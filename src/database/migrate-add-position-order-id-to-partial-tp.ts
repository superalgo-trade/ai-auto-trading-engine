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
 * 数据库迁移：为 partial_take_profit_history 表添加 position_order_id 字段
 * 
 * 问题背景：
 * - 之前的分批止盈历史只通过 symbol 查询，导致同一币种不同持仓的历史混淆
 * - 例如：XRP 第一次开仓分批止盈后平仓，再次开仓时会误认为已完成阶段1-2
 * 
 * 解决方案：
 * - 添加 position_order_id 字段关联开仓订单ID
 * - 查询时同时使用 symbol 和 position_order_id 精确匹配
 */

import { createClient } from "@libsql/client";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  syncUrl: process.env.DATABASE_SYNC_URL,
  syncInterval: 1000,
});

async function migrate() {
  try {
    console.log("开始迁移：为 partial_take_profit_history 表添加 position_order_id 字段...");

    // 1. 检查表是否存在
    const tableCheck = await dbClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='partial_take_profit_history'"
    );

    if (tableCheck.rows.length === 0) {
      console.log("⚠️ 表 partial_take_profit_history 不存在，跳过迁移");
      return;
    }

    // 2. 检查字段是否已存在
    const tableInfo = await dbClient.execute("PRAGMA table_info(partial_take_profit_history)");
    const hasPositionOrderId = tableInfo.rows.some((row: any) => row.name === 'position_order_id');

    if (hasPositionOrderId) {
      console.log("✅ position_order_id 字段已存在，跳过迁移");
    } else {
      // 3. 添加 position_order_id 字段
      await dbClient.execute(
        "ALTER TABLE partial_take_profit_history ADD COLUMN position_order_id TEXT"
      );
      console.log("✅ 成功添加 position_order_id 字段");

      // 4. 创建索引
      await dbClient.execute(
        "CREATE INDEX IF NOT EXISTS idx_partial_taking_profit_position_order_id ON partial_take_profit_history(position_order_id)"
      );
      console.log("✅ 成功创建 position_order_id 索引");
    }

    // 5. 尝试为现有记录填充 position_order_id
    // 策略：从 price_orders 表中查找对应的 position_order_id
    console.log("尝试为现有记录填充 position_order_id...");
    
    const existingRecords = await dbClient.execute(
      "SELECT id, symbol, order_id, timestamp FROM partial_take_profit_history WHERE position_order_id IS NULL"
    );

    let updatedCount = 0;
    for (const record of existingRecords.rows) {
      if (!record.order_id) continue;

      // 尝试从 trades 表找到对应的平仓订单
      const tradeResult = await dbClient.execute({
        sql: "SELECT order_id FROM trades WHERE order_id = ? AND type = 'close' LIMIT 1",
        args: [record.order_id]
      });

      if (tradeResult.rows.length === 0) continue;

      // 通过 symbol 和时间范围从 price_orders 找到对应的开仓订单ID
      const priceOrderResult = await dbClient.execute({
        sql: `SELECT position_order_id FROM price_orders 
              WHERE symbol LIKE ? 
              AND position_order_id IS NOT NULL 
              AND created_at <= ? 
              ORDER BY created_at DESC 
              LIMIT 1`,
        args: [`%${record.symbol}%`, record.timestamp]
      });

      if (priceOrderResult.rows.length > 0 && priceOrderResult.rows[0].position_order_id) {
        await dbClient.execute({
          sql: "UPDATE partial_take_profit_history SET position_order_id = ? WHERE id = ?",
          args: [priceOrderResult.rows[0].position_order_id, record.id]
        });
        updatedCount++;
      }
    }

    console.log(`✅ 成功为 ${updatedCount} 条记录填充 position_order_id`);
    console.log("迁移完成！");
    
  } catch (error: any) {
    console.error("迁移失败:", error.message);
    throw error;
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
