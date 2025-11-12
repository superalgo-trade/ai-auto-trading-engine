/**
 * 测试数据库初始化 - 验证策略字段
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { CREATE_TABLES_SQL } from "../src/database/schema";

async function test() {
  console.log("1. 检查SQL语句...");
  const hasMarketState = CREATE_TABLES_SQL.includes("market_state TEXT");
  const hasStrategyType = CREATE_TABLES_SQL.includes("strategy_type TEXT");
  const hasSignalStrength = CREATE_TABLES_SQL.includes("signal_strength REAL");
  const hasOpportunityScore = CREATE_TABLES_SQL.includes("opportunity_score REAL");
  
  console.log(`  market_state TEXT: ${hasMarketState ? "✅" : "❌"}`);
  console.log(`  strategy_type TEXT: ${hasStrategyType ? "✅" : "❌"}`);
  console.log(`  signal_strength REAL: ${hasSignalStrength ? "✅" : "❌"}`);
  console.log(`  opportunity_score REAL: ${hasOpportunityScore ? "✅" : "❌"}`);
  
  if (!hasMarketState || !hasStrategyType || !hasSignalStrength || !hasOpportunityScore) {
    console.log("\n❌ SQL语句中缺少策略字段！");
    process.exit(1);
  }
  
  console.log("\n2. 创建数据库...");
  const dbPath = ".voltagent/test-trading.db";
  const client = createClient({ url: `file:${dbPath}` });
  
  await client.executeMultiple(CREATE_TABLES_SQL);
  console.log("  ✅ 表创建完成");
  
  console.log("\n3. 检查表结构...");
  const result = await client.execute("PRAGMA table_info(positions)");
  
  const fields = result.rows.map((r: any) => r.name);
  console.log(`  总字段数: ${fields.length}`);
  
  const strategyFields = ["market_state", "strategy_type", "signal_strength", "opportunity_score"];
  for (const field of strategyFields) {
    const exists = fields.includes(field);
    console.log(`  ${field}: ${exists ? "✅" : "❌"}`);
  }
  
  console.log("\n✅ 测试完成");
  process.exit(0);
}

test().catch(console.error);
