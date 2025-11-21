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
 * API 路由
 */
import { Hono } from "hono";
import { parsePositionSize } from "../utils";
import { serveStatic } from "@hono/node-server/serve-static";
import { createClient } from "@libsql/client";
import { getExchangeClient } from "../exchanges";
import { createLogger } from "../utils/logger";
import { formatPrice, formatUSDT, formatPercent, getDecimalPlacesBySymbol } from "../utils/priceFormatter";
import { performHealthCheck } from "../scheduler/healthCheck";

const logger = createLogger({
  name: "api-routes",
  level: "info",
});

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  syncUrl: process.env.DATABASE_SYNC_URL,
  syncInterval: 1000, // 每秒同步一次
});

// 价格缓存
interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

let priceCache: PriceCache | null = null;
const PRICE_CACHE_TTL = 5000; // 5秒缓存

export function createApiRoutes() {
  const app = new Hono();

  // 静态文件服务 - 需要使用绝对路径
  app.use("/*", serveStatic({ root: "./public" }));

  /**
   * 获取账户总览
   * 
   * 账户结构（统一接口，兼容 Gate.io 和 Binance）：
   * - account.total = available + positionMargin
   * - account.total 不包含未实现盈亏
   * - 真实总资产 = account.total + unrealisedPnl
   * 
   * Gate.io 特点：
   * - 币本位反向合约，保证金以 USDT 计价
   * - account.total 不含未实现盈亏
   * 
   * Binance 特点：
   * - USDT 本位正向合约，保证金直接以 USDT 计价
   * - account.total 不含未实现盈亏
   * 
   * API返回说明：
   * - totalBalance: 不包含未实现盈亏的总资产（用于计算已实现收益）
   * - unrealisedPnl: 当前持仓的未实现盈亏
   * 
   * 前端显示：
   * - 总资产显示 = totalBalance + unrealisedPnl（实时反映持仓盈亏）
   */
  app.get("/api/account", async (c) => {
    try {
      const exchangeClient = getExchangeClient();
      const account = await exchangeClient.getFuturesAccount();
      
      // 从数据库获取初始资金
      const initialResult = await dbClient.execute(
        "SELECT total_value FROM account_history ORDER BY timestamp ASC LIMIT 1"
      );
      const initialBalance = initialResult.rows[0]
        ? Number.parseFloat(initialResult.rows[0].total_value as string)
        : 100;
      
      // 统一处理：account.total 不包含未实现盈亏（Gate.io 和 Binance 都是如此）
      // 总资产（不含未实现盈亏）= account.total
      const unrealisedPnl = Number.parseFloat(account.unrealisedPnl || "0");
      const totalBalance = Number.parseFloat(account.total || "0");
      
      // 收益率 = (总资产 - 初始资金) / 初始资金 * 100
      // 总资产不包含未实现盈亏，收益率反映已实现盈亏
      const returnPercent = ((totalBalance - initialBalance) / initialBalance) * 100;
      
      return c.json({
        totalBalance,  // 总资产（不包含未实现盈亏）
        availableBalance: Number.parseFloat(account.available || "0"),
        positionMargin: Number.parseFloat(account.positionMargin || "0"),
        unrealisedPnl,
        returnPercent,  // 收益率（不包含未实现盈亏）
        initialBalance,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取当前持仓 - 从交易所获取实时数据（兼容 Gate.io 和 Binance）
   */
  app.get("/api/positions", async (c) => {
    try {
      const exchangeClient = getExchangeClient();
      const exchangePositions = await exchangeClient.getPositions();
      
      // 从数据库获取止损止盈信息
      const dbResult = await dbClient.execute("SELECT symbol, stop_loss, profit_target FROM positions");
      const dbPositionsMap = new Map(
        dbResult.rows.map((row: any) => [row.symbol, row])
      );
      
      // 过滤并格式化持仓
      const positions = exchangePositions
        .filter((p: any) => parsePositionSize(p.size) !== 0)
        .map((p: any) => {
          const size = parsePositionSize(p.size);
          const symbol = exchangeClient.extractSymbol(p.contract);
          const dbPos = dbPositionsMap.get(symbol);
          const entryPrice = Number.parseFloat(p.entryPrice || "0");
          const quantity = Math.abs(size);
          const leverage = Number.parseInt(p.leverage || "1");
          
          // 开仓价值（保证金）: 从交易所 API 直接获取（Gate.io 和 Binance 都支持）
          const openValue = Number.parseFloat(p.margin || "0");
          
          return {
            symbol,
            quantity,
            entryPrice,
            currentPrice: Number.parseFloat(p.markPrice || "0"),
            liquidationPrice: Number.parseFloat(p.liqPrice || "0"),
            unrealizedPnl: Number.parseFloat(p.unrealisedPnl || "0"),
            leverage,
            side: size > 0 ? "long" : "short",
            openValue,
            profitTarget: dbPos?.profit_target ? Number(dbPos.profit_target) : null,
            stopLoss: dbPos?.stop_loss ? Number(dbPos.stop_loss) : null,
            openedAt: p.create_time || new Date().toISOString(),
          };
        });
      
      return c.json({ 
        positions,
        count: positions.length 
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取账户价值历史（用于绘图）
   */
  app.get("/api/history", async (c) => {
    try {
      const limitParam = c.req.query("limit");
      
      let result;
      if (limitParam) {
        // 如果传递了 limit 参数，使用 LIMIT 子句
        const limit = Number.parseInt(limitParam);
        result = await dbClient.execute({
          sql: `SELECT timestamp, total_value, unrealized_pnl, return_percent 
                FROM account_history 
                ORDER BY timestamp DESC 
                LIMIT ?`,
          args: [limit],
        });
      } else {
        // 如果没有传递 limit 参数，返回全部数据
        result = await dbClient.execute(
          `SELECT timestamp, total_value, unrealized_pnl, return_percent 
           FROM account_history 
           ORDER BY timestamp DESC`
        );
      }
      
      const history = result.rows.map((row: any) => ({
        timestamp: row.timestamp,
        totalValue: Number.parseFloat(row.total_value as string) || 0,
        unrealizedPnl: Number.parseFloat(row.unrealized_pnl as string) || 0,
        returnPercent: Number.parseFloat(row.return_percent as string) || 0,
      })).reverse(); // 反转，使时间从旧到新
      
      return c.json({ history });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取交易记录 - 从数据库获取历史仓位（已平仓的记录）
   */
  app.get("/api/trades", async (c) => {
    try {
      const limit = Number.parseInt(c.req.query("limit") || "10");
      const symbol = c.req.query("symbol"); // 可选，筛选特定币种
      
      // 从数据库获取历史交易记录，按实际时间倒序（最新平仓的在最前面）
      // 使用 strftime 将不同格式的时间戳统一转换为Unix时间戳进行排序，避免字符串比较导致的排序错误
      let sql = `SELECT * FROM trades ORDER BY strftime('%s', timestamp) DESC LIMIT ?`;
      let args: any[] = [limit];
      
      if (symbol) {
        sql = `SELECT * FROM trades WHERE symbol = ? ORDER BY strftime('%s', timestamp) DESC LIMIT ?`;
        args = [symbol, limit];
      }
      
      const result = await dbClient.execute({
        sql,
        args,
      });
      
      if (!result.rows || result.rows.length === 0) {
        return c.json({ trades: [] });
      }
      
      // 转换数据库格式到前端需要的格式
      const trades = result.rows.map((row: any) => {
        // 标准化时间戳格式：统一转换为UTC ISO格式
        let normalizedTimestamp = row.timestamp;
        try {
          const date = new Date(row.timestamp as string);
          if (!isNaN(date.getTime())) {
            normalizedTimestamp = date.toISOString();
          }
        } catch (e) {
          logger.warn(`时间戳格式异常: ${row.timestamp}`);
        }
        
        return {
          id: row.id,
          orderId: row.order_id,
          symbol: row.symbol,
          side: row.side, // long/short
          type: row.type, // open/close
          price: Number.parseFloat(row.price || "0"),
          quantity: Number.parseFloat(row.quantity || "0"),
          leverage: Number.parseInt(row.leverage || "1"),
          pnl: row.pnl ? Number.parseFloat(row.pnl) : null,
          fee: Number.parseFloat(row.fee || "0"),
          timestamp: normalizedTimestamp,
          status: row.status,
        };
      });
      
      return c.json({ trades });
    } catch (error: any) {
      logger.error("获取历史仓位失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取完整交易记录 - 合并开仓和平仓记录，并关联平仓原因
   */
  app.get("/api/completed-trades", async (c) => {
    try {
      const limit = Number.parseInt(c.req.query("limit") || "50");
      
      // 获取所有平仓记录，并关联平仓事件表获取平仓原因
      // 使用 strftime 将不同格式的时间戳统一转换为Unix时间戳进行排序
      const result = await dbClient.execute({
        sql: `SELECT t.*, pce.close_reason
              FROM trades t
              LEFT JOIN position_close_events pce ON t.order_id = pce.order_id
              WHERE t.type = 'close' 
              ORDER BY strftime('%s', t.timestamp) DESC 
              LIMIT ?`,
        args: [limit],
      });
      
      if (!result.rows || result.rows.length === 0) {
        return c.json({ trades: [] });
      }
      
      // 对于每个平仓记录，找到对应的开仓记录
      const completedTrades = [];
      
      for (const closeRow of result.rows) {
        // 查找对应的开仓记录（同币种、同方向、时间更早）
        const openResult = await dbClient.execute({
          sql: `SELECT * FROM trades 
                WHERE symbol = ? 
                AND side = ? 
                AND type = 'open' 
                AND timestamp < ?
                ORDER BY timestamp DESC 
                LIMIT 1`,
          args: [closeRow.symbol, closeRow.side, closeRow.timestamp],
        });
        
        if (openResult.rows && openResult.rows.length > 0) {
          const openRow = openResult.rows[0];
          
          // 计算持仓时间 - 统一处理时间戳格式，兼容币安和Gate.io
          const openTime = new Date(openRow.timestamp as string);
          const closeTime = new Date(closeRow.timestamp as string);
          
          // 验证时间戳是否有效
          if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) {
            logger.warn(`无效的时间戳: open=${openRow.timestamp}, close=${closeRow.timestamp}`);
            continue;
          }
          
          const holdingTimeMs = closeTime.getTime() - openTime.getTime();
          
          // 如果持仓时间为负值，说明数据异常，跳过该记录
          if (holdingTimeMs < 0) {
            logger.warn(`持仓时间为负值: symbol=${closeRow.symbol}, open=${openRow.timestamp}, close=${closeRow.timestamp}, diff=${holdingTimeMs}ms`);
            continue;
          }
          
          // 转换为友好的时间格式
          const hours = Math.floor(holdingTimeMs / (1000 * 60 * 60));
          const minutes = Math.floor((holdingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
          const holdingTime = hours > 0 ? `${hours}时${minutes}分` : `${minutes}分`;
          
          // 计算总手续费
          const openFee = typeof openRow.fee === 'string' ? Number.parseFloat(openRow.fee || "0") : Number(openRow.fee || 0);
          const closeFee = typeof closeRow.fee === 'string' ? Number.parseFloat(closeRow.fee || "0") : Number(closeRow.fee || 0);
          const totalFee = openFee + closeFee;
          
          // 安全地转换数值
          const leverage = typeof openRow.leverage === 'string' ? Number.parseInt(openRow.leverage || "1") : Number(openRow.leverage || 1);
          const openPrice = typeof openRow.price === 'string' ? Number.parseFloat(openRow.price || "0") : Number(openRow.price || 0);
          const closePrice = typeof closeRow.price === 'string' ? Number.parseFloat(closeRow.price || "0") : Number(closeRow.price || 0);
          const quantity = typeof closeRow.quantity === 'string' ? Number.parseFloat(closeRow.quantity || "0") : Number(closeRow.quantity || 0);
          const pnl = closeRow.pnl ? (typeof closeRow.pnl === 'string' ? Number.parseFloat(closeRow.pnl) : Number(closeRow.pnl)) : 0;
          
          completedTrades.push({
            id: closeRow.id,
            symbol: closeRow.symbol,
            side: closeRow.side, // long/short
            leverage,
            openPrice,
            closePrice,
            quantity,
            openTime: openRow.timestamp,
            closeTime: closeRow.timestamp,
            holdingTime,
            holdingTimeMs,
            totalFee,
            pnl,
            closeReason: closeRow.close_reason || null, // 平仓原因
          });
        }
      }
      
      return c.json({ trades: completedTrades });
    } catch (error: any) {
      logger.error("获取完整交易记录失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取 Agent 决策日志
   */
  app.get("/api/logs", async (c) => {
    try {
      const limit = c.req.query("limit") || "20";
      
      const result = await dbClient.execute({
        sql: `SELECT * FROM agent_decisions 
              ORDER BY timestamp DESC 
              LIMIT ?`,
        args: [Number.parseInt(limit)],
      });
      
      const logs = result.rows.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        iteration: row.iteration,
        decision: row.decision,
        actionsTaken: row.actions_taken,
        accountValue: row.account_value,
        positionsCount: row.positions_count,
      }));
      
      return c.json({ logs });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取交易统计
   */
  app.get("/api/stats", async (c) => {
    try {
      // 统计总交易次数 - 使用 pnl IS NOT NULL 来确保这是已完成的平仓交易
      const totalTradesResult = await dbClient.execute(
        "SELECT COUNT(*) as count FROM trades WHERE type = 'close' AND pnl IS NOT NULL"
      );
      const totalTrades = (totalTradesResult.rows[0] as any).count;
      
      // 统计盈利交易
      const winTradesResult = await dbClient.execute(
        "SELECT COUNT(*) as count FROM trades WHERE type = 'close' AND pnl IS NOT NULL AND pnl > 0"
      );
      const winTrades = (winTradesResult.rows[0] as any).count;
      
      // 计算胜率
      const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
      
      // 计算总盈亏
      const pnlResult = await dbClient.execute(
        "SELECT SUM(pnl) as total_pnl FROM trades WHERE type = 'close' AND pnl IS NOT NULL"
      );
      const totalPnl = (pnlResult.rows[0] as any).total_pnl || 0;
      
      // 获取最大单笔盈利和亏损
      const maxWinResult = await dbClient.execute(
        "SELECT MAX(pnl) as max_win FROM trades WHERE type = 'close' AND pnl IS NOT NULL AND pnl > 0"
      );
      const maxWin = (maxWinResult.rows[0] as any).max_win || 0;
      
      const maxLossResult = await dbClient.execute(
        "SELECT MIN(pnl) as max_loss FROM trades WHERE type = 'close' AND pnl IS NOT NULL AND pnl < 0"
      );
      const maxLoss = (maxLossResult.rows[0] as any).max_loss || 0;
      
      return c.json({
        totalTrades,
        winTrades,
        lossTrades: totalTrades - winTrades,
        winRate,
        totalPnl,
        maxWin,
        maxLoss,
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取多个币种的实时价格
   */
  app.get("/api/prices", async (c) => {
    try {
      const DEFAULT_TRADING_SYMBOLS = 'BTC,ETH,SOL,XRP,BNB,BCH';
      const tradingSymbolsStr = process.env.TRADING_SYMBOLS || DEFAULT_TRADING_SYMBOLS;
      const symbols = tradingSymbolsStr.split(",").map(s => s.trim());
      
      const exchangeClient = getExchangeClient();
      const prices: Record<string, number> = {};
      
      // 使用缓存的价格数据（如果存在且未过期）
      if (priceCache && Date.now() - priceCache.timestamp < PRICE_CACHE_TTL) {
        return c.json({ prices: priceCache.prices });
      }
      
      // 分批获取价格，避免并发过多导致网络拥堵
      const BATCH_SIZE = 5; // 每批5个币种
      for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        const batch = symbols.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (symbol) => {
            try {
              const contract = exchangeClient.normalizeContract(symbol);
              const ticker = await exchangeClient.getFuturesTicker(contract);
              prices[symbol] = Number.parseFloat(ticker.last || "0");
            } catch (error: any) {
              logger.error(`获取 ${symbol} 价格失败:`, error);
              // 如果有旧缓存，使用旧价格作为降级
              if (priceCache && priceCache.prices[symbol]) {
                prices[symbol] = priceCache.prices[symbol];
                logger.warn(`使用 ${symbol} 的缓存价格: ${prices[symbol]}`);
              } else {
                prices[symbol] = 0;
              }
            }
          })
        );
        // 批次之间添加短暂延迟，避免请求过快
        if (i + BATCH_SIZE < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // 更新缓存
      priceCache = {
        prices,
        timestamp: Date.now(),
      };
      
      return c.json({ prices });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取交易品种列表
   */
  app.get("/api/trading-symbols", async (c) => {
    try {
      const DEFAULT_TRADING_SYMBOLS = 'BTC,ETH,SOL,XRP,BNB,BCH';
      const tradingSymbolsStr = process.env.TRADING_SYMBOLS || DEFAULT_TRADING_SYMBOLS;
      const symbols = tradingSymbolsStr.split(",").map(s => s.trim());
      
      return c.json({ symbols });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取条件单列表（止盈止损）
   */
  app.get("/api/price-orders", async (c) => {
    try {
      // 只返回活跃状态的条件单（已触发和已取消的不显示，因为平仓原因已在交易历史中显示）
      const result = await dbClient.execute(
        `SELECT * FROM price_orders 
         WHERE status = 'active'
         ORDER BY created_at DESC`
      );
      
      const priceOrders = result.rows.map((row: any) => ({
        id: row.id,
        order_id: row.order_id,
        symbol: row.symbol,
        side: row.side,
        type: row.type,
        trigger_price: Number.parseFloat(row.trigger_price),
        order_price: Number.parseFloat(row.order_price),
        quantity: Number.parseFloat(row.quantity),
        status: row.status,
        position_order_id: row.position_order_id, // 🔧 添加关联持仓ID，用于前端分组
        created_at: row.created_at,
        updated_at: row.updated_at,
        triggered_at: row.triggered_at
      }));
      
      return c.json({ 
        priceOrders,
        count: priceOrders.length,
        activeCount: priceOrders.length // 全部都是活跃的
      });
    } catch (error: any) {
      logger.error('获取条件单失败:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取系统健康状态（使用缓存，避免频繁执行完整检查）
   */
  app.get("/api/health", async (c) => {
    try {
      // 使用缓存结果，避免前端轮询导致频繁执行完整检查
      const healthResult = await performHealthCheck(false);
      return c.json(healthResult);
    } catch (error: any) {
      logger.error('健康检查失败:', error);
      return c.json({ 
        healthy: false, 
        issues: [`健康检查执行失败: ${error.message}`],
        warnings: [],
        timestamp: new Date().toISOString(),
        details: {
          orphanOrders: 0,
          inconsistentStates: 0,
          positionMismatches: { onlyInExchange: [], onlyInDB: [] }
        }
      }, 500);
    }
  });

  return app;
}

