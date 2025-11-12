/**
 * 测试数据库schema是否包含策略字段
 */
import { CREATE_TABLES_SQL } from "../src/database/schema";

console.log("=".repeat(80));
console.log("检查 CREATE_TABLES_SQL 是否包含策略字段");
console.log("=".repeat(80));

const requiredFields = [
  "market_state TEXT",
  "strategy_type TEXT", 
  "signal_strength REAL",
  "opportunity_score REAL"
];

let allFound = true;

for (const field of requiredFields) {
  const found = CREATE_TABLES_SQL.includes(field);
  console.log(`${found ? "✅" : "❌"} ${field}: ${found ? "存在" : "缺失"}`);
  if (!found) {
    allFound = false;
  }
}

console.log("\n" + "=".repeat(80));
if (allFound) {
  console.log("✅ 所有策略字段都在SQL中");
} else {
  console.log("❌ 有字段缺失！");
  console.log("\n显示 positions 表的 CREATE TABLE 语句：");
  const match = CREATE_TABLES_SQL.match(/CREATE TABLE IF NOT EXISTS positions \([\s\S]*?\);/);
  if (match) {
    console.log(match[0]);
  }
}
console.log("=".repeat(80));

process.exit(allFound ? 0 : 1);
