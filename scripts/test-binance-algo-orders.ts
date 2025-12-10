/**
 * 测试脚本：验证币安U本位合约条件单(Algo Order)的创建和删除
 * 
 * 根据币安官方文档：
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/trade/rest-api/New-Algo-Order
 * 
 * 使用方法：
 * npx tsx scripts/test-binance-algo-orders.ts
 */

import { BinanceExchangeClient } from '../src/exchanges/BinanceExchangeClient';
import { createLogger } from '../src/utils/logger';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const logger = createLogger({ name: 'test-algo-orders', level: 'info' });

interface TestResult {
  testName: string;
  success: boolean;
  error?: string;
  requestPayload?: any;
  response?: any;
}

const results: TestResult[] = [];

async function testAlgoOrders() {
  logger.info('🚀 开始测试币安条件单(Algo Order)创建');
  
  // 初始化客户端
  const config = {
    exchangeName: 'binance' as const,
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    isTestnet: process.env.BINANCE_USE_TESTNET === 'true'
  };
  
  if (!config.apiKey || !config.apiSecret) {
    logger.error('❌ 缺少API密钥，请在.env文件中配置');
    return;
  }
  
  const client = new BinanceExchangeClient(config);
  
  logger.info(`📡 使用${config.isTestnet ? '测试网' : '正式网'}`);
  
  // 测试用参数
  const testSymbol = 'ETHUSDT';
  const testQuantity = '0.001'; // 很小的数量用于测试
  
  try {
    // 1. 获取当前价格
    logger.info(`\n📊 步骤1: 获取${testSymbol}当前价格...`);
    const ticker = await client.getFuturesTicker(testSymbol);
    const currentPrice = parseFloat(ticker.markPrice || ticker.last);
    logger.info(`   当前价格: ${currentPrice}`);
    
    // 2. 测试条件单创建（使用正确的 Algo Order API）
    logger.info('\n🧪 步骤2: 测试条件单创建（Algo Order API - CONDITIONAL）');
    logger.info('   根据币安官方文档，条件单必须使用 algoType="CONDITIONAL"');
    
    // 测试1: CONDITIONAL + STOP_MARKET (市价止损)
    await test1_StopMarket(client, testSymbol, testQuantity, currentPrice);
    
    // 测试2: CONDITIONAL + TAKE_PROFIT_MARKET (市价止盈)
    await test2_TakeProfitMarket(client, testSymbol, testQuantity, currentPrice);
    
    // 测试3: CONDITIONAL + STOP_MARKET + closePosition
    await test3_StopMarketWithClosePosition(client, testSymbol, currentPrice);
    
    // 测试4: CONDITIONAL + STOP (限价止损)
    await test4_StopLimit(client, testSymbol, testQuantity, currentPrice);
    
    // 测试5: 查询条件单
    await test5_QueryAlgoOrders(client, testSymbol);
    
    // 3. 打印测试结果摘要
    printTestSummary();
    
  } catch (error: any) {
    logger.error('测试过程中发生错误:', error);
  }
}

/**
 * 测试1: CONDITIONAL + STOP_MARKET (市价止损单)
 */
async function test1_StopMarket(
  client: any,
  symbol: string,
  quantity: string,
  currentPrice: number
) {
  const testName = '测试1: CONDITIONAL + STOP_MARKET (市价止损)';
  logger.info(`\n   ${testName}`);
  
  const triggerPrice = (currentPrice * 0.95).toFixed(2); // 止损价格在当前价-5%
  
  // 根据官方文档的正确参数
  const payload = {
    algoType: 'CONDITIONAL',      // 必须是 CONDITIONAL
    symbol,
    side: 'SELL',                 // 平多单用 SELL
    type: 'STOP_MARKET',          // 市价止损
    quantity,
    triggerPrice,                 // 使用 triggerPrice（不是 stopPrice）
    workingType: 'MARK_PRICE',    // 使用标记价格触发
    priceProtect: 'true',         // 触发保护
    reduceOnly: 'true'            // 只减仓
  };
  
  logger.info('   请求payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await (client as any).privateRequest('/fapi/v1/algoOrder', payload, 'POST', 1);
    logger.info('   ✅ 成功! 响应:', JSON.stringify(response, null, 2));
    
    results.push({
      testName,
      success: true,
      requestPayload: payload,
      response
    });
    
    // 立即取消订单
    if (response.algoId) {
      await cancelAlgoOrder(client, symbol, response.algoId);
    }
    
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    logger.error(`   ❌ 失败: ${errorMsg}`);
    
    results.push({
      testName,
      success: false,
      error: errorMsg,
      requestPayload: payload
    });
  }
}

/**
 * 测试2: CONDITIONAL + TAKE_PROFIT_MARKET (市价止盈单)
 */
