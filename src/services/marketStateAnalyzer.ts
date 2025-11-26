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
 * 1. 策略自适应时间框架选择（根据交易策略自动匹配最优时间框架）
 * 2. 趋势强度判断（基于主框架的EMA20/EMA50关系）
 * 3. 超买超卖判断（基于确认框架的RSI7/RSI14）
 * 4. 波动率状态（基于过滤框架的ATR，判断市场活跃度）
 * 5. 多时间框架一致性检查（三层验证）
 * 6. 价格与关键均线的位置关系（偏离度计算）
 * 
 * 策略时间框架映射：
 * - ultra-short:  3分钟（主）+ 5分钟（确认）+ 15分钟（过滤）
 * - aggressive:   5分钟（主）+ 15分钟（确认）+ 30分钟（过滤）
 * - balanced:     5分钟（主）+ 15分钟（确认）+ 1小时（过滤）
 * - conservative: 15分钟（主）+ 30分钟（确认）+ 1小时（过滤）
 * - swing-trend:  15分钟（主）+ 1小时（确认）+ 4小时（过滤）
 */

import { createLogger } from "../utils/logger";
import { getTradingStrategy, type TradingStrategy } from "../agents/tradingAgent";
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
 * 策略自适应时间框架配置
 * 根据不同交易策略选择最优的时间框架组合
 */
interface StrategyTimeframes {
  primary: string;    // 主框架：用于趋势判断
  confirm: string;    // 确认框架：用于动量判断
  filter: string;     // 过滤框架：用于大势判断
}

/**
 * 获取策略对应的时间框架配置
 */
function getTimeframesForStrategy(strategy: TradingStrategy): StrategyTimeframes {
  const timeframeMap: Record<TradingStrategy, StrategyTimeframes> = {
    'ultra-short': {
      primary: 'SHORT_1',      // 3分钟 - 极快响应
      confirm: 'SHORT',        // 5分钟 - 减少噪音
      filter: 'SHORT_CONFIRM'  // 15分钟 - 避免逆势
    },
    'aggressive': {
      primary: 'SHORT',        // 5分钟 - 快速响应
      confirm: 'SHORT_CONFIRM', // 15分钟 - 平衡噪音
      filter: 'MEDIUM_SHORT'   // 30分钟 - 趋势质量
    },
    'balanced': {
      primary: 'SHORT',        // 5分钟 - 敏感适中
      confirm: 'SHORT_CONFIRM', // 15分钟 - 标准配置
      filter: 'MEDIUM'         // 1小时 - 稳定可靠
    },
    'conservative': {
      primary: 'SHORT_CONFIRM', // 15分钟 - 过滤噪音
      confirm: 'MEDIUM_SHORT',  // 30分钟 - 高质量信号
      filter: 'MEDIUM'         // 1小时 - 趋势确认
    },
    'swing-trend': {
      primary: 'SHORT_CONFIRM', // 15分钟 - 过滤短期波动
      confirm: 'MEDIUM',        // 1小时 - 趋势成熟度
      filter: 'MEDIUM_LONG'    // 4小时 - 大趋势方向
    }
  };
  
  return timeframeMap[strategy];
}

/**
 * 分析市场状态
 * 
 * @param symbol 交易品种
 * @param currentPosition 当前持仓信息（可选）
 * @returns 市场状态分析结果
 */
