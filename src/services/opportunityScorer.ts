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
 * 机会评分系统
 * 
 * 对每个币种的开仓机会进行量化评分（0-100分）
 * 评分维度：
 * 1. 信号强度 (30分)
 * 2. 趋势一致性 (25分)
 * 3. 波动率适配 (20分)
 * 4. 风险收益比 (15分)
 * 5. 市场活跃度 (10分)
 */

import { createLogger } from "../utils/logger";
import type { 
  OpportunityScore, 
  StrategyResult,
  MarketStateAnalysis 
} from "../types/marketState";

const logger = createLogger({
  name: "opportunity-scorer",
  level: "info",
});

/**
 * 计算机会评分
 * 
 * @param strategyResult 策略结果
 * @param marketState 市场状态分析
 * @returns 机会评分
 */
export function scoreOpportunity(
  strategyResult: StrategyResult,
  marketState: MarketStateAnalysis
): OpportunityScore {
  // 如果策略建议观望，根据市场状态给予基础分
  if (strategyResult.action === "wait") {
    let baseScore = 0;
    let reason = strategyResult.reason;
    
    // 趋势明确的市场给予较高基础分
    if (marketState.state === "downtrend_continuation" || 
        marketState.state === "uptrend_continuation") {
      baseScore = 45; // 趋势明确但暂无精确入场点（从35提高到45）
      reason = `趋势明确但暂无精确入场点。${strategyResult.reason}`;
    } 
    // 趋势中的回调/反弹机会（最佳时机）
    else if (marketState.state === "downtrend_overbought" || 
             marketState.state === "uptrend_oversold") {
      baseScore = 55; // 最佳入场时机但策略未触发（从45提高到55）
      reason = `最佳入场时机但指标未完全满足。${strategyResult.reason}`;
    }
    // 震荡市
    else if (marketState.state.startsWith("ranging")) {
      baseScore = 30; // 震荡市等待更好机会（从25提高到30）
      reason = `震荡市场，等待更明确信号。${strategyResult.reason}`;
    }
    
    return {
      symbol: strategyResult.symbol,
      totalScore: baseScore,
      breakdown: {
        signalStrength: baseScore,
        trendConsistency: 0,
        volatilityFit: 0,
        riskRewardRatio: 0,
        liquidity: 0,
      },
      confidence: "low",
      recommendation: {
        strategyType: "none",
        direction: "wait",
        confidence: "low",
        reason,
      },
    };
  }
  
  // 1. 信号强度评分 (0-30分)
  const signalScore = strategyResult.signalStrength * 30;
  
  // 2. 趋势一致性评分 (0-25分)
  const trendScore = marketState.timeframeAlignment.alignmentScore * 25;
  
  // 3. 波动率适配评分 (0-20分)
  const volatilityScore = calculateVolatilityFitScore(marketState) * 20;
  
  // 4. 风险收益比评分 (0-15分)
  const rrScore = calculateRiskRewardScore(strategyResult, marketState) * 15;
  
  // 5. 流动性评分 (0-10分)
  const liquidityScore = calculateLiquidityScore(strategyResult.symbol) * 10;
  
  // 计算总分
  const totalScore = signalScore + trendScore + volatilityScore + rrScore + liquidityScore;
  
  // 根据总分判断置信度
  let confidence: "high" | "medium" | "low";
  if (totalScore >= 75) {
    confidence = "high";
  } else if (totalScore >= 60) {
    confidence = "medium";
  } else {
    confidence = "low";
  }
  
  return {
    symbol: strategyResult.symbol,
    totalScore: Math.round(totalScore),
    breakdown: {
      signalStrength: Math.round(signalScore),
      trendConsistency: Math.round(trendScore),
      volatilityFit: Math.round(volatilityScore),
      riskRewardRatio: Math.round(rrScore),
      liquidity: Math.round(liquidityScore),
    },
    confidence,
    recommendation: {
      strategyType: strategyResult.strategyType as any,
      direction: strategyResult.action === "long" ? "long" : strategyResult.action === "short" ? "short" : "wait",
      confidence,
      reason: strategyResult.reason,
    },
  };
}

