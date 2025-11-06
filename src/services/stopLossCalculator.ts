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
 * 科学止损计算器
 * 
 * 核心理念：止损的目的是过滤"噪音"，捕捉"信号"
 * - 噪音：随机的、无序的、短暂的价格波动
 * - 信号：有趋势的、有序的、持续的价格波动
 * 
 * 实现两种主流止损方法：
 * 1. 基于波动率的止损（ATR）- 客观、自适应
 * 2. 基于支撑/阻力位的止损 - 基于市场结构
 */

import { createPinoLogger } from "@voltagent/logger";
import { getExchangeClient } from "../exchanges";

const logger = createPinoLogger({
  name: "stop-loss-calculator",
  level: "info",
});

/**
 * 止损配置参数
 */
export interface StopLossConfig {
  // ATR 相关配置
  atrPeriod: number;           // ATR 计算周期（默认14）
  atrMultiplier: number;       // ATR 倍数（1.5-3.0，默认2.0）
  
  // 支撑/阻力位相关配置
  lookbackPeriod: number;      // 回溯周期数（用于识别关键位）
  bufferPercent: number;       // 缓冲区百分比（防止假突破）
  
  // 综合止损策略
  useATR: boolean;             // 是否使用ATR止损
  useSupportResistance: boolean; // 是否使用支撑/阻力止损
  
  // 最小/最大止损距离（防止极端情况）
  minStopLossPercent: number;  // 最小止损距离%（如0.5%）
  maxStopLossPercent: number;  // 最大止损距离%（如5%）
}

/**
 * 默认止损配置
 */
export const DEFAULT_STOP_LOSS_CONFIG: StopLossConfig = {
  atrPeriod: 14,
  atrMultiplier: 2.0,
  lookbackPeriod: 20,
  bufferPercent: 0.1,
  useATR: true,
  useSupportResistance: true,
  minStopLossPercent: 0.5,
  maxStopLossPercent: 5.0,
};

/**
 * K线数据接口
 */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 止损计算结果
 */
export interface StopLossResult {
  // 推荐的止损价格
  stopLossPrice: number;
  
  // 止损距离（百分比）
  stopLossDistancePercent: number;
  
  // 计算方法
  method: "ATR" | "SUPPORT_RESISTANCE" | "HYBRID";
  
  // 详细信息
  details: {
    atr?: number;              // ATR值
    atrPercent?: number;       // ATR占价格的百分比
    supportLevel?: number;     // 支撑位价格
    resistanceLevel?: number;  // 阻力位价格
    atrStopPrice?: number;     // 基于ATR的止损价
    srStopPrice?: number;      // 基于支撑/阻力的止损价
  };
  
  // 质量评分（0-100）
  qualityScore: number;
  
  // 风险评估
  riskAssessment: {
    isNoisy: boolean;          // 是否处于高噪音环境
    volatilityLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
    recommendation: string;    // 建议
  };
}

/**
 * 计算 ATR (Average True Range)
 */
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) {
    logger.warn(`K线数量不足，无法计算ATR${period}`);
    return 0;
  }
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    // True Range = max(H-L, |H-PC|, |L-PC|)
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  // 计算前 period 个 TR 的平均值作为初始 ATR
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  // 使用指数移动平均平滑 ATR
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  
  return atr;
}

/**
 * 识别支撑位（最近的显著低点）
 */
export function findSupportLevel(candles: Candle[], lookback: number = 20): number {
  if (candles.length < lookback) {
    return 0;
  }
  
  const recentCandles = candles.slice(-lookback);
  
  // 方法1：寻找最低点
  const lowestLow = Math.min(...recentCandles.map(c => c.low));
  
  // 方法2：寻找局部低点（比左右邻居都低）
  const localLows: number[] = [];
  for (let i = 2; i < recentCandles.length - 2; i++) {
    const current = recentCandles[i].low;
    const leftMin = Math.min(recentCandles[i - 1].low, recentCandles[i - 2].low);
    const rightMin = Math.min(recentCandles[i + 1].low, recentCandles[i + 2].low);
    
    if (current < leftMin && current < rightMin) {
      localLows.push(current);
    }
  }
  
  // 如果找到局部低点，使用最低的局部低点；否则使用绝对最低点
  return localLows.length > 0 ? Math.min(...localLows) : lowestLow;
}

/**
 * 识别阻力位（最近的显著高点）
 */
