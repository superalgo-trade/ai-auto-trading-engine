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
 * 数据库迁移：添加 price_orders 表（条件单表）
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { createPinoLogger } from "@voltagent/logger";

const logger = createPinoLogger({
  name: "db-migrate",
  level: "info",
});

async function migrate() {
  try {
    const dbUrl = process.env.DATABASE_URL || "file:./.voltagent/trading.db";
    logger.info(`连接数据库: ${dbUrl}`);

    const client = createClient({
      url: dbUrl,
    });

    logger.info("开始迁移：添加 price_orders 表...");

    // 创建条件单表
    await client.execute(`
      CREATE TABLE IF NOT EXISTS price_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL UNIQUE,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        type TEXT NOT NULL,
        trigger_price REAL NOT NULL,
        order_price REAL NOT NULL,
        quantity REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT,
        triggered_at TEXT
      )
    `);

    // 创建索引
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_price_orders_symbol ON price_orders(symbol)
    `);
    
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_price_orders_status ON price_orders(status)
    `);
    
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_price_orders_order_id ON price_orders(order_id)
    `);

    logger.info("✅ 迁移成功：price_orders 表已创建");

    // 显示当前条件单数量
    const countResult = await client.execute(
      "SELECT COUNT(*) as count FROM price_orders"
    );
    const count = (countResult.rows[0] as any).count as number;
    logger.info(`当前条件单数量: ${count}`);

    client.close();
  } catch (error: any) {
    logger.error(`❌ 迁移失败: ${error.message}`);
    throw error;
  }
}

migrate();