async function test2_TakeProfitMarket(
  client: any,
  symbol: string,
  quantity: string,
  currentPrice: number
) {
  const testName = '测试2: CONDITIONAL + TAKE_PROFIT_MARKET (市价止盈)';
  logger.info(`\n   ${testName}`);
  
  const triggerPrice = (currentPrice * 1.05).toFixed(2); // 止盈价格在当前价+5%
  
  const payload = {
    algoType: 'CONDITIONAL',
    symbol,
    side: 'SELL',
    type: 'TAKE_PROFIT_MARKET',
    quantity,
    triggerPrice,
    workingType: 'MARK_PRICE',
    priceProtect: 'true',
    reduceOnly: 'true'
  };
  
  logger.info('   请求payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await (client as any).privateRequest('/fapi/v1/algoOrder', payload, 'POST', 1);
    logger.info('   ✅ 成功! 响应:', JSON.stringify(response, null, 2));
    
    results.push({
      testName,
      success: true,
      requestPayload: payload,
      response
    });
    
    if (response.algoId) {
      await cancelAlgoOrder(client, symbol, response.algoId);
    }
    
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    logger.error(`   ❌ 失败: ${errorMsg}`);
    
    results.push({
      testName,
      success: false,
      error: errorMsg,
      requestPayload: payload
    });
  }
}

/**
 * 测试3: CONDITIONAL + STOP_MARKET + closePosition
 */
async function test3_StopMarketWithClosePosition(
  client: any,
  symbol: string,
  currentPrice: number
) {
  const testName = '测试3: CONDITIONAL + STOP_MARKET + closePosition';
  logger.info(`\n   ${testName}`);
  
  const triggerPrice = (currentPrice * 0.95).toFixed(2);
  
  const payload = {
    algoType: 'CONDITIONAL',
    symbol,
    side: 'SELL',
    type: 'STOP_MARKET',
    triggerPrice,
    workingType: 'MARK_PRICE',
    priceProtect: 'true',
    closePosition: 'true'  // 触发后全部平仓
  };
  
  logger.info('   请求payload:', JSON.stringify(payload, null, 2));
  logger.info('   💡 使用 closePosition=true，触发后自动平掉所有持仓');
  
  try {
    const response = await (client as any).privateRequest('/fapi/v1/algoOrder', payload, 'POST', 1);
    logger.info('   ✅ 成功! 响应:', JSON.stringify(response, null, 2));
    
    results.push({
      testName,
      success: true,
      requestPayload: payload,
      response
    });
    
    if (response.algoId) {
      await cancelAlgoOrder(client, symbol, response.algoId);
    }
    
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    logger.error(`   ❌ 失败: ${errorMsg}`);
    
    results.push({
      testName,
      success: false,
      error: errorMsg,
      requestPayload: payload
    });
  }
}

/**
 * 测试4: CONDITIONAL + STOP (限价止损单)
 */
async function test4_StopLimit(
  client: any,
  symbol: string,
  quantity: string,
  currentPrice: number
) {
  const testName = '测试4: CONDITIONAL + STOP (限价止损)';
  logger.info(`\n   ${testName}`);
  
  const triggerPrice = (currentPrice * 0.95).toFixed(2);
  const limitPrice = (currentPrice * 0.94).toFixed(2); // 限价略低于触发价
  
  const payload = {
    algoType: 'CONDITIONAL',
    symbol,
    side: 'SELL',
    type: 'STOP',              // 限价止损（需要指定 price）
    quantity,
    triggerPrice,
    price: limitPrice,         // 限价
    workingType: 'MARK_PRICE',
    priceProtect: 'true',
    reduceOnly: 'true'
  };
  
  logger.info('   请求payload:', JSON.stringify(payload, null, 2));
  logger.info('   💡 STOP 类型需要同时指定 triggerPrice 和 price（限价）');
  
  try {
    const response = await (client as any).privateRequest('/fapi/v1/algoOrder', payload, 'POST', 1);
    logger.info('   ✅ 成功! 响应:', JSON.stringify(response, null, 2));
    
    results.push({
      testName,
      success: true,
      requestPayload: payload,
      response
    });
    
    if (response.algoId) {
      await cancelAlgoOrder(client, symbol, response.algoId);
    }
    
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    logger.error(`   ❌ 失败: ${errorMsg}`);
    
    results.push({
      testName,
      success: false,
      error: errorMsg,
      requestPayload: payload
    });
  }
}

/**
 * 测试5: 查询条件单
 */
