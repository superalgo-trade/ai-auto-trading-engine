/**
 * ai-auto-trading - AI 加密货币自动交易系统
 * Copyright (C) 2025 losesky
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * 数据库迁移：添加策略信息字段到 positions 表
 * 
 * 新增字段：
 * - market_state: 市场状态（如 'uptrend_oversold', 'ranging_neutral' 等）
 * - strategy_type: 策略类型（如 'trend_following', 'mean_reversion', 'breakout'）
 * - signal_strength: 信号强度（0-1）
 * - opportunity_score: 机会评分（0-100）
 * 
 * 使用方法：
 * npm run migrate:strategy-info
 * 或
 * ts-node src/database/migrate-add-strategy-info.ts
 */

import { createClient } from "@libsql/client";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function migrate() {
  console.log("🔧 开始数据库迁移：添加策略信息字段...");
  
  try {
    // 检查字段是否已存在
    const tableInfo = await dbClient.execute("PRAGMA table_info(positions)");
    const columnNames = tableInfo.rows.map((row: any) => row.name);
    
    const fieldsToAdd = [
      { name: "market_state", type: "TEXT" },
      { name: "strategy_type", type: "TEXT" },
      { name: "signal_strength", type: "REAL" },
      { name: "opportunity_score", type: "REAL" },
    ];
    
    for (const field of fieldsToAdd) {
      if (!columnNames.includes(field.name)) {
        console.log(`  添加字段: ${field.name} (${field.type})`);
        await dbClient.execute(
          `ALTER TABLE positions ADD COLUMN ${field.name} ${field.type}`
        );
      } else {
        console.log(`  字段已存在: ${field.name}`);
      }
    }
    
    console.log("✅ 数据库迁移完成！");
    console.log("");
    console.log("📋 新增字段说明：");
    console.log("  - market_state: 记录开仓时的市场状态（趋势/震荡/超买超卖等）");
    console.log("  - strategy_type: 记录使用的策略类型（趋势跟踪/均值回归/突破等）");
    console.log("  - signal_strength: 记录信号强度（0-1），反映技术指标对齐程度");
    console.log("  - opportunity_score: 记录机会评分（0-100），反映综合质量评估");
    console.log("");
    console.log("这些信息有助于后续分析不同策略和市场状态下的表现。");
    
  } catch (error) {
    console.error("❌ 迁移失败:", error);
    process.exit(1);
  }
}

// 执行迁移
migrate()
  .then(() => {
    console.log("🎉 迁移脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 迁移脚本执行失败:", error);
    process.exit(1);
  });
