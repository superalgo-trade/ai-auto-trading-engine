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
 * 数据库迁移 - 添加 position_close_events 表
 * 
 * 此表用于记录所有平仓事件（止损/止盈触发、手动平仓等），供AI决策使用
 */

import { createClient } from "@libsql/client";
import { createLogger } from "../utils/logger";

const logger = createLogger({
  name: "migrate-add-close-events",
  level: "info",
});

async function migrate() {
  const dbClient = createClient({
    url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  });

  try {
    logger.info("开始迁移：添加 position_close_events 表...");

    // 创建 position_close_events 表
    await dbClient.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS position_close_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          side TEXT NOT NULL,
          close_reason TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          trigger_price REAL,
          close_price REAL NOT NULL,
          entry_price REAL NOT NULL,
          quantity REAL NOT NULL,
          leverage INTEGER NOT NULL,
          pnl REAL NOT NULL,
          pnl_percent REAL NOT NULL,
          fee REAL,
          trigger_order_id TEXT,
          close_trade_id TEXT,
          order_id TEXT,
          created_at TEXT NOT NULL,
          processed INTEGER DEFAULT 0
        )
      `
    });

    logger.info("✅ 创建 position_close_events 表成功");

    // 创建索引
    await dbClient.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_close_events_processed ON position_close_events(processed, created_at)`
    });

    logger.info("✅ 创建索引 idx_close_events_processed 成功");

    await dbClient.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_close_events_symbol ON position_close_events(symbol)`
    });

    logger.info("✅ 创建索引 idx_close_events_symbol 成功");

    // 验证表是否创建成功
    const result = await dbClient.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='position_close_events'`
    });

    if (result.rows.length > 0) {
      logger.info("✅ 迁移成功：position_close_events 表已创建");
      
      // 显示表结构
      const schema = await dbClient.execute({
        sql: `PRAGMA table_info(position_close_events)`
      });
      
      logger.info("表结构:");
      for (const col of schema.rows) {
        logger.info(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
      }
    } else {
      logger.error("❌ 迁移失败：position_close_events 表未创建");
      process.exit(1);
    }

  } catch (error: any) {
    logger.error("迁移失败:", error);
    process.exit(1);
  }
}

// 执行迁移
migrate()
  .then(() => {
    logger.info("迁移完成");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("迁移异常:", error);
    process.exit(1);
  });
