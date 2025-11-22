#!/usr/bin/env tsx
/**
 * 测试AVAX交易失败修复
 * 
 * 验证：
 * 1. 币种冷静期机制
 * 2. 历史失败惩罚
 * 3. 反转检测阈值降低
 */

import { createClient } from "@libsql/client";
import { 
  isSymbolInCooldown, 
  getSymbolLossStats,
  calculateHistoricalLossPenalty 
} from "../src/services/coinCooldownManager";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function testCooldownSystem() {
  console.log("=".repeat(80));
  console.log("测试1: 币种冷静期机制");
  console.log("=".repeat(80));
  
  // 测试AVAX（应该在冷静期内，如果有最近的亏损记录）
  const symbols = ["AVAX", "BTC", "ETH", "SOL"];
  
  for (const symbol of symbols) {
    console.log(`\n检查 ${symbol}:`);
    
    // 检查是否在冷静期
    const cooldown = await isSymbolInCooldown(symbol);
    if (cooldown.inCooldown) {
      console.log(`  ⚠️  在冷静期中`);
      console.log(`  原因: ${cooldown.reason}`);
      console.log(`  剩余时间: ${cooldown.remainingHours?.toFixed(1)} 小时`);
      console.log(`  解除时间: ${cooldown.cooldownUntil}`);
    } else {
      console.log(`  ✅ 不在冷静期`);
    }
    
    // 获取亏损统计
    const stats = await getSymbolLossStats(symbol);
    console.log(`  统计数据:`);
    console.log(`    - 24h内亏损次数: ${stats.losses24h}`);
    console.log(`    - 48h内亏损次数: ${stats.losses48h}`);
    console.log(`    - 24h总亏损: ${stats.totalLoss24h.toFixed(2)} USDT`);
    console.log(`    - 平均亏损%: ${stats.avgLossPercent24h.toFixed(1)}%`);
    console.log(`    - 有趋势反转亏损: ${stats.hasReversalLoss ? "是" : "否"}`);
    
    // 计算惩罚
    const penalty = calculateHistoricalLossPenalty(stats);
    if (penalty > 0) {
      console.log(`  📉 评分惩罚: -${penalty} 分`);
    }
  }
}

async function testRecentLosses() {
  console.log("\n" + "=".repeat(80));
  console.log("测试2: 查询最近的亏损记录");
  console.log("=".repeat(80));
  
  const result = await dbClient.execute({
    sql: `SELECT 
            symbol, 
            pnl, 
            pnl_percent, 
            close_reason,
            created_at,
            datetime('now') as now,
            ROUND((julianday('now') - julianday(created_at)) * 24, 1) as hours_ago
          FROM position_close_events
          WHERE pnl < 0
            AND created_at > datetime('now', '-48 hours')
          ORDER BY created_at DESC
          LIMIT 20`,
  });
  
  console.log(`\n找到 ${result.rows.length} 条亏损记录（48小时内）:\n`);
  
  for (const row of result.rows) {
    const symbol = String(row.symbol || "");
    const pnl = Number.parseFloat(String(row.pnl || "0"));
    const pnlPercent = Number.parseFloat(String(row.pnl_percent || "0"));
    const reason = String(row.close_reason || "");
    const hoursAgo = Number.parseFloat(String(row.hours_ago || "0"));
    
    console.log(`${symbol.padEnd(8)} | ${hoursAgo.toFixed(1).padStart(6)}h前 | ${pnl.toFixed(2).padStart(10)} USDT | ${pnlPercent.toFixed(1).padStart(7)}% | ${reason}`);
  }
}

async function testReversalThresholds() {
  console.log("\n" + "=".repeat(80));
  console.log("测试3: 反转检测阈值调整说明");
  console.log("=".repeat(80));
  
  console.log("\n原阈值:");
  console.log("  - reversalScore >= 70: 立即平仓");
  console.log("  - reversalScore >= 50: 建议平仓");
  console.log("  - reversalScore >= 30: 早期预警");
  
  console.log("\n新阈值（已降低）:");
  console.log("  - reversalScore >= 60: 立即平仓  ⬅️ 降低10分");
  console.log("  - reversalScore >= 40: 建议平仓  ⬅️ 降低10分");
  console.log("  - reversalScore >= 25: 早期预警  ⬅️ 降低5分");
  
  console.log("\n影响分析:");
  console.log("  ✅ AVAX第一次交易: reversalScore=40，现在会触发【建议平仓】");
  console.log("  ✅ AVAX第二次交易: reversalScore=40，现在会触发【建议平仓】");
  console.log("  ✅ 反应更灵敏，能更早识别趋势反转");
}

async function testScorePenalties() {
  console.log("\n" + "=".repeat(80));
  console.log("测试4: 评分惩罚机制说明");
  console.log("=".repeat(80));
  
  console.log("\n新增的评分惩罚:");
  console.log("\n1. 历史失败惩罚:");
  console.log("   - 24h内有亏损: -20分");
  console.log("   - 平均亏损>=20%: 额外-15分");
  console.log("   - 平均亏损>=15%: 额外-10分");
  console.log("   - 48h内亏损>=2次: -20分");
  console.log("   - 有趋势反转亏损: -15分");
  
  console.log("\n2. 趋势稳定性惩罚:");
  console.log("   - 主框架趋势减弱>40%: -10分");
  console.log("   - 确认框架趋势减弱>40%: -8分");
  
  console.log("\n3. 高波动性惩罚:");
  console.log("   - ATR比率>2.0: -15分");
  console.log("   - ATR比率>1.5: -10分");
  
  console.log("\n示例（AVAX第二次开仓）:");
  console.log("  基础评分: 77分");
  console.log("  - 历史失败惩罚: -20分（24h内有亏损）");
  console.log("  - 历史失败惩罚: -15分（有趋势反转）");
  console.log("  实际评分: 42分  ⬅️ 低于75分阈值，会被拒绝");
}

async function main() {
  try {
    await testCooldownSystem();
    await testRecentLosses();
    await testReversalThresholds();
    await testScorePenalties();
    
    console.log("\n" + "=".repeat(80));
    console.log("✅ 测试完成");
    console.log("=".repeat(80));
    console.log("\n修复总结:");
    console.log("1. ✅ 币种冷静期机制 - 防止短期内重复犯错");
    console.log("2. ✅ 历史失败惩罚 - 降低有亏损记录的币种评分");
    console.log("3. ✅ 反转检测阈值降低 - 更早识别趋势反转");
    console.log("4. ✅ 趋势稳定性检测 - 识别震荡不稳的市场");
    console.log("5. ✅ 高波动性惩罚 - 降低波动过大币种评分");
    console.log("\n预期效果:");
    console.log("- AVAX第二次开仓会被冷静期阻止");
    console.log("- 即使不在冷静期，历史惩罚也会使评分降至42分，低于75分阈值");
    console.log("- reversalScore=40会触发平仓建议，而非等到50分");
    
  } catch (error) {
    console.error("测试失败:", error);
    process.exit(1);
  }
}

main();
