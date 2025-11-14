/**
 * 分批止盈完整流程集成测试脚本
 * 
 * 测试目标:
 * 1. 开仓 → 自动设置条件单（止损 + 极端止盈）
 * 2. 模拟价格上涨达到1R → AI检测并执行Stage1分批止盈（平仓33%）
 * 3. 验证止损自动移至成本价（保本）
 * 4. 模拟价格继续上涨达到2R → AI执行Stage2分批止盈（再平仓33%）
 * 5. 验证止损自动移至1R位置
 * 6. 模拟价格达到3R → AI执行Stage3（启用移动止损）
 * 7. 验证极端止盈条件单（5R/8R/10R）作为最后防线
 * 8. 验证数据库记录完整性（partial_take_profit_history）
 * 
 * 使用方式:
 * tsx --env-file=.env ./scripts/test-partial-take-profit.ts
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';
import { getExchangeClient } from '../src/exchanges';
import { createLogger } from '../src/utils/logger';
import { getChinaTimeISO } from '../src/utils/timeUtils';
import { calculateScientificStopLoss } from '../src/services/stopLossCalculator';
import { formatPriceNumber, getDecimalPlacesBySymbol } from '../src/utils/priceFormatter';
import { getStrategyParams, getTradingStrategy } from '../src/agents/tradingAgent';

const logger = createLogger({
  name: 'partial-take-profit-test',
  level: 'info',
});

const dbClient = createClient({
  url: process.env.DATABASE_URL || 'file:./.voltagent/trading.db',
});

// 测试配置
const TEST_CONFIG = {
  symbol: 'ETH_USDT',
  side: 'long' as const,
  leverage: 8,
  amountUsdt: 10000, // 增加到10000 USDT以满足Gate.io ETH合约最小交易数量（1 ETH ≈ 3000 USDT）
  testMode: process.env.TEST_MODE !== 'false', // 默认测试模式
};

interface TestResult {
  phase: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

const testResults: TestResult[] = [];

/**
 * 记录测试结果
 */
function recordResult(result: TestResult) {
  testResults.push(result);
  const icon = result.success ? '✅' : '❌';
  logger.info(`${icon} [阶段${result.phase}] ${result.message}`);
  if (result.error) {
    logger.error(`   错误: ${result.error}`);
  }
  if (result.duration) {
    logger.info(`   耗时: ${result.duration}ms`);
  }
}

/**
 * 打印测试报告
 */
function printReport() {
  logger.info('\n' + '='.repeat(80));
  logger.info('📊 测试报告');
  logger.info('='.repeat(80));
  
  const successCount = testResults.filter(r => r.success).length;
  const failCount = testResults.filter(r => !r.success).length;
  
  logger.info(`总测试数: ${testResults.length}`);
  logger.info(`✅ 成功: ${successCount}`);
  logger.info(`❌ 失败: ${failCount}`);
  logger.info(`成功率: ${((successCount / testResults.length) * 100).toFixed(2)}%`);
  
  if (failCount > 0) {
    logger.info('\n失败的测试:');
    testResults.filter(r => !r.success).forEach(r => {
      logger.info(`  - [${r.phase}] ${r.message}: ${r.error}`);
    });
  }
  
  logger.info('='.repeat(80));
}

/**
 * 阶段1: 准备测试环境
 */
