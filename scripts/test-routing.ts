/**
 * 测试策略路由和机会评分系统
 */

import "dotenv/config";
import { createLogger } from "../src/utils/logger";
import { analyzeMultipleMarketStates } from "../src/services/marketStateAnalyzer";
import { routeMultipleStrategies } from "../src/services/strategyRouter";
import { scoreAndRankOpportunities } from "../src/services/opportunityScorer";

const logger = createLogger({
  name: "test-routing",
  level: "info",
});

async function main() {
  try {
    logger.info("=== 测试策略路由和机会评分系统 ===\n");
    
    const symbols = ["BTC", "ETH", "SOL", "DOGE", "XRP"];
    
    // 1. 分析市场状态
    logger.info("1️⃣ 分析市场状态...");
    const marketStates = await analyzeMultipleMarketStates(symbols);
    logger.info(`   完成: ${marketStates.size} 个品种\n`);
    
    // 2. 路由策略
    logger.info("2️⃣ 路由策略...");
    const strategyResults = await routeMultipleStrategies(symbols);
    logger.info(`   完成: ${strategyResults.size} 个品种\n`);
    
    // 3. 评分和排序
    logger.info("3️⃣ 评分和排序...");
    const resultArray = Array.from(strategyResults.values());
    const rankedOpportunities = scoreAndRankOpportunities(resultArray, marketStates, 50);
    logger.info(`   发现 ${rankedOpportunities.length} 个评分达标的机会\n`);
    
    // 4. 显示结果
    logger.info("📊 评分结果（按评分排序）：\n");
    
    if (rankedOpportunities.length === 0) {
      logger.info("   暂无评分达标的交易机会\n");
    } else {
      for (let i = 0; i < rankedOpportunities.length; i++) {
        const opp = rankedOpportunities[i];
        const result = strategyResults.get(opp.symbol)!;
        const state = marketStates.get(opp.symbol)!;
        
        logger.info(`${i + 1}. ${opp.symbol} - 总分: ${opp.totalScore}/100 (${opp.confidence})`);
        logger.info(`   市场状态: ${state.state} (置信度: ${(state.confidence * 100).toFixed(0)}%)`);
        logger.info(`   策略类型: ${result.strategyType}`);
        logger.info(`   动作: ${result.action} @ ${result.keyMetrics.price.toFixed(2)}`);
        logger.info(`   推荐杠杆: ${result.recommendedLeverage}x`);
        logger.info(`   信号强度: ${(result.signalStrength * 100).toFixed(0)}%`);
        logger.info(`   评分明细:`);
        logger.info(`     - 信号强度: ${opp.breakdown.signalStrength}/30`);
        logger.info(`     - 趋势一致性: ${opp.breakdown.trendConsistency}/25`);
        logger.info(`     - 波动率适配: ${opp.breakdown.volatilityFit}/20`);
        logger.info(`     - 风险收益比: ${opp.breakdown.riskRewardRatio}/15`);
        logger.info(`     - 流动性: ${opp.breakdown.liquidity}/10`);
        logger.info(`   关键指标:`);
        logger.info(`     - RSI7: ${result.keyMetrics.rsi7.toFixed(1)}`);
        logger.info(`     - MACD: ${result.keyMetrics.macd.toFixed(2)}`);
        logger.info(`     - EMA20/50: ${result.keyMetrics.ema20.toFixed(2)} / ${result.keyMetrics.ema50.toFixed(2)}`);
        logger.info(`   理由: ${result.reason}\n`);
      }
    }
    
    // 5. 显示所有币种的市场状态概览
    logger.info("🌐 市场状态概览：\n");
    for (const [symbol, state] of marketStates) {
      logger.info(`${symbol}:`);
      logger.info(`  状态: ${state.state}`);
      logger.info(`  趋势: ${state.trendStrength}`);
      logger.info(`  动量: ${state.momentumState}`);
      logger.info(`  RSI7: ${state.keyMetrics.rsi7_15m.toFixed(1)}`);
      logger.info(``);
    }
    
    logger.info("✅ 测试完成!\n");
    process.exit(0);
  } catch (error) {
    logger.error("测试失败:", error);
    process.exit(1);
  }
}

main();
