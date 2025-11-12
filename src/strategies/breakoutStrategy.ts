/**
 * 突破策略
 * 在价格突破关键支撑/阻力位时进场
 */

import type { MarketStateAnalysis } from '../types/marketState';
import {
  calculateSignalStrength,
  checkMultiTimeframeAlignment,
  calculateVolatilityAdjustment,
  calculateRecommendedLeverage,
  identifyKeyLevels,
  detectVolumeSpike,
  standardizeStrategyResult,
  type StandardizedStrategyResult,
  type TimeframeAnalysis,
} from './strategyUtils';

/**
 * 突破做多策略
 * 条件：
 * - 价格突破近期关键阻力位（最近20根K线的高点）
 * - 突破时成交量放大（>1.5倍平均量）
 * - 1小时 MACD > 0（趋势向上）
 * - RSI7 在40-70之间（避免追高）
 */
export function breakoutLongSignal(
  symbol: string,
  timeframe15m: any, // 包含K线历史和成交量数据
  timeframe1h: TimeframeAnalysis,
  marketState: MarketStateAnalysis,
  maxLeverage: number = 10
): StandardizedStrategyResult {
  const warnings: string[] = [];
  let signalStrength = 0;

  // 1. 识别关键阻力位
  if (!timeframe15m.candles || timeframe15m.candles.length < 20) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'breakout',
      reason: 'K线数据不足，无法识别关键阻力位',
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  const keyLevels = identifyKeyLevels(timeframe15m.candles, 20);
  const currentPrice = timeframe15m.close;
  const resistanceBreakout = currentPrice > keyLevels.resistance * 0.998; // 允许0.2%误差

  if (!resistanceBreakout) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'breakout',
      reason: `价格${currentPrice.toFixed(2)}未突破阻力位${keyLevels.resistance.toFixed(2)}`,
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  // 2. 检查成交量放大
  let volumeConfirmation = false;
  if (timeframe15m.volume && timeframe15m.avgVolume) {
    const volumeCheck = detectVolumeSpike(timeframe15m.volume, timeframe15m.avgVolume, 1.5);
    volumeConfirmation = volumeCheck.isSpike;
    
    if (!volumeConfirmation) {
      warnings.push(`成交量未放大(仅${volumeCheck.ratio}x)，突破可能无效`);
    } else if (volumeCheck.level === 'extreme') {
      signalStrength += 0.1; // 极端成交量加分
    }
  } else {
    warnings.push('无成交量数据，无法确认突破有效性');
  }

  // 3. 检查1小时趋势
  const uptrendConfirmed = timeframe1h.macd > 0;
  if (!uptrendConfirmed) {
    warnings.push('1小时MACD为负，突破趋势偏弱');
  }

  // 4. 检查RSI（避免追高，放宽范围：从40-70调整到35-75）
  const rsiInRange = timeframe15m.rsi7 >= 35 && timeframe15m.rsi7 <= 75;
  if (!rsiInRange) {
    if (timeframe15m.rsi7 > 75) {
      warnings.push(`RSI7过高(${timeframe15m.rsi7.toFixed(1)})，可能追高`);
      signalStrength *= 0.8;
    } else {
      return {
        symbol,
        action: 'wait',
        confidence: 'low',
        signalStrength: 0,
        recommendedLeverage: 0,
        marketState: marketState.state,
        strategyType: 'breakout',
        reason: `RSI7过低(${timeframe15m.rsi7.toFixed(1)})，突破可能失败`,
        keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
      };
    }
  }

  // 5. 计算信号强度
  const alignmentCheck = checkMultiTimeframeAlignment(timeframe15m, timeframe1h, 'long');
  signalStrength = calculateSignalStrength({
    rsi7: timeframe15m.rsi7,
    rsi14: timeframe15m.rsi14,
    macd: timeframe1h.macd,
    macdSignal: timeframe1h.macdSignal,
    emaAlignment: timeframe1h.ema20 > timeframe1h.ema50,
    pricePosition: ((currentPrice - keyLevels.resistance) / keyLevels.resistance) * 100,
    trendConsistency: alignmentCheck.score,
  });

  // 突破确认加分
  if (volumeConfirmation) {
    signalStrength = Math.min(signalStrength * 1.25, 1.0);
  }

  // 6. 波动率调整
  const atr = marketState.keyMetrics.atr_ratio;
  const volatilityAdj = calculateVolatilityAdjustment(atr, 1.0);
  
  if (volatilityAdj.status === 'extreme') {
    warnings.push('波动率极端，假突破风险高');
    signalStrength *= 0.7;
  } else if (volatilityAdj.status === 'high') {
    warnings.push('波动率偏高');
    signalStrength *= 0.85;
  }

  // 7. 计算推荐杠杆
  const baseLeverage = 4; // 突破策略基础杠杆
  const recommendedLeverage = calculateRecommendedLeverage(
    baseLeverage,
    signalStrength,
    volatilityAdj.leverageMultiplier,
    maxLeverage
  );

  // 8. 生成决策理由
  let reason = `突破做多信号: `;
  reason += `价格突破阻力位${keyLevels.resistance.toFixed(2)}, `;
  if (volumeConfirmation) {
    reason += `成交量确认, `;
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
    strategyType: 'breakout',
    reason,
    warnings,
    keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
  });
}