export function findResistanceLevel(candles: Candle[], lookback: number = 20): number {
  if (candles.length < lookback) {
    return 0;
  }
  
  const recentCandles = candles.slice(-lookback);
  
  // 方法1：寻找最高点
  const highestHigh = Math.max(...recentCandles.map(c => c.high));
  
  // 方法2：寻找局部高点（比左右邻居都高）
  const localHighs: number[] = [];
  for (let i = 2; i < recentCandles.length - 2; i++) {
    const current = recentCandles[i].high;
    const leftMax = Math.max(recentCandles[i - 1].high, recentCandles[i - 2].high);
    const rightMax = Math.max(recentCandles[i + 1].high, recentCandles[i + 2].high);
    
    if (current > leftMax && current > rightMax) {
      localHighs.push(current);
    }
  }
  
  // 如果找到局部高点，使用最高的局部高点；否则使用绝对最高点
  return localHighs.length > 0 ? Math.max(...localHighs) : highestHigh;
}

/**
 * 判断市场噪音水平
 */
export function assessMarketNoise(candles: Candle[], atr: number, currentPrice: number): {
  isNoisy: boolean;
  volatilityLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  atrPercent: number;
} {
  const atrPercent = (atr / currentPrice) * 100;
  
  let volatilityLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  let isNoisy: boolean;
  
  if (atrPercent < 1.5) {
    volatilityLevel = "LOW";
    isNoisy = false;
  } else if (atrPercent < 3.0) {
    volatilityLevel = "MEDIUM";
    isNoisy = false;
  } else if (atrPercent < 5.0) {
    volatilityLevel = "HIGH";
    isNoisy = true;
  } else {
    volatilityLevel = "EXTREME";
    isNoisy = true;
  }
  
  return { isNoisy, volatilityLevel, atrPercent };
}

/**
 * 计算科学止损位
 * 
 * @param symbol 交易对符号
 * @param side 方向（long/short）
 * @param entryPrice 入场价格
 * @param config 止损配置
 * @param timeframe K线周期（默认1h）
 */
