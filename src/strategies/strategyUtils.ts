/**
 * 策略工具函数
 * 提供策略通用的评分、确认和调整功能
 */

import type { MarketState } from '../types/marketState';

// 时间框架分析数据接口
export interface TimeframeAnalysis {
  ema20: number;
  ema50: number;
  rsi7: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  close: number;
}

/**
 * 计算信号强度评分（0-1）
 * 综合多个指标的对齐程度
 */
export function calculateSignalStrength(indicators: {
  rsi7: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  emaAlignment: boolean; // EMA20 vs EMA50 的关系是否符合预期
  pricePosition: number; // 价格相对于EMA20的位置（百分比）
  trendConsistency: number; // 多时间框架一致性（0-1）
}): number {
  let score = 0;
  let maxScore = 0;

  // RSI7 超卖/超买（权重：25分）
  maxScore += 25;
  if (indicators.rsi7 < 25) {
    score += 25 * (25 - indicators.rsi7) / 25; // 超卖越深，分数越高
  } else if (indicators.rsi7 > 75) {
    score += 25 * (indicators.rsi7 - 75) / 25; // 超买越高，分数越高
  } else if (indicators.rsi7 >= 30 && indicators.rsi7 <= 70) {
    score += 15; // 中性区域给部分分
  }

  // MACD 方向确认（权重：20分）
  maxScore += 20;
  const macdDiff = indicators.macd - indicators.macdSignal;
  if (Math.abs(macdDiff) > 0) {
    score += 20 * Math.min(Math.abs(macdDiff) / 100, 1);
  }

  // EMA 排列确认（权重：25分）
  maxScore += 25;
  if (indicators.emaAlignment) {
    score += 25;
  }

  // 价格位置合理性（权重：15分）
  maxScore += 15;
  const absDeviation = Math.abs(indicators.pricePosition);
  if (absDeviation < 3) {
    score += 15 * (1 - absDeviation / 3); // 偏离越小越好
  }

  // 多时间框架一致性（权重：15分）
  maxScore += 15;
  score += 15 * indicators.trendConsistency;

  return Math.min(score / maxScore, 1);
}

/**
 * 多时间框架确认检查
 * 检查15分钟和1小时级别的趋势是否一致
 */
export function checkMultiTimeframeAlignment(
  timeframe15m: TimeframeAnalysis,
  timeframe1h: TimeframeAnalysis,
  direction: 'long' | 'short'
): { aligned: boolean; score: number } {
  let alignmentScore = 0;
  let checks = 0;

  // 检查 EMA 排列
  const ema15m = timeframe15m.ema20 > timeframe15m.ema50;
  const ema1h = timeframe1h.ema20 > timeframe1h.ema50;
  
  checks++;
  if (direction === 'long' && ema15m && ema1h) {
    alignmentScore += 30;
  } else if (direction === 'short' && !ema15m && !ema1h) {
    alignmentScore += 30;
  } else if (direction === 'long' && ema1h) {
    alignmentScore += 15; // 至少1小时趋势对
  } else if (direction === 'short' && !ema1h) {
    alignmentScore += 15;
  }

  // 检查 MACD 方向
  const macd15m = timeframe15m.macd > 0;
  const macd1h = timeframe1h.macd > 0;
  
  checks++;
  if (direction === 'long' && macd1h) {
    alignmentScore += 25;
    if (macd15m) alignmentScore += 10; // 15分钟也对齐加分
  } else if (direction === 'short' && !macd1h) {
    alignmentScore += 25;
    if (!macd15m) alignmentScore += 10;
  }

  // 检查 RSI 趋势
  const rsi15m = timeframe15m.rsi14;
  const rsi1h = timeframe1h.rsi14;
  
  checks++;
  if (direction === 'long') {
    if (rsi1h < 70) alignmentScore += 15; // 1小时未超买
    if (rsi15m < 30) alignmentScore += 10; // 15分钟超卖
  } else {
    if (rsi1h > 30) alignmentScore += 15; // 1小时未超卖
    if (rsi15m > 70) alignmentScore += 10; // 15分钟超买
  }

  // 检查价格与EMA20的关系
  checks++;
  if (direction === 'long' && timeframe1h.close > timeframe1h.ema20) {
    alignmentScore += 10;
  } else if (direction === 'short' && timeframe1h.close < timeframe1h.ema20) {
    alignmentScore += 10;
  }

  const finalScore = alignmentScore / 100;
  const aligned = finalScore >= 0.6; // 60%以上算对齐

  return { aligned, score: finalScore };
}

/**
 * 波动率调整系数计算
 * ATR高时降低杠杆建议，控制风险
 */
export function calculateVolatilityAdjustment(
  atr: number,
  atrMa: number,
  baseVolatility: number = 1.0
): {
  adjustment: number; // 调整系数（0.5-1.5）
  leverageMultiplier: number; // 杠杆倍数调整（0.6-1.0）
  status: 'low' | 'normal' | 'high' | 'extreme';
} {
  const atrRatio = atr / atrMa;

  let status: 'low' | 'normal' | 'high' | 'extreme';
  let adjustment: number;
  let leverageMultiplier: number;

  if (atrRatio < 0.8) {
    // 低波动率：可以适当提高杠杆
    status = 'low';
    adjustment = 1.2;
    leverageMultiplier = 1.0;
  } else if (atrRatio < 1.2) {
    // 正常波动率
    status = 'normal';
    adjustment = 1.0;
    leverageMultiplier = 1.0;
  } else if (atrRatio < 1.8) {
    // 高波动率：降低杠杆
    status = 'high';
    adjustment = 0.8;
    leverageMultiplier = 0.8;
  } else {
    // 极端波动率：大幅降低杠杆或观望
    status = 'extreme';
    adjustment = 0.6;
    leverageMultiplier = 0.6;
  }

  return { adjustment, leverageMultiplier, status };
}

