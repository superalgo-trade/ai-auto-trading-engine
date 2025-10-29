/**
 * open-nof1.ai - AI 加密货币自动交易系统
 * Copyright (C) 2025 195440
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
 * 交易执行工具
 */
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { createGateClient } from "../../services/gateClient";
import { createClient } from "@libsql/client";
import { createPinoLogger } from "@voltagent/logger";
import { getChinaTimeISO } from "../../utils/timeUtils";
import { RISK_PARAMS } from "../../config/riskParams";

const logger = createPinoLogger({
  name: "trade-execution",
  level: "info",
});

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

/**
 * 开仓工具
 */
export const openPositionTool = createTool({
  name: "openPosition",
  description: "开仓 - 做多或做空指定币种（使用市价单，立即以当前市场价格成交）。IMPORTANT: 开仓前必须先用getAccountBalance和getPositions工具查询可用资金和现有持仓，避免资金不足。交易手续费约0.05%，避免频繁交易。开仓时不设置止盈止损，你需要在每个周期主动决策是否平仓。",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    side: z.enum(["long", "short"]).describe("方向：long=做多，short=做空"),
    leverage: z.number().min(5).max(15).describe("杠杆倍数（5-15倍，严格限制）"),
    amountUsdt: z.number().describe("开仓金额（USDT）"),
  }),
  execute: async ({ symbol, side, leverage, amountUsdt }) => {
    // 开仓时不设置止盈止损，由 AI 在每个周期主动决策
    const stopLoss = undefined;
    const takeProfit = undefined;
    const client = createGateClient();
    const contract = `${symbol}_USDT`;
    
    try {
      //  参数验证
      if (!Number.isFinite(amountUsdt) || amountUsdt <= 0) {
        return {
          success: false,
          message: `无效的开仓金额: ${amountUsdt}`,
        };
      }
      
      if (!Number.isFinite(leverage) || leverage < 5 || leverage > 15) {
        return {
          success: false,
          message: `无效的杠杆倍数: ${leverage}（必须在5-15之间，严格限制以控制风险）`,
        };
      }
      
      // ====== 开仓前强制风控检查 ======
      
      // 1. 检查持仓数量（最多5个）
      const allPositions = await client.getPositions();
      const activePositions = allPositions.filter((p: any) => Math.abs(Number.parseInt(p.size || "0")) !== 0);
      
      if (activePositions.length >= RISK_PARAMS.MAX_POSITIONS) {
        return {
          success: false,
          message: `已达到最大持仓数量限制（${RISK_PARAMS.MAX_POSITIONS}个），当前持仓 ${activePositions.length} 个，无法开新仓`,
        };
      }
      
      // 2. 获取账户信息
      const account = await client.getFuturesAccount();
      const unrealisedPnl = Number.parseFloat(account.unrealisedPnl || "0");
      const totalBalance = Number.parseFloat(account.total || "0") - unrealisedPnl;
      const availableBalance = Number.parseFloat(account.available || "0");
      
      if (!Number.isFinite(availableBalance) || availableBalance <= 0) {
        return {
          success: false,
          message: `账户可用资金异常: ${availableBalance} USDT`,
        };
      }
      
      // 3. 检查账户回撤（从数据库获取初始净值和峰值净值）
      const initialBalanceResult = await dbClient.execute(
        "SELECT total_value FROM account_history ORDER BY timestamp ASC LIMIT 1"
      );
      const initialBalance = initialBalanceResult.rows[0]
        ? Number.parseFloat(initialBalanceResult.rows[0].total_value as string)
        : totalBalance;
      
      const peakBalanceResult = await dbClient.execute(
        "SELECT MAX(total_value) as peak FROM account_history"
      );
      const peakBalance = peakBalanceResult.rows[0]?.peak 
        ? Number.parseFloat(peakBalanceResult.rows[0].peak as string)
        : totalBalance;
      
      const drawdownFromPeak = peakBalance > 0 
        ? ((peakBalance - totalBalance) / peakBalance) * 100 
        : 0;
      
      if (drawdownFromPeak >= 15) {
        return {
          success: false,
          message: `账户回撤已达 ${drawdownFromPeak.toFixed(2)}% ≥ 15%，触发风控保护，禁止新开仓`,
        };
      }
      
      // 4. 检查总敞口（不超过账户净值的15倍）
      let currentTotalExposure = 0;
      for (const pos of activePositions) {
        const posSize = Math.abs(Number.parseInt(pos.size || "0"));
        const entryPrice = Number.parseFloat(pos.entryPrice || "0");
        const posLeverage = Number.parseInt(pos.leverage || "1");
        // 获取合约乘数
        let posQuantoMultiplier = 0.01;
        try {
          const contractInfo = await client.getContractInfo(pos.contract);
          posQuantoMultiplier = Number.parseFloat(contractInfo.quantoMultiplier || "0.01");
        } catch {}
        const posValue = posSize * entryPrice * posQuantoMultiplier;
        currentTotalExposure += posValue;
      }
      
      const newExposure = amountUsdt * leverage;
      const totalExposure = currentTotalExposure + newExposure;
      const maxAllowedExposure = totalBalance * 15; // 提升到15倍
      
      if (totalExposure > maxAllowedExposure) {
        return {
          success: false,
          message: `新开仓将导致总敞口 ${totalExposure.toFixed(2)} USDT 超过限制 ${maxAllowedExposure.toFixed(2)} USDT（账户净值的15倍），拒绝开仓`,
        };
      }
      
      // 5. 检查单笔仓位（建议不超过账户净值的30%）
      const maxSinglePosition = totalBalance * 0.30; // 30%
      if (amountUsdt > maxSinglePosition) {
        logger.warn(`开仓金额 ${amountUsdt.toFixed(2)} USDT 超过建议仓位 ${maxSinglePosition.toFixed(2)} USDT（账户净值的30%）`);
      }
      
      // ====== 风控检查通过，继续开仓 ======
      
      let adjustedAmountUsdt = amountUsdt;
      
      // 设置杠杆
      await client.setLeverage(contract, leverage);
      
      // 获取当前价格和合约信息
      const ticker = await client.getFuturesTicker(contract);
      const currentPrice = Number.parseFloat(ticker.last || "0");
      const contractInfo = await client.getContractInfo(contract);
      
      // Gate.io 永续合约的保证金计算
      // 注意：Gate.io 使用"张数"作为单位，每张合约代表一定数量的币
      // 对于 BTC_USDT: 1张 = 0.0001 BTC
      // 保证金计算：保证金 = (张数 * quantoMultiplier * 价格) / 杠杆
      
      //  修复：使用正确的字段名 quantoMultiplier（驼峰命名），不是 quanto_multiplier
      const quantoMultiplier = Number.parseFloat(contractInfo.quantoMultiplier || "0.01");
      const minSize = Number.parseInt(contractInfo.orderSizeMin || "1");
      const maxSize = Number.parseInt(contractInfo.orderSizeMax || "1000000");
      
      // 计算可以开多少张合约
      // adjustedAmountUsdt = (quantity * quantoMultiplier * currentPrice) / leverage
      // => quantity = (adjustedAmountUsdt * leverage) / (quantoMultiplier * currentPrice)
      let quantity = (adjustedAmountUsdt * leverage) / (quantoMultiplier * currentPrice);
      
      // 向下取整到整数张数（合约必须是整数）
      quantity = Math.floor(quantity);
      
      // 确保数量在允许范围内
      quantity = Math.max(quantity, minSize);
      quantity = Math.min(quantity, maxSize);
      
      let size = side === "long" ? quantity : -quantity;
      
      // 最后验证：如果 size 为 0 或者太小，放弃开仓
      if (Math.abs(size) < minSize) {
        const minMargin = (minSize * quantoMultiplier * currentPrice) / leverage;
        return {
          success: false,
          message: `计算的数量 ${Math.abs(size)} 张小于最小限制 ${minSize} 张，需要至少 ${minMargin.toFixed(2)} USDT 保证金（当前${adjustedAmountUsdt.toFixed(2)} USDT，杠杆${leverage}x）`,
        };
      }
      
      // 计算实际使用的保证金
      let actualMargin = (Math.abs(size) * quantoMultiplier * currentPrice) / leverage;
      
      logger.info(`开仓 ${symbol} ${side === "long" ? "做多" : "做空"} ${Math.abs(size)}张 (杠杆${leverage}x)`);
      
      //  市价单开仓（不设置止盈止损）
      const order = await client.placeOrder({
        contract,
        size,
        price: 0,  // 市价单必须传 price: 0
      });
      
      //  等待并验证订单状态（带重试）
      // 增加等待时间，确保 Gate.io API 更新持仓信息
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      //  检查订单状态并获取实际成交价格（最多重试3次）
      let finalOrderStatus = order.status;
      let actualFillSize = 0;
      let actualFillPrice = currentPrice; // 默认使用当前价格
      
      if (order.id) {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const orderDetail = await client.getOrder(order.id.toString());
            finalOrderStatus = orderDetail.status;
            actualFillSize = Math.abs(Number.parseInt(orderDetail.size || "0") - Number.parseInt(orderDetail.left || "0"));
            
            //  获取实际成交价格（fill_price 或 average price）
            if (orderDetail.fill_price && Number.parseFloat(orderDetail.fill_price) > 0) {
              actualFillPrice = Number.parseFloat(orderDetail.fill_price);
            } else if (orderDetail.price && Number.parseFloat(orderDetail.price) > 0) {
              actualFillPrice = Number.parseFloat(orderDetail.price);
            }
            
            logger.info(`成交: ${actualFillSize}张 @ ${actualFillPrice.toFixed(2)} USDT`);
            
            //  验证成交价格的合理性（滑点保护）
            const priceDeviation = Math.abs(actualFillPrice - currentPrice) / currentPrice;
            if (priceDeviation > 0.02) {
              // 滑点超过2%，拒绝此次交易（回滚）
              logger.error(`❌ 成交价偏离超过2%: ${currentPrice.toFixed(2)} → ${actualFillPrice.toFixed(2)} (偏离 ${(priceDeviation * 100).toFixed(2)}%)，拒绝交易`);
              
              // 尝试平仓回滚（如果已经成交）
              try {
                await client.placeOrder({
                  contract,
                  size: -size,
                  price: 0,
                  reduceOnly: true,
                });
                logger.info(`已回滚交易`);
              } catch (rollbackError: any) {
                logger.error(`回滚失败: ${rollbackError.message}，请手动处理`);
              }
              
              return {
                success: false,
                message: `开仓失败：成交价偏离超过2% (${currentPrice.toFixed(2)} → ${actualFillPrice.toFixed(2)})，已拒绝交易`,
              };
            }
            
            // 如果订单被取消或未成交，返回失败
            if (finalOrderStatus === 'cancelled' || actualFillSize === 0) {
              return {
                success: false,
                message: `开仓失败：订单${finalOrderStatus === 'cancelled' ? '被取消' : '未成交'}（订单ID: ${order.id}）`,
              };
            }
            
            // 成功获取订单信息，跳出循环
            break;
            
          } catch (error: any) {
            retryCount++;
            if (retryCount >= maxRetries) {
              logger.error(`获取订单详情失败（重试${retryCount}次）: ${error.message}`);
              // 如果无法获取订单详情，使用预估值继续
              logger.warn(`使用预估值继续: 数量=${Math.abs(size)}, 价格=${currentPrice}`);
              actualFillSize = Math.abs(size);
              actualFillPrice = currentPrice;
            } else {
              logger.warn(`获取订单详情失败，${retryCount}/${maxRetries} 次重试...`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }
      }
      
      //  使用实际成交数量和价格记录到数据库
      const finalQuantity = actualFillSize > 0 ? actualFillSize : Math.abs(size);
      
      // 计算手续费（Gate.io taker费率 0.05%）
      // 手续费 = 合约名义价值 * 0.05%
      // 合约名义价值 = 张数 * quantoMultiplier * 价格
      const positionValue = finalQuantity * quantoMultiplier * actualFillPrice;
      const fee = positionValue * 0.0005; // 0.05%
      
      // 记录开仓交易
      // side: 持仓方向（long=做多, short=做空）
      // 实际执行: long开仓=买入(+size), short开仓=卖出(-size)
      // 映射状态：Gate.io finished -> filled, open -> pending
      const dbStatus = finalOrderStatus === 'finished' ? 'filled' : 'pending';
      
      await dbClient.execute({
        sql: `INSERT INTO trades (order_id, symbol, side, type, price, quantity, leverage, fee, timestamp, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          order.id?.toString() || "",
          symbol,
          side,            // 持仓方向（long/short）
          "open",
          actualFillPrice, // 使用实际成交价格
          finalQuantity,   // 使用实际成交数量
          leverage,
          fee,            // 手续费
          getChinaTimeISO(),
          dbStatus,
        ],
      });
      
      // 不设置止损止盈订单
      let slOrderId: string | undefined;
      let tpOrderId: string | undefined;
      
      //  获取持仓信息以获取 Gate.io 返回的强平价
      // Gate.io API 有延迟，需要等待并重试
      let liquidationPrice = 0;
      let gatePositionSize = 0;
      let maxRetries = 5;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 递增等待时间
          
          const positions = await client.getPositions();
          
          const gatePosition = positions.find((p: any) => p.contract === contract);
          if (gatePosition) {
            gatePositionSize = Number.parseInt(gatePosition.size || "0");
            
            if (gatePositionSize !== 0) {
              if (gatePosition.liq_price) {
                liquidationPrice = Number.parseFloat(gatePosition.liq_price);
              }
              break; // 持仓已存在，跳出循环
            }
          }
          
          retryCount++;
          
          if (retryCount >= maxRetries) {
            logger.error(`❌ 警告：Gate.io 查询显示持仓为0，但订单状态为 ${finalOrderStatus}`);
            logger.error(`订单ID: ${order.id}, 成交数量: ${actualFillSize}, 计算数量: ${finalQuantity}`);
            logger.error(`可能原因：Gate.io API 延迟或持仓需要更长时间更新`);
          }
        } catch (error) {
          logger.warn(`获取持仓失败（重试${retryCount + 1}/${maxRetries}）: ${error}`);
          retryCount++;
        }
      }
      
      // 如果未能从 Gate.io 获取强平价，使用估算公式（仅作为后备）
      if (liquidationPrice === 0) {
        liquidationPrice = side === "long" 
          ? actualFillPrice * (1 - 0.9 / leverage)
          : actualFillPrice * (1 + 0.9 / leverage);
        logger.warn(`使用估算强平价: ${liquidationPrice}`);
      }
        
      // 先检查是否已存在持仓
      const existingResult = await dbClient.execute({
        sql: "SELECT symbol FROM positions WHERE symbol = ?",
        args: [symbol],
      });
      
      if (existingResult.rows.length > 0) {
        // 更新现有持仓
        await dbClient.execute({
          sql: `UPDATE positions SET 
                quantity = ?, entry_price = ?, current_price = ?, liquidation_price = ?, 
                unrealized_pnl = ?, leverage = ?, side = ?, profit_target = ?, stop_loss = ?, 
                tp_order_id = ?, sl_order_id = ?, entry_order_id = ?
                WHERE symbol = ?`,
          args: [
            finalQuantity,
            actualFillPrice,
            actualFillPrice,
            liquidationPrice,
            0,
            leverage,
            side,
            takeProfit || null,
            stopLoss || null,
            tpOrderId || null,
            slOrderId || null,
            order.id?.toString() || "",
            symbol,
          ],
        });
      } else {
        // 插入新持仓
        await dbClient.execute({
          sql: `INSERT INTO positions 
                (symbol, quantity, entry_price, current_price, liquidation_price, unrealized_pnl, 
                 leverage, side, profit_target, stop_loss, tp_order_id, sl_order_id, entry_order_id, opened_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            symbol,
            finalQuantity,
            actualFillPrice,
            actualFillPrice,
            liquidationPrice,
            0,
            leverage,
            side,
            takeProfit || null,
            stopLoss || null,
            tpOrderId || null,
            slOrderId || null,
            order.id?.toString() || "",
            getChinaTimeISO(),
          ],
        });
      }
      
      const contractAmount = Math.abs(size) * quantoMultiplier;
      const totalValue = contractAmount * actualFillPrice;
      
      return {
        success: true,
        orderId: order.id?.toString(),
        symbol,
        side,
        size: Math.abs(size), // 合约张数
        contractAmount, // 实际币的数量
        price: actualFillPrice,
        leverage,
        actualMargin,
        message: `✅ 成功开仓 ${symbol} ${side === "long" ? "做多" : "做空"} ${Math.abs(size)} 张 (${contractAmount.toFixed(4)} ${symbol})，成交价 ${actualFillPrice.toFixed(2)}，保证金 ${actualMargin.toFixed(2)} USDT，杠杆 ${leverage}x。⚠️ 未设置止盈止损，请在每个周期主动决策是否平仓。`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `开仓失败: ${error.message}`,
      };
    }
  },
});