/**
 * 计算波动率适配评分 (0-1)
 * 正常波动率得分最高，过高或过低波动率扣分
 */
function calculateVolatilityFitScore(marketState: MarketStateAnalysis): number {
  const atrRatio = marketState.keyMetrics.atr_ratio;
  
  // 理想波动率范围：0.8 - 1.2
  if (atrRatio >= 0.8 && atrRatio <= 1.2) {
    return 1.0; // 完美波动率
  }
  
  // 稍高波动率：1.2 - 1.5
  if (atrRatio > 1.2 && atrRatio <= 1.5) {
    return 0.8;
  }
  
  // 稍低波动率：0.6 - 0.8
  if (atrRatio >= 0.6 && atrRatio < 0.8) {
    return 0.8;
  }
  
  // 过高波动率：> 1.5
  if (atrRatio > 1.5) {
    return Math.max(0.3, 1.0 - (atrRatio - 1.5) * 0.5);
  }
  
  // 过低波动率：< 0.6
  return Math.max(0.3, atrRatio / 0.6);
}

/**
 * 计算风险收益比评分 (0-1)
 * 基于策略推荐的杠杆和市场状态
 */
function calculateRiskRewardScore(
  strategyResult: StrategyResult,
  marketState: MarketStateAnalysis
): number {
  // 基础风险收益比基于市场状态
  let baseRR = 0.5;
  
  // 极端状态（最佳做多/做空机会）
  if (marketState.state === "uptrend_oversold" || marketState.state === "downtrend_overbought") {
    baseRR = 0.9;
  }
  // 趋势延续
  else if (marketState.state === "uptrend_continuation" || marketState.state === "downtrend_continuation") {
    baseRR = 0.7;
  }
  // 震荡市均值回归
  else if (marketState.state === "ranging_oversold" || marketState.state === "ranging_overbought") {
    baseRR = 0.8;
  }
  
  // 根据推荐杠杆调整（杠杆越低，风险越小，但收益也越小）
  const leverage = strategyResult.recommendedLeverage;
  if (leverage <= 2) {
    baseRR *= 0.9; // 低杠杆稍微降低评分
  } else if (leverage >= 5) {
    baseRR *= 0.8; // 高杠杆降低评分
  }
  
  return baseRR;
}

/**
 * 计算流动性评分 (0-1)
 * 基于交易品种的流动性
 */
function calculateLiquidityScore(symbol: string): number {
  // 主流币种流动性最高
  const highLiquiditySymbols = ["BTC", "ETH", "BNB", "SOL"];
  if (highLiquiditySymbols.includes(symbol)) {
    return 1.0;
  }
  
  // 二线币种流动性中等
  const mediumLiquiditySymbols = ["XRP", "ADA", "DOGE", "AVAX", "DOT", "MATIC", "LTC"];
  if (mediumLiquiditySymbols.includes(symbol)) {
    return 0.8;
  }
  
  // 其他币种流动性较低
  return 0.6;
}

/**
 * 批量评分并排序
 * 
 * @param strategyResults 策略结果列表
 * @param marketStates 市场状态映射
 * @param minScore 最低评分阈值
 * @returns 排序后的机会评分列表
 */
export function scoreAndRankOpportunities(
  strategyResults: StrategyResult[],
  marketStates: Map<string, MarketStateAnalysis>,
  minScore: number = 60
): OpportunityScore[] {
  logger.info(`评分 ${strategyResults.length} 个机会...`);
  
  const scores: OpportunityScore[] = [];
  
  for (const result of strategyResults) {
    const marketState = marketStates.get(result.symbol);
    if (!marketState) {
      logger.warn(`未找到 ${result.symbol} 的市场状态，跳过评分`);
      continue;
    }
    
    const score = scoreOpportunity(result, marketState);
    
    // 只保留评分达标的机会
    if (score.totalScore >= minScore) {
      scores.push(score);
    }
  }
  
  // 按总分降序排序
  scores.sort((a, b) => b.totalScore - a.totalScore);
  
  logger.info(`评分完成，${scores.length} 个机会达到最低评分 ${minScore}`);
  
  return scores;
}
