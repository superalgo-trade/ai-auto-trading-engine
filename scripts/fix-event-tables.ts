/**
 * 修复position_close_events和partial_take_profit_history表中的错误PNL数据
 * 
 * 问题：这两个表中的PNL数据还是旧的错误值（乘以了杠杆）
 * 解决方案：从已修复的trades表中获取正确的PNL，更新到事件表
 */

import { createClient } from "@libsql/client";
import "dotenv/config";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function fixEventTables() {
  console.log("🔧 开始修复事件表中的PNL数据...\n");

  try {
    // 1. 修复position_close_events表
    console.log("📋 修复 position_close_events 表...");
    
    const closeEventsResult = await dbClient.execute(
      "SELECT * FROM position_close_events WHERE close_reason = 'partial_close' ORDER BY created_at DESC"
    );

    if (!closeEventsResult.rows || closeEventsResult.rows.length === 0) {
      console.log("  ❌ 没有找到分批平仓事件记录");
    } else {
      console.log(`  📊 找到 ${closeEventsResult.rows.length} 条分批平仓事件\n`);

      let fixedCount = 0;

      for (const eventRow of closeEventsResult.rows) {
        const symbol = eventRow.symbol as string;
        const closePrice = Number.parseFloat(eventRow.close_price as string);
        const quantity = Number.parseFloat(eventRow.quantity as string);
        const oldPnl = Number.parseFloat(eventRow.pnl as string);

        // 从trades表查找匹配的记录
        const tradesResult = await dbClient.execute({
          sql: `SELECT pnl, fee FROM trades 
                WHERE symbol = ? 
                AND type = 'close'
                AND ABS(price - ?) < 0.1
                AND ABS(quantity - ?) < 0.1
                LIMIT 1`,
          args: [symbol, closePrice, quantity],
        });

        if (tradesResult.rows && tradesResult.rows.length > 0) {
          const tradeRow = tradesResult.rows[0];
          const correctPnl = Number.parseFloat(tradeRow.pnl as string);
          const correctFee = Number.parseFloat(tradeRow.fee as string);

          // 检查是否需要更新
          const pnlDiff = Math.abs(oldPnl - correctPnl);
          if (pnlDiff > 1) {  // 差异超过1美元
            // 重新计算盈亏百分比
            const entryPrice = Number.parseFloat(eventRow.entry_price as string);
            const side = eventRow.side as string;
            const leverage = Number.parseInt(eventRow.leverage as string);
            
            const pnlPercent = entryPrice > 0 
              ? ((closePrice - entryPrice) / entryPrice * 100 * (side === 'long' ? 1 : -1) * leverage)
              : 0;

            await dbClient.execute({
              sql: `UPDATE position_close_events 
                    SET pnl = ?, pnl_percent = ?, fee = ?
                    WHERE id = ?`,
              args: [correctPnl, pnlPercent, correctFee, eventRow.id],
            });

            console.log(`  ✅ 修复 ${symbol}: ${oldPnl.toFixed(2)} → ${correctPnl.toFixed(2)} USDT`);
            fixedCount++;
          }
        }
      }

      console.log(`\n  📊 position_close_events 表: 修复 ${fixedCount} 条记录\n`);
    }

    // 2. 修复partial_take_profit_history表
    console.log("📋 修复 partial_take_profit_history 表...");
    
    const historyResult = await dbClient.execute(
      "SELECT * FROM partial_take_profit_history ORDER BY timestamp DESC"
    );

    if (!historyResult.rows || historyResult.rows.length === 0) {
      console.log("  ❌ 没有找到分批止盈历史记录");
    } else {
      console.log(`  📊 找到 ${historyResult.rows.length} 条分批止盈历史\n`);

      let fixedCount = 0;

      for (const historyRow of historyResult.rows) {
        const symbol = historyRow.symbol as string;
        const triggerPrice = Number.parseFloat(historyRow.trigger_price as string);
        const closedQuantity = Number.parseFloat(historyRow.closed_quantity as string);
        const oldPnl = Number.parseFloat(historyRow.pnl as string);

        // 从trades表查找匹配的记录
        const tradesResult = await dbClient.execute({
          sql: `SELECT pnl FROM trades 
                WHERE symbol = ? 
                AND type = 'close'
                AND ABS(price - ?) < 0.1
                AND ABS(quantity - ?) < 0.1
                LIMIT 1`,
          args: [symbol, triggerPrice, closedQuantity],
        });

        if (tradesResult.rows && tradesResult.rows.length > 0) {
          const tradeRow = tradesResult.rows[0];
          const correctPnl = Number.parseFloat(tradeRow.pnl as string);

          // 检查是否需要更新
          const pnlDiff = Math.abs(oldPnl - correctPnl);
          if (pnlDiff > 1) {  // 差异超过1美元
            await dbClient.execute({
              sql: `UPDATE partial_take_profit_history 
                    SET pnl = ?
                    WHERE id = ?`,
              args: [correctPnl, historyRow.id],
            });

            console.log(`  ✅ 修复 ${symbol} Stage${historyRow.stage}: ${oldPnl.toFixed(2)} → ${correctPnl.toFixed(2)} USDT`);
            fixedCount++;
          }
        }
      }

      console.log(`\n  📊 partial_take_profit_history 表: 修复 ${fixedCount} 条记录\n`);
    }

    console.log("=" .repeat(50));
    console.log("✅ 所有事件表修复完成！");
    console.log("=".repeat(50));

  } catch (error: any) {
    console.error("❌ 修复过程出错:", error);
    throw error;
  }
}

// 执行修复
fixEventTables()
  .then(() => {
    console.log("\n✅ 修复完成！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 修复失败:", error);
    process.exit(1);
  });
