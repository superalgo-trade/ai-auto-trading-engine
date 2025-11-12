/**
 * 趋势跟踪策略
 * 在确认的趋势中寻找回调/反弹机会
 */

import type { MarketStateAnalysis } from '../types/marketState';
import {
  calculateSignalStrength,
  checkMultiTimeframeAlignment,
  calculateVolatilityAdjustment,
  calculateRecommendedLeverage,
  standardizeStrategyResult,
  type StandardizedStrategyResult,
  type TimeframeAnalysis,
} from './strategyUtils';

/**
 * 趋势跟踪做多策略
 * 条件：
 * - 1小时 EMA20 > EMA50（上涨趋势确认）
 * - 1小时 MACD > 0（动量向上）
 * - 15分钟 RSI7 < 40（短期回调，从30放宽到40）
 * - 价格回到 EMA20 附近（回调结束）
 */
export function trendFollowingLongSignal(
  symbol: string,
  timeframe15m: TimeframeAnalysis,
  timeframe1h: TimeframeAnalysis,
  marketState: MarketStateAnalysis,
  maxLeverage: number = 10
): StandardizedStrategyResult {
  const warnings: string[] = [];
  let signalStrength = 0;

  // 1. 检查1小时上涨趋势
  const trendConfirmed = timeframe1h.ema20 > timeframe1h.ema50;
  if (!trendConfirmed) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'trend_following',
      reason: '1小时级别无上涨趋势',
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  // 2. 检查1小时动量
  const momentumPositive = timeframe1h.macd > 0;
  if (!momentumPositive) {
    warnings.push('1小时MACD为负，动量偏弱');
  }

  // 3. 趋势延续逻辑：如果是上涨趋势延续且RSI适中，可以稳健做多
  if (marketState.state === 'uptrend_continuation' && 
      timeframe15m.rsi7 >= 45 && timeframe15m.rsi7 <= 65) {
    // 上涨趋势延续，RSI在中性区域，给予中等信号强度
    signalStrength = 0.5; // 中等强度
    warnings.push('上涨趋势延续，RSI适中，稳健做多机会');
    
    // 继续后续的波动率和杠杆计算...
  } else {
    // 4. 原有逻辑：检查15分钟超卖（等待回调）
    const oversold = timeframe15m.rsi7 < 40;
    if (!oversold) {
      return {
        symbol,
        action: 'wait',
        confidence: 'low',
        signalStrength: 0,
        recommendedLeverage: 0,
        marketState: marketState.state,
        strategyType: 'trend_following',
        reason: '15分钟RSI7未超卖，等待更好的回调机会',
        keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
      };
    }

    // 5. 检查价格是否回到EMA20附近
    const priceNearEma = timeframe15m.close >= timeframe15m.ema20 * 0.995;
    if (!priceNearEma) {
      warnings.push('价格还在EMA20下方，可能回调未结束');
    }

    // 6. 计算信号强度（回调做多）
    const alignmentCheck = checkMultiTimeframeAlignment(timeframe15m, timeframe1h, 'long');
    signalStrength = calculateSignalStrength({
      rsi7: timeframe15m.rsi7,
      rsi14: timeframe15m.rsi14,
      macd: timeframe1h.macd,
      macdSignal: timeframe1h.macdSignal,
      emaAlignment: trendConfirmed,
      pricePosition: ((timeframe15m.close - timeframe15m.ema20) / timeframe15m.ema20) * 100,
      trendConsistency: alignmentCheck.score,
    });
  }

  // 7. 波动率调整
  const atr = marketState.keyMetrics.atr_ratio;
  const volatilityAdj = calculateVolatilityAdjustment(atr, 1.0);
  
  if (volatilityAdj.status === 'extreme') {
    warnings.push('波动率极端，建议降低仓位或观望');
    signalStrength *= 0.7;
  } else if (volatilityAdj.status === 'high') {
    warnings.push('波动率偏高，建议谨慎操作');
    signalStrength *= 0.85;
  }

  // 7. 计算推荐杠杆
  const baseLeverage = 5; // 趋势跟踪基础杠杆
  const recommendedLeverage = calculateRecommendedLeverage(
    baseLeverage,
    signalStrength,
    volatilityAdj.leverageMultiplier,
    maxLeverage
  );

  // 8. 生成决策理由
  let reason = `趋势跟踪做多信号: `;
  
  // 根据市场状态判断理由
  if (marketState.state === 'uptrend_continuation' && 
      timeframe15m.rsi7 >= 45 && timeframe15m.rsi7 <= 65) {
    reason += `上涨趋势延续，`;
    reason += `1小时趋势确认(EMA20>EMA50), `;
    reason += `15分钟RSI7适中(${timeframe15m.rsi7.toFixed(1)}), `;
    reason += `稳健做多机会`;
  } else {
    reason += `1小时上涨趋势确认, `;
    reason += `15分钟RSI7超卖回调(${timeframe15m.rsi7.toFixed(1)}), `;
    reason += `信号强度${(signalStrength * 100).toFixed(0)}%`;
  }

  if (warnings.length > 0) {
    reason += ` [注意: ${warnings.join('; ')}]`;
  }

  return standardizeStrategyResult({
    symbol,
    action: 'long',
    signalStrength,
    recommendedLeverage,
    marketState: marketState.state,
    strategyType: 'trend_following',
    reason,
    warnings,
    keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
  });
}

