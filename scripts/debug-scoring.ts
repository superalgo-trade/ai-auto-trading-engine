/**
 * 调试评分系统 - 查看实际评分详情
 */

import 'dotenv/config'; // 明确加载.env文件
import { analyzeMultipleMarketStates } from '../src/services/marketStateAnalyzer';
import { routeMultipleStrategies } from '../src/services/strategyRouter';
import { scoreAndRankOpportunities } from '../src/services/opportunityScorer';
import { createLogger } from '../src/utils/logger';

const logger = createLogger({
  name: 'debug-scoring',
  level: 'info',
});

async function debugScoring() {
  // 确保使用Binance交易所（覆盖.env配置）
  process.env.EXCHANGE_NAME = 'binance';
  
  logger.info('🔍 调试评分系统...\n');
  logger.info(`使用交易所: ${process.env.EXCHANGE_NAME}`);
  logger.info(`Binance测试网: ${process.env.BINANCE_USE_TESTNET}`);

  // 1. 分析市场状态
  const symbols = ['BTC', 'ETH', 'SOL'];
  logger.info(`分析 ${symbols.length} 个品种的市场状态...`);
  const marketStates = await analyzeMultipleMarketStates(symbols);

  // 2. 路由策略
  logger.info(`\n路由策略...`);
  const strategyResults = await routeMultipleStrategies(symbols);

  // 3. 评分（设置为0分阈值，看所有评分）
  logger.info(`\n评分机会（阈值=0，查看所有评分）...`);
  const resultArray = Array.from(strategyResults.values());
  const allScores = scoreAndRankOpportunities(resultArray, marketStates, 0);

  // 4. 打印详细信息
  logger.info(`\n========== 评分详情 ==========\n`);
  
  for (const score of allScores) {
    const state = marketStates.get(score.symbol)!;
    const result = strategyResults.get(score.symbol)!;
    
    logger.info(`【${score.symbol}】`);
    logger.info(`  市场状态: ${state.state} (置信度: ${(state.confidence * 100).toFixed(0)}%)`);
    logger.info(`  策略动作: ${result.action} (策略类型: ${result.strategyType})`);
    logger.info(`  策略理由: ${result.reason}`);
    logger.info(`  信号强度: ${(result.signalStrength * 100).toFixed(0)}%`);
    logger.info(`  总评分: ${score.totalScore}/100 (置信度: ${score.confidence})`);
    logger.info(`  评分明细:`);
    logger.info(`    - 信号强度: ${score.breakdown.signalStrength}/30`);
    logger.info(`    - 趋势一致性: ${score.breakdown.trendConsistency}/25`);
    logger.info(`    - 波动率适配: ${score.breakdown.volatilityFit}/20`);
    logger.info(`    - 风险收益比: ${score.breakdown.riskRewardRatio}/15`);
    logger.info(`    - 流动性: ${score.breakdown.liquidity}/10`);
    logger.info(`  关键指标:`);
    logger.info(`    - RSI7: ${result.keyMetrics.rsi7.toFixed(1)}`);
    logger.info(`    - RSI14: ${result.keyMetrics.rsi14.toFixed(1)}`);
    logger.info(`    - MACD: ${result.keyMetrics.macd.toFixed(2)}`);
    logger.info(`    - EMA20: ${result.keyMetrics.ema20.toFixed(2)}`);
    logger.info(`    - EMA50: ${result.keyMetrics.ema50.toFixed(2)}`);
    logger.info(`    - Price: ${result.keyMetrics.price.toFixed(2)}`);
    logger.info(``);
  }

  // 5. 统计
  const above40 = allScores.filter(s => s.totalScore >= 40).length;
  const above50 = allScores.filter(s => s.totalScore >= 50).length;
  const above60 = allScores.filter(s => s.totalScore >= 60).length;

  logger.info(`========== 统计 ==========`);
  logger.info(`总评分机会: ${allScores.length}`);
  logger.info(`≥40分: ${above40} 个`);
  logger.info(`≥50分: ${above50} 个`);
  logger.info(`≥60分: ${above60} 个`);
}

debugScoring()
  .then(() => {
    console.log('\n✅ 调试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 调试失败:', error);
    process.exit(1);
  });
