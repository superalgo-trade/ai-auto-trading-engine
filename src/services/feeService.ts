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
 * 手续费服务模块
 * 负责智能获取和计算交易手续费
 */
import type { IExchangeClient } from '../exchanges/IExchangeClient';
import { RISK_PARAMS } from '../config/riskParams';
import { createLogger } from '../utils/logger';

const logger = createLogger({ name: 'fee-service', level: 'info' });

export interface FeeCalculationResult {
  fee: number;
  source: 'actual' | 'estimated';
  rate?: number;
}

/**
 * 手续费服务类
 * 提供智能手续费获取：优先使用真实值，失败则估算
 */
export class FeeService {
  // 手续费查询缓存 (orderId -> FeeCalculationResult)
  private feeCache: Map<string, { result: FeeCalculationResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 缓存5分钟

  constructor(private exchangeClient: IExchangeClient) {}

  /**
   * 从交易所成交记录获取真实手续费
   * @param orderId 订单ID
   * @param contract 合约名称
   * @param startTime 查询起始时间（可选，默认查询最近24小时）
   */
  async getActualFeeFromTrade(
    orderId: string,
    contract: string,
    startTime?: number
  ): Promise<FeeCalculationResult | null> {
    try {
      // 检查缓存
      const cached = this.feeCache.get(orderId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.debug(`✅ 从缓存获取手续费: 订单${orderId}`);
        return cached.result;
      }

      // 查询最近的成交记录
      const queryStartTime = startTime || Date.now() - 24 * 60 * 60 * 1000;
      const trades = await this.exchangeClient.getMyTrades(contract, 100, queryStartTime);

      // 查找匹配订单ID的成交记录
      const matchedTrades = trades.filter(
        (t) => t.order_id === orderId || t.id === orderId
      );

      if (matchedTrades.length === 0) {
        logger.debug(`⚠️ 未找到订单${orderId}的成交记录`);
        return null;
      }

      // 累加该订单的所有成交手续费（可能部分成交）
      const totalFee = matchedTrades.reduce((sum, trade) => {
        const fee = parseFloat(trade.fee || '0');
        return sum + Math.abs(fee);
      }, 0);

      logger.debug(
        `✅ 从交易记录获取真实手续费: 订单${orderId}, 手续费=${totalFee.toFixed(4)} USDT`
      );

      const result: FeeCalculationResult = {
        fee: totalFee,
        source: 'actual',
      };

      // 更新缓存
      this.feeCache.set(orderId, {
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error: any) {
      logger.warn(`⚠️ 获取订单${orderId}真实手续费失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 估算手续费（后备方案）
   * @param notionalValue 名义价值（USDT）
   * @param isMaker 是否为maker订单
   */
  estimateFee(notionalValue: number, isMaker: boolean = false): FeeCalculationResult {
    const exchangeName = this.exchangeClient.getExchangeName();
    const isTestnet = this.exchangeClient.isTestnet();

    const networkType = isTestnet ? 'testnet' : 'mainnet';
    const feeConfig =
      RISK_PARAMS.FEE_RATES[exchangeName as 'binance' | 'gate'][networkType];
    const feeRate = isMaker ? feeConfig.maker : feeConfig.taker;

    const fee = Math.abs(notionalValue * feeRate);

    logger.debug(
      `📊 估算手续费: 名义价值=${notionalValue.toFixed(2)}, ` +
        `费率=${(feeRate * 100).toFixed(3)}%, 手续费=${fee.toFixed(4)} USDT`
    );

    return {
      fee,
      source: 'estimated',
      rate: feeRate,
    };
  }

  /**
   * 智能获取手续费：优先真实值，失败则估算
   * @param orderId 订单ID（可选，用于查询真实手续费）
   * @param contract 合约名称
   * @param notionalValue 名义价值（USDT）
   * @param isMaker 是否为maker订单
   * @param startTime 查询起始时间（可选）
   */
  async getFee(
    orderId: string | null,
    contract: string,
    notionalValue: number,
    isMaker: boolean = false,
    startTime?: number
  ): Promise<FeeCalculationResult> {
    // 策略1: 如果提供了orderId，尝试从交易记录获取真实手续费
    if (orderId) {
      const actualFee = await this.getActualFeeFromTrade(orderId, contract, startTime);
      if (actualFee && actualFee.fee > 0) {
        return actualFee;
      }
    }

    // 策略2: 降级到估算
    return this.estimateFee(notionalValue, isMaker);
  }

  /**
   * 清理过期缓存
   */
  cleanupCache() {
    const now = Date.now();
    for (const [orderId, cached] of this.feeCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.feeCache.delete(orderId);
      }
    }
  }
}
