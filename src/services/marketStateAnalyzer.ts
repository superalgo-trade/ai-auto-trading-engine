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
 * 市场状态识别服务
 * 
 * 功能：
 * 1. 趋势强度判断（基于EMA20/EMA50关系，1小时级别）
 * 2. 超买超卖判断（基于RSI7/RSI14，15分钟级别）
 * 3. 波动率状态（基于ATR，判断市场活跃度）
 * 4. 多时间框架一致性检查（15分钟 + 1小时）
 * 5. 价格与关键均线的位置关系（偏离度计算）
 */

import { createLogger } from "../utils/logger";
import { 
  performMultiTimeframeAnalysis,
  calculateTrendConsistency,
  type MultiTimeframeAnalysis,
  type TimeframeIndicators 
} from "./multiTimeframeAnalysis";
import type {
  MarketState,
  MarketStateAnalysis,
  TrendStrength,
  MomentumState,
  VolatilityState
} from "../types/marketState";

const logger = createLogger({
  name: "market-state",
  level: "info",
});

// 环境变量配置（带默认值）
const OVERSOLD_EXTREME_THRESHOLD = Number.parseFloat(process.env.OVERSOLD_EXTREME_THRESHOLD || "20");
const OVERSOLD_MILD_THRESHOLD = Number.parseFloat(process.env.OVERSOLD_MILD_THRESHOLD || "30");
const OVERBOUGHT_EXTREME_THRESHOLD = Number.parseFloat(process.env.OVERBOUGHT_EXTREME_THRESHOLD || "80");
const OVERBOUGHT_MILD_THRESHOLD = Number.parseFloat(process.env.OVERBOUGHT_MILD_THRESHOLD || "70");

/**
 * 分析市场状态
 * 
 * @param symbol 交易品种
 * @returns 市场状态分析结果
 */
export async function analyzeMarketState(symbol: string): Promise<MarketStateAnalysis> {
  logger.info(`开始分析 ${symbol} 的市场状态...`);
  
  // 获取多时间框架数据
  const mtfData = await performMultiTimeframeAnalysis(symbol, ["SHORT_CONFIRM", "MEDIUM"]);
  
  // 提取关键时间框架数据
  const tf15m = mtfData.timeframes.shortconfirm; // 15分钟
  const tf1h = mtfData.timeframes.medium;         // 1小时
  
  if (!tf15m || !tf1h) {
    throw new Error(`无法获取 ${symbol} 的时间框架数据`);
  }
  
  // 1. 判断趋势强度（基于1小时框架）
  const trendStrength = determineTrendStrength(tf1h);
  
  // 2. 判断动量状态（基于15分钟框架的RSI7）
  const momentumState = determineMomentumState(tf15m);
  
  // 3. 判断波动率状态（基于1小时框架的ATR）
  const volatilityState = determineVolatilityState(tf1h);
  
  // 4. 综合判断市场状态
  const { state, confidence } = determineMarketState(
    trendStrength,
    momentumState,
    tf15m,
    tf1h
  );
  
  // 5. 计算多时间框架一致性
  const alignmentScore = calculateTrendConsistency(
    tf15m.ema20,
    tf15m.ema50,
    tf1h.ema20,
    tf1h.ema50,
    tf15m.macd,
    tf1h.macd
  );
  
  const is15mAnd1hAligned = alignmentScore > 0.6;
  
  // 6. 计算价格相对布林带的位置
  const priceVsUpperBB = calculatePriceVsBB(tf15m.currentPrice, tf15m.bollingerUpper, tf15m.bollingerMiddle);
  const priceVsLowerBB = calculatePriceVsBB(tf15m.currentPrice, tf15m.bollingerLower, tf15m.bollingerMiddle);
  
  const analysis: MarketStateAnalysis = {
    symbol,
    state,
    trendStrength,
    momentumState,
    volatilityState,
    confidence,
    keyMetrics: {
      rsi7_15m: tf15m.rsi7,
      rsi14_15m: tf15m.rsi14,
      macd_15m: tf15m.macd,
      ema20_1h: tf1h.ema20,
      ema50_1h: tf1h.ema50,
      macd_1h: tf1h.macd,
      price: tf15m.currentPrice,
      atr_ratio: tf1h.atrRatio,
      distanceToEMA20: tf15m.deviationFromEMA20,
      priceVsUpperBB,
      priceVsLowerBB,
    },
    timeframeAlignment: {
      is15mAnd1hAligned,
      alignmentScore,
    },
    timestamp: new Date().toISOString(),
  };
  
  logger.info(`${symbol} 市场状态: ${state} (置信度: ${(confidence * 100).toFixed(1)}%)`);
  
  return analysis;
}

/**
 * 判断趋势强度
 */
function determineTrendStrength(tf: TimeframeIndicators): TrendStrength {
  const { ema20, ema50, macd, currentPrice } = tf;
  
  // 上涨趋势：EMA20 > EMA50 且 MACD > 0 且价格在EMA20上方
  if (ema20 > ema50 && macd > 0) {
    return "trending_up";
  }
  
  // 下跌趋势：EMA20 < EMA50 且 MACD < 0 且价格在EMA20下方
  if (ema20 < ema50 && macd < 0) {
    return "trending_down";
  }
  
  // 其他情况为震荡
  return "ranging";
}

