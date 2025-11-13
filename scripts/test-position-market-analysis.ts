/**
 * 测试持仓市场状态分析功能
 * 验证趋势反转信号检测的准确性
 */

import { analyzeMultipleMarketStates, analyzeMarketState } from '../src/services/marketStateAnalyzer.js';
import createLogger from '../src/utils/logger.js';
import { getExchangeClient } from '../src/exchanges';

const logger = createLogger({ name: 'TestPositionMarketAnalysis' });

interface TestCase {
  name: string;
  symbol: string;
  positionSide: 'long' | 'short';
  expectedState?: string;
}

async function testMarketStateAnalysis() {
  logger.info('='.repeat(80));
  logger.info('开始测试持仓市场状态分析功能');
  logger.info('='.repeat(80));
  
  // 测试用例：模拟持仓币种
  const testCases: TestCase[] = [
    { name: '测试1: BTC 市场状态', symbol: 'BTC', positionSide: 'long' },
    { name: '测试2: ETH 市场状态', symbol: 'ETH', positionSide: 'short' },
    { name: '测试3: SOL 市场状态', symbol: 'SOL', positionSide: 'long' },
  ];
  
  // 测试单个市场状态分析
  logger.info('\n【测试1：单个币种市场状态分析】');
  for (const testCase of testCases) {
    try {
      logger.info(`\n${testCase.name}`);
      logger.info(`  币种: ${testCase.symbol}`);
      logger.info(`  持仓方向: ${testCase.positionSide}`);
      
      const state = await analyzeMarketState(testCase.symbol);
      
      logger.info(`  结果:`);
      logger.info(`    • 市场状态: ${state.state}`);
      logger.info(`    • 趋势强度: ${state.trendStrength}`);
      logger.info(`    • 动量状态: ${state.momentumState}`);
      logger.info(`    • 置信度: ${Math.round(state.confidence * 100)}%`);
      logger.info(`    • 多时间框架一致性: ${Math.round(state.timeframeAlignment.alignmentScore * 100)}%`);
      
      // 判断是否适合当前持仓方向
      const isLong = testCase.positionSide === 'long';
      const isTrendingUp = state.state.startsWith('uptrend');
      const isTrendingDown = state.state.startsWith('downtrend');
      
      if ((isLong && isTrendingDown) || (!isLong && isTrendingUp)) {
        logger.warn(`    ⚠️ 警告: 持仓方向与市场趋势相反!`);
      } else if ((isLong && isTrendingUp) || (!isLong && isTrendingDown)) {
        logger.info(`    ✅ 持仓方向与市场趋势一致`);
      } else {
        logger.info(`    ℹ️ 市场处于震荡状态`);
      }
      
    } catch (error) {
      logger.error(`  ❌ 分析失败: ${error}`);
    }
  }
  
  // 测试批量市场状态分析
  logger.info('\n【测试2：批量市场状态分析】');
  try {
    const symbols = testCases.map(tc => tc.symbol);
    logger.info(`  批量分析币种: ${symbols.join(', ')}`);
    
    const startTime = Date.now();
    const marketStates = await analyzeMultipleMarketStates(symbols);
    const duration = Date.now() - startTime;
    
    logger.info(`  分析完成，耗时: ${duration}ms`);
    logger.info(`  成功分析 ${marketStates.size}/${symbols.length} 个币种`);
    
    for (const [symbol, state] of marketStates) {
      logger.info(`\n  ${symbol}:`);
      logger.info(`    • 状态: ${state.state}`);
      logger.info(`    • 趋势: ${state.trendStrength}`);
      logger.info(`    • 动量: ${state.momentumState}`);
      logger.info(`    • 置信度: ${Math.round(state.confidence * 100)}%`);
    }
    
  } catch (error) {
    logger.error(`  ❌ 批量分析失败: ${error}`);
  }
  
  // 测试趋势反转检测逻辑
  logger.info('\n【测试3：趋势反转信号检测】');
  
  // 模拟场景
  const reversalScenarios = [
    {
      name: '场景1: 多头持仓，趋势从上涨转为下跌',
      positionSide: 'long' as const,
      entryState: 'uptrend_oversold',
      currentState: 'downtrend_continuation',
      shouldDetect: true
    },
    {
      name: '场景2: 空头持仓，趋势从下跌转为上涨',
      positionSide: 'short' as const,
      entryState: 'downtrend_overbought',
      currentState: 'uptrend_continuation',
      shouldDetect: true
    },
    {
      name: '场景3: 多头持仓，趋势保持上涨',
      positionSide: 'long' as const,
      entryState: 'uptrend_oversold',
      currentState: 'uptrend_overbought',
      shouldDetect: false
    },
    {
      name: '场景4: 入场状态未知',
      positionSide: 'long' as const,
      entryState: undefined,
      currentState: 'downtrend_continuation',
      shouldDetect: false
    }
  ];
  
  for (const scenario of reversalScenarios) {
    logger.info(`\n  ${scenario.name}`);
    logger.info(`    持仓方向: ${scenario.positionSide}`);
    logger.info(`    入场状态: ${scenario.entryState || '未知'}`);
    logger.info(`    当前状态: ${scenario.currentState}`);
    
    // 使用简化的反转检测逻辑
    const detected = detectReversal(
      scenario.positionSide,
      scenario.entryState,
      scenario.currentState
    );
    
    const expectation = scenario.shouldDetect ? '应检测到反转' : '不应检测到反转';
    const result = detected ? '✅ 检测到反转' : 'ℹ️ 未检测到反转';
    const match = detected === scenario.shouldDetect ? '✅' : '❌';
    
    logger.info(`    预期: ${expectation}`);
    logger.info(`    实际: ${result}`);
    logger.info(`    结果: ${match} ${detected === scenario.shouldDetect ? '匹配' : '不匹配'}`);
  }
  
  // 性能测试
  logger.info('\n【测试4：性能测试】');
  const perfTestSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP'];
  
  logger.info(`  测试币种数量: ${perfTestSymbols.length}`);
  logger.info('  执行10次批量分析，测量平均耗时...');
  
  const times: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    await analyzeMultipleMarketStates(perfTestSymbols);
    times.push(Date.now() - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  logger.info(`  平均耗时: ${avgTime.toFixed(0)}ms`);
  logger.info(`  最快: ${minTime}ms`);
  logger.info(`  最慢: ${maxTime}ms`);
  logger.info(`  结论: ${avgTime < 3000 ? '✅ 性能良好' : '⚠️ 性能需优化'}`);
  
  logger.info('\n' + '='.repeat(80));
  logger.info('测试完成');
  logger.info('='.repeat(80));
}

// 简化的反转检测逻辑（用于测试）
function detectReversal(
  positionSide: 'long' | 'short',
  entryState: string | undefined,
  currentState: string
): boolean {
  if (!entryState) return false;
  
  const isLong = positionSide === 'long';
  const wasUptrend = entryState.startsWith('uptrend');
  const wasDowntrend = entryState.startsWith('downtrend');
  const nowUptrend = currentState.startsWith('uptrend');
  const nowDowntrend = currentState.startsWith('downtrend');
  
  // 多头持仓：入场时上涨→现在下跌
  if (isLong && wasUptrend && nowDowntrend) {
    return true;
  }
  
  // 空头持仓：入场时下跌→现在上涨
  if (!isLong && wasDowntrend && nowUptrend) {
    return true;
  }
  
  return false;
}

// 运行测试
testMarketStateAnalysis().catch(error => {
  logger.error('测试失败:', error);
  process.exit(1);
});
