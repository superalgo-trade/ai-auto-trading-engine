/**
 * ai-auto-trading - AI 加密货币自动交易系统
 * Copyright (C) 2025 losesky
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (aexport const syncPositionsTool = createTool({
  name: "syncPositions",
  description: "同步交易所持仓数据到本地数据库",
  parameters: z.object({}),
  execute: async () => {
    const exchangeClient = getExchangeClient();
    
    try {
      const positions = await exchangeClient.getPositions();tion) any later version.
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
 * 账户管理工具
 */
import { createTool } from "@voltagent/core";
import { parsePositionSize } from "../../utils";
import { z } from "zod";
import { getExchangeClient } from "../../exchanges";
import { createClient } from "@libsql/client";
import { RISK_PARAMS } from "../../config/riskParams";
import { getQuantoMultiplier } from "../../utils/contractUtils";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  syncUrl: process.env.DATABASE_SYNC_URL,
  syncInterval: 1000,
});

/**
 * 获取账户余额工具
 */
export const getAccountBalanceTool = createTool({
  name: "getAccountBalance",
  description: "获取账户余额和资金信息",
  parameters: z.object({}),
  execute: async () => {
    const client = getExchangeClient();
    
    try {
      const account = await client.getFuturesAccount();
      
      return {
        currency: account.currency,
        totalBalance: Number.parseFloat(account.total || "0"),
        availableBalance: Number.parseFloat(account.available || "0"),
        positionMargin: Number.parseFloat(account.positionMargin || "0"),
        orderMargin: Number.parseFloat(account.orderMargin || "0"),
        unrealisedPnl: Number.parseFloat(account.unrealisedPnl || "0"),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        error: error.message,
        message: `获取账户余额失败: ${error.message}`,
      };
    }
  },
});

/**
 * 获取当前持仓工具
 */
export const getPositionsTool = createTool({
  name: "getPositions",
  description: `获取当前所有持仓信息，包括市场状态和趋势反转分析。

返回信息包含：
- 基础持仓信息（合约、数量、杠杆、价格、盈亏等）
- 市场状态分析（趋势强度、动量状态、波动率等）
- 趋势强度得分（-100到+100，量化趋势强弱）
- 反转分析（仅在有持仓时）：
  * reversalScore: 0-100，反转确认程度
  * earlyWarning: 是否发出趋势减弱预警
  * recommendation: 具体建议（如"立即平仓"、"密切关注"等）
  * details: 详细原因说明

⚠️ 重要：如果 reversalScore ≥ 70 或 earlyWarning=true，请特别关注！`,
  parameters: z.object({}),
  execute: async () => {
    const client = getExchangeClient();
    
    try {
      const positions = await client.getPositions();
      
      const activePositions = positions.filter((p: any) => Number.parseFloat(p.size || "0") !== 0);
      
      // 获取每个持仓的市场状态和反转分析
      const formattedPositions = await Promise.all(
        activePositions.map(async (p: any) => {
          const symbol = client.extractSymbol(p.contract);
          const direction = Number.parseFloat(p.size || "0") > 0 ? "long" : "short";
          
          // 分析市场状态（传入持仓信息以计算反转得分）
          let marketState;
          try {
            const { analyzeMarketState } = await import("../../services/marketStateAnalyzer");
            marketState = await analyzeMarketState(symbol, { direction });
          } catch (error) {
            // 如果分析失败，不影响基础信息返回
            marketState = null;
          }
          
          return {
            contract: p.contract,
            symbol,
            size: Number.parseFloat(p.size || "0"),
            leverage: Number.parseInt(p.leverage || "1"),
            entryPrice: Number.parseFloat(p.entryPrice || "0"),
            markPrice: Number.parseFloat(p.markPrice || "0"),
            liquidationPrice: Number.parseFloat(p.liqPrice || "0"),
            unrealisedPnl: Number.parseFloat(p.unrealisedPnl || "0"),
            realisedPnl: Number.parseFloat(p.realisedPnl || "0"),
            margin: Number.parseFloat(p.margin || "0"),
            side: direction,
            // 新增：市场状态和反转分析
            marketState: marketState ? {
              state: marketState.state,
              trendStrength: marketState.trendStrength,
              momentumState: marketState.momentumState,
              confidence: Math.round(marketState.confidence * 100),
            } : undefined,
            trendScores: marketState?.trendScores,
            reversalAnalysis: marketState?.reversalAnalysis,
          };
        })
      );
      
      return {
        positions: formattedPositions,
        count: formattedPositions.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        error: error.message,
        message: `获取持仓失败: ${error.message}`,
      };
    }
  },
});

/**
 * 获取未成交订单工具
 */
