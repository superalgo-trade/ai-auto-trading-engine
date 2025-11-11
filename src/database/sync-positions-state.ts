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
 * 同步交易所和数据库的持仓状态
 * 修复数据库持仓与交易所实际持仓不一致的问题
 */

import { createClient } from "@libsql/client";
import { createLogger } from "../utils/logger";
import { getExchangeClient } from "../exchanges";

const logger = createLogger({
  name: "sync-positions-state",
  level: "info",
});

async function syncPositionsState() {
  const dbClient = createClient({
    url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  });

  const exchangeClient = getExchangeClient();

  try {
    logger.info("============================================");
    logger.info("开始同步持仓状态...");
    logger.info("============================================");

    // 1. 获取数据库中的持仓
    const dbPositionsResult = await dbClient.execute(
      "SELECT * FROM positions WHERE 1=1"
    );
    const dbPositions = dbPositionsResult.rows;

    logger.info(`数据库中有 ${dbPositions.length} 个持仓记录`);

    // 2. 获取交易所的实际持仓
    const exchangePositions = await exchangeClient.getPositions();
    const activePositions = exchangePositions.filter(
      (p: any) => Math.abs(parseFloat(p.size || "0")) > 0
    );

    logger.info(`交易所有 ${activePositions.length} 个实际持仓`);

    // 3. 建立交易所持仓映射
    const exchangePositionMap = new Map();
    for (const pos of activePositions) {
      const symbol = exchangeClient.extractSymbol(pos.contract);
      const size = parseFloat(pos.size || "0");
      const side = size > 0 ? "long" : "short";
      exchangePositionMap.set(`${symbol}_${side}`, pos);
    }

    // 4. 检查数据库持仓是否存在于交易所
    const orphanedPositions: any[] = [];
    for (const dbPos of dbPositions) {
      const symbol = dbPos.symbol as string;
      const side = dbPos.side as string;
      const key = `${symbol}_${side}`;

      if (!exchangePositionMap.has(key)) {
        orphanedPositions.push(dbPos);
        logger.warn(
          `⚠️  数据库持仓 ${symbol} ${side} 在交易所不存在，可能已被平仓`
        );
      }
    }

    if (orphanedPositions.length === 0) {
      logger.info("✅ 所有数据库持仓都在交易所存在，无需同步");
      return;
    }

    // 5. 处理孤立的持仓记录
    logger.info(`\n发现 ${orphanedPositions.length} 个孤立持仓，开始处理...`);

    for (const dbPos of orphanedPositions) {
      const symbol = dbPos.symbol as string;
      const side = dbPos.side as string;
      const contract = exchangeClient.normalizeContract(symbol);

      logger.info(`\n处理 ${symbol} ${side}...`);

      // 6. 查找对应的条件单
      const priceOrdersResult = await dbClient.execute({
        sql: `SELECT * FROM price_orders 
              WHERE symbol = ? AND side = ? AND status = 'active'`,
        args: [symbol, side],
      });

      const activeOrders = priceOrdersResult.rows;

      if (activeOrders.length === 0) {
        logger.info(`  ${symbol} ${side} 没有活跃的条件单`);
      } else {
        logger.info(
          `  ${symbol} ${side} 有 ${activeOrders.length} 个活跃条件单`
        );

        // 7. 检查条件单是否在交易所存在
        try {
          const exchangePriceOrders = await exchangeClient.getPriceOrders(
            contract
          );
          const exchangeOrderIds = new Set(
            exchangePriceOrders.map(
              (o: any) =>
                o.id?.toString() ||
                o.orderId?.toString() ||
                o.order_id?.toString()
            )
          );

          for (const order of activeOrders) {
            const orderId = order.order_id as string;
            const orderType = order.type as string;

            if (!exchangeOrderIds.has(orderId)) {
              logger.info(
                `  ✅ 条件单 ${orderId} (${orderType}) 已不在交易所，可能已触发`
              );

              // 8. 查找平仓交易
              try {
                const trades = await exchangeClient.getMyTrades(contract, 500);
                const orderCreateTime = new Date(
                  order.created_at as string
                ).getTime();

                const closeTrades = trades.filter((t: any) => {
                  const tradeTime = t.timestamp || t.create_time || 0;
                  if (tradeTime <= orderCreateTime) return false;

                  const tradeSize =
                    typeof t.size === "number"
                      ? t.size
                      : parseFloat(t.size || "0");
                  const isCloseTrade =
                    (side === "long" && tradeSize < 0) ||
                    (side === "short" && tradeSize > 0);

                  return isCloseTrade;
                });

                if (closeTrades.length > 0) {
                  const closeTrade = closeTrades[0];
                  const closePrice = parseFloat(closeTrade.price);
                  const closeTime = new Date(
                    closeTrade.timestamp || closeTrade.create_time || Date.now()
                  ).toISOString();

                  logger.info(
                    `  📊 找到平仓交易: 价格=${closePrice}, 时间=${closeTime}`
                  );

                  // 9. 计算盈亏
                  const entryPrice = parseFloat(dbPos.entry_price as string);
                  const quantity = Math.abs(parseFloat(dbPos.quantity as string));
                  const leverage = parseInt(dbPos.leverage as string);

                  const pnl = await exchangeClient.calculatePnl(
                    entryPrice,
                    closePrice,
                    quantity,
                    side as "long" | "short",
                    contract
                  );

                  const priceChange =
                    side === "long"
                      ? (closePrice - entryPrice) / entryPrice
                      : (entryPrice - closePrice) / entryPrice;
                  const pnlPercent = priceChange * 100 * leverage;

                  logger.info(
                    `  💰 盈亏: ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`
                  );

                  // 10. 记录平仓事件
                  const closeReason =
                    orderType === "stop_loss"
                      ? "stop_loss_triggered"
                      : "take_profit_triggered";

                  await dbClient.execute({
                    sql: `INSERT INTO position_close_events 
                          (symbol, side, close_reason, trigger_type, trigger_price, close_price, entry_price, 
                           quantity, leverage, pnl, pnl_percent, fee, trigger_order_id, close_trade_id, order_id, created_at, processed)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                      symbol,
                      side,
                      closeReason,
                      "exchange_order",
                      parseFloat(order.trigger_price as string),
                      closePrice,
                      entryPrice,
                      quantity,
                      leverage,
                      pnl,
                      pnlPercent,
                      parseFloat(closeTrade.fee || "0"),
                      orderId,
                      closeTrade.id?.toString() || "",
                      orderId,
                      new Date().toISOString(),
                      0,
                    ],
                  });

                  // 11. 记录交易历史
                  await dbClient.execute({
                    sql: `INSERT INTO trades 
                          (order_id, symbol, side, type, price, quantity, leverage, pnl, fee, timestamp, status)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                      closeTrade.id?.toString() || orderId,
                      symbol,
                      side,
                      "close",
                      closePrice,
                      quantity,
                      leverage,
                      pnl,
                      closeTrade.fee || "0",
                      closeTime,
                      "filled",
                    ],
                  });

                  logger.info(`  ✅ 已记录平仓事件和交易历史`);
                } else {
                  logger.warn(`  ⚠️  未找到平仓交易记录，使用触发价估算`);
                  
                  // 使用触发价估算
                  const triggerPrice = parseFloat(order.trigger_price as string);
                  const entryPrice = parseFloat(dbPos.entry_price as string);
                  const quantity = Math.abs(parseFloat(dbPos.quantity as string));
                  const leverage = parseInt(dbPos.leverage as string);

                  const pnl = await exchangeClient.calculatePnl(
                    entryPrice,
                    triggerPrice,
                    quantity,
                    side as "long" | "short",
                    contract
                  );

                  const priceChange =
                    side === "long"
                      ? (triggerPrice - entryPrice) / entryPrice
                      : (entryPrice - triggerPrice) / entryPrice;
                  const pnlPercent = priceChange * 100 * leverage;

                  logger.info(
                    `  💰 估算盈亏: ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`
                  );

                  // 记录平仓事件（使用触发价）
                  const closeReason =
                    orderType === "stop_loss"
                      ? "stop_loss_triggered"
                      : "take_profit_triggered";

                  await dbClient.execute({
                    sql: `INSERT INTO position_close_events 
                          (symbol, side, close_reason, trigger_type, trigger_price, close_price, entry_price, 
                           quantity, leverage, pnl, pnl_percent, fee, trigger_order_id, close_trade_id, order_id, created_at, processed)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                      symbol,
                      side,
                      closeReason,
                      "exchange_order",
                      triggerPrice,
                      triggerPrice,
                      entryPrice,
                      quantity,
                      leverage,
                      pnl,
                      pnlPercent,
                      0,
                      orderId,
                      `estimated_${orderId}`,
                      orderId,
                      new Date().toISOString(),
                      0,
                    ],
                  });

                  logger.info(`  ✅ 已记录平仓事件（使用触发价估算）`);
                }
              } catch (tradeError) {
                logger.error(`  ❌ 查找平仓交易失败:`, tradeError);
              }

              // 12. 更新条件单状态
              await dbClient.execute({
                sql: `UPDATE price_orders SET status = 'triggered', updated_at = ?, triggered_at = ? WHERE order_id = ?`,
                args: [new Date().toISOString(), new Date().toISOString(), orderId],
              });

              logger.info(`  ✅ 已更新条件单 ${orderId} 状态为 triggered`);
            } else {
              logger.info(`  ℹ️  条件单 ${orderId} (${orderType}) 仍在交易所活跃`);
            }
          }
        } catch (error) {
          logger.error(`  ❌ 查询交易所条件单失败:`, error);
        }
      }

      // 13. 删除孤立的持仓记录
      await dbClient.execute({
        sql: `DELETE FROM positions WHERE symbol = ? AND side = ?`,
        args: [symbol, side],
      });

      logger.info(`  ✅ 已删除孤立持仓记录 ${symbol} ${side}`);
    }

    logger.info("\n============================================");
    logger.info("✅ 持仓状态同步完成");
    logger.info("============================================");
  } catch (error) {
    logger.error("同步持仓状态失败:", error);
    throw error;
  } finally {
    dbClient.close();
  }
}

// 执行同步
syncPositionsState()
  .then(() => {
    logger.info("同步任务完成");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("同步任务失败:", error);
    process.exit(1);
  });