export async function calculateScientificStopLoss(
  symbol: string,
  side: "long" | "short",
  entryPrice: number,
  config: StopLossConfig = DEFAULT_STOP_LOSS_CONFIG,
  timeframe: "1m" | "5m" | "15m" | "1h" | "4h" = "1h"
): Promise<StopLossResult> {
  const exchangeClient = getExchangeClient();
  const contract = exchangeClient.normalizeContract(symbol);
  
  // 获取K线数据（需要足够的历史数据）
  const requiredCandles = Math.max(config.atrPeriod + 1, config.lookbackPeriod) + 10;
  const rawCandles = await exchangeClient.getFuturesCandles(contract, timeframe, requiredCandles);
  
  if (!rawCandles || rawCandles.length < config.atrPeriod + 1) {
    logger.error(`K线数据不足，无法计算止损。需要至少 ${config.atrPeriod + 1} 根K线`);
    throw new Error("K线数据不足");
  }
  
  // 转换为标准格式
  const candles: Candle[] = rawCandles.map((c: any) => ({
    time: c.t || c.time || 0,
    open: Number.parseFloat(c.open || c.o || "0"),
    high: Number.parseFloat(c.high || c.h || "0"),
    low: Number.parseFloat(c.low || c.l || "0"),
    close: Number.parseFloat(c.close || c.c || "0"),
    volume: Number.parseFloat(c.volume || c.v || "0"),
  }));
  
  const currentPrice = candles[candles.length - 1].close;
  
  // ===== 1. 基于 ATR 的止损 =====
  const atr = calculateATR(candles, config.atrPeriod);
  const atrPercent = (atr / currentPrice) * 100;
  const atrDistance = atr * config.atrMultiplier;
  
  let atrStopPrice: number;
  if (side === "long") {
    atrStopPrice = entryPrice - atrDistance;
  } else {
    atrStopPrice = entryPrice + atrDistance;
  }
  
  // ===== 2. 基于支撑/阻力位的止损 =====
  let srStopPrice: number | undefined;
  let supportLevel: number | undefined;
  let resistanceLevel: number | undefined;
  
  if (config.useSupportResistance) {
    if (side === "long") {
      supportLevel = findSupportLevel(candles, config.lookbackPeriod);
      // 止损设在支撑位下方一个缓冲区
      const buffer = supportLevel * (config.bufferPercent / 100);
      srStopPrice = supportLevel - buffer;
    } else {
      resistanceLevel = findResistanceLevel(candles, config.lookbackPeriod);
      // 止损设在阻力位上方一个缓冲区
      const buffer = resistanceLevel * (config.bufferPercent / 100);
      srStopPrice = resistanceLevel + buffer;
    }
  }
  
  // ===== 3. 综合决策 =====
  let finalStopPrice: number;
  let method: "ATR" | "SUPPORT_RESISTANCE" | "HYBRID";
  
  if (config.useATR && config.useSupportResistance && srStopPrice !== undefined) {
    // 混合策略：选择更保守的止损位
    if (side === "long") {
      // 多单：选择较高的止损（更接近入场价，更保守）
      finalStopPrice = Math.max(atrStopPrice, srStopPrice);
    } else {
      // 空单：选择较低的止损（更接近入场价，更保守）
      finalStopPrice = Math.min(atrStopPrice, srStopPrice);
    }
    method = "HYBRID";
  } else if (config.useSupportResistance && srStopPrice !== undefined) {
    finalStopPrice = srStopPrice;
    method = "SUPPORT_RESISTANCE";
  } else {
    finalStopPrice = atrStopPrice;
    method = "ATR";
  }
  
  // ===== 4. 应用最小/最大止损限制 =====
  const minStopDistance = entryPrice * (config.minStopLossPercent / 100);
  const maxStopDistance = entryPrice * (config.maxStopLossPercent / 100);
  
  if (side === "long") {
    const currentDistance = entryPrice - finalStopPrice;
    if (currentDistance < minStopDistance) {
      finalStopPrice = entryPrice - minStopDistance;
      logger.warn(`止损距离过小，调整为最小值 ${config.minStopLossPercent}%`);
    } else if (currentDistance > maxStopDistance) {
      finalStopPrice = entryPrice - maxStopDistance;
      logger.warn(`止损距离过大，调整为最大值 ${config.maxStopLossPercent}%`);
    }
  } else {
    const currentDistance = finalStopPrice - entryPrice;
    if (currentDistance < minStopDistance) {
      finalStopPrice = entryPrice + minStopDistance;
      logger.warn(`止损距离过小，调整为最小值 ${config.minStopLossPercent}%`);
    } else if (currentDistance > maxStopDistance) {
      finalStopPrice = entryPrice + maxStopDistance;
      logger.warn(`止损距离过大，调整为最大值 ${config.maxStopLossPercent}%`);
    }
  }
  
  // ===== 5. 计算止损距离百分比 =====
  const stopLossDistancePercent = side === "long"
    ? ((entryPrice - finalStopPrice) / entryPrice) * 100
    : ((finalStopPrice - entryPrice) / entryPrice) * 100;
  
  // ===== 6. 评估市场噪音和风险 =====
  const noiseAssessment = assessMarketNoise(candles, atr, currentPrice);
  
  let recommendation = "";
  if (noiseAssessment.volatilityLevel === "EXTREME") {
    recommendation = "市场波动极端剧烈，建议减小仓位或暂缓交易";
  } else if (noiseAssessment.isNoisy) {
    recommendation = "市场噪音较高，已自动扩大止损空间以避免被洗出";
  } else {
    recommendation = "市场波动正常，止损设置合理";
  }
  
  // ===== 7. 计算质量评分 =====
  let qualityScore = 50; // 基础分
  
  // ATR合理性（1-3%为最佳）
  if (atrPercent >= 1.5 && atrPercent <= 3.0) {
    qualityScore += 20;
  } else if (atrPercent < 1.5) {
    qualityScore += 10;
  }
  
  // 止损距离合理性（1.5-3%为最佳）
  if (stopLossDistancePercent >= 1.5 && stopLossDistancePercent <= 3.0) {
    qualityScore += 20;
  } else if (stopLossDistancePercent < 1.5) {
    qualityScore += 10;
  }
  
  // 支撑/阻力位存在性
  if (supportLevel || resistanceLevel) {
    qualityScore += 10;
  }
  
  // 确保分数在0-100范围内
  qualityScore = Math.max(0, Math.min(100, qualityScore));
  
  // ===== 8. 返回结果 =====
  const result: StopLossResult = {
    stopLossPrice: finalStopPrice,
    stopLossDistancePercent,
    method,
    details: {
      atr,
      atrPercent,
      supportLevel,
      resistanceLevel,
      atrStopPrice,
      srStopPrice,
    },
    qualityScore,
    riskAssessment: {
      isNoisy: noiseAssessment.isNoisy,
      volatilityLevel: noiseAssessment.volatilityLevel,
      recommendation,
    },
  };
  
  logger.info(`📊 ${symbol} ${side} 止损计算完成: 
    - 入场价: ${entryPrice.toFixed(4)}
    - 止损价: ${finalStopPrice.toFixed(4)}
    - 止损距离: ${stopLossDistancePercent.toFixed(2)}%
    - ATR${config.atrPeriod}: ${atr.toFixed(4)} (${atrPercent.toFixed(2)}%)
    - 方法: ${method}
    - 波动率: ${noiseAssessment.volatilityLevel}
    - 质量评分: ${qualityScore}/100`);
  
  return result;
}