/**
 * 平仓工具
 */
export const closePositionTool = createTool({
  name: "closePosition",
  description: "平仓 - 关闭指定币种的持仓",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    percentage: z.number().min(1).max(100).default(100).describe("平仓百分比（1-100）"),
  }),
  execute: async ({ symbol, percentage }) => {
    const client = createGateClient();
    const contract = `${symbol}_USDT`;
    
    try {
      //  参数验证
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        return {
          success: false,
          message: `无效的平仓百分比: ${percentage}（必须在1-100之间）`,
        };
      }
      
      //  直接从 Gate.io 获取最新的持仓信息（不依赖数据库）
      const allPositions = await client.getPositions();
      const gatePosition = allPositions.find((p: any) => p.contract === contract);
      
      if (!gatePosition || Number.parseInt(gatePosition.size || "0") === 0) {
        return {
          success: false,
          message: `没有找到 ${symbol} 的持仓`,
        };
      }
      
      // 从 Gate.io 获取实时数据
      const gateSize = Number.parseInt(gatePosition.size || "0");
      const side = gateSize > 0 ? "long" : "short";
      const quantity = Math.abs(gateSize);
      let entryPrice = Number.parseFloat(gatePosition.entryPrice || "0");
      let currentPrice = Number.parseFloat(gatePosition.markPrice || "0");
      const leverage = Number.parseInt(gatePosition.leverage || "1");
      const totalUnrealizedPnl = Number.parseFloat(gatePosition.unrealisedPnl || "0");
      
      //  如果价格为0，获取实时行情作为后备
      if (currentPrice === 0 || entryPrice === 0) {
        const ticker = await client.getFuturesTicker(contract);
        if (currentPrice === 0) {
          currentPrice = Number.parseFloat(ticker.markPrice || ticker.last || "0");
          logger.warn(`持仓标记价格为0，使用行情价格: ${currentPrice}`);
        }
        if (entryPrice === 0) {
          entryPrice = currentPrice; // 如果开仓价为0，使用当前价格
          logger.warn(`持仓开仓价为0，使用当前价格: ${entryPrice}`);
        }
      }
      
      // 计算平仓数量
      const closeSize = Math.floor((quantity * percentage) / 100);
      const size = side === "long" ? -closeSize : closeSize;
      
      //  改进：计算实际盈亏，Gate.io 返回的是毛盈亏（未扣除手续费）
      // 获取合约乘数用于计算手续费
      let quantoMultiplier = 0.01;
      try {
        const contractInfo = await client.getContractInfo(contract);
        quantoMultiplier = Number.parseFloat(contractInfo.quantoMultiplier || "0.01");
      } catch (error: any) {
        logger.warn(`获取合约信息失败，使用默认乘数: ${error.message}`);
      }
      
      // Gate.io 返回的毛盈亏
      let grossPnl = percentage === 100 
        ? totalUnrealizedPnl 
        : (totalUnrealizedPnl * percentage) / 100;
      
      // 如果 Gate.io 返回的盈亏为 0 且入场价和当前价不同，手动计算毛盈亏
      if (grossPnl === 0 && Math.abs(currentPrice - entryPrice) > 0.01) {
        // 手动计算盈亏公式：
        // 对于做多：(currentPrice - entryPrice) * quantity * quantoMultiplier
        // 对于做空：(entryPrice - currentPrice) * quantity * quantoMultiplier
        const priceChange = side === "long" 
          ? (currentPrice - entryPrice) 
          : (entryPrice - currentPrice);
        
        grossPnl = priceChange * closeSize * quantoMultiplier;
        
        logger.warn(`Gate.io 返回的盈亏为0，手动计算毛盈亏: ${grossPnl.toFixed(2)} USDT (价格变动: ${priceChange.toFixed(4)})`);
      }
      
      //  扣除手续费（开仓 + 平仓）
      const openFee = entryPrice * closeSize * quantoMultiplier * 0.0005;
      const closeFee = currentPrice * closeSize * quantoMultiplier * 0.0005;
      const totalFees = openFee + closeFee;
      
      // 净盈亏 = 毛盈亏 - 总手续费
      let pnl = grossPnl - totalFees;
      
      logger.info(`平仓 ${symbol} ${side === "long" ? "做多" : "做空"} ${closeSize}张 (入场: ${entryPrice.toFixed(2)}, 当前: ${currentPrice.toFixed(2)})`);
      
      //  市价单平仓（Gate.io 市价单：price 为 "0"，不设置 tif）
      const order = await client.placeOrder({
        contract,
        size,
        price: 0,  // 市价单必须传 price: 0
        reduceOnly: true, // 只减仓，不开新仓
      });
      
      //  等待并验证订单状态（带重试）
      await new Promise(resolve => setTimeout(resolve, 500));
      
      //  获取实际成交价格和数量（最多重试3次）
      let actualExitPrice = currentPrice;
      let actualCloseSize = closeSize;
      let finalOrderStatus = order.status;
      
      if (order.id) {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const orderDetail = await client.getOrder(order.id.toString());
            finalOrderStatus = orderDetail.status;
            const filled = Math.abs(Number.parseInt(orderDetail.size || "0") - Number.parseInt(orderDetail.left || "0"));
            
            if (filled > 0) {
              actualCloseSize = filled;
            }
            
            // 获取实际成交价格
            if (orderDetail.fill_price && Number.parseFloat(orderDetail.fill_price) > 0) {
              actualExitPrice = Number.parseFloat(orderDetail.fill_price);
            } else if (orderDetail.price && Number.parseFloat(orderDetail.price) > 0) {
              actualExitPrice = Number.parseFloat(orderDetail.price);
            }
            
            logger.info(`成交: ${actualCloseSize}张 @ ${actualExitPrice.toFixed(2)} USDT`);
            
            //  验证成交价格的合理性（滑点保护）
            const priceDeviation = Math.abs(actualExitPrice - currentPrice) / currentPrice;
            if (priceDeviation > 0.03) {
              // 平仓时允许3%滑点（比开仓宽松，因为可能是紧急止损）
              logger.warn(`⚠️ 平仓成交价偏离超过3%: ${currentPrice.toFixed(2)} → ${actualExitPrice.toFixed(2)} (偏离 ${(priceDeviation * 100).toFixed(2)}%)`);
            }
            
            //  重新计算实际盈亏（基于真实成交价格）
            // 获取合约乘数
            let quantoMultiplier = 0.01; // 默认值
            try {
              const contractInfo = await client.getContractInfo(contract);
              quantoMultiplier = Number.parseFloat(contractInfo.quantoMultiplier || "0.01");
            } catch (error: any) {
              logger.warn(`获取合约信息失败，使用默认乘数: ${error.message}`);
            }
            
            const priceChange = side === "long" 
              ? (actualExitPrice - entryPrice) 
              : (entryPrice - actualExitPrice);
            
            // 盈亏 = 价格变化 * 张数 * 合约乘数
            const grossPnl = priceChange * actualCloseSize * quantoMultiplier;
            
            //  扣除手续费（开仓 + 平仓）
            // 开仓手续费 = 开仓名义价值 * 0.05%
            const openFee = entryPrice * actualCloseSize * quantoMultiplier * 0.0005;
            // 平仓手续费 = 平仓名义价值 * 0.05%
            const closeFee = actualExitPrice * actualCloseSize * quantoMultiplier * 0.0005;
            // 总手续费
            const totalFees = openFee + closeFee;
            
            // 净盈亏 = 毛盈亏 - 总手续费
            pnl = grossPnl - totalFees;
            
            logger.info(`盈亏: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
            
            // 成功获取订单信息，跳出循环
            break;
            
          } catch (error: any) {
            retryCount++;
            if (retryCount >= maxRetries) {
              logger.error(`获取平仓订单详情失败（重试${retryCount}次）: ${error.message}`);
              // 如果无法获取订单详情，使用预估值
              logger.warn(`使用预估值继续: 数量=${closeSize}, 价格=${currentPrice}`);
              actualCloseSize = closeSize;
              actualExitPrice = currentPrice;
              // 重新计算盈亏（需要乘以合约乘数）
              let quantoMultiplier = 0.01;
              try {
                const contractInfo = await client.getContractInfo(contract);
                quantoMultiplier = Number.parseFloat(contractInfo.quantoMultiplier || "0.01");
              } catch {}
              const priceChange = side === "long" 
                ? (actualExitPrice - entryPrice) 
                : (entryPrice - actualExitPrice);
              const grossPnl = priceChange * actualCloseSize * quantoMultiplier;
              // 扣除手续费
              const openFee = entryPrice * actualCloseSize * quantoMultiplier * 0.0005;
              const closeFee = actualExitPrice * actualCloseSize * quantoMultiplier * 0.0005;
              pnl = grossPnl - openFee - closeFee;
            } else {
              logger.warn(`获取平仓订单详情失败，${retryCount}/${maxRetries} 次重试...`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }
      }
      
      // 获取账户信息用于记录当前总资产
      const account = await client.getFuturesAccount();
      const totalBalance = Number.parseFloat(account.total || "0");
      
      //  计算总手续费（开仓 + 平仓）用于数据库记录
      // 需要获取合约乘数
      let dbQuantoMultiplier = 0.01;
      try {
        const contractInfo = await client.getContractInfo(contract);
        dbQuantoMultiplier = Number.parseFloat(contractInfo.quantoMultiplier || "0.01");
      } catch (error: any) {
        logger.warn(`获取合约信息失败，使用默认乘数: ${error.message}`);
      }
      
      // 开仓手续费 = 开仓名义价值 * 0.05%
      const dbOpenFee = entryPrice * actualCloseSize * dbQuantoMultiplier * 0.0005;
      // 平仓手续费 = 平仓名义价值 * 0.05%
      const dbCloseFee = actualExitPrice * actualCloseSize * dbQuantoMultiplier * 0.0005;
      // 总手续费
      const totalFee = dbOpenFee + dbCloseFee;
      
      // 记录平仓交易
      // side: 原持仓方向（long/short）
      // 实际执行方向: long平仓=卖出, short平仓=买入
      // pnl: 净盈亏（已扣除手续费）
      // fee: 总手续费（开仓+平仓）
      // 映射状态：Gate.io finished -> filled, open -> pending
      const dbStatus = finalOrderStatus === 'finished' ? 'filled' : 'pending';
      
      await dbClient.execute({
        sql: `INSERT INTO trades (order_id, symbol, side, type, price, quantity, leverage, pnl, fee, timestamp, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          order.id?.toString() || "",
          symbol,
          side,             // 原持仓方向（便于统计某个币种的多空盈亏）
          "close",
          actualExitPrice,   // 使用实际成交价格
          actualCloseSize,   // 使用实际成交数量
          leverage,
          pnl,              // 净盈亏（已扣除手续费）
          totalFee,         // 总手续费（开仓+平仓）
          getChinaTimeISO(),
          dbStatus,
        ],
      });
      
      // 从数据库获取止损止盈订单ID（如果存在）
      const posResult = await dbClient.execute({
        sql: "SELECT sl_order_id, tp_order_id FROM positions WHERE symbol = ?",
        args: [symbol],
      });
      
      // 取消止损止盈订单（先检查订单状态）
      if (posResult.rows.length > 0) {
        const dbPosition = posResult.rows[0] as any;
        
        if (dbPosition.sl_order_id) {
          try {
            // 先获取订单状态
            const orderDetail = await client.getOrder(dbPosition.sl_order_id);
            // 只取消未完成的订单（open状态）
            if (orderDetail.status === 'open') {
              await client.cancelOrder(dbPosition.sl_order_id);
            }
          } catch (e: any) {
            // 订单可能已经不存在或已被取消
            logger.warn(`无法取消止损订单 ${dbPosition.sl_order_id}: ${e.message}`);
          }
        }
        
        if (dbPosition.tp_order_id) {
          try {
            // 先获取订单状态
            const orderDetail = await client.getOrder(dbPosition.tp_order_id);
            // 只取消未完成的订单（open状态）
            if (orderDetail.status === 'open') {
              await client.cancelOrder(dbPosition.tp_order_id);
            }
          } catch (e: any) {
            // 订单可能已经不存在或已被取消
            logger.warn(`无法取消止盈订单 ${dbPosition.tp_order_id}: ${e.message}`);
          }
        }
      }
      
      // 如果全部平仓，从持仓表删除；否则不操作（交由同步任务更新）
      if (percentage === 100) {
        await dbClient.execute({
          sql: "DELETE FROM positions WHERE symbol = ?",
          args: [symbol],
        });
      }
      
      return {
        success: true,
        orderId: order.id?.toString(),
        symbol,
        side,
        closedSize: actualCloseSize,  // 使用实际成交数量
        entryPrice,
        exitPrice: actualExitPrice,   // 使用实际成交价格
        leverage,
        pnl,                          // 净盈亏（已扣除手续费）
        fee: totalFee,                // 总手续费
        totalBalance,
        message: `成功平仓 ${symbol} ${actualCloseSize} 张，入场价 ${entryPrice.toFixed(4)}，平仓价 ${actualExitPrice.toFixed(4)}，净盈亏 ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (已扣手续费 ${totalFee.toFixed(2)} USDT)，当前总资产 ${totalBalance.toFixed(2)} USDT`,
      };
    } catch (error: any) {
      logger.error(`平仓失败: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
        message: `平仓失败: ${error.message}`,
      };
    }
  },
});

/**
 * 取消订单工具
 */
export const cancelOrderTool = createTool({
  name: "cancelOrder",
  description: "取消指定的挂单",
  parameters: z.object({
    orderId: z.string().describe("订单ID"),
  }),
  execute: async ({ orderId }) => {
    const client = createGateClient();
    
    try {
      await client.cancelOrder(orderId);
      
      return {
        success: true,
        orderId,
        message: `订单 ${orderId} 已取消`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `取消订单失败: ${error.message}`,
      };
    }
  },
});