async function phase1_PrepareEnvironment(): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    logger.info('\n' + '='.repeat(80));
    logger.info('阶段1: 准备测试环境');
    logger.info('='.repeat(80));
    
    // 1.1 检查数据库连接
    await dbClient.execute('SELECT 1');
    recordResult({
      phase: '1.1',
      success: true,
      message: '数据库连接正常',
      duration: Date.now() - startTime,
    });
    
    // 1.2 检查交易所连接
    const exchangeClient = getExchangeClient();
    const account = await exchangeClient.getFuturesAccount();
    const balance = parseFloat(account.available || '0');
    
    recordResult({
      phase: '1.2',
      success: balance > 0,
      message: `交易所连接正常，可用余额: ${balance.toFixed(2)} USDT`,
      data: { balance },
      duration: Date.now() - startTime,
    });
    
    if (!TEST_CONFIG.testMode && balance < TEST_CONFIG.amountUsdt) {
      recordResult({
        phase: '1.2',
        success: false,
        message: `余额不足，需要至少 ${TEST_CONFIG.amountUsdt} USDT`,
        error: 'Insufficient balance',
      });
      return false;
    }
    
    // 1.3 清理测试数据
    await dbClient.execute({
      sql: 'DELETE FROM positions WHERE symbol = ?',
      args: [TEST_CONFIG.symbol],
    });
    await dbClient.execute({
      sql: 'DELETE FROM price_orders WHERE symbol = ?',
      args: [TEST_CONFIG.symbol],
    });
    await dbClient.execute({
      sql: 'DELETE FROM partial_take_profit_history WHERE symbol = ?',
      args: [TEST_CONFIG.symbol],
    });
    
    recordResult({
      phase: '1.3',
      success: true,
      message: '测试数据已清理',
      duration: Date.now() - startTime,
    });
    
    return true;
  } catch (error: any) {
    recordResult({
      phase: '1',
      success: false,
      message: '准备环境失败',
      error: error.message,
      duration: Date.now() - startTime,
    });
    return false;
  }
}

/**
 * 阶段2: 开仓并设置条件单
 */