/**
 * 突破做空策略
 * 条件：
 * - 价格跌破近期关键支撑位
 * - 突破时成交量放大
 * - 1小时 MACD < 0
 * - RSI7 在30-60之间
 */
export function breakoutShortSignal(
  symbol: string,
  timeframe15m: any,
  timeframe1h: TimeframeAnalysis,
  marketState: MarketStateAnalysis,
  maxLeverage: number = 10
): StandardizedStrategyResult {
  const warnings: string[] = [];
  let signalStrength = 0;

  // 1. 识别关键支撑位
  if (!timeframe15m.candles || timeframe15m.candles.length < 20) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'breakout',
      reason: 'K线数据不足，无法识别关键支撑位',
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  const keyLevels = identifyKeyLevels(timeframe15m.candles, 20);
  const currentPrice = timeframe15m.close;
  const supportBreakdown = currentPrice < keyLevels.support * 1.002; // 允许0.2%误差

  if (!supportBreakdown) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'breakout',
      reason: `价格${currentPrice.toFixed(2)}未跌破支撑位${keyLevels.support.toFixed(2)}`,
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  // 2. 检查成交量放大
  let volumeConfirmation = false;
  if (timeframe15m.volume && timeframe15m.avgVolume) {
    const volumeCheck = detectVolumeSpike(timeframe15m.volume, timeframe15m.avgVolume, 1.5);
    volumeConfirmation = volumeCheck.isSpike;
    
    if (!volumeConfirmation) {
      warnings.push(`成交量未放大(仅${volumeCheck.ratio}x)，突破可能无效`);
    } else if (volumeCheck.level === 'extreme') {
      signalStrength += 0.1;
    }
  } else {
    warnings.push('无成交量数据，无法确认突破有效性');
  }

  // 3. 检查1小时趋势
  const downtrendConfirmed = timeframe1h.macd < 0;
  if (!downtrendConfirmed) {
    warnings.push('1小时MACD为正，突破趋势偏弱');
  }

  // 4. 检查RSI（放宽范围：从30-60调整到25-65）
  const rsiInRange = timeframe15m.rsi7 >= 25 && timeframe15m.rsi7 <= 65;
  if (!rsiInRange) {
    if (timeframe15m.rsi7 < 25) {
      warnings.push(`RSI7过低(${timeframe15m.rsi7.toFixed(1)})，可能超卖反弹`);
      signalStrength *= 0.8;
    } else {
      return {
        symbol,
        action: 'wait',
        confidence: 'low',
        signalStrength: 0,
        recommendedLeverage: 0,
        marketState: marketState.state,
        strategyType: 'breakout',
        reason: `RSI7过高(${timeframe15m.rsi7.toFixed(1)})，突破可能失败`,
        keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
      };
    }
  }

  // 5. 计算信号强度
  const alignmentCheck = checkMultiTimeframeAlignment(timeframe15m, timeframe1h, 'short');
  signalStrength = calculateSignalStrength({
    rsi7: timeframe15m.rsi7,
    rsi14: timeframe15m.rsi14,
    macd: timeframe1h.macd,
    macdSignal: timeframe1h.macdSignal,
    emaAlignment: timeframe1h.ema20 < timeframe1h.ema50,
    pricePosition: ((currentPrice - keyLevels.support) / keyLevels.support) * 100,
    trendConsistency: alignmentCheck.score,
  });

  // 突破确认加分
  if (volumeConfirmation) {
    signalStrength = Math.min(signalStrength * 1.25, 1.0);
  }

  // 6. 波动率调整
  const atr = marketState.keyMetrics.atr_ratio;
  const volatilityAdj = calculateVolatilityAdjustment(atr, 1.0);
  
  if (volatilityAdj.status === 'extreme') {
    warnings.push('波动率极端，假突破风险高');
    signalStrength *= 0.7;
  } else if (volatilityAdj.status === 'high') {
    warnings.push('波动率偏高');
    signalStrength *= 0.85;
  }

  // 7. 计算推荐杠杆
  const baseLeverage = 4;
  const recommendedLeverage = calculateRecommendedLeverage(
    baseLeverage,
    signalStrength,
    volatilityAdj.leverageMultiplier,
    maxLeverage
  );

  // 8. 生成决策理由
  let reason = `突破做空信号: `;
  reason += `价格跌破支撑位${keyLevels.support.toFixed(2)}, `;
  if (volumeConfirmation) {
    reason += `成交量确认, `;
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
    strategyType: 'breakout',
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
 * 突破策略包装函数（用于策略路由器）
 */
export async function breakoutStrategy(
  symbol: string,
  direction: "long" | "short",
  marketState: MarketStateAnalysis,
  tf15m: any,
  tf1h: any
) {
  // 转换时间框架数据格式（突破策略需要K线历史）
  const timeframe15m = {
    close: tf15m.currentPrice,
    ema20: tf15m.ema20,
    ema50: tf15m.ema50,
    macd: tf15m.macd,
    macdSignal: tf15m.macdSignal || 0,
    rsi7: tf15m.rsi7,
    rsi14: tf15m.rsi14,
    candles: tf15m.candles || [], // 使用真实的K线历史数据
    volume: tf15m.volume,
    avgVolume: tf15m.avgVolume,
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
    return breakoutLongSignal(symbol, timeframe15m, timeframe1h, marketState);
  } else {
    return breakoutShortSignal(symbol, timeframe15m, timeframe1h, marketState);
  }
}