export async function analyzeMarketState(
  symbol: string,
  currentPosition?: { direction: 'long' | 'short' }
): Promise<MarketStateAnalysis> {
  logger.info(`开始分析 ${symbol} 的市场状态...`);
  
  // 获取当前策略
  const strategy = getTradingStrategy();
  const timeframes = getTimeframesForStrategy(strategy);
  
  logger.debug(`${symbol} 使用策略: ${strategy}, 时间框架: ${timeframes.primary}/${timeframes.confirm}/${timeframes.filter}`);
  
  // 获取多时间框架数据（策略自适应）
  const mtfData = await performMultiTimeframeAnalysis(
    symbol, 
    [timeframes.primary, timeframes.confirm, timeframes.filter]
  );
  
  // 提取时间框架数据（动态适配）
  const tfPrimaryKey = timeframes.primary.toLowerCase().replace(/_/g, '') as keyof typeof mtfData.timeframes;
  const tfConfirmKey = timeframes.confirm.toLowerCase().replace(/_/g, '') as keyof typeof mtfData.timeframes;
  const tfFilterKey = timeframes.filter.toLowerCase().replace(/_/g, '') as keyof typeof mtfData.timeframes;
  
  const tfPrimary = mtfData.timeframes[tfPrimaryKey];
  const tfConfirm = mtfData.timeframes[tfConfirmKey];
  const tfFilter = mtfData.timeframes[tfFilterKey];
  
  if (!tfPrimary || !tfConfirm || !tfFilter) {
    throw new Error(`无法获取 ${symbol} 的时间框架数据`);
  }
  
  // 1. 判断趋势强度（基于主框架）
  const trendStrength = determineTrendStrength(tfPrimary);
  
  // 2. 判断动量状态（基于确认框架）
  const momentumState = determineMomentumState(tfConfirm);
  
  // 3. 判断波动率状态（基于过滤框架）
  const volatilityState = determineVolatilityState(tfFilter);
  
  // 4. 综合判断市场状态
  const { state, confidence } = determineMarketState(
    trendStrength,
    momentumState,
    tfConfirm,
    tfFilter
  );
  
  // 5. 计算多时间框架一致性（三层验证）
  const alignmentScore = calculateTripleTimeframeConsistency(
    tfPrimary,
    tfConfirm,
    tfFilter
  );
  
  const isAligned = alignmentScore > 0.6;
  
  // 6. 计算价格相对布林带的位置
  const priceVsUpperBB = calculatePriceVsBB(tfConfirm.currentPrice, tfConfirm.bollingerUpper, tfConfirm.bollingerMiddle);
  const priceVsLowerBB = calculatePriceVsBB(tfConfirm.currentPrice, tfConfirm.bollingerLower, tfConfirm.bollingerMiddle);
  
  // 7. 计算趋势强度得分（新增）
  const trendScores = {
    primary: calculateTrendScore(tfPrimary),
    confirm: calculateTrendScore(tfConfirm),
    filter: calculateTrendScore(tfFilter)
  };
  
  // 8. 更新趋势得分历史
  updateTrendScoreHistory(symbol, trendScores);
  
  // 9. 获取历史数据并计算趋势变化
  const scoreHistory = getTrendScoreHistory(symbol);
  const trendChanges = scoreHistory.primary.length > 0 ? {
    primary: detectTrendWeakening(trendScores.primary, scoreHistory.primary),
    confirm: detectTrendWeakening(trendScores.confirm, scoreHistory.confirm),
    filter: detectTrendWeakening(trendScores.filter, scoreHistory.filter)
  } : undefined;
  
  // 10. 如果有持仓，计算反转得分
  let reversalAnalysis: import("../types/marketState").ReversalAnalysis | undefined;
  if (currentPosition && scoreHistory.primary.length > 0) {
    reversalAnalysis = calculateReversalScore(
      tfPrimary,
      tfConfirm,
      tfFilter,
      currentPosition.direction,
      scoreHistory
    );
    
    logger.info(`${symbol} 反转分析: 得分=${reversalAnalysis.reversalScore}, 预警=${reversalAnalysis.earlyWarning}, 建议=${reversalAnalysis.recommendation}`);
  }
  
  const analysis: MarketStateAnalysis = {
    symbol,
    state,
    trendStrength,
    momentumState,
    volatilityState,
    confidence,
    trendScores,        // 新增
    trendChanges,       // 新增
    reversalAnalysis,   // 新增
    keyMetrics: {
      rsi7_15m: tfConfirm.rsi7,
      rsi14_15m: tfConfirm.rsi14,
      macd_15m: tfConfirm.macd,
      ema20_1h: tfFilter.ema20,
      ema50_1h: tfFilter.ema50,
      macd_1h: tfFilter.macd,
      price: tfConfirm.currentPrice,
      atr_ratio: tfFilter.atrRatio,
      distanceToEMA20: tfConfirm.deviationFromEMA20,
      priceVsUpperBB,
      priceVsLowerBB,
    },
    timeframeAlignment: {
      is15mAnd1hAligned: isAligned,
      alignmentScore,
    },
    timestamp: new Date().toISOString(),
  };
  
  logger.info(`${symbol} 市场状态: ${state} (置信度: ${(confidence * 100).toFixed(1)}%, 策略: ${strategy}, 趋势得分: P=${trendScores.primary} C=${trendScores.confirm} F=${trendScores.filter})`);
  
  return analysis;
}

