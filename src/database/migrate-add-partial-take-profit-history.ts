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
 * 数据库迁移：添加分批止盈历史表
 * 
 * 目的：记录每次分批止盈的执行情况，包括：
 * - R倍数（风险倍数）
 * - 触发价格
 * - 平仓百分比
 * - 新的止损价格
 * - 盈亏情况
 */

import { createClient } from "@libsql/client";
import { createLogger } from "../utils/logger";

const logger = createLogger({
  name: "migrate-partial-take-profit",
  level: "info",
});

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function migrate() {
  try {
    logger.info("开始迁移：添加分批止盈历史表...");
    
    // 创建分批止盈历史表
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS partial_take_profit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        stage INTEGER NOT NULL,
        r_multiple REAL NOT NULL,
        trigger_price REAL NOT NULL,
        close_percent REAL NOT NULL,
        closed_quantity REAL NOT NULL,
        remaining_quantity REAL NOT NULL,
        pnl REAL NOT NULL,
        new_stop_loss_price REAL,
        status TEXT NOT NULL DEFAULT 'completed',
        notes TEXT,
        timestamp TEXT NOT NULL,
        UNIQUE(symbol, stage)
      )
    `);
    
    logger.info("✅ 分批止盈历史表创建成功");
    
    // 创建索引以提高查询性能
    await dbClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_partial_tp_symbol ON partial_take_profit_history(symbol)
    `);
    
    await dbClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_partial_tp_timestamp ON partial_take_profit_history(timestamp)
    `);
    
    logger.info("✅ 索引创建成功");
    
    // 检查是否需要更新positions表
    const columnsResult = await dbClient.execute("PRAGMA table_info(positions)");
    const columns = columnsResult.rows.map((row: any) => row.name);
    
    if (!columns.includes("partial_close_percentage")) {
      logger.info("添加 partial_close_percentage 列到 positions 表...");
      await dbClient.execute(`
        ALTER TABLE positions ADD COLUMN partial_close_percentage REAL DEFAULT 0
      `);
      logger.info("✅ partial_close_percentage 列添加成功");
    } else {
      logger.info("✓ partial_close_percentage 列已存在");
    }
    
    logger.info("✅ 迁移完成！");
    
    // 显示表结构
    logger.info("\n分批止盈历史表结构:");
    const tableInfo = await dbClient.execute("PRAGMA table_info(partial_take_profit_history)");
    for (const row of tableInfo.rows) {
      logger.info(`  ${(row as any).name}: ${(row as any).type}`);
    }
    
  } catch (error: any) {
    logger.error(`迁移失败: ${error.message}`);
    throw error;
  }
}

// 执行迁移
migrate()
  .then(() => {
    logger.info("迁移脚本执行完毕");
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`迁移失败: ${error}`);
    process.exit(1);
  });