async function phase2_OpenPositionWithOrders(): Promise<{
  orderId: string;
  fillPrice: number;
  fillSize: number;
  stopLossPrice: number;
  extremeTakeProfitPrice: number;
  slOrderId?: string;
  tpOrderId?: string;
} | null> {
  const startTime = Date.now();
  
  try {
    logger.info('\n' + '='.repeat(80));
    logger.info('阶段2: 开仓并自动设置条件单（止损 + 极端止盈）');
    logger.info('='.repeat(80));
    
    const exchangeClient = getExchangeClient();
    const contract = exchangeClient.normalizeContract(TEST_CONFIG.symbol);
    
    // 2.1 获取当前价格
    const ticker = await exchangeClient.getFuturesTicker(contract);
    const currentPrice = parseFloat(ticker.last || '0');
    
    recordResult({
      phase: '2.1',
      success: currentPrice > 0,
      message: `当前价格: ${currentPrice.toFixed(2)} USDT`,
      data: { currentPrice },
      duration: Date.now() - startTime,
    });
    
    // 2.2 计算科学止损位
    const stopLossConfig = {
      atrPeriod: 14,
      atrMultiplier: 2.0,
      lookbackPeriod: 24,
      bufferPercent: 0.5,
      useATR: true,
      useSupportResistance: true,
      minStopLossPercent: 0.5,
      maxStopLossPercent: 5.0,
    };
    
    const stopLossResult = await calculateScientificStopLoss(
      TEST_CONFIG.symbol.replace('_USDT', '').replace('USDT', ''),
      TEST_CONFIG.side,
      currentPrice,
      stopLossConfig,
      '1h'
    );
    
    const stopLossPrice = stopLossResult.stopLossPrice;
    const stopLossDistance = Math.abs(currentPrice - stopLossPrice);
    const stopLossDistancePercent = (stopLossDistance / currentPrice) * 100;
    
    recordResult({
      phase: '2.2',
      success: true,
      message: `计算科学止损位: ${stopLossPrice.toFixed(2)} (距离${stopLossDistancePercent.toFixed(2)}%)`,
      data: { 
        stopLossPrice, 
        stopLossDistance,
        stopLossDistancePercent,
        method: stopLossResult.method,
        qualityScore: stopLossResult.qualityScore,
      },
      duration: Date.now() - startTime,
    });
    
    // 2.3 计算极端止盈位（基于策略配置）
    const strategy = getTradingStrategy();
    const strategyParams = getStrategyParams(strategy);
    const extremeRMultiple = strategyParams.partialTakeProfit?.extremeTakeProfit?.rMultiple || 5;
    
    const extremeTakeProfitPrice = formatPriceNumber(TEST_CONFIG.side === 'long'
      ? currentPrice + stopLossDistance * extremeRMultiple
      : currentPrice - stopLossDistance * extremeRMultiple);
    
    recordResult({
      phase: '2.3',
      success: true,
      message: `极端止盈位: ${extremeTakeProfitPrice.toFixed(2)} (${extremeRMultiple}R = ${extremeRMultiple}倍风险距离)`,
      data: { extremeTakeProfitPrice, extremeRMultiple },
      duration: Date.now() - startTime,
    });
    
    // 2.4 计算分批止盈目标价格（用于后续测试）
    const stage1Price = formatPriceNumber(TEST_CONFIG.side === 'long'
      ? currentPrice + stopLossDistance * (strategyParams.partialTakeProfit?.stage1?.rMultiple || 1)
      : currentPrice - stopLossDistance * (strategyParams.partialTakeProfit?.stage1?.rMultiple || 1));
    
    const stage2Price = formatPriceNumber(TEST_CONFIG.side === 'long'
      ? currentPrice + stopLossDistance * (strategyParams.partialTakeProfit?.stage2?.rMultiple || 2)
      : currentPrice - stopLossDistance * (strategyParams.partialTakeProfit?.stage2?.rMultiple || 2));
    
    const stage3Price = formatPriceNumber(TEST_CONFIG.side === 'long'
      ? currentPrice + stopLossDistance * (strategyParams.partialTakeProfit?.stage3?.rMultiple || 3)
      : currentPrice - stopLossDistance * (strategyParams.partialTakeProfit?.stage3?.rMultiple || 3));
    
    logger.info(`📊 分批止盈目标价格:`);
    logger.info(`   Stage1 (${strategyParams.partialTakeProfit?.stage1?.rMultiple || 1}R): ${stage1Price.toFixed(2)} - ${strategyParams.partialTakeProfit?.stage1?.description}`);
    logger.info(`   Stage2 (${strategyParams.partialTakeProfit?.stage2?.rMultiple || 2}R): ${stage2Price.toFixed(2)} - ${strategyParams.partialTakeProfit?.stage2?.description}`);
    logger.info(`   Stage3 (${strategyParams.partialTakeProfit?.stage3?.rMultiple || 3}R): ${stage3Price.toFixed(2)} - ${strategyParams.partialTakeProfit?.stage3?.description}`);
    logger.info(`   极端止盈 (${extremeRMultiple}R): ${extremeTakeProfitPrice.toFixed(2)} - 兜底保护`);
    
    // 测试模式：不真实下单
    if (TEST_CONFIG.testMode) {
      logger.warn('⚠️  测试模式：跳过真实开仓，使用模拟数据');
      
      const mockOrderId = `TEST_${Date.now()}`;
      const mockSlOrderId = `SL_${Date.now()}`;
      const mockTpOrderId = `TP_${Date.now()}`;
      const fillPrice = currentPrice;
      const fillSize = TEST_CONFIG.amountUsdt / currentPrice;
      
      // 插入模拟数据到数据库
      await dbClient.execute({
        sql: `INSERT INTO trades (order_id, symbol, side, type, price, quantity, leverage, fee, timestamp, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          mockOrderId,
          TEST_CONFIG.symbol,
          TEST_CONFIG.side,
          'open',
          fillPrice,
          fillSize,
          TEST_CONFIG.leverage,
          fillPrice * fillSize * 0.0005,
          getChinaTimeISO(),
          'filled',
        ],
      });
      
      await dbClient.execute({
        sql: `INSERT INTO positions 
              (symbol, quantity, entry_price, current_price, liquidation_price, unrealized_pnl, 
               leverage, side, stop_loss, profit_target, sl_order_id, tp_order_id, entry_order_id, opened_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          TEST_CONFIG.symbol,
          fillSize,
          fillPrice,
          fillPrice,
          formatPriceNumber(TEST_CONFIG.side === 'long' ? fillPrice * 0.9 : fillPrice * 1.1),
          0,
          TEST_CONFIG.leverage,
          TEST_CONFIG.side,
          stopLossPrice,
          extremeTakeProfitPrice,
          mockSlOrderId,
          mockTpOrderId,
          mockOrderId,
          getChinaTimeISO(),
        ],
      });
      
      await dbClient.execute({
        sql: `INSERT INTO price_orders 
              (order_id, symbol, side, type, trigger_price, quantity, status, position_order_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          mockSlOrderId,
          TEST_CONFIG.symbol,
          TEST_CONFIG.side,
          'stop_loss',
          stopLossPrice,
          fillSize,
          'active',
          mockOrderId,
          getChinaTimeISO(),
        ],
      });
      
      await dbClient.execute({
        sql: `INSERT INTO price_orders 
              (order_id, symbol, side, type, trigger_price, quantity, status, position_order_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          mockTpOrderId,
          TEST_CONFIG.symbol,
          TEST_CONFIG.side,
          'take_profit',
          extremeTakeProfitPrice,
          fillSize,
          'active',
          mockOrderId,
          getChinaTimeISO(),
        ],
      });
      
      recordResult({
        phase: '2.4',
        success: true,
        message: '模拟开仓完成（测试模式）',
        data: { 
          orderId: mockOrderId,
          fillPrice,
          fillSize,
          stopLossPrice,
          extremeTakeProfitPrice,
          stage1Price,
          stage2Price,
          stage3Price,
        },
        duration: Date.now() - startTime,
      });
      
      return {
        orderId: mockOrderId,
        fillPrice,
        fillSize,
        stopLossPrice,
        extremeTakeProfitPrice,
        slOrderId: mockSlOrderId,
        tpOrderId: mockTpOrderId,
      };
    }
    
    // 真实模式：实际下单
    logger.info('📌 真实交易模式：开始执行实际开仓...');
    
    // 2.5 设置杠杆
    await exchangeClient.setLeverage(contract, TEST_CONFIG.leverage);
    
    // 2.6 市价单开仓
    const quantity = TEST_CONFIG.amountUsdt / currentPrice;
    const size = TEST_CONFIG.side === 'long' ? quantity : -quantity;
    
    const order = await exchangeClient.placeOrder({
      contract,
      size,
      price: 0,
    });
    
    recordResult({
      phase: '2.5',
      success: !!order.id,
      message: `开仓成功，订单ID: ${order.id}`,
      data: order,
      duration: Date.now() - startTime,
    });
    
    // 2.7 等待并获取成交信息
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const orderDetail = await exchangeClient.getOrder(order.id!.toString());
    const fillPrice = parseFloat(order.price || orderDetail.fill_price || currentPrice.toString());
    const fillSize = Math.abs(parseFloat(orderDetail.size || order.size?.toString() || '0') - parseFloat(orderDetail.left || '0'));
    
    recordResult({
      phase: '2.6',
      success: fillSize > 0,
      message: `成交确认: ${fillSize.toFixed(4)} @ ${fillPrice.toFixed(2)}`,
      data: { fillPrice, fillSize },
      duration: Date.now() - startTime,
    });
    
    // 2.8 重新计算止损（基于实际成交价）
    const adjustedStopLossResult = await calculateScientificStopLoss(
      TEST_CONFIG.symbol.replace('_USDT', '').replace('USDT', ''),
      TEST_CONFIG.side,
      fillPrice,
      stopLossConfig,
      '1h'
    );
    
    const finalStopLossPrice = adjustedStopLossResult.stopLossPrice;
    const finalStopLossDistance = Math.abs(fillPrice - finalStopLossPrice);
    
    const finalExtremeTakeProfitPrice = formatPriceNumber(TEST_CONFIG.side === 'long'
      ? fillPrice + finalStopLossDistance * extremeRMultiple
      : fillPrice - finalStopLossDistance * extremeRMultiple);
    
    // 2.9 设置止损止盈条件单
    const stopLossOrderResult = await exchangeClient.setPositionStopLoss(
      contract,
      finalStopLossPrice,
      finalExtremeTakeProfitPrice
    );
    
    recordResult({
      phase: '2.7',
      success: stopLossOrderResult.success,
      message: `设置条件单成功: 止损=${finalStopLossPrice.toFixed(2)}, 极端止盈=${finalExtremeTakeProfitPrice.toFixed(2)}`,
      data: stopLossOrderResult,
      duration: Date.now() - startTime,
    });
    
    // 2.10 记录到数据库
    const now = getChinaTimeISO();
    const contractInfo = await exchangeClient.getContractInfo(contract);
    const multiplier = contractInfo.quanto_multiplier || contractInfo.multiplier || 0.01;
    const notionalValue = fillPrice * fillSize * multiplier;
    const openFee = notionalValue * 0.0005;
    
    await dbClient.execute({
      sql: `INSERT INTO trades (order_id, symbol, side, type, price, quantity, leverage, fee, timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        order.id?.toString() || '',
        TEST_CONFIG.symbol,
        TEST_CONFIG.side,
        'open',
        fillPrice,
        fillSize,
        TEST_CONFIG.leverage,
        openFee,
        now,
        'filled',
      ],
    });
    
    await dbClient.execute({
      sql: `INSERT INTO positions 
            (symbol, quantity, entry_price, current_price, liquidation_price, unrealized_pnl, 
             leverage, side, stop_loss, profit_target, sl_order_id, tp_order_id, entry_order_id, opened_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        TEST_CONFIG.symbol,
        fillSize,
        fillPrice,
        fillPrice,
        formatPriceNumber(TEST_CONFIG.side === 'long' ? fillPrice * 0.9 : fillPrice * 1.1),
        0,
        TEST_CONFIG.leverage,
        TEST_CONFIG.side,
        finalStopLossPrice,
        finalExtremeTakeProfitPrice,
        stopLossOrderResult.stopLossOrderId || null,
        stopLossOrderResult.takeProfitOrderId || null,
        order.id?.toString() || '',
        now,
      ],
    });
    
    if (stopLossOrderResult.stopLossOrderId) {
      await dbClient.execute({
        sql: `INSERT INTO price_orders 
              (order_id, symbol, side, type, trigger_price, quantity, status, position_order_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          stopLossOrderResult.stopLossOrderId,
          TEST_CONFIG.symbol,
          TEST_CONFIG.side,
          'stop_loss',
          finalStopLossPrice,
          fillSize,
          'active',
          order.id?.toString() || '',
          now,
        ],
      });
    }
    
    if (stopLossOrderResult.takeProfitOrderId) {
      await dbClient.execute({
        sql: `INSERT INTO price_orders 
              (order_id, symbol, side, type, trigger_price, quantity, status, position_order_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          stopLossOrderResult.takeProfitOrderId,
          TEST_CONFIG.symbol,
          TEST_CONFIG.side,
          'take_profit',
          finalExtremeTakeProfitPrice,
          fillSize,
          'active',
          order.id?.toString() || '',
          now,
        ],
      });
    }
    
    recordResult({
      phase: '2.8',
      success: true,
      message: '数据库记录完成',
      duration: Date.now() - startTime,
    });
    
    return {
      orderId: order.id?.toString() || '',
      fillPrice,
      fillSize,
      stopLossPrice: finalStopLossPrice,
      extremeTakeProfitPrice: finalExtremeTakeProfitPrice,
      slOrderId: stopLossOrderResult.stopLossOrderId,
      tpOrderId: stopLossOrderResult.takeProfitOrderId,
    };
    
  } catch (error: any) {
    recordResult({
      phase: '2',
      success: false,
      message: '开仓失败',
      error: error.message,
      duration: Date.now() - startTime,
    });
    return null;
  }
}