export const getOpenOrdersTool = createTool({
  name: "getOpenOrders",
  description: "获取所有未成交的挂单",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).optional().describe("可选：仅获取指定币种的订单"),
  }),
  execute: async ({ symbol }) => {
    const client = getExchangeClient();
    
    try {
      const contract = symbol ? client.normalizeContract(symbol) : undefined;
      const orders = await client.getOpenOrders(contract);
      
      const formattedOrders = orders.map((o: any) => ({
        orderId: o.id?.toString(),
        contract: o.contract,
        size: parsePositionSize(o.size),
        price: Number.parseFloat(o.price || "0"),
        left: Number.parseInt(o.left || "0"),
        status: o.status,
        side: parsePositionSize(o.size) > 0 ? "long" : "short",
        isReduceOnly: o.is_reduce_only,
        createdAt: o.create_time,
      }));
      
      return {
        orders: formattedOrders,
        count: formattedOrders.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        error: error.message,
        message: `获取未成交订单失败: ${error.message}`,
      };
    }
  },
});

/**
 * 检查订单状态工具
 */
export const checkOrderStatusTool = createTool({
  name: "checkOrderStatus",
  description: "检查指定订单的详细状态，包括成交价格、成交数量等",
  parameters: z.object({
    orderId: z.string().describe("订单ID"),
  }),
  execute: async ({ orderId }) => {
    const client = getExchangeClient();
    
    try {
      const orderDetail = await client.getOrder(orderId);
      
      const totalSize = Math.abs(parsePositionSize(orderDetail.size));
      const leftSize = Math.abs(Number.parseInt(orderDetail.left || "0"));
      const filledSize = totalSize - leftSize;
      const fillPrice = Number.parseFloat(orderDetail.fill_price || orderDetail.price || "0");
      
      return {
        success: true,
        orderId: orderDetail.id?.toString(),
        contract: orderDetail.contract,
        status: orderDetail.status,
        totalSize,
        filledSize,
        leftSize,
        fillPrice,
        price: Number.parseFloat(orderDetail.price || "0"),
        createdAt: orderDetail.create_time,
        finishedAt: orderDetail.finish_time,
        isFullyFilled: leftSize === 0,
        fillPercentage: totalSize > 0 ? (filledSize / totalSize * 100).toFixed(2) : "0",
        message: `订单 ${orderId} 状态: ${orderDetail.status}, 已成交 ${filledSize}/${totalSize} 张 (${totalSize > 0 ? (filledSize / totalSize * 100).toFixed(1) : '0'}%), 成交价 ${fillPrice}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `获取订单状态失败: ${error.message}`,
      };
    }
  },
});

/**
 * 计算风险敞口工具
 */
export const calculateRiskTool = createTool({
  name: "calculateRisk",
  description: "计算当前账户的风险敞口和仓位情况",
  parameters: z.object({}),
  execute: async () => {
    const client = getExchangeClient();
    
    try {
      const [account, positions] = await Promise.all([
        client.getFuturesAccount(),
        client.getPositions(),
      ]);
      
      // account.total 包含了未实现盈亏，需要减去以得到实际总资产
      const unrealisedPnl = Number.parseFloat(account.unrealisedPnl || "0");
      const totalBalance = Number.parseFloat(account.total || "0") - unrealisedPnl;
      const availableBalance = Number.parseFloat(account.available || "0");
      
      // 计算每个持仓的风险（需要异步获取合约乘数）
      const activePositions = positions.filter((p: any) => Number.parseFloat(p.size || "0") !== 0);
      
      const positionRisks = await Promise.all(
        activePositions.map(async (p: any) => {
          const size = Math.abs(Number.parseFloat(p.size || "0"));
          const entryPrice = Number.parseFloat(p.entryPrice || "0");
          const leverage = Number.parseInt(p.leverage || "1");
          const liquidationPrice = Number.parseFloat(p.liqPrice || "0");
          const currentPrice = Number.parseFloat(p.markPrice || "0");
          const pnl = Number.parseFloat(p.unrealisedPnl || "0");
          
          // 获取合约乘数（修复：正确计算名义价值）
          const quantoMultiplier = await getQuantoMultiplier(p.contract);
          
          // 正确计算名义价值：张数 × 入场价格 × 合约乘数
          const notionalValue = size * entryPrice * quantoMultiplier;
          const margin = notionalValue / leverage;
          
          // 计算风险百分比（到强平的距离）
          const riskPercent = currentPrice > 0 
            ? Math.abs((currentPrice - liquidationPrice) / currentPrice) * 100 
            : 0;
          
          return {
            contract: p.contract,
            notionalValue,
            margin,
            leverage,
            pnl,
            riskPercent,
            side: Number.parseFloat(p.size || "0") > 0 ? "long" : "short",
          };
        })
      );
      
      const totalNotional = positionRisks.reduce((sum: number, p: any) => sum + p.notionalValue, 0);
      const totalMargin = positionRisks.reduce((sum: number, p: any) => sum + p.margin, 0);
      const usedMarginPercent = totalBalance > 0 ? (totalMargin / totalBalance) * 100 : 0;
      
      // 从数据库获取初始资金
      const initialBalanceResult = await dbClient.execute(
        "SELECT total_value FROM account_history ORDER BY timestamp ASC LIMIT 1"
      );
      const initialBalance = initialBalanceResult.rows[0]
        ? Number.parseFloat(initialBalanceResult.rows[0].total_value as string)
        : 100;
      
      const returnPercent = initialBalance > 0 
        ? ((totalBalance - initialBalance) / initialBalance) * 100 
        : 0;
      
      let riskLevel = "low";
      if (usedMarginPercent > 80) {
        riskLevel = "high";
      } else if (usedMarginPercent > 50) {
        riskLevel = "medium";
      }

      return {
        totalBalance,
        availableBalance,
        unrealisedPnl,
        totalNotional,
        totalMargin,
        usedMarginPercent,
        returnPercent,
        positionCount: positionRisks.length,
        positions: positionRisks,
        riskLevel,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        error: error.message,
        message: `计算风险失败: ${error.message}`,
      };
    }
  },
});

/**
 * 同步持仓到数据库工具
 */
export const syncPositionsTool = createTool({
  name: "syncPositions",
  description: "同步交易所持仓数据到本地数据库",
  parameters: z.object({}),
  execute: async () => {
    const exchangeClient = getExchangeClient();
    
    try {
      const positions = await exchangeClient.getPositions();
      
      // 清空本地持仓表
      await dbClient.execute("DELETE FROM positions");
      
      // 插入当前持仓
      for (const p of positions) {
        const pos = p as any;
        const size = Number.parseFloat(pos.size || "0");
        if (size === 0) continue;
        
        const symbol = exchangeClient.extractSymbol(pos.contract || "");
        const side = size > 0 ? "long" : "short";
        
        // 🔧 同步持仓时，初始化分批止盈百分比为0（全新同步的持仓不应有分批记录）
        await dbClient.execute({
          sql: `INSERT INTO positions 
                (symbol, quantity, entry_price, current_price, liquidation_price, unrealized_pnl, 
                 leverage, side, entry_order_id, opened_at, partial_close_percentage)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            symbol,
            Math.abs(size),
            Number.parseFloat(pos.entryPrice || "0"),
            Number.parseFloat(pos.markPrice || "0"),
            Number.parseFloat(pos.liqPrice || "0"),
            Number.parseFloat(pos.unrealisedPnl || "0"),
            Number.parseInt(pos.leverage || "1"),
            side,
            "synced",
            new Date().toISOString(),
            0, // 初始化分批止盈百分比
          ],
        });
      }
      
      return {
        success: true,
        syncedCount: positions.filter((p: any) => Number.parseFloat(p.size || "0") !== 0).length,
        message: "持仓同步完成",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `同步持仓失败: ${error.message}`,
      };
    }
  },
});

