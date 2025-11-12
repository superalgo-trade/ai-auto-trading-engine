/**
 * 测试策略功能
 */

import { trendFollowingLongSignal, trendFollowingShortSignal } from '../src/strategies/trendFollowingStrategy';
import { meanReversionLongSignal, meanReversionShortSignal } from '../src/strategies/meanReversionStrategy';
import { breakoutLongSignal, breakoutShortSignal } from '../src/strategies/breakoutStrategy';
import type { MarketStateAnalysis } from '../src/types/marketState';
import type { TimeframeAnalysis } from '../src/strategies/strategyUtils';

console.log('=== 测试策略模块 ===\n');

// 模拟市场数据
const mockTimeframe15m: TimeframeAnalysis = {
  ema20: 103500,
  ema50: 103000,
  rsi7: 28,
  rsi14: 35,
  macd: -200,
  macdSignal: -250,
  close: 103400,
};

const mockTimeframe1h: TimeframeAnalysis = {
  ema20: 104500,
  ema50: 103800,
  rsi7: 45,
  rsi14: 48,
  macd: 150,
  macdSignal: 120,
  close: 103400,
};

const mockMarketState: MarketStateAnalysis = {
  symbol: 'BTC',
  state: 'uptrend_oversold',
  trendStrength: 'trending_up',
  momentumState: 'oversold_mild',
  volatilityState: 'normal_vol',
  confidence: 0.75,
  keyMetrics: {
    rsi7_15m: 28,
    rsi14_15m: 35,
    macd_15m: -200,
    ema20_1h: 104500,
    ema50_1h: 103800,
    macd_1h: 150,
    price: 103400,
    atr_ratio: 1.1,
    distanceToEMA20: -1.05,
    priceVsUpperBB: 0.3,
    priceVsLowerBB: -0.2,
  },
  timeframeAlignment: {
    is15mAnd1hAligned: true,
    alignmentScore: 0.75,
  },
  timestamp: new Date().toISOString(),
};

// 测试趋势跟踪策略
console.log('1️⃣ 测试趋势跟踪做多策略：');
const trendLong = trendFollowingLongSignal('BTC', mockTimeframe15m, mockTimeframe1h, mockMarketState, 10);
console.log(`   动作: ${trendLong.action}`);
console.log(`   置信度: ${trendLong.confidence}`);
console.log(`   信号强度: ${(trendLong.signalStrength * 100).toFixed(1)}%`);
console.log(`   推荐杠杆: ${trendLong.recommendedLeverage}x`);
console.log(`   理由: ${trendLong.reason}`);
console.log('');

// 测试均值回归策略（极端超卖）
console.log('2️⃣ 测试均值回归做多策略：');
const mockTimeframe15mOversold = { ...mockTimeframe15m, rsi7: 22 };
const meanRevLong = meanReversionLongSignal('BTC', mockTimeframe15mOversold, mockTimeframe1h, mockMarketState, 10);
console.log(`   动作: ${meanRevLong.action}`);
console.log(`   置信度: ${meanRevLong.confidence}`);
console.log(`   信号强度: ${(meanRevLong.signalStrength * 100).toFixed(1)}%`);
console.log(`   推荐杠杆: ${meanRevLong.recommendedLeverage}x`);
console.log(`   理由: ${meanRevLong.reason}`);
console.log('');

// 测试突破策略
console.log('3️⃣ 测试突破做多策略：');
const mockTimeframe15mBreakout = {
  ...mockTimeframe15m,
  rsi7: 55,
  close: 104800,
  candles: [
    { high: 104500, low: 103000, close: 104000 },
    { high: 104600, low: 103500, close: 104200 },
    { high: 104700, low: 103800, close: 104500 },
  ],
  volume: 15000,
  avgVolume: 9000,
};
const breakoutLong = breakoutLongSignal('BTC', mockTimeframe15mBreakout, mockTimeframe1h, mockMarketState, 10);
console.log(`   动作: ${breakoutLong.action}`);
console.log(`   置信度: ${breakoutLong.confidence}`);
console.log(`   信号强度: ${(breakoutLong.signalStrength * 100).toFixed(1)}%`);
console.log(`   推荐杠杆: ${breakoutLong.recommendedLeverage}x`);
console.log(`   理由: ${breakoutLong.reason}`);
console.log('');

// 测试做空信号
console.log('4️⃣ 测试趋势跟踪做空策略：');
const mockTimeframe15mShort = { ...mockTimeframe15m, rsi7: 75 };
const mockTimeframe1hShort = { ...mockTimeframe1h, ema20: 103000, ema50: 104000, macd: -150 };
const mockMarketStateShort: MarketStateAnalysis = {
  ...mockMarketState,
  state: 'downtrend_overbought',
  trendStrength: 'trending_down',
  momentumState: 'overbought_mild',
};
const trendShort = trendFollowingShortSignal('BTC', mockTimeframe15mShort, mockTimeframe1hShort, mockMarketStateShort, 10);
console.log(`   动作: ${trendShort.action}`);
console.log(`   置信度: ${trendShort.confidence}`);
console.log(`   信号强度: ${(trendShort.signalStrength * 100).toFixed(1)}%`);
console.log(`   推荐杠杆: ${trendShort.recommendedLeverage}x`);
console.log(`   理由: ${trendShort.reason}`);
console.log('');

console.log('✅ 策略模块测试完成！');