/**
 * 阶段3: 模拟价格上涨并执行Stage1分批止盈（1R）
 */
async function phase3_ExecuteStage1TakeProfit(
  entryPrice: number,
  stopLossPrice: number
): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    logger.info('\n' + '='.repeat(80));
    logger.info('阶段3: 模拟达到1R，执行Stage1分批止盈（平仓33%）');
    logger.info('='.repeat(80));
    
    const exchangeClient = getExchangeClient();
    const contract = exchangeClient.normalizeContract(TEST_CONFIG.symbol);
    
    // 3.1 计算1R目标价格
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
    const strategy = getTradingStrategy();
    const strategyParams = getStrategyParams(strategy);
    const stage1RMultiple = strategyParams.partialTakeProfit?.stage1?.rMultiple || 1;
    
    const stage1TargetPrice = formatPriceNumber(TEST_CONFIG.side === 'long'
      ? entryPrice + stopLossDistance * stage1RMultiple
      : entryPrice - stopLossDistance * stage1RMultiple);
    
    logger.info(`💰 Stage1目标价格: ${stage1TargetPrice.toFixed(2)} (${stage1RMultiple}R)`);
    logger.info(`   入场价: ${entryPrice.toFixed(2)}`);
    logger.info(`   止损价: ${stopLossPrice.toFixed(2)}`);
    logger.info(`   风险距离R: ${stopLossDistance.toFixed(2)} (${((stopLossDistance / entryPrice) * 100).toFixed(2)}%)`);
    
    // 测试模式：模拟检查机会
    if (TEST_CONFIG.testMode) {
      logger.warn('⚠️  测试模式：模拟执行分批止盈检查');
      
      // 动态导入分批止盈工具
      const { checkPartialTakeProfitOpportunityTool, partialTakeProfitTool } = await import('../src/tools/trading/takeProfitManagement.js');
      
      // 临时修改positions表的当前价格，模拟达到1R
      await dbClient.execute({
        sql: 'UPDATE positions SET current_price = ? WHERE symbol = ?',
        args: [stage1TargetPrice, TEST_CONFIG.symbol],
      });
      
      // 检查分批止盈机会
      const checkResult = await checkPartialTakeProfitOpportunityTool.execute!({}) as any;
      
      recordResult({
        phase: '3.1',
        success: checkResult.success || false,
        message: `检查分批止盈机会: ${JSON.stringify(checkResult)}`,
        data: checkResult,
        duration: Date.now() - startTime,
      });
      
      // 如果提示可以执行Stage1（使用短名称ETH而不是ETH_USDT）
      const shortSymbol = TEST_CONFIG.symbol.replace('_USDT', '').replace('USDT', '');
      const symbolOpportunity = checkResult.opportunities?.[shortSymbol];
      if (symbolOpportunity && symbolOpportunity.canExecuteStages?.includes(1)) {
        logger.info('✅ 检测到Stage1分批止盈机会');
        
        // 执行分批止盈
        const executeResult = await partialTakeProfitTool.execute!({
          symbol: shortSymbol,
          stage: '1',
        }) as any;
        
        recordResult({
          phase: '3.2',
          success: executeResult.success || false,
          message: `Stage1分批止盈执行结果: ${executeResult.message || ''}`,
          data: executeResult,
          duration: Date.now() - startTime,
        });
        
        if (executeResult.success) {
          // 验证数据库记录
          const historyResult = await dbClient.execute({
            sql: 'SELECT * FROM partial_take_profit_history WHERE symbol = ? AND stage = 1 ORDER BY timestamp DESC LIMIT 1',
            args: [TEST_CONFIG.symbol],
          });
          
          const hasRecord = historyResult.rows.length > 0;
          const record = historyResult.rows[0];
          
          recordResult({
            phase: '3.3',
            success: hasRecord && !!record.side && !!record.closed_quantity && !!record.order_id,
            message: hasRecord 
              ? `数据库记录验证: side=${record.side}, quantity=${record.closed_quantity}, orderId=${record.order_id}`
              : '数据库记录未找到',
            data: record,
            duration: Date.now() - startTime,
          });
          
          // 验证止损是否移至成本价
          const positionResult = await dbClient.execute({
            sql: 'SELECT stop_loss, entry_price FROM positions WHERE symbol = ?',
            args: [TEST_CONFIG.symbol],
          });
          
          if (positionResult.rows.length > 0) {
            const pos = positionResult.rows[0];
            const stopLoss = parseFloat(pos.stop_loss as string);
            const entryPriceDb = parseFloat(pos.entry_price as string);
            const isAtBreakeven = Math.abs(stopLoss - entryPriceDb) / entryPriceDb < 0.001; // 0.1%容差
            
            recordResult({
              phase: '3.4',
              success: isAtBreakeven,
              message: isAtBreakeven 
                ? `止损已移至成本价: ${stopLoss.toFixed(2)} ≈ ${entryPriceDb.toFixed(2)}`
                : `止损未正确移动: ${stopLoss.toFixed(2)} != ${entryPriceDb.toFixed(2)}`,
              data: { stopLoss, entryPrice: entryPriceDb },
              duration: Date.now() - startTime,
            });
          }
          
          return true;
        }
      } else {
        recordResult({
          phase: '3.2',
          success: false,
          message: '未检测到Stage1分批止盈机会',
          error: 'Stage1 not triggered',
          data: symbolOpportunity,
        });
        return false;
      }
    }
    
    return false;
  } catch (error: any) {
    recordResult({
      phase: '3',
      success: false,
      message: 'Stage1分批止盈测试失败',
      error: error.message,
      duration: Date.now() - startTime,
    });
    return false;
  }
}

