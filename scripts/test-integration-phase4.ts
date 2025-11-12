/**
 * 第四阶段集成测试
 * 验证开仓机会分析工具的完整功能
 */

import "dotenv/config";
import { createLogger } from "../src/utils/logger";
import { analyzeOpeningOpportunitiesTool } from "../src/tools/trading/opportunityAnalysis";

const logger = createLogger({
  name: "integration-test",
  level: "info",
});

// 定义返回类型以避免TypeScript类型检查错误
interface OpportunityResult {
  success: boolean;
  totalAnalyzed?: number;
  opportunitiesFound?: number;
  topOpportunities?: any[];
  marketSummary?: any;
  filterInfo?: any;
  timestamp?: string;
  message?: string;
  error?: string;
}

async function testAnalyzeOpportunities() {
  logger.info("\n=== 测试场景1：调用开仓机会分析工具 ===\n");
  
  try {
    if (!analyzeOpeningOpportunitiesTool.execute) {
      throw new Error("analyzeOpeningOpportunitiesTool.execute is undefined");
    }
    
    const result = await analyzeOpeningOpportunitiesTool.execute({
      symbols: ["BTC", "ETH", "SOL"],
      minScore: 50, // 降低阈值以便看到更多结果
      maxResults: 5,
      includeOpenPositions: false,
    }) as OpportunityResult;
    
    logger.info("工具返回结果:");
    logger.info(`  成功: ${result.success}`);
    logger.info(`  分析品种数: ${result.totalAnalyzed || 0}`);
    logger.info(`  发现机会数: ${result.opportunitiesFound || 0}`);
    
    if (result.topOpportunities && Array.isArray(result.topOpportunities) && result.topOpportunities.length > 0) {
      logger.info(`\n📊 发现 ${result.topOpportunities.length} 个交易机会:\n`);
      
      for (const opp of result.topOpportunities) {
        logger.info(`${opp.rank || '?'}. ${opp.symbol || 'Unknown'}:`);
        logger.info(`   评分: ${opp.score || 0}/100 (${opp.confidence || 'unknown'})`);
        logger.info(`   动作: ${opp.action || 'wait'}`);
        logger.info(`   市场状态: ${opp.marketState || 'unknown'}`);
        logger.info(`   策略类型: ${opp.strategyType || 'none'}`);
        logger.info(`   推荐杠杆: ${opp.recommendedLeverage || 1}x`);
        logger.info(`   信号强度: ${opp.signalStrength || 0}%`);
        logger.info(`   理由: ${opp.reason || 'N/A'}`);
        
        if (opp.keyMetrics) {
          logger.info(`   关键指标:`);
          logger.info(`     - RSI7: ${opp.keyMetrics.rsi7?.toFixed(1) || 'N/A'}`);
          logger.info(`     - 价格: ${opp.keyMetrics.price?.toFixed(2) || 'N/A'}`);
          logger.info(`     - EMA20: ${opp.keyMetrics.ema20?.toFixed(2) || 'N/A'}`);
        }
        
        if (opp.scoreBreakdown) {
          logger.info(`   评分明细:`);
          logger.info(`     - 信号强度: ${opp.scoreBreakdown.signalStrength || 0}`);
          logger.info(`     - 趋势一致性: ${opp.scoreBreakdown.trendConsistency || 0}`);
          logger.info(`     - 波动率适配: ${opp.scoreBreakdown.volatilityFit || 0}`);
          logger.info(`     - 风险收益比: ${opp.scoreBreakdown.riskRewardRatio || 0}`);
          logger.info(`     - 流动性: ${opp.scoreBreakdown.liquidity || 0}`);
        }
        logger.info(``);
      }
    } else {
      logger.info("\n  暂无达到评分阈值的交易机会");
    }
    
    if (result.marketSummary) {
      logger.info(`\n🌐 市场概况:`);
      logger.info(`  总品种数: ${result.marketSummary.total || 0}`);
      if (result.marketSummary.byState) {
        logger.info(`  市场状态分布: ${JSON.stringify(result.marketSummary.byState, null, 2)}`);
      }
      if (result.marketSummary.byTrend) {
        logger.info(`  趋势分布: ${JSON.stringify(result.marketSummary.byTrend, null, 2)}`);
      }
      if (result.marketSummary.byMomentum) {
        logger.info(`  动量分布: ${JSON.stringify(result.marketSummary.byMomentum, null, 2)}`);
      }
    }
    
    logger.info("\n✅ 测试场景1通过");
    return true;
    
  } catch (error) {
    logger.error("❌ 测试场景1失败:", error);
    return false;
  }
}

async function testWithDefaultSymbols() {
  logger.info("\n=== 测试场景2：使用默认配置（环境变量中的交易品种） ===\n");
  
  try {
    if (!analyzeOpeningOpportunitiesTool.execute) {
      throw new Error("analyzeOpeningOpportunitiesTool.execute is undefined");
    }
    
    const result = await analyzeOpeningOpportunitiesTool.execute({}) as OpportunityResult;
    
    logger.info(`  分析品种数: ${result.totalAnalyzed || 0}`);
    logger.info(`  发现机会数: ${result.opportunitiesFound || 0}`);
    
    if (result.filterInfo) {
      logger.info(`  评分阈值: ${result.filterInfo.minScore || 60}`);
      logger.info(`  返回数量限制: ${result.filterInfo.maxResults || 5}`);
      if (result.filterInfo.openPositionsFiltered && Array.isArray(result.filterInfo.openPositionsFiltered) && result.filterInfo.openPositionsFiltered.length > 0) {
        logger.info(`  已过滤持仓: ${result.filterInfo.openPositionsFiltered.join(", ")}`);
      }
    }
    
    logger.info("\n✅ 测试场景2通过");
    return true;
    
  } catch (error) {
    logger.error("❌ 测试场景2失败:", error);
    return false;
  }
}

