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
 * 数据库迁移：修复 partial_take_profit_history 表字段
 * 
 * 添加缺失字段：
 * - side: 持仓方向 (long/short)
 * - order_id: 关联的交易订单ID（trades表）
 */

import { createClient } from "@libsql/client";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  syncUrl: process.env.DATABASE_SYNC_URL,
  syncInterval: 1000,
});

async function migrate() {
  console.log("开始迁移：修复 partial_take_profit_history 表字段...");
  
  try {
    // 检查表是否存在
    const tableExists = await dbClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='partial_take_profit_history'"
    );
    
    if (tableExists.rows.length === 0) {
      console.log("⚠️ 表 partial_take_profit_history 不存在，跳过迁移");
      return;
    }
    
    // 检查字段是否已存在
    const tableInfo = await dbClient.execute("PRAGMA table_info(partial_take_profit_history)");
    const columns = tableInfo.rows.map((row: any) => row.name);
    
    const needsSide = !columns.includes("side");
    const needsOrderId = !columns.includes("order_id");
    
    if (!needsSide && !needsOrderId) {
      console.log("✅ 字段已存在，无需迁移");
      return;
    }
    
    // 添加 side 字段
    if (needsSide) {
      console.log("添加 side 字段...");
      await dbClient.execute(
        "ALTER TABLE partial_take_profit_history ADD COLUMN side TEXT"
      );
      console.log("✅ side 字段已添加");
    }
    
    // 添加 order_id 字段
    if (needsOrderId) {
      console.log("添加 order_id 字段...");
      await dbClient.execute(
        "ALTER TABLE partial_take_profit_history ADD COLUMN order_id TEXT"
      );
      console.log("✅ order_id 字段已添加");
    }
    
    // 尝试从 position_close_events 回填已有记录的 side 字段
    if (needsSide) {
      console.log("回填已有记录的 side 字段...");
      const historyRecords = await dbClient.execute(
        "SELECT id, symbol, timestamp FROM partial_take_profit_history WHERE side IS NULL"
      );
      
      for (const record of historyRecords.rows) {
        // 尝试从 position_close_events 表查找对应的记录
        const closeEvent = await dbClient.execute({
          sql: `SELECT side FROM position_close_events 
                WHERE symbol = ? AND close_reason = 'partial_close'
                ORDER BY ABS(JULIANDAY(created_at) - JULIANDAY(?)) ASC
                LIMIT 1`,
          args: [record.symbol, record.timestamp]
        });
        
        if (closeEvent.rows.length > 0) {
          await dbClient.execute({
            sql: "UPDATE partial_take_profit_history SET side = ? WHERE id = ?",
            args: [closeEvent.rows[0].side, record.id]
          });
        }
      }
      console.log(`✅ 已回填 ${historyRecords.rows.length} 条记录的 side 字段`);
    }
    
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
