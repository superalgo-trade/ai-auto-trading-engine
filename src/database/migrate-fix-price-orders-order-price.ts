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
 * 数据库迁移：修复 price_orders 表的 order_price 字段
 * 
 * 问题：order_price 字段定义为 NOT NULL，但条件单（止损/止盈）通常不需要订单价格
 * 解决：将 order_price 改为可空，默认值为 0
 */

import { createClient } from "@libsql/client";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  syncUrl: process.env.DATABASE_SYNC_URL,
  syncInterval: 1000,
});

async function migrate() {
  console.log("开始迁移：修复 price_orders 表的 order_price 字段...");
  
  try {
    // 检查表是否存在
    const tableExists = await dbClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='price_orders'"
    );
    
    if (tableExists.rows.length === 0) {
      console.log("⚠️ 表 price_orders 不存在，跳过迁移");
      return;
    }
    
    // SQLite 不支持直接修改列定义，需要重建表
    console.log("📊 开始重建 price_orders 表...");
    
    // 1. 创建临时表
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS price_orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL UNIQUE,
        position_order_id TEXT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        type TEXT NOT NULL,
        trigger_price REAL NOT NULL,
        order_price REAL DEFAULT 0,
        quantity REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT,
        triggered_at TEXT
      )
    `);
    console.log("✅ 临时表已创建");
    
    // 2. 复制数据，将 NULL 的 order_price 设为 0
    await dbClient.execute(`
      INSERT INTO price_orders_new 
      SELECT id, order_id, position_order_id, symbol, side, type, trigger_price, 
             COALESCE(order_price, 0) as order_price, 
             quantity, status, created_at, updated_at, triggered_at
      FROM price_orders
    `);
    console.log("✅ 数据已复制");
    
    // 3. 删除旧表
    await dbClient.execute("DROP TABLE price_orders");
    console.log("✅ 旧表已删除");
    
    // 4. 重命名新表
    await dbClient.execute("ALTER TABLE price_orders_new RENAME TO price_orders");
    console.log("✅ 新表已重命名");
    
    // 5. 重新创建索引
    await dbClient.execute("CREATE INDEX IF NOT EXISTS idx_price_orders_symbol ON price_orders(symbol)");
    await dbClient.execute("CREATE INDEX IF NOT EXISTS idx_price_orders_status ON price_orders(status)");
    await dbClient.execute("CREATE INDEX IF NOT EXISTS idx_price_orders_order_id ON price_orders(order_id)");
    console.log("✅ 索引已重建");
    
    console.log("✅ 迁移完成");
    
  } catch (error: any) {
    console.error("❌ 迁移失败:", error.message);
    throw error;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      console.log("迁移脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("迁移脚本执行失败:", error);
      process.exit(1);
    });
}

export { migrate };
