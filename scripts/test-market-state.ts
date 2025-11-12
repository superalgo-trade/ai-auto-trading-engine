/**
 * ai-auto-trading - AI 加密货币自动交易系统
 * Copyright (C) 2025 losesky
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * 测试市场状态分析功能
 */

import "dotenv/config";
import { analyzeMarketState, analyzeMultipleMarketStates } from "../src/services/marketStateAnalyzer";
import { createLogger } from "../src/utils/logger";

const logger = createLogger({
  name: "test-market-state",
  level: "info",
});

async function testSingleAnalysis() {
  logger.info("=== 测试单个品种市场状态分析 ===");
  
  const symbol = "BTC";
  
  try {
    const analysis = await analyzeMarketState(symbol);
    
    logger.info(`\n${symbol} 市场状态分析结果:`);
    logger.info(`  市场状态: ${analysis.state}`);
    logger.info(`  置信度: ${(analysis.confidence * 100).toFixed(1)}%`);
    logger.info(`  趋势强度: ${analysis.trendStrength}`);
    logger.info(`  动量状态: ${analysis.momentumState}`);
    logger.info(`  波动率状态: ${analysis.volatilityState}`);
    logger.info(`\n  关键指标:`);
    logger.info(`    RSI7(15m): ${analysis.keyMetrics.rsi7_15m.toFixed(2)}`);
    logger.info(`    RSI14(15m): ${analysis.keyMetrics.rsi14_15m.toFixed(2)}`);
    logger.info(`    MACD(15m): ${analysis.keyMetrics.macd_15m.toFixed(4)}`);
    logger.info(`    EMA20(1h): ${analysis.keyMetrics.ema20_1h.toFixed(2)}`);
    logger.info(`    EMA50(1h): ${analysis.keyMetrics.ema50_1h.toFixed(2)}`);
    logger.info(`    MACD(1h): ${analysis.keyMetrics.macd_1h.toFixed(4)}`);
    logger.info(`    当前价格: ${analysis.keyMetrics.price.toFixed(2)}`);
    logger.info(`    ATR比率: ${analysis.keyMetrics.atr_ratio.toFixed(2)}`);
    logger.info(`    距离EMA20: ${analysis.keyMetrics.distanceToEMA20.toFixed(2)}%`);
    logger.info(`\n  多时间框架一致性:`);
    logger.info(`    15m和1h对齐: ${analysis.timeframeAlignment.is15mAnd1hAligned ? "是" : "否"}`);
    logger.info(`    对齐评分: ${(analysis.timeframeAlignment.alignmentScore * 100).toFixed(1)}%`);
    
  } catch (error) {
    logger.error(`分析失败:`, error);
  }
}

async function testMultipleAnalysis() {
  logger.info("\n=== 测试多品种批量市场状态分析 ===");
  
  const symbols = ["BTC", "ETH", "SOL"];
  
  try {
    const results = await analyzeMultipleMarketStates(symbols);
    
    logger.info(`\n成功分析 ${results.size} 个品种:`);
    
    for (const [symbol, analysis] of results) {
      logger.info(`\n${symbol}:`);
      logger.info(`  状态: ${analysis.state} (置信度: ${(analysis.confidence * 100).toFixed(1)}%)`);
      logger.info(`  RSI7: ${analysis.keyMetrics.rsi7_15m.toFixed(2)}`);
      logger.info(`  趋势: ${analysis.trendStrength}`);
    }
    
  } catch (error) {
    logger.error(`批量分析失败:`, error);
  }
}

async function main() {
  try {
    await testSingleAnalysis();
    await testMultipleAnalysis();
    
    logger.info("\n✅ 测试完成!");
    process.exit(0);
  } catch (error) {
    logger.error("测试失败:", error);
    process.exit(1);
  }
}

main();