async function test5_QueryAlgoOrders(
  client: any,
  symbol: string
) {
  const testName = '测试5: 查询条件单列表';
  logger.info(`\n   ${testName}`);
  
  const payload = {
    algoType: 'CONDITIONAL',
    symbol
  };
  
  logger.info('   请求payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await (client as any).privateRequest('/fapi/v1/openAlgoOrders', payload, 'GET', 1);
    logger.info(`   ✅ 成功! 找到 ${response.length} 个条件单`);
    
    if (response.length > 0) {
      logger.info('   条件单列表:');
      response.forEach((order: any, index: number) => {
        logger.info(`     ${index + 1}. algoId=${order.algoId}, type=${order.orderType}, side=${order.side}, triggerPrice=${order.triggerPrice}, status=${order.algoStatus}`);
      });
    }
    
    results.push({
      testName,
      success: true,
      requestPayload: payload,
      response
    });
    
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    logger.error(`   ❌ 失败: ${errorMsg}`);
    
    results.push({
      testName,
      success: false,
      error: errorMsg,
      requestPayload: payload
    });
  }
}

/**
 * 取消条件单
 */
async function cancelAlgoOrder(client: any, symbol: string, algoId: string) {
  try {
    logger.info(`   🗑️  取消条件单: algoId=${algoId}`);
    await (client as any).privateRequest('/fapi/v1/algoOrder', { symbol, algoId }, 'DELETE', 1);
    logger.info('   ✅ 条件单已取消');
  } catch (error: any) {
    logger.warn(`   ⚠️  取消条件单失败: ${error.message}`);
  }
}

/**
 * 打印测试结果摘要
 */
function printTestSummary() {
  logger.info('\n' + '='.repeat(80));
  logger.info('📋 测试结果摘要');
  logger.info('='.repeat(80));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  logger.info(`\n总计: ${results.length} 个测试`);
  logger.info(`✅ 成功: ${successCount}`);
  logger.info(`❌ 失败: ${failCount}`);
  
  logger.info('\n详细结果:');
  results.forEach((result, index) => {
    logger.info(`\n${index + 1}. ${result.testName}`);
    logger.info(`   状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (result.success && result.response) {
      logger.info(`   响应字段: ${Object.keys(result.response).join(', ')}`);
      if (result.response.algoId) {
        logger.info(`   algoId: ${result.response.algoId}`);
      }
    } else if (!result.success) {
      logger.info(`   错误: ${result.error}`);
    }
  });
  
  logger.info('\n' + '='.repeat(80));
  logger.info('💡 关键发现');
  logger.info('='.repeat(80));
  
  const successfulMethods = results.filter(r => r.success);
  if (successfulMethods.length > 0) {
    logger.info('\n✅ 可用的条件单创建方法:');
    successfulMethods.forEach(method => {
      logger.info(`\n   方法: ${method.testName}`);
      logger.info(`   参数要点:`);
      const payload = method.requestPayload;
      logger.info(`     - algoType: ${payload.algoType}`);
      logger.info(`     - type: ${payload.type}`);
      logger.info(`     - triggerPrice: ${payload.triggerPrice} (触发价)`);
      if (payload.price) {
        logger.info(`     - price: ${payload.price} (限价)`);
      }
      if (payload.quantity) {
        logger.info(`     - quantity: ${payload.quantity}`);
      }
      if (payload.closePosition) {
        logger.info(`     - closePosition: ${payload.closePosition}`);
      }
      logger.info(`     - workingType: ${payload.workingType}`);
      logger.info(`     - priceProtect: ${payload.priceProtect}`);
    });
    
    logger.info('\n📝 下一步行动:');
    logger.info('   1. 将成功的方法应用到主程序 BinanceExchangeClient.ts');
    logger.info('   2. 修改 setPositionStopLoss 方法使用 /fapi/v1/algoOrder 端点');
    logger.info('   3. 参数调整: stopPrice -> triggerPrice, 添加 algoType: CONDITIONAL');
    logger.info('   4. 修改 getPriceOrders 使用 /fapi/v1/openAlgoOrders');
    logger.info('   5. 修改 cancelPositionStopLoss 使用 /fapi/v1/algoOrder DELETE');
    
  } else {
    logger.info('\n❌ 所有测试都失败了，可能的原因:');
    logger.info('   1. 测试网API密钥权限不足或未正确配置');
    logger.info('   2. 需要先开仓才能设置条件单（某些情况下）');
    logger.info('   3. 测试网环境限制或维护中');
    logger.info('   4. 参数格式仍需进一步调整');
    logger.info('\n💡 建议:');
    logger.info('   - 检查 .env 文件中的 BINANCE_API_KEY 和 BINANCE_API_SECRET');
    logger.info('   - 确认测试网可正常访问: https://testnet.binancefuture.com');
    logger.info('   - 尝试在正式网测试（请使用小额资金！）');
  }
  
  logger.info('\n' + '='.repeat(80));
}

// 运行测试
testAlgoOrders()
  .then(() => {
    logger.info('\n✅ 测试完成');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