/**
 * 判断动量状态（超买超卖）
 */
function determineMomentumState(tf: TimeframeIndicators): MomentumState {
  const rsi7 = tf.rsi7;
  
  if (rsi7 < OVERSOLD_EXTREME_THRESHOLD) {
    return "oversold_extreme";
  }
  if (rsi7 < OVERSOLD_MILD_THRESHOLD) {
    return "oversold_mild";
  }
  if (rsi7 > OVERBOUGHT_EXTREME_THRESHOLD) {
    return "overbought_extreme";
  }
  if (rsi7 > OVERBOUGHT_MILD_THRESHOLD) {
    return "overbought_mild";
  }
  
  return "neutral";
}

/**
 * 判断波动率状态
 */
function determineVolatilityState(tf: TimeframeIndicators): VolatilityState {
  const atrRatio = tf.atrRatio;
  
  if (atrRatio > 1.5) {
    return "high_vol";
  }
  if (atrRatio < 0.7) {
    return "low_vol";
  }
  
  return "normal_vol";
}

/**
 * 综合判断市场状态
 */
function determineMarketState(
  trendStrength: TrendStrength,
  momentumState: MomentumState,
  tf15m: TimeframeIndicators,
  tf1h: TimeframeIndicators
): { state: MarketState; confidence: number } {
  let state: MarketState = "no_clear_signal";
  let confidence = 0.3;
  
  // 上涨趋势 + 极端超卖 = 最佳做多机会 ⭐⭐⭐⭐⭐
  if (trendStrength === "trending_up" && momentumState === "oversold_extreme") {
    state = "uptrend_oversold";
    confidence = 0.9;
  }
  // 下跌趋势 + 极端超买 = 最佳做空机会 ⭐⭐⭐⭐⭐
  else if (trendStrength === "trending_down" && momentumState === "overbought_extreme") {
    state = "downtrend_overbought";
    confidence = 0.9;
  }
  // 上涨趋势 + 轻度超卖或中性 = 趋势延续做多 ⭐⭐⭐⭐
  else if (
    trendStrength === "trending_up" && 
    (momentumState === "oversold_mild" || momentumState === "neutral")
  ) {
    state = "uptrend_continuation";
    confidence = 0.7;
  }
  // 下跌趋势 + 轻度超买或中性 = 趋势延续做空 ⭐⭐⭐⭐
  else if (
    trendStrength === "trending_down" && 
    (momentumState === "overbought_mild" || momentumState === "neutral")
  ) {
    state = "downtrend_continuation";
    confidence = 0.7;
  }
  // 震荡市 + 极端超卖 = 均值回归做多 ⭐⭐⭐
  else if (trendStrength === "ranging" && momentumState === "oversold_extreme") {
    state = "ranging_oversold";
    confidence = 0.8;
  }
  // 震荡市 + 极端超买 = 均值回归做空 ⭐⭐⭐
  else if (trendStrength === "ranging" && momentumState === "overbought_extreme") {
    state = "ranging_overbought";
    confidence = 0.8;
  }
  // 震荡市 + 中性 = 观望 ⭐
  else if (trendStrength === "ranging" && momentumState === "neutral") {
    state = "ranging_neutral";
    confidence = 0.5;
  }
  
  // 增加置信度调整：MACD拐点确认
  if (tf15m.macdTurn === 1 && (state === "uptrend_oversold" || state === "ranging_oversold")) {
    confidence = Math.min(confidence + 0.1, 1.0);
  }
  if (tf15m.macdTurn === -1 && (state === "downtrend_overbought" || state === "ranging_overbought")) {
    confidence = Math.min(confidence + 0.1, 1.0);
  }
  
  return { state, confidence };
}

/**
 * 计算价格相对布林带的位置
 * 返回 -1 到 1 的值
 * -1: 在下轨下方
 *  0: 在中轨
 *  1: 在上轨上方
 */
function calculatePriceVsBB(price: number, bbLevel: number, bbMiddle: number): number {
  if (bbMiddle === 0 || bbLevel === bbMiddle) return 0;
  
  const distance = price - bbMiddle;
  const range = Math.abs(bbLevel - bbMiddle);
  
  if (range === 0) return 0;
  
  const position = distance / range;
  
  // 限制在 -2 到 2 之间（允许超出布林带）
  return Math.max(-2, Math.min(2, position));
}

/**
 * 批量分析多个品种的市场状态
 */
export async function analyzeMultipleMarketStates(
  symbols: string[]
): Promise<Map<string, MarketStateAnalysis>> {
  logger.info(`批量分析 ${symbols.length} 个品种的市场状态...`);
  
  const results = new Map<string, MarketStateAnalysis>();
  
  // 并发分析所有品种
  const promises = symbols.map(async (symbol) => {
    try {
      const analysis = await analyzeMarketState(symbol);
      results.set(symbol, analysis);
    } catch (error) {
      logger.error(`分析 ${symbol} 市场状态失败:`, error);
    }
  });
  
  await Promise.all(promises);
  
  logger.info(`完成市场状态分析，成功: ${results.size}/${symbols.length}`);
  
  return results;
}