/**
 * 计算价格偏离度
 * 返回价格相对于关键均线的偏离百分比
 */
export function calculatePriceDeviation(
  price: number,
  ema20: number,
  ema50: number
): {
  fromEma20: number;
  fromEma50: number;
  deviationLevel: 'extreme' | 'significant' | 'moderate' | 'minimal';
} {
  const fromEma20 = ((price - ema20) / ema20) * 100;
  const fromEma50 = ((price - ema50) / ema50) * 100;

  const maxDeviation = Math.max(Math.abs(fromEma20), Math.abs(fromEma50));

  let deviationLevel: 'extreme' | 'significant' | 'moderate' | 'minimal';
  if (maxDeviation > 5) {
    deviationLevel = 'extreme';
  } else if (maxDeviation > 3) {
    deviationLevel = 'significant';
  } else if (maxDeviation > 1.5) {
    deviationLevel = 'moderate';
  } else {
    deviationLevel = 'minimal';
  }

  return {
    fromEma20: Number(fromEma20.toFixed(2)),
    fromEma50: Number(fromEma50.toFixed(2)),
    deviationLevel,
  };
}

/**
 * 策略结果标准化
 * 统一所有策略的输出格式
 */
export interface StandardizedStrategyResult {
  symbol: string;
  action: 'long' | 'short' | 'wait';
  confidence: 'high' | 'medium' | 'low';
  signalStrength: number; // 0-1
  recommendedLeverage: number;
  marketState: MarketState;
  strategyType: string;
  reason: string;
  warnings?: string[];
  keyMetrics: {
    rsi7: number;
    rsi14: number;
    macd: number;
    ema20: number;
    ema50: number;
    price: number;
    atrRatio: number;
    priceDeviationFromEma20: number;
  };
}

/**
 * 标准化策略输出
 */
export function standardizeStrategyResult(result: any): StandardizedStrategyResult {
  // 根据信号强度确定置信度
  let confidence: 'high' | 'medium' | 'low';
  if (result.signalStrength >= 0.7) {
    confidence = 'high';
  } else if (result.signalStrength >= 0.5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    symbol: result.symbol,
    action: result.action,
    confidence,
    signalStrength: result.signalStrength,
    recommendedLeverage: result.recommendedLeverage,
    marketState: result.marketState,
    strategyType: result.strategyType,
    reason: result.reason,
    warnings: result.warnings || [],
    keyMetrics: result.keyMetrics,
  };
}

/**
 * 计算推荐杠杆
 * 根据信号强度、波动率和市场状态调整杠杆
 */
export function calculateRecommendedLeverage(
  baseLeverage: number,
  signalStrength: number,
  volatilityAdjustment: number,
  maxLeverage: number = 10
): number {
  // 基础杠杆 × 信号强度 × 波动率调整
  const adjustedLeverage = baseLeverage * signalStrength * volatilityAdjustment;
  
  // 限制在合理范围内（最小2倍，最大不超过设定值）
  const finalLeverage = Math.max(2, Math.min(adjustedLeverage, maxLeverage));
  
  return Number(finalLeverage.toFixed(1));
}

/**
 * 检测 MACD 柱状线拐点
 * 用于均值回归策略的动量反转信号
 */
export function detectMacdHistogramReversal(
  currentHist: number,
  previousHist: number,
  direction: 'bullish' | 'bearish'
): boolean {
  if (direction === 'bullish') {
    // 看涨反转：柱状线从负转正，或从下降转上升
    return currentHist > previousHist && previousHist < 0;
  } else {
    // 看跌反转：柱状线从正转负，或从上升转下降
    return currentHist < previousHist && previousHist > 0;
  }
}

/**
 * 识别近期高低点（支撑/阻力位）
 * 用于突破策略
 */
export function identifyKeyLevels(
  candles: Array<{ high: number; low: number; close: number }>,
  lookback: number = 20
): {
  resistance: number;
  support: number;
  range: number;
} {
  const recentCandles = candles.slice(-lookback);
  
  const highs = recentCandles.map(c => c.high);
  const lows = recentCandles.map(c => c.low);
  
  const resistance = Math.max(...highs);
  const support = Math.min(...lows);
  const range = resistance - support;

  return {
    resistance: Number(resistance.toFixed(2)),
    support: Number(support.toFixed(2)),
    range: Number(range.toFixed(2)),
  };
}

/**
 * 检测成交量异常
 * 用于突破策略确认
 */
export function detectVolumeSpike(
  currentVolume: number,
  avgVolume: number,
  threshold: number = 1.5
): {
  isSpike: boolean;
  ratio: number;
  level: 'extreme' | 'significant' | 'moderate' | 'normal';
} {
  const ratio = currentVolume / avgVolume;
  const isSpike = ratio >= threshold;

  let level: 'extreme' | 'significant' | 'moderate' | 'normal';
  if (ratio >= 3.0) {
    level = 'extreme';
  } else if (ratio >= 2.0) {
    level = 'significant';
  } else if (ratio >= 1.5) {
    level = 'moderate';
  } else {
    level = 'normal';
  }

  return {
    isSpike,
    ratio: Number(ratio.toFixed(2)),
    level,
  };
}