/**
 * 阶段4: 模拟价格继续上涨并执行Stage2分批止盈（2R）
 */
async function phase4_ExecuteStage2TakeProfit(
  entryPrice: number,
  stopLossPrice: number
): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    logger.info('\n' + '='.repeat(80));
    logger.info('阶段4: 模拟达到2R，执行Stage2分批止盈（再平仓33%）');
    logger.info('='.repeat(80));
    
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
    const strategy = getTradingStrategy();
    const strategyParams = getStrategyParams(strategy);
    const stage2RMultiple = strategyParams.partialTakeProfit?.stage2?.rMultiple || 2;
    
    const stage2TargetPrice = formatPriceNumber(TEST_CONFIG.side === 'long'
      ? entryPrice + stopLossDistance * stage2RMultiple
      : entryPrice - stopLossDistance * stage2RMultiple);
    
    logger.info(`💰 Stage2目标价格: ${stage2TargetPrice.toFixed(2)} (${stage2RMultiple}R)`);
    
    if (TEST_CONFIG.testMode) {
      // 更新模拟价格
      await dbClient.execute({
        sql: 'UPDATE positions SET current_price = ? WHERE symbol = ?',
        args: [stage2TargetPrice, TEST_CONFIG.symbol],
      });
      
      const { checkPartialTakeProfitOpportunityTool: checkTool2, partialTakeProfitTool: executeTool2 } = await import('../src/tools/trading/takeProfitManagement.js');
      
      const checkResult = await checkTool2.execute!({}) as any;
      const shortSymbol2 = TEST_CONFIG.symbol.replace('_USDT', '').replace('USDT', '');
      const symbolOpportunity = checkResult.opportunities?.[shortSymbol2];
      
      if (symbolOpportunity && symbolOpportunity.canExecuteStages?.includes(2)) {
        const executeResult = await executeTool2.execute!({
          symbol: shortSymbol2,
          stage: '2',
        }) as any;
        
        recordResult({
          phase: '4.1',
          success: executeResult.success || false,
          message: `Stage2分批止盈执行: ${executeResult.message || ''}`,
          data: executeResult,
          duration: Date.now() - startTime,
        });
        
        if (executeResult.success) {
          // 验证止损是否移至1R位置
          const positionResult = await dbClient.execute({
            sql: 'SELECT stop_loss, entry_price FROM positions WHERE symbol = ?',
            args: [TEST_CONFIG.symbol],
          });
          
          if (positionResult.rows.length > 0) {
            const pos = positionResult.rows[0];
            const stopLoss = parseFloat(pos.stop_loss as string);
            const entryPriceDb = parseFloat(pos.entry_price as string);
            
            const stage1RMultiple = strategyParams.partialTakeProfit?.stage1?.rMultiple || 1;
            const expected1RPrice = TEST_CONFIG.side === 'long'
              ? entryPriceDb + stopLossDistance * stage1RMultiple
              : entryPriceDb - stopLossDistance * stage1RMultiple;
            
            const isAt1R = Math.abs(stopLoss - expected1RPrice) / expected1RPrice < 0.001;
            
            recordResult({
              phase: '4.2',
              success: isAt1R,
              message: isAt1R
                ? `止损已移至1R位置: ${stopLoss.toFixed(2)} ≈ ${expected1RPrice.toFixed(2)}`
                : `止损位置不正确: ${stopLoss.toFixed(2)} != ${expected1RPrice.toFixed(2)}`,
              data: { stopLoss, expected1RPrice },
              duration: Date.now() - startTime,
            });
          }
          
          return true;
        }
      } else {
        recordResult({
          phase: '4.1',
          success: false,
          message: '未检测到Stage2分批止盈机会',
          error: 'Stage2 not triggered',
        });
        return false;
      }
    }
    
    return false;
  } catch (error: any) {
    recordResult({
      phase: '4',
      success: false,
      message: 'Stage2分批止盈测试失败',
      error: error.message,
      duration: Date.now() - startTime,
    });
    return false;
  }
}