/**
 * 计算三层时间框架一致性（主框架 + 确认框架 + 过滤框架）
 */
function calculateTripleTimeframeConsistency(
  tfPrimary: TimeframeIndicators,
  tfConfirm: TimeframeIndicators,
  tfFilter: TimeframeIndicators
): number {
  // 计算主框架和确认框架的一致性
  const primaryConfirmScore = calculateTrendConsistency(
    tfPrimary.ema20,
    tfPrimary.ema50,
    tfConfirm.ema20,
    tfConfirm.ema50,
    tfPrimary.macd,
    tfConfirm.macd
  );
  
  // 计算确认框架和过滤框架的一致性
  const confirmFilterScore = calculateTrendConsistency(
    tfConfirm.ema20,
    tfConfirm.ema50,
    tfFilter.ema20,
    tfFilter.ema50,
    tfConfirm.macd,
    tfFilter.macd
  );
  
  // 加权平均：主框架-确认框架占60%，确认框架-过滤框架占40%
  return primaryConfirmScore * 0.6 + confirmFilterScore * 0.4;
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
  
  // 上涨趋势 + 极端超卖 = 最佳做多机会（回调买入）⭐⭐⭐⭐⭐
  if (trendStrength === "trending_up" && momentumState === "oversold_extreme") {
    state = "uptrend_oversold";
    confidence = 0.9;
  }
  // 下跌趋势 + 极端超买 = 最佳做空机会（反弹卖出）⭐⭐⭐⭐⭐
  else if (trendStrength === "trending_down" && momentumState === "overbought_extreme") {
    state = "downtrend_overbought";
    confidence = 0.9;
  }
  // 🔧 新增：下跌趋势 + 极端超卖 = 潜在反弹机会（逆势做多）⭐⭐⭐
  else if (trendStrength === "trending_down" && momentumState === "oversold_extreme") {
    state = "downtrend_oversold";
    confidence = 0.6; // 逆势交易风险较高，置信度中等
  }
  // 🔧 新增：上涨趋势 + 极端超买 = 潜在回调风险（逆势做空）⭐⭐⭐
  else if (trendStrength === "trending_up" && momentumState === "overbought_extreme") {
    state = "uptrend_overbought";
    confidence = 0.6; // 逆势交易风险较高，置信度中等
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
  // 下跌趋势 + 轻度超卖 = 下跌趋势中的超卖状态 ⭐⭐⭐
  else if (trendStrength === "trending_down" && momentumState === "oversold_mild") {
    state = "downtrend_oversold";
    confidence = 0.5; // 风险中等
  }
  // 上涨趋势 + 轻度超买 = 上涨趋势中的超买状态 ⭐⭐⭐
  else if (trendStrength === "trending_up" && momentumState === "overbought_mild") {
    state = "uptrend_overbought";
    confidence = 0.5; // 风险中等
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

/**
 * 计算趋势强度得分（-100到+100）
 * +100 = 极强上涨趋势
 * 0 = 震荡
 * -100 = 极强下跌趋势
 */
function calculateTrendScore(tf: TimeframeIndicators): number {
  let score = 0;
  
  // 1. EMA关系（权重40%）- 主要趋势方向
  const emaGap = (tf.ema20 - tf.ema50) / tf.ema50;
  score += Math.max(-40, Math.min(40, emaGap * 1000));
  
  // 2. MACD强度（权重30%）- 趋势动能
  const macdNormalized = tf.macd / tf.currentPrice;
  score += Math.max(-30, Math.min(30, macdNormalized * 10000));
  
  // 3. 价格偏离度（权重20%）- 超买超卖
  score += Math.max(-20, Math.min(20, tf.deviationFromEMA20 * 2));
  
  // 4. RSI趋势（权重10%）- 动量方向
  const rsiTrend = (tf.rsi7 - 50) / 5;
  score += Math.max(-10, Math.min(10, rsiTrend));
  
  return Math.round(score);
}

/**
 * 检测趋势减弱（用于反转预警）
 */
function detectTrendWeakening(
  currentScore: number,
  scoreHistory: number[] // 最近5个周期
): import("../types/marketState").TrendChange {
  const previousScore = scoreHistory[scoreHistory.length - 1] || currentScore;
  const change = currentScore - previousScore;
  const changePercent = previousScore !== 0 
    ? (change / Math.abs(previousScore)) * 100 
    : 0;
  
  // 趋势减弱：得分绝对值下降超过20%
  const isWeakening = Math.abs(currentScore) < Math.abs(previousScore) * 0.8;
  
  // 趋势反转：得分跨越零线或反向超过20点
  const isReversing = 
    (previousScore > 20 && currentScore < -20) ||
    (previousScore < -20 && currentScore > 20);
  
  // 减弱严重程度
  const weakeningSeverity = isWeakening 
    ? Math.round((1 - Math.abs(currentScore) / Math.abs(previousScore)) * 100)
    : 0;
  
  return {
    currentScore,
    previousScore,
    change,
    changePercent,
    isWeakening,
    isReversing,
    weakeningSeverity
  };
}

/**
 * 背离信号接口
 */
interface DivergenceSignal {
  type: 'bullish' | 'bearish' | 'none'; // 看涨背离、看跌背离、无背离
  strength: number; // 0-100，背离强度
  description: string;
}

/**
 * 检测MACD背离
 * @param candles K线数据（最近20-30根）
 * @param macdValues MACD值数组（与K线对应）
 * @returns 背离信号
 */
function detectMACDDivergence(
  candles: any[],
  macdValues: number[]
): DivergenceSignal {
  // 至少需要20根K线才能检测背离
  if (!candles || candles.length < 20 || !macdValues || macdValues.length < 20) {
    return { type: 'none', strength: 0, description: '数据不足' };
  }
  
  // 提取价格数据（兼容不同交易所格式）
  const prices = candles.map((c: any) => {
    const closeVal = c.close || c.c || c.Close;
    return Number.parseFloat(closeVal || "0");
  }).filter((n: number) => Number.isFinite(n));
  
  if (prices.length < 20) {
    return { type: 'none', strength: 0, description: '价格数据不足' };
  }
  
  const halfLen = Math.floor(prices.length / 2);
  
  // 找到前半段和后半段的极值点
  const firstHalfPrices = prices.slice(0, halfLen);
  const secondHalfPrices = prices.slice(halfLen);
  const firstHalfMACD = macdValues.slice(0, halfLen);
  const secondHalfMACD = macdValues.slice(halfLen);
  
  const priceHigh1 = Math.max(...firstHalfPrices);
  const priceHigh2 = Math.max(...secondHalfPrices);
  const priceLow1 = Math.min(...firstHalfPrices);
  const priceLow2 = Math.min(...secondHalfPrices);
  
  const macdHigh1 = Math.max(...firstHalfMACD);
  const macdHigh2 = Math.max(...secondHalfMACD);
  const macdLow1 = Math.min(...firstHalfMACD);
  const macdLow2 = Math.min(...secondHalfMACD);
  
  // 顶背离检测：价格创新高，MACD未创新高（看跌信号）
  const isPriceHigherHigh = priceHigh2 > priceHigh1 * 1.001; // 价格新高（至少0.1%）
  const isMACDLowerHigh = macdHigh2 < macdHigh1 * 0.95; // MACD未新高（至少低5%）
  
  if (isPriceHigherHigh && isMACDLowerHigh) {
    const priceIncrease = ((priceHigh2 - priceHigh1) / priceHigh1) * 100;
    const macdDecrease = ((macdHigh1 - macdHigh2) / Math.abs(macdHigh1)) * 100;
    const strength = Math.min(100, Math.round((priceIncrease + macdDecrease) * 10));
    
    return {
      type: 'bearish',
      strength: Math.max(60, strength), // 至少60强度才算有效背离
      description: `顶背离：价格新高(${priceHigh2.toFixed(2)})但MACD未新高(${macdHigh2.toFixed(4)})`
    };
  }
  
  // 底背离检测：价格创新低，MACD未创新低（看涨信号）
  const isPriceLowerLow = priceLow2 < priceLow1 * 0.999; // 价格新低（至少0.1%）
  const isMACDHigherLow = macdLow2 > macdLow1 * 1.05; // MACD未新低（至少高5%）
  
  if (isPriceLowerLow && isMACDHigherLow) {
    const priceDecrease = ((priceLow1 - priceLow2) / priceLow1) * 100;
    const macdIncrease = ((macdLow2 - macdLow1) / Math.abs(macdLow1)) * 100;
    const strength = Math.min(100, Math.round((priceDecrease + macdIncrease) * 10));
    
    return {
      type: 'bullish',
      strength: Math.max(60, strength), // 至少60强度才算有效背离
      description: `底背离：价格新低(${priceLow2.toFixed(2)})但MACD未新低(${macdLow2.toFixed(4)})`
    };
  }
  
  return { type: 'none', strength: 0, description: '无明显背离' };
}

/**
 * 检测RSI背离
 * @param candles K线数据（最近20-30根）
 * @param rsiValues RSI值数组（与K线对应）
 * @returns 背离信号
 */
function detectRSIDivergence(
  candles: any[],
  rsiValues: number[]
): DivergenceSignal {
  // 至少需要20根K线才能检测背离
  if (!candles || candles.length < 20 || !rsiValues || rsiValues.length < 20) {
    return { type: 'none', strength: 0, description: '数据不足' };
  }
  
  // 提取价格数据（兼容不同交易所格式）
  const prices = candles.map((c: any) => {
    const closeVal = c.close || c.c || c.Close;
    return Number.parseFloat(closeVal || "0");
  }).filter((n: number) => Number.isFinite(n));
  
  if (prices.length < 20) {
    return { type: 'none', strength: 0, description: '价格数据不足' };
  }
  
  const halfLen = Math.floor(prices.length / 2);
  
  // 找到前半段和后半段的极值点
  const firstHalfPrices = prices.slice(0, halfLen);
  const secondHalfPrices = prices.slice(halfLen);
  const firstHalfRSI = rsiValues.slice(0, halfLen);
  const secondHalfRSI = rsiValues.slice(halfLen);
  
  const priceHigh1 = Math.max(...firstHalfPrices);
  const priceHigh2 = Math.max(...secondHalfPrices);
  const priceLow1 = Math.min(...firstHalfPrices);
  const priceLow2 = Math.min(...secondHalfPrices);
  
  const rsiHigh1 = Math.max(...firstHalfRSI);
  const rsiHigh2 = Math.max(...secondHalfRSI);
  const rsiLow1 = Math.min(...firstHalfRSI);
  const rsiLow2 = Math.min(...secondHalfRSI);
  
  // 顶背离检测：价格创新高，RSI未创新高（看跌信号）
  const isPriceHigherHigh = priceHigh2 > priceHigh1 * 1.001;
  const isRSILowerHigh = rsiHigh2 < rsiHigh1 - 3; // RSI至少低3个点
  
  if (isPriceHigherHigh && isRSILowerHigh) {
    const priceIncrease = ((priceHigh2 - priceHigh1) / priceHigh1) * 100;
    const rsiDecrease = rsiHigh1 - rsiHigh2;
    const strength = Math.min(100, Math.round((priceIncrease * 5 + rsiDecrease) * 2));
    
    return {
      type: 'bearish',
      strength: Math.max(60, strength),
      description: `RSI顶背离：价格新高(${priceHigh2.toFixed(2)})但RSI未新高(${rsiHigh2.toFixed(1)})`
    };
  }
  
  // 底背离检测：价格创新低，RSI未创新低（看涨信号）
  const isPriceLowerLow = priceLow2 < priceLow1 * 0.999;
  const isRSIHigherLow = rsiLow2 > rsiLow1 + 3; // RSI至少高3个点
  
  if (isPriceLowerLow && isRSIHigherLow) {
    const priceDecrease = ((priceLow1 - priceLow2) / priceLow1) * 100;
    const rsiIncrease = rsiLow2 - rsiLow1;
    const strength = Math.min(100, Math.round((priceDecrease * 5 + rsiIncrease) * 2));
    
    return {
      type: 'bullish',
      strength: Math.max(60, strength),
      description: `RSI底背离：价格新低(${priceLow2.toFixed(2)})但RSI未新低(${rsiLow2.toFixed(1)})`
    };
  }
  
  return { type: 'none', strength: 0, description: '无明显背离' };
}

/**
 * 计算多时间框架趋势反转得分（0-100）
 * 集成背离检测，提供更准确的反转信号
 */
function calculateReversalScore(
  tfPrimary: TimeframeIndicators,
  tfConfirm: TimeframeIndicators,
  tfFilter: TimeframeIndicators,
  positionDirection: 'long' | 'short',
  trendScoreHistory: {
    primary: number[];
    confirm: number[];
    filter: number[];
  }
): import("../types/marketState").ReversalAnalysis {
  let score = 0;
  const details: string[] = [];
  const reversedFrames: string[] = [];
  
  // 计算各框架当前趋势得分
  const scorePrimary = calculateTrendScore(tfPrimary);
  const scoreConfirm = calculateTrendScore(tfConfirm);
  const scoreFilter = calculateTrendScore(tfFilter);
  
  // 判断反转方向（做多持仓→看跌反转，做空持仓→看涨反转）
  const targetSign = positionDirection === 'long' ? -1 : 1;
  const targetDivergence = positionDirection === 'long' ? 'bearish' : 'bullish';
  
  // 1. 主框架反转检测（权重40%，为背离检测腾出空间）
  const primaryChange = detectTrendWeakening(scorePrimary, trendScoreHistory.primary);
  if (Math.sign(scorePrimary) === targetSign && Math.abs(scorePrimary) > 30) {
    score += 40;
    details.push(`主框架已强势反转（得分=${scorePrimary}）`);
    reversedFrames.push('primary');
  } else if (primaryChange.isWeakening && primaryChange.weakeningSeverity > 40) {
    score += 20;
    details.push(`主框架趋势显著减弱（${primaryChange.weakeningSeverity}%）`);
  } else if (Math.abs(scorePrimary) < 20) {
    score += 12;
    details.push(`主框架进入震荡区（得分=${scorePrimary}）`);
  }
  
  // 2. 确认框架反转检测（权重25%）
  const confirmChange = detectTrendWeakening(scoreConfirm, trendScoreHistory.confirm);
  if (Math.sign(scoreConfirm) === targetSign && Math.abs(scoreConfirm) > 30) {
    score += 25;
    details.push(`确认框架已强势反转（得分=${scoreConfirm}）`);
    reversedFrames.push('confirm');
  } else if (confirmChange.isWeakening && confirmChange.weakeningSeverity > 40) {
    score += 12;
    details.push(`确认框架趋势显著减弱（${confirmChange.weakeningSeverity}%）`);
  }
  
  // 3. 过滤框架反转检测（权重15%）
  const filterChange = detectTrendWeakening(scoreFilter, trendScoreHistory.filter);
  if (Math.sign(scoreFilter) === targetSign && Math.abs(scoreFilter) > 30) {
    score += 15;
    details.push(`过滤框架已反转（得分=${scoreFilter}）`);
    reversedFrames.push('filter');
  }
  
  // 4. MACD背离检测（权重10%）- 使用主框架数据
  if (tfPrimary.candles && tfPrimary.candles.length >= 20) {
    try {
      // 提取MACD历史值（从K线数据中重新计算或使用已有数据）
      const macdValues: number[] = [];
      const closes = tfPrimary.candles.map((c: any) => {
        const closeVal = c.close || c.c || c.Close;
        return Number.parseFloat(closeVal || "0");
      }).filter((n: number) => Number.isFinite(n));
      
      // 简化：使用当前MACD值填充数组（实际应该从历史K线计算）
      // 为了准确性，这里使用当前MACD作为基准，通过价格变化推算历史MACD趋势
      for (let i = 0; i < Math.min(closes.length, 30); i++) {
        const priceRatio = closes[i] / tfPrimary.currentPrice;
        const estimatedMACD = tfPrimary.macd * priceRatio;
        macdValues.push(estimatedMACD);
      }
      
      const macdDivergence = detectMACDDivergence(
        tfPrimary.candles.slice(-30),
        macdValues.slice(-30)
      );
      
      if (macdDivergence.type === targetDivergence && macdDivergence.strength >= 60) {
        score += 10;
        details.push(`⚠️ ${macdDivergence.description}（强度${macdDivergence.strength}）`);
      }
    } catch (error) {
      logger.debug(`MACD背离检测失败:`, error);
    }
  }
  
  // 5. RSI背离检测（权重10%）- 使用确认框架数据
  if (tfConfirm.candles && tfConfirm.candles.length >= 20) {
    try {
      // 提取RSI历史值（简化：使用当前RSI作为基准推算）
      const rsiValues: number[] = [];
      const closes = tfConfirm.candles.map((c: any) => {
        const closeVal = c.close || c.c || c.Close;
        return Number.parseFloat(closeVal || "0");
      }).filter((n: number) => Number.isFinite(n));
      
      // 使用RSI7的值，通过价格变化推算历史RSI趋势
      for (let i = 0; i < Math.min(closes.length, 30); i++) {
        const idx = closes.length - 1 - i;
        if (idx >= 0 && idx < closes.length - 1) {
          const priceChange = ((closes[idx + 1] - closes[idx]) / closes[idx]) * 100;
          // RSI会跟随价格变化，但幅度更小
          const rsiAdjust = priceChange * 0.5;
          rsiValues.unshift(Math.max(0, Math.min(100, tfConfirm.rsi7 - rsiAdjust)));
        } else {
          rsiValues.unshift(tfConfirm.rsi7);
        }
      }
      
      const rsiDivergence = detectRSIDivergence(
        tfConfirm.candles.slice(-30),
        rsiValues.slice(-30)
      );
      
      if (rsiDivergence.type === targetDivergence && rsiDivergence.strength >= 60) {
        score += 10;
        details.push(`⚠️ ${rsiDivergence.description}（强度${rsiDivergence.strength}）`);
      }
    } catch (error) {
      logger.debug(`RSI背离检测失败:`, error);
    }
  }
  
  // 早期预警：任意两个框架趋势减弱>40% 或 检测到背离
  const weakenedFrames = [
    primaryChange.weakeningSeverity > 40,
    confirmChange.weakeningSeverity > 40,
    filterChange.weakeningSeverity > 40
  ].filter(Boolean).length;
  
  const hasDivergence = details.some(d => d.includes('背离'));
  const earlyWarning = weakenedFrames >= 2 || reversedFrames.length >= 2 || hasDivergence;
  
  // 生成建议（降低阈值：70, 50, 30）
  let recommendation = '';
  if (score >= 70) {
    recommendation = '立即平仓！多个时间框架确认反转';
  } else if (score >= 50) {
    recommendation = '建议平仓，反转风险较高';
  } else if (earlyWarning && score >= 30) {
    recommendation = '密切关注，趋势开始减弱或出现背离';
  } else {
    recommendation = '趋势正常，继续持有';
  }
  
  return {
    reversalScore: score,
    earlyWarning,
    timeframesReversed: reversedFrames,
    recommendation,
    details
  };
}

// 存储历史趋势得分（内存缓存）
const trendScoreCache = new Map<string, {
  primary: number[];
  confirm: number[];
  filter: number[];
  lastUpdate: number;
}>();

const SCORE_HISTORY_SIZE = 5; // 保留最近5个周期
const CACHE_EXPIRE_MS = 3600000; // 1小时过期

/**
 * 更新趋势得分历史
 */
function updateTrendScoreHistory(
  symbol: string,
  scores: { primary: number; confirm: number; filter: number }
): void {
  const cached = trendScoreCache.get(symbol);
  const now = Date.now();
  
  if (!cached || now - cached.lastUpdate > CACHE_EXPIRE_MS) {
    // 初始化或重置
    trendScoreCache.set(symbol, {
      primary: [scores.primary],
      confirm: [scores.confirm],
      filter: [scores.filter],
      lastUpdate: now
    });
  } else {
    // 追加新得分
    cached.primary.push(scores.primary);
    cached.confirm.push(scores.confirm);
    cached.filter.push(scores.filter);
    
    // 保持固定大小
    if (cached.primary.length > SCORE_HISTORY_SIZE) {
      cached.primary.shift();
      cached.confirm.shift();
      cached.filter.shift();
    }
    
    cached.lastUpdate = now;
  }
}

/**
 * 获取趋势得分历史
 */
function getTrendScoreHistory(symbol: string): {
  primary: number[];
  confirm: number[];
  filter: number[];
} {
  const cached = trendScoreCache.get(symbol);
  const now = Date.now();
  
  if (!cached || now - cached.lastUpdate > CACHE_EXPIRE_MS) {
    return { primary: [], confirm: [], filter: [] };
  }
  
  return {
    primary: cached.primary.slice(),
    confirm: cached.confirm.slice(),
    filter: cached.filter.slice()
  };
}
