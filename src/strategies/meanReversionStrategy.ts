/**
 * 均值回归策略
 * 在震荡市或趋势修正中寻找超买超卖机会
 */

import type { MarketStateAnalysis } from '../types/marketState';
import {
  calculateSignalStrength,
  checkMultiTimeframeAlignment,
  calculateVolatilityAdjustment,
  calculateRecommendedLeverage,
  detectMacdHistogramReversal,
  standardizeStrategyResult,
  type StandardizedStrategyResult,
  type TimeframeAnalysis,
} from './strategyUtils';

/**
 * 均值回归做多策略
 * 条件：
 * - 15分钟 RSI7 < 35（极端超卖，从25放宽到35）
 * - 价格触及布林带下轨（偏离均值）
 * - MACD 柱状线拐头向上（动量反转信号）
 * - 1小时趋势不是强烈下跌（避免抄底下跌刀）
 */
export function meanReversionLongSignal(
  symbol: string,
  timeframe15m: any, // 包含布林带数据
  timeframe1h: TimeframeAnalysis,
  marketState: MarketStateAnalysis,
  maxLeverage: number = 10
): StandardizedStrategyResult {
  const warnings: string[] = [];
  let signalStrength = 0;

  // 1. 检查15分钟极端超卖（放宽条件：从25提高到35）
  const extremeOversold = timeframe15m.rsi7 < 35;
  if (!extremeOversold) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'mean_reversion',
      reason: '15分钟RSI7未达到极端超卖水平(<35)',
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  // 2. 检查价格是否触及布林带下轨
  const nearLowerBB = marketState.keyMetrics.priceVsLowerBB < 0.1; // 距离下轨很近
  if (!nearLowerBB) {
    warnings.push('价格未触及布林带下轨，偏离不够极端');
  }

  // 3. 检查MACD柱状线反转（如果有历史数据）
  let macdReversal = false;
  if (timeframe15m.macdHist && timeframe15m.prevMacdHist !== undefined) {
    macdReversal = detectMacdHistogramReversal(
      timeframe15m.macdHist,
      timeframe15m.prevMacdHist,
      'bullish'
    );
    if (!macdReversal) {
      warnings.push('MACD柱状线未出现看涨反转信号');
    }
  }

  // 4. 检查1小时趋势（避免抄底下跌刀）
  const strongDowntrend = timeframe1h.ema20 < timeframe1h.ema50 && timeframe1h.macd < -50;
  if (strongDowntrend) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'mean_reversion',
      reason: '1小时强烈下跌趋势，避免抄底',
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  // 5. 计算信号强度
  const alignmentCheck = checkMultiTimeframeAlignment(timeframe15m, timeframe1h, 'long');
  signalStrength = calculateSignalStrength({
    rsi7: timeframe15m.rsi7,
    rsi14: timeframe15m.rsi14,
    macd: timeframe15m.macd,
    macdSignal: timeframe15m.macdSignal,
    emaAlignment: timeframe1h.ema20 > timeframe1h.ema50,
    pricePosition: ((timeframe15m.close - timeframe15m.ema20) / timeframe15m.ema20) * 100,
    trendConsistency: alignmentCheck.score * 0.7, // 均值回归对时间框架一致性要求较低
  });

  // 极端超卖加分（放宽阈值：从20提高到25）
  if (timeframe15m.rsi7 < 25) {
    signalStrength = Math.min(signalStrength * 1.2, 1.0);
  }

  // MACD反转加分
  if (macdReversal) {
    signalStrength = Math.min(signalStrength * 1.15, 1.0);
  }

  // 6. 波动率调整
  const atr = marketState.keyMetrics.atr_ratio;
  const volatilityAdj = calculateVolatilityAdjustment(atr, 1.0);
  
  if (volatilityAdj.status === 'extreme') {
    warnings.push('波动率极端，建议降低仓位');
    signalStrength *= 0.6;
  } else if (volatilityAdj.status === 'high') {
    warnings.push('波动率偏高');
    signalStrength *= 0.8;
  }

  // 7. 计算推荐杠杆（均值回归使用更保守的杠杆）
  const baseLeverage = 3; // 均值回归基础杠杆较低
  const recommendedLeverage = calculateRecommendedLeverage(
    baseLeverage,
    signalStrength,
    volatilityAdj.leverageMultiplier,
    Math.min(maxLeverage, 5) // 最高5倍
  );

  // 8. 生成决策理由
  let reason = `均值回归做多信号: `;
  reason += `15分钟RSI7极端超卖(${timeframe15m.rsi7.toFixed(1)}), `;
  if (nearLowerBB) {
    reason += `价格触及布林带下轨, `;
  }
  if (macdReversal) {
    reason += `MACD柱状线看涨反转, `;
  }
  reason += `信号强度${(signalStrength * 100).toFixed(0)}%`;

  if (warnings.length > 0) {
    reason += ` [注意: ${warnings.join('; ')}]`;
  }

  return standardizeStrategyResult({
    symbol,
    action: 'long',
    signalStrength,
    recommendedLeverage,
    marketState: marketState.state,
    strategyType: 'mean_reversion',
    reason,
    warnings,
    keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
  });
}

/**
 * 均值回归做空策略
 * 条件：
 * - 15分钟 RSI7 > 65（极端超买，从75降低到65）
 * - 价格触及布林带上轨
 * - MACD 柱状线拐头向下
 * - 1小时趋势不是强烈上涨
 */