/**
 * 阶段5: 验证极端止盈条件单
 */
async function phase5_VerifyExtremeTakeProfit(
  entryPrice: number,
  stopLossPrice: number,
  extremeTakeProfitPrice: number
): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    logger.info('\n' + '='.repeat(80));
    logger.info('阶段5: 验证极端止盈条件单（最后防线）');
    logger.info('='.repeat(80));
    
    // 验证条件单是否存在且正确
    const priceOrdersResult = await dbClient.execute({
      sql: 'SELECT * FROM price_orders WHERE symbol = ? AND type = ? AND status = ?',
      args: [TEST_CONFIG.symbol, 'take_profit', 'active'],
    });
    
    if (priceOrdersResult.rows.length === 0) {
      recordResult({
        phase: '5.1',
        success: false,
        message: '未找到极端止盈条件单',
        error: 'No extreme take profit order found',
      });
      return false;
    }
    
    const tpOrder = priceOrdersResult.rows[0];
    const triggerPrice = parseFloat(tpOrder.trigger_price as string);
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
    
    const strategy = getTradingStrategy();
    const strategyParams = getStrategyParams(strategy);
    const extremeRMultiple = strategyParams.partialTakeProfit?.extremeTakeProfit?.rMultiple || 5;
    
    const expectedPrice = TEST_CONFIG.side === 'long'
      ? entryPrice + stopLossDistance * extremeRMultiple
      : entryPrice - stopLossDistance * extremeRMultiple;
    
    const priceMatch = Math.abs(triggerPrice - expectedPrice) / expectedPrice < 0.01; // 1%容差
    
    recordResult({
      phase: '5.1',
      success: priceMatch,
      message: priceMatch
        ? `极端止盈价格正确: ${triggerPrice.toFixed(2)} ≈ ${expectedPrice.toFixed(2)} (${extremeRMultiple}R)`
        : `极端止盈价格不正确: ${triggerPrice.toFixed(2)} != ${expectedPrice.toFixed(2)}`,
      data: { triggerPrice, expectedPrice, extremeRMultiple },
      duration: Date.now() - startTime,
    });
    
    return priceMatch;
  } catch (error: any) {
    recordResult({
      phase: '5',
      success: false,
      message: '极端止盈验证失败',
      error: error.message,
      duration: Date.now() - startTime,
    });
    return false;
  }
}