/**
 * 检查是否应该开仓（基于止损合理性）
 * 
 * 这是一个"过滤器"，在开仓前检查止损空间是否合理
 * 如果止损距离太远（风险回报比不佳），建议放弃交易
 */
export async function shouldOpenPosition(
  symbol: string,
  side: "long" | "short",
  entryPrice: number,
  config: StopLossConfig = DEFAULT_STOP_LOSS_CONFIG
): Promise<{
  shouldOpen: boolean;
  reason: string;
  stopLossResult?: StopLossResult;
}> {
  try {
    const stopLossResult = await calculateScientificStopLoss(
      symbol,
      side,
      entryPrice,
      config
    );
    
    // 检查1：止损距离是否过大
    if (stopLossResult.stopLossDistancePercent > config.maxStopLossPercent) {
      return {
        shouldOpen: false,
        reason: `止损距离过大 (${stopLossResult.stopLossDistancePercent.toFixed(2)}% > ${config.maxStopLossPercent}%)，风险回报比不佳`,
        stopLossResult,
      };
    }
    
    // 检查2：波动率是否过于极端
    if (stopLossResult.riskAssessment.volatilityLevel === "EXTREME") {
      return {
        shouldOpen: false,
        reason: "市场波动极端剧烈，暂缓交易",
        stopLossResult,
      };
    }
    
    // 检查3：质量评分是否过低
    if (stopLossResult.qualityScore < 40) {
      return {
        shouldOpen: false,
        reason: `止损质量评分过低 (${stopLossResult.qualityScore}/100)，交易环境不理想`,
        stopLossResult,
      };
    }
    
    return {
      shouldOpen: true,
      reason: "止损设置合理，可以开仓",
      stopLossResult,
    };
  } catch (error) {
    logger.error(`检查开仓条件失败: ${error}`);
    return {
      shouldOpen: false,
      reason: `无法计算止损: ${error}`,
    };
  }
}

/**
 * 为现有持仓动态更新止损（移动止损）
 */
export async function updateTrailingStopLoss(
  symbol: string,
  side: "long" | "short",
  entryPrice: number,
  currentPrice: number,
  currentStopLoss: number,
  config: StopLossConfig = DEFAULT_STOP_LOSS_CONFIG
): Promise<{
  shouldUpdate: boolean;
  newStopLoss?: number;
  reason: string;
}> {
  try {
    // 重新计算科学止损位
    const stopLossResult = await calculateScientificStopLoss(
      symbol,
      side,
      currentPrice, // 使用当前价格作为参考
      config
    );
    
    const newStopLoss = stopLossResult.stopLossPrice;
    
    // 只在止损向有利方向移动时才更新
    if (side === "long") {
      // 多单：新止损高于旧止损才更新
      if (newStopLoss > currentStopLoss) {
        const improvement = ((newStopLoss - currentStopLoss) / currentStopLoss) * 100;
        return {
          shouldUpdate: true,
          newStopLoss,
          reason: `止损上移 ${improvement.toFixed(2)}%，保护利润`,
        };
      }
    } else {
      // 空单：新止损低于旧止损才更新
      if (newStopLoss < currentStopLoss) {
        const improvement = ((currentStopLoss - newStopLoss) / currentStopLoss) * 100;
        return {
          shouldUpdate: true,
          newStopLoss,
          reason: `止损下移 ${improvement.toFixed(2)}%，保护利润`,
        };
      }
    }
    
    return {
      shouldUpdate: false,
      reason: "当前止损位置仍然合理，无需调整",
    };
  } catch (error) {
    logger.error(`更新止损失败: ${error}`);
    return {
      shouldUpdate: false,
      reason: `无法更新止损: ${error}`,
    };
  }
}