/**
 * 趋势跟踪做空策略
 * 条件：
 * - 1小时 EMA20 < EMA50（下跌趋势确认）
 * - 1小时 MACD < 0（动量向下）
 * - 15分钟 RSI7 > 60（短期反弹，从70降低到60）
 * - 价格跌破 EMA20（反弹结束）
 */
export function trendFollowingShortSignal(
  symbol: string,
  timeframe15m: TimeframeAnalysis,
  timeframe1h: TimeframeAnalysis,
  marketState: MarketStateAnalysis,
  maxLeverage: number = 10
): StandardizedStrategyResult {
  const warnings: string[] = [];
  let signalStrength = 0;

  // 1. 检查1小时下跌趋势
  const trendConfirmed = timeframe1h.ema20 < timeframe1h.ema50;
  if (!trendConfirmed) {
    return {
      symbol,
      action: 'wait',
      confidence: 'low',
      signalStrength: 0,
      recommendedLeverage: 0,
      marketState: marketState.state,
      strategyType: 'trend_following',
      reason: '1小时级别无下跌趋势',
      keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
    };
  }

  // 2. 检查1小时动量
  const momentumNegative = timeframe1h.macd < 0;
  if (!momentumNegative) {
    warnings.push('1小时MACD为正，动量偏弱');
  }

  // 3. 趋势延续逻辑：如果是下跌趋势延续且RSI适中，可以稳健做空
  if (marketState.state === 'downtrend_continuation' && 
      timeframe15m.rsi7 >= 35 && timeframe15m.rsi7 <= 55) {
    // 下跌趋势延续，RSI在中性区域，给予中等信号强度
    signalStrength = 0.5; // 中等强度
    warnings.push('下跌趋势延续，RSI适中，稳健做空机会');
    
    // 继续后续的波动率和杠杆计算...
  } else {
    // 4. 原有逻辑：检查15分钟超买（等待反弹）
    const overbought = timeframe15m.rsi7 > 60;
    if (!overbought) {
      return {
        symbol,
        action: 'wait',
        confidence: 'low',
        signalStrength: 0,
        recommendedLeverage: 0,
        marketState: marketState.state,
        strategyType: 'trend_following',
        reason: '15分钟RSI7未超买，等待更好的反弹机会',
        keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
      };
    }
    
    // 5. 检查价格是否跌破EMA20（反弹结束）
    const priceBelowEma = timeframe15m.close <= timeframe15m.ema20 * 1.005;
    if (!priceBelowEma) {
      warnings.push('价格还在EMA20上方，可能反弹未结束');
    }

    // 6. 计算信号强度（反弹做空）
    const alignmentCheck = checkMultiTimeframeAlignment(timeframe15m, timeframe1h, 'short');
    signalStrength = calculateSignalStrength({
      rsi7: timeframe15m.rsi7,
      rsi14: timeframe15m.rsi14,
      macd: timeframe1h.macd,
      macdSignal: timeframe1h.macdSignal,
      emaAlignment: trendConfirmed,
      pricePosition: ((timeframe15m.close - timeframe15m.ema20) / timeframe15m.ema20) * 100,
      trendConsistency: alignmentCheck.score,
    });
  }

  // 7. 波动率调整
  const atr = marketState.keyMetrics.atr_ratio;
  const volatilityAdj = calculateVolatilityAdjustment(atr, 1.0);
  
  if (volatilityAdj.status === 'extreme') {
    warnings.push('波动率极端，建议降低仓位或观望');
    signalStrength *= 0.7;
  } else if (volatilityAdj.status === 'high') {
    warnings.push('波动率偏高，建议谨慎操作');
    signalStrength *= 0.85;
  }

  // 7. 计算推荐杠杆
  const baseLeverage = 5; // 趋势跟踪基础杠杆
  const recommendedLeverage = calculateRecommendedLeverage(
    baseLeverage,
    signalStrength,
    volatilityAdj.leverageMultiplier,
    maxLeverage
  );

  // 8. 生成决策理由
  let reason = `趋势跟踪做空信号: `;
  
  // 根据市场状态判断理由
  if (marketState.state === 'downtrend_continuation' && 
      timeframe15m.rsi7 >= 35 && timeframe15m.rsi7 <= 55) {
    reason += `下跌趋势延续，`;
    reason += `1小时趋势确认(EMA20<EMA50), `;
    reason += `15分钟RSI7适中(${timeframe15m.rsi7.toFixed(1)}), `;
    reason += `稳健做空机会`;
  } else {
    reason += `1小时下跌趋势确认, `;
    reason += `15分钟RSI7超买反弹(${timeframe15m.rsi7.toFixed(1)}), `;
    reason += `信号强度${(signalStrength * 100).toFixed(0)}%`;
  }

  if (warnings.length > 0) {
    reason += ` [注意: ${warnings.join('; ')}]`;
  }

  return standardizeStrategyResult({
    symbol,
    action: 'short',
    signalStrength,
    recommendedLeverage,
    marketState: marketState.state,
    strategyType: 'trend_following',
    reason,
    warnings,
    keyMetrics: extractKeyMetrics(timeframe15m, timeframe1h),
  });
}