/**
 * 查询平仓事件历史工具
 */
export const getCloseEventsTool = createTool({
  name: "getCloseEvents",
  description: "查询平仓事件历史，了解每次平仓的原因和详情",
  parameters: z.object({
    symbol: z.string().optional().describe("币种代码（可选，不填则查询所有）"),
    limit: z.number().min(1).max(100).default(20).describe("查询数量限制"),
  }),
  execute: async ({ symbol, limit }) => {
    try {
      let sql = `
        SELECT 
          id,
          symbol,
          side,
          entry_price,
          close_price,
          quantity,
          leverage,
          pnl,
          fee,
          close_reason,
          trigger_type,
          order_id,
          created_at,
          processed
        FROM position_close_events
      `;
      
      const args: any[] = [];
      
      if (symbol) {
        sql += " WHERE symbol = ?";
        args.push(symbol);
      }
      
      sql += " ORDER BY created_at DESC LIMIT ?";
      args.push(limit);
      
      const result = await dbClient.execute({ sql, args });
      
      const events = result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        side: row.side,
        entryPrice: Number.parseFloat(row.entry_price as string),
        exitPrice: Number.parseFloat(row.close_price as string),
        quantity: Number.parseFloat(row.quantity as string),
        leverage: Number.parseInt(row.leverage as string),
        pnl: Number.parseFloat(row.pnl as string),
        fee: Number.parseFloat(row.fee as string),
        closeReason: row.close_reason as string,
        triggerType: row.trigger_type as string,
        orderId: row.order_id as string,
        createdAt: row.created_at as string,
        processed: Boolean(row.processed),
      }));
      
      // 翻译平仓原因
      const reasonMap: Record<string, string> = {
        'stop_loss_triggered': '止损触发',
        'take_profit_triggered': '止盈触发',
        'manual_close': 'AI手动',
        'ai_decision': 'AI主动',
        'trend_reversal': '趋势反转',
        'forced_close': '系统强制',
        'partial_close': '分批止盈',
        'peak_drawdown': '峰值回撤',
        'time_limit': '持仓到期',
      };
      
      const triggerTypeMap: Record<string, string> = {
        'exchange_order': '交易所条件单',
        'ai_decision': 'AI决策',
        'system_risk': '系统风控',
        'manual_operation': '手动操作',
      };
      
      return {
        success: true,
        events: events.map(e => ({
          ...e,
          closeReasonText: reasonMap[e.closeReason] || e.closeReason,
          triggerTypeText: triggerTypeMap[e.triggerType] || e.triggerType,
        })),
        total: events.length,
        message: `查询到 ${events.length} 条平仓事件`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `查询平仓事件失败: ${error.message}`,
      };
    }
  },
});