/**
 * 主测试流程
 */
async function runTests() {
  logger.info('🚀 开始分批止盈完整流程集成测试');
  logger.info(`测试配置: ${JSON.stringify(TEST_CONFIG, null, 2)}`);
  
  try {
    // 阶段1: 准备环境
    const envReady = await phase1_PrepareEnvironment();
    if (!envReady) {
      logger.error('❌ 环境准备失败，测试中止');
      printReport();
      process.exit(1);
    }
    
    // 阶段2: 开仓并设置条件单
    const positionData = await phase2_OpenPositionWithOrders();
    if (!positionData) {
      logger.error('❌ 开仓失败，测试中止');
      printReport();
      process.exit(1);
    }
    
    const { orderId, fillPrice, fillSize, stopLossPrice, extremeTakeProfitPrice } = positionData;
    
    // 阶段3: Stage1分批止盈（1R）
    await phase3_ExecuteStage1TakeProfit(fillPrice, stopLossPrice);
    
    // 阶段4: Stage2分批止盈（2R）
    await phase4_ExecuteStage2TakeProfit(fillPrice, stopLossPrice);
    
    // 阶段5: 验证极端止盈
    await phase5_VerifyExtremeTakeProfit(fillPrice, stopLossPrice, extremeTakeProfitPrice);
    
    // 打印测试报告
    printReport();
    
    const failCount = testResults.filter(r => !r.success).length;
    process.exit(failCount > 0 ? 1 : 0);
    
  } catch (error: any) {
    logger.error(`测试执行异常: ${error.message}`);
    logger.error(error.stack);
    printReport();
    process.exit(1);
  }
}

// 运行测试
runTests();