/**
 * 提取关键指标
 */
function extractKeyMetrics(timeframe15m: TimeframeAnalysis, timeframe1h: TimeframeAnalysis) {
  return {
    rsi7: timeframe15m.rsi7,
    rsi14: timeframe15m.rsi14,
    macd: timeframe1h.macd,
    ema20: timeframe1h.ema20,
    ema50: timeframe1h.ema50,
    price: timeframe15m.close,
    atrRatio: 1.0, // 会在外部填充
    priceDeviationFromEma20: ((timeframe15m.close - timeframe15m.ema20) / timeframe15m.ema20) * 100,
  };
}

/**
 * 趋势跟踪策略包装函数（用于策略路由器）
 */
export async function trendFollowingStrategy(
  symbol: string,
  direction: "long" | "short",
  marketState: MarketStateAnalysis,
  tf15m: any,
  tf1h: any
) {
  // 转换时间框架数据格式
  const timeframe15m: TimeframeAnalysis = {
    close: tf15m.currentPrice,
    ema20: tf15m.ema20,
    ema50: tf15m.ema50,
    macd: tf15m.macd,
    macdSignal: tf15m.macdSignal || 0,
    rsi7: tf15m.rsi7,
    rsi14: tf15m.rsi14,
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
    return trendFollowingLongSignal(symbol, timeframe15m, timeframe1h, marketState);
  } else {
    return trendFollowingShortSignal(symbol, timeframe15m, timeframe1h, marketState);
  }
}
