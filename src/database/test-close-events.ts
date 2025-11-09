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
 * 测试平仓事件记录功能
 */

import { createClient } from "@libsql/client";
import { createLogger } from "../utils/logger";
import { formatChinaTime } from "../utils/timeUtils";

const logger = createLogger({
  name: "test-close-events",
  level: "info",
});

async function testCloseEvents() {
  const dbClient = createClient({
    url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  });

  try {
    logger.info("开始测试平仓事件功能...\n");

    // 1. 检查表是否存在
    logger.info("1. 检查 position_close_events 表...");
    const tableCheck = await dbClient.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='position_close_events'`
    });

    if (tableCheck.rows.length === 0) {
      logger.error("❌ position_close_events 表不存在！");
      logger.info("请先运行: npx tsx src/database/migrate-add-close-events.ts");
      return;
    }
    logger.info("✅ position_close_events 表存在\n");

    // 2. 插入测试数据
    logger.info("2. 插入测试平仓事件...");
    const testEvent = {
      symbol: 'BTC',
      side: 'long',
      close_reason: 'take_profit_triggered',
      trigger_price: 95000,
      close_price: 95100,
      entry_price: 90000,
      quantity: 0.01,
      pnl: 51,
      pnl_percent: 5.67,
      trigger_order_id: 'test_tp_123',
      close_trade_id: 'test_trade_456',
      created_at: new Date().toISOString(),
      processed: 0
    };

    await dbClient.execute({
      sql: `INSERT INTO position_close_events 
            (symbol, side, close_reason, trigger_price, close_price, entry_price, 
             quantity, pnl, pnl_percent, trigger_order_id, close_trade_id, created_at, processed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testEvent.symbol,
        testEvent.side,
        testEvent.close_reason,
        testEvent.trigger_price,
        testEvent.close_price,
        testEvent.entry_price,
        testEvent.quantity,
        testEvent.pnl,
        testEvent.pnl_percent,
        testEvent.trigger_order_id,
        testEvent.close_trade_id,
        testEvent.created_at,
        testEvent.processed
      ]
    });
    logger.info("✅ 测试事件已插入\n");

    // 3. 查询24小时内的事件
    logger.info("3. 查询近期平仓事件...");
    const result = await dbClient.execute({
      sql: `SELECT * FROM position_close_events 
            WHERE created_at > datetime('now', '-24 hours')
            ORDER BY created_at DESC
            LIMIT 10`
    });

    logger.info(`✅ 找到 ${result.rows.length} 条近期事件:`);
    for (const row of result.rows) {
      const e = row as any;
      logger.info(`  - ${e.symbol} ${e.side} | ${e.close_reason}`);
      logger.info(`    盈亏: ${e.pnl >= 0 ? '+' : ''}${e.pnl} USDT (${e.pnl_percent >= 0 ? '+' : ''}${e.pnl_percent}%)`);
      logger.info(`    时间: ${formatChinaTime(e.created_at)}`);
      logger.info(`    已处理: ${e.processed ? '是' : '否'}`);
      logger.info('');
    }

    // 4. 测试标记为已处理
    logger.info("4. 测试标记事件为已处理...");
    await dbClient.execute({
      sql: `UPDATE position_close_events 
            SET processed = 1 
            WHERE created_at > datetime('now', '-24 hours') AND processed = 0`
    });
    logger.info("✅ 所有未处理事件已标记\n");

    // 5. 验证标记结果
    logger.info("5. 验证标记结果...");
    const processedCheck = await dbClient.execute({
      sql: `SELECT COUNT(*) as count FROM position_close_events 
            WHERE processed = 0 AND created_at > datetime('now', '-24 hours')`
    });
    const unprocessedCount = (processedCheck.rows[0] as any).count;
    
    if (unprocessedCount === 0) {
      logger.info("✅ 所有事件已正确标记为已处理\n");
    } else {
      logger.warn(`⚠️  仍有 ${unprocessedCount} 个未处理事件\n`);
    }

    // 6. 清理测试数据
    logger.info("6. 清理测试数据...");
    await dbClient.execute({
      sql: `DELETE FROM position_close_events WHERE trigger_order_id = ?`,
      args: [testEvent.trigger_order_id]
    });
    logger.info("✅ 测试数据已清理\n");

    logger.info("✅ 平仓事件功能测试完成！");

  } catch (error: any) {
    logger.error("测试失败:", error);
    process.exit(1);
  } finally {
    dbClient.close();
  }
}

// 执行测试
testCloseEvents()
  .then(() => {
    logger.info("\n所有测试通过 ✅");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("\n测试异常:", error);
    process.exit(1);
  });