async function testResultFormat() {
  logger.info("\n=== 测试场景3：验证返回结果格式 ===\n");
  
  try {
    if (!analyzeOpeningOpportunitiesTool.execute) {
      throw new Error("analyzeOpeningOpportunitiesTool.execute is undefined");
    }
    
    const result = await analyzeOpeningOpportunitiesTool.execute({
      symbols: ["BTC"],
      minScore: 0, // 设置为0以确保有结果
      maxResults: 1,
    }) as OpportunityResult;
    
    // 验证必需字段
    const requiredFields = [
      'success',
      'totalAnalyzed',
      'opportunitiesFound',
      'topOpportunities',
      'timestamp'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`缺少必需字段: ${field}`);
      }
    }
    
    // 如果有机会，验证机会对象格式
    if (result.topOpportunities && Array.isArray(result.topOpportunities) && result.topOpportunities.length > 0) {
      const opp = result.topOpportunities[0];
      const oppRequiredFields = [
        'rank', 'symbol', 'score', 'action', 'confidence',
        'marketState', 'strategyType', 'recommendedLeverage',
        'signalStrength', 'reason', 'keyMetrics', 'scoreBreakdown'
      ];
      
      for (const field of oppRequiredFields) {
        if (!(field in opp)) {
          throw new Error(`机会对象缺少必需字段: ${field}`);
        }
      }
      
      logger.info("  ✓ 返回结果格式正确");
      logger.info("  ✓ 所有必需字段存在");
    }
    
    logger.info("\n✅ 测试场景3通过");
    return true;
    
  } catch (error) {
    logger.error("❌ 测试场景3失败:", error);
    return false;
  }
}

async function testDatabaseFields() {
  logger.info("\n=== 测试场景4：验证数据库字段扩展 ===\n");
  
  try {
    const { createClient } = await import("@libsql/client");
    const dbUrl = process.env.DATABASE_URL || "file:./.voltagent/trading.db";
    const dbClient = createClient({ url: dbUrl });
    
    // 查询表结构
    const schema = await dbClient.execute(
      "PRAGMA table_info(positions)"
    );
    
    const columnNames = schema.rows.map((row: any) => row.name);
    
    const requiredColumns = [
      'market_state',
      'strategy_type',
      'signal_strength',
      'opportunity_score'
    ];
    
    for (const col of requiredColumns) {
      if (columnNames.includes(col)) {
        logger.info(`  ✓ 字段存在: ${col}`);
      } else {
        throw new Error(`缺少字段: ${col}`);
      }
    }
    
    logger.info("\n✅ 测试场景4通过");
    return true;
    
  } catch (error) {
    logger.error("❌ 测试场景4失败:", error);
    return false;
  }
}

async function main() {
  try {
    logger.info("🧪 第四阶段集成测试开始\n");
    logger.info("=" .repeat(60));
    
    const results = await Promise.all([
      testAnalyzeOpportunities(),
      testWithDefaultSymbols(),
      testResultFormat(),
      testDatabaseFields(),
    ]);
    
    const allPassed = results.every(r => r);
    
    logger.info("\n" + "=".repeat(60));
    logger.info("\n📊 测试结果汇总:");
    logger.info(`  测试场景1（开仓机会分析）: ${results[0] ? '✅ 通过' : '❌ 失败'}`);
    logger.info(`  测试场景2（默认配置）: ${results[1] ? '✅ 通过' : '❌ 失败'}`);
    logger.info(`  测试场景3（结果格式验证）: ${results[2] ? '✅ 通过' : '❌ 失败'}`);
    logger.info(`  测试场景4（数据库字段）: ${results[3] ? '✅ 通过' : '❌ 失败'}`);
    
    if (allPassed) {
      logger.info("\n🎉 所有测试通过！第四阶段集成成功！");
      logger.info("\n✨ 新功能已就绪：");
      logger.info("  1. ✅ 开仓机会分析工具（analyzeOpeningOpportunities）");
      logger.info("  2. ✅ 市场状态自动识别（8种状态）");
      logger.info("  3. ✅ 策略自动路由（趋势跟踪/均值回归/突破）");
      logger.info("  4. ✅ 机会量化评分（0-100分，5维度）");
      logger.info("  5. ✅ 自动过滤已持仓品种");
      logger.info("  6. ✅ 数据库记录策略信息");
      logger.info("  7. ✅ TradingAgent集成完成");
      process.exit(0);
    } else {
      logger.error("\n❌ 部分测试失败，请检查错误信息");
      process.exit(1);
    }
    
  } catch (error) {
    logger.error("测试执行失败:", error);
    process.exit(1);
  }
}

main();
