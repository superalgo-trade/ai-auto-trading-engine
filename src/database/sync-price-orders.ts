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
 * 同步现有持仓的条件单到数据库
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { createPinoLogger } from "@voltagent/logger";
import { getExchangeClient } from "../exchanges/index.js";

const logger = createPinoLogger({
  name: "sync-price-orders",
  level: "info",
});

async function syncPriceOrders() {
  try {
    const dbUrl = process.env.DATABASE_URL || "file:./.voltagent/trading.db";
    logger.info(`连接数据库: ${dbUrl}`);

    const dbClient = createClient({
      url: dbUrl,
    });

    const exchangeClient = getExchangeClient();
    logger.info(`使用交易所: ${process.env.EXCHANGE || 'gate'}`);

    // 获取所有持仓
    const positions = await dbClient.execute(
      "SELECT symbol, side, quantity, stop_loss, profit_target, sl_order_id, tp_order_id FROM positions"
    );

    logger.info(`找到 ${positions.rows.length} 个持仓`);

    let syncCount = 0;
    let skipCount = 0;

    for (const pos of positions.rows) {
      const position = pos as any;
      const now = new Date().toISOString();

      // 检查止损订单
      if (position.sl_order_id && position.stop_loss) {
        // 检查是否已在数据库中
        const existing = await dbClient.execute({
          sql: "SELECT id FROM price_orders WHERE order_id = ?",
          args: [position.sl_order_id]
        });

        if (existing.rows.length === 0) {
          // 验证订单在交易所是否存在
          try {
            const orderDetail = await exchangeClient.getOrder(position.sl_order_id);
            const status = orderDetail.status === 'open' ? 'active' : 
                          orderDetail.status === 'finished' ? 'triggered' : 'cancelled';

            await dbClient.execute({
              sql: `INSERT INTO price_orders 
                    (order_id, symbol, side, type, trigger_price, order_price, quantity, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                position.sl_order_id,
                position.symbol,
                position.side,
                'stop_loss',
                position.stop_loss,
                0,
                position.quantity,
                status,
                now
              ]
            });
            logger.info(`✅ 同步止损单: ${position.symbol} ${position.sl_order_id} (${status})`);
            syncCount++;
          } catch (err: any) {
            logger.warn(`⚠️  止损单 ${position.sl_order_id} 不存在于交易所，可能已被触发或取消`);
            skipCount++;
          }
        } else {
          logger.debug(`止损单 ${position.sl_order_id} 已在数据库中`);
          skipCount++;
        }
      }

      // 检查止盈订单
      if (position.tp_order_id && position.profit_target) {
        // 检查是否已在数据库中
        const existing = await dbClient.execute({
          sql: "SELECT id FROM price_orders WHERE order_id = ?",
          args: [position.tp_order_id]
        });

        if (existing.rows.length === 0) {
          // 验证订单在交易所是否存在
          try {
            const orderDetail = await exchangeClient.getOrder(position.tp_order_id);
            const status = orderDetail.status === 'open' ? 'active' : 
                          orderDetail.status === 'finished' ? 'triggered' : 'cancelled';

            await dbClient.execute({
              sql: `INSERT INTO price_orders 
                    (order_id, symbol, side, type, trigger_price, order_price, quantity, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                position.tp_order_id,
                position.symbol,
                position.side,
                'take_profit',
                position.profit_target,
                0,
                position.quantity,
                status,
                now
              ]
            });
            logger.info(`✅ 同步止盈单: ${position.symbol} ${position.tp_order_id} (${status})`);
            syncCount++;
          } catch (err: any) {
            logger.warn(`⚠️  止盈单 ${position.tp_order_id} 不存在于交易所，可能已被触发或取消`);
            skipCount++;
          }
        } else {
          logger.debug(`止盈单 ${position.tp_order_id} 已在数据库中`);
          skipCount++;
        }
      }
    }

    logger.info(`\n同步完成:`);
    logger.info(`  新增条件单: ${syncCount}`);
    logger.info(`  跳过: ${skipCount}`);

    // 显示当前条件单统计
    const statsResult = await dbClient.execute(`
      SELECT 
        status,
        type,
        COUNT(*) as count
      FROM price_orders
      GROUP BY status, type
    `);

    logger.info(`\n当前条件单统计:`);
    for (const row of statsResult.rows) {
      const stat = row as any;
      logger.info(`  ${stat.type} (${stat.status}): ${stat.count}`);
    }

    dbClient.close();
  } catch (error: any) {
    logger.error(`❌ 同步失败: ${error.message}`);
    throw error;
  }
}

syncPriceOrders();