export function meanReversionShortSignal(
  symbol: string,
  timeframe15m: any,
  timeframe1h: TimeframeAnalysis,
  marketState: MarketStateAnalysis,
  maxLeverage: number = 10
): StandardizedStrategyResult {
  const warnings: string[] = [];
  let signalStrength = 0;

  // 1. 检查15分钟极端超买（放宽条件：从75降低到65）
  const extremeOverbought = timeframe15m.rsi7 > 65;
  if (!extremeOverbought) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'mean_reversion',
      reason: '15分钟RSI7未达到极端超买水平(>65)',
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  // 2. 检查价格是否触及布林带上轨
  const nearUpperBB = marketState.keyMetrics.priceVsUpperBB > 0.9; // 距离上轨很近
  if (!nearUpperBB) {
    warnings.push('价格未触及布林带上轨，偏离不够极端');
  }

  // 3. 检查MACD柱状线反转
  let macdReversal = false;
  if (timeframe15m.macdHist && timeframe15m.prevMacdHist !== undefined) {
    macdReversal = detectMacdHistogramReversal(
      timeframe15m.macdHist,
      timeframe15m.prevMacdHist,
      'bearish'
    );
    if (!macdReversal) {
      warnings.push('MACD柱状线未出现看跌反转信号');
    }
  }

  // 4. 检查1小时趋势（避免做空强势上涨）
  const strongUptrend = timeframe1h.ema20 > timeframe1h.ema50 && timeframe1h.macd > 50;
  if (strongUptrend) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'mean_reversion',
      reason: '1小时强烈上涨趋势，避免做空',
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  // 5. 计算信号强度
  const alignmentCheck = checkMultiTimeframeAlignment(timeframe15m, timeframe1h, 'short');
  signalStrength = calculateSignalStrength({
    rsi7: timeframe15m.rsi7,
    rsi14: timeframe15m.rsi14,
    macd: timeframe15m.macd,
    macdSignal: timeframe15m.macdSignal,
    emaAlignment: timeframe1h.ema20 < timeframe1h.ema50,
    pricePosition: ((timeframe15m.close - timeframe15m.ema20) / timeframe15m.ema20) * 100,
    trendConsistency: alignmentCheck.score * 0.7,
  });

  // 极端超买加分（放宽阈值：从80降低到75）
  if (timeframe15m.rsi7 > 75) {
    signalStrength = Math.min(signalStrength * 1.2, 1.0);
  }

  // MACD反转加分
  if (macdReversal) {
    signalStrength = Math.min(signalStrength * 1.15, 1.0);
  }

  // 6. 波动率调整
  const atr = marketState.keyMetrics.atr_ratio;
  const volatilityAdj = calculateVolatilityAdjustment(atr, 1.0);
  
  if (volatilityAdj.status === 'extreme') {
    warnings.push('波动率极端，建议降低仓位');
    signalStrength *= 0.6;
  } else if (volatilityAdj.status === 'high') {
    warnings.push('波动率偏高');
    signalStrength *= 0.8;
  }

  // 7. 计算推荐杠杆
  const baseLeverage = 10;
  const recommendedLeverage = calculateRecommendedLeverage(
    baseLeverage,
    signalStrength,
    volatilityAdj.leverageMultiplier,
    Math.min(maxLeverage, 5)
  );

  // 8. 生成决策理由
  let reason = `均值回归做空信号: `;
  reason += `15分钟RSI7极端超买(${timeframe15m.rsi7.toFixed(1)}), `;
  if (nearUpperBB) {
    reason += `价格触及布林带上轨, `;
  }
  if (macdReversal) {
    reason += `MACD柱状线看跌反转, `;
  }
  reason += `信号强度${(signalStrength * 100).toFixed(0)}%`;

  if (warnings.length > 0) {
    reason += ` [注意: ${warnings.join('; ')}]`;
  }

  return standardizeStrategyResult({
    symbol,
    action: 'short',
    signalStrength,
    recommendedLeverage,
    marketState: marketState.state,
    strategyType: 'mean_reversion',
    reason,
    warnings,
    keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
  });
}

/**
 * 提取关键指标
 */
function extractKeyMetrics(timeframe15m: any, timeframe1h: TimeframeAnalysis) {
  return {
    rsi7: timeframe15m.rsi7,
    rsi14: timeframe15m.rsi14,
    macd: timeframe15m.macd,
    ema20: timeframe1h.ema20,
    ema50: timeframe1h.ema50,
    price: timeframe15m.close,
    atrRatio: 1.0,
    priceDeviationFromEma20: ((timeframe15m.close - timeframe15m.ema20) / timeframe15m.ema20) * 100,
  };
}

/**
 * 均值回归策略包装函数（用于策略路由器）
 */
export async function meanReversionStrategy(
  symbol: string,
  direction: "long" | "short",
  marketState: MarketStateAnalysis,
  tf15m: any,
  tf1h: any
) {
  // 转换时间框架数据格式
  const timeframe15m = {
    close: tf15m.currentPrice,
    ema20: tf15m.ema20,
    ema50: tf15m.ema50,
    macd: tf15m.macd,
    macdSignal: tf15m.macdSignal || 0,
    rsi7: tf15m.rsi7,
    rsi14: tf15m.rsi14,
    bollingerUpper: tf15m.bollingerUpper,
    bollingerLower: tf15m.bollingerLower,
    bollingerMiddle: tf15m.bollingerMiddle,
    macdHistogram: tf15m.macdHistogram,
  };
  
  const timeframe1h: TimeframeAnalysis = {
    close: tf1h.currentPrice,
    ema20: tf1h.ema20,
    ema50: tf1h.ema50,
    macd: tf1h.macd,
    macdSignal: tf1h.macdSignal || 0,
    rsi7: tf1h.rsi7,
    rsi14: tf1h.rsi14,
  };
  
  // 调用相应的策略函数
  if (direction === "long") {
    return meanReversionLongSignal(symbol, timeframe15m, timeframe1h, marketState);
  } else {
    return meanReversionShortSignal(symbol, timeframe15m, timeframe1h, marketState);
  }
}
