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
 * 止损管理工具
 * 为 AI Agent 提供科学止损计算和管理接口
 */

import { createTool } from "@voltagent/core";
import { z } from "zod";
import { createPinoLogger } from "@voltagent/logger";
import { RISK_PARAMS } from "../../config/riskParams";
import {
  calculateScientificStopLoss,
  shouldOpenPosition,
  updateTrailingStopLoss,
  DEFAULT_STOP_LOSS_CONFIG,
  type StopLossConfig,
} from "../../services/stopLossCalculator";

const logger = createPinoLogger({
  name: "stop-loss-management",
  level: "info",
});

/**
 * 计算科学止损位工具
 */
export const calculateStopLossTool = createTool({
  name: "calculateStopLoss",
  description: `计算科学止损位 - 基于ATR（平均真实波幅）和支撑/阻力位的综合止损策略。
  
核心理念：
- ATR止损：自适应市场波动，高波动时自动放宽，低波动时自动收紧
- 支撑/阻力止损：基于市场结构的关键位置，提高盈亏比
- 综合策略：结合两者优势，选择更保守的止损位

返回结果包含：
- 推荐止损价格
- 止损距离百分比
- 市场波动率评估
- 风险建议
- 质量评分（0-100）`,
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    side: z.enum(["long", "short"]).describe("方向：long=做多，short=做空"),
    entryPrice: z.number().describe("入场价格"),
    timeframe: z.enum(["1m", "5m", "15m", "1h", "4h"]).optional().describe("K线周期（默认1h）"),
  }),
  execute: async ({ symbol, side, entryPrice, timeframe = "1h" }) => {
    try {
      if (!RISK_PARAMS.ENABLE_SCIENTIFIC_STOP_LOSS) {
        return {
          success: false,
          message: "科学止损系统未启用，请在环境变量中设置 ENABLE_SCIENTIFIC_STOP_LOSS=true",
        };
      }

      // 构建止损配置
      const config: StopLossConfig = {
        atrPeriod: RISK_PARAMS.ATR_PERIOD,
        atrMultiplier: RISK_PARAMS.ATR_MULTIPLIER,
        lookbackPeriod: RISK_PARAMS.SUPPORT_RESISTANCE_LOOKBACK,
        bufferPercent: RISK_PARAMS.SUPPORT_RESISTANCE_BUFFER,
        useATR: RISK_PARAMS.USE_ATR_STOP_LOSS,
        useSupportResistance: RISK_PARAMS.USE_SUPPORT_RESISTANCE_STOP_LOSS,
        minStopLossPercent: RISK_PARAMS.MIN_STOP_LOSS_PERCENT,
        maxStopLossPercent: RISK_PARAMS.MAX_STOP_LOSS_PERCENT,
      };

      const result = await calculateScientificStopLoss(
        symbol,
        side,
        entryPrice,
        config,
        timeframe
      );

      return {
        success: true,
        data: {
          symbol,
          side,
          entryPrice,
          stopLossPrice: result.stopLossPrice,
          stopLossDistancePercent: result.stopLossDistancePercent.toFixed(2),
          method: result.method,
          atr: result.details.atr?.toFixed(4),
          atrPercent: result.details.atrPercent?.toFixed(2),
          supportLevel: result.details.supportLevel?.toFixed(4),
          resistanceLevel: result.details.resistanceLevel?.toFixed(4),
          qualityScore: result.qualityScore,
          volatilityLevel: result.riskAssessment.volatilityLevel,
          isNoisy: result.riskAssessment.isNoisy,
          recommendation: result.riskAssessment.recommendation,
        },
        message: `✅ 止损计算完成
- 入场价: ${entryPrice.toFixed(4)}
- 止损价: ${result.stopLossPrice.toFixed(4)}
- 止损距离: ${result.stopLossDistancePercent.toFixed(2)}%
- 计算方法: ${result.method}
- 波动率: ${result.riskAssessment.volatilityLevel}
- 质量评分: ${result.qualityScore}/100
- 建议: ${result.riskAssessment.recommendation}`,
      };
    } catch (error: any) {
      logger.error(`计算止损失败: ${error.message}`);
      return {
        success: false,
        message: `计算止损失败: ${error.message}`,
      };
    }
  },
});

/**
 * 检查开仓合理性工具（基于止损）
 */
export const checkOpenPositionTool = createTool({
  name: "checkOpenPosition",
  description: `开仓前检查工具 - 基于止损合理性判断是否应该开仓。这是一个"过滤器"，帮助避免以下情况：
  
1. 止损距离过大，风险回报比不佳
2. 市场波动极端剧烈
3. 止损质量评分过低

建议：在执行 openPosition 之前，先调用此工具检查。如果返回 shouldOpen=false，建议放弃此次交易机会。`,
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    side: z.enum(["long", "short"]).describe("方向：long=做多，short=做空"),
    entryPrice: z.number().describe("计划入场价格（当前市场价）"),
  }),
  execute: async ({ symbol, side, entryPrice }) => {
    try {
      if (!RISK_PARAMS.ENABLE_STOP_LOSS_FILTER) {
        return {
          success: true,
          shouldOpen: true,
          message: "止损过滤器未启用，允许开仓",
        };
      }

      const config: StopLossConfig = {
        atrPeriod: RISK_PARAMS.ATR_PERIOD,
        atrMultiplier: RISK_PARAMS.ATR_MULTIPLIER,
        lookbackPeriod: RISK_PARAMS.SUPPORT_RESISTANCE_LOOKBACK,
        bufferPercent: RISK_PARAMS.SUPPORT_RESISTANCE_BUFFER,
        useATR: RISK_PARAMS.USE_ATR_STOP_LOSS,
        useSupportResistance: RISK_PARAMS.USE_SUPPORT_RESISTANCE_STOP_LOSS,
        minStopLossPercent: RISK_PARAMS.MIN_STOP_LOSS_PERCENT,
        maxStopLossPercent: RISK_PARAMS.MAX_STOP_LOSS_PERCENT,
      };

      const checkResult = await shouldOpenPosition(symbol, side, entryPrice, config);

      if (checkResult.shouldOpen) {
        return {
          success: true,
          shouldOpen: true,
          data: checkResult.stopLossResult
            ? {
                stopLossPrice: checkResult.stopLossResult.stopLossPrice,
                stopLossDistancePercent: checkResult.stopLossResult.stopLossDistancePercent.toFixed(2),
                qualityScore: checkResult.stopLossResult.qualityScore,
                volatilityLevel: checkResult.stopLossResult.riskAssessment.volatilityLevel,
              }
            : undefined,
          message: `✅ ${checkResult.reason}`,
        };
      } else {
        return {
          success: true,
          shouldOpen: false,
          data: checkResult.stopLossResult
            ? {
                stopLossPrice: checkResult.stopLossResult.stopLossPrice,
                stopLossDistancePercent: checkResult.stopLossResult.stopLossDistancePercent.toFixed(2),
                qualityScore: checkResult.stopLossResult.qualityScore,
                volatilityLevel: checkResult.stopLossResult.riskAssessment.volatilityLevel,
              }
            : undefined,
          message: `⚠️ 不建议开仓: ${checkResult.reason}`,
        };
      }
    } catch (error: any) {
      logger.error(`检查开仓条件失败: ${error.message}`);
      return {
        success: false,
        shouldOpen: false,
        message: `检查失败: ${error.message}`,
      };
    }
  },
});

/**
 * 更新移动止损工具
 */
export const updateTrailingStopTool = createTool({
  name: "updateTrailingStop",
  description: `更新移动止损 - 为盈利中的持仓动态调整止损位，保护利润。
  
工作原理：
- 重新计算基于当前价格的科学止损位
- 只在止损向有利方向移动时才更新
- 多单：新止损高于旧止损时更新
- 空单：新止损低于旧止损时更新

适用场景：
- 持仓已盈利，希望锁定部分利润
- 定期检查（如每小时）是否可以上移止损`,
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    side: z.enum(["long", "short"]).describe("方向"),
    entryPrice: z.number().describe("入场价格"),
    currentPrice: z.number().describe("当前市场价格"),
    currentStopLoss: z.number().describe("当前止损价格"),
  }),
  execute: async ({ symbol, side, entryPrice, currentPrice, currentStopLoss }) => {
    try {
      if (!RISK_PARAMS.ENABLE_TRAILING_STOP_LOSS) {
        return {
          success: false,
          message: "移动止损未启用，请在环境变量中设置 ENABLE_TRAILING_STOP_LOSS=true",
        };
      }

      const config: StopLossConfig = {
        atrPeriod: RISK_PARAMS.ATR_PERIOD,
        atrMultiplier: RISK_PARAMS.ATR_MULTIPLIER,
        lookbackPeriod: RISK_PARAMS.SUPPORT_RESISTANCE_LOOKBACK,
        bufferPercent: RISK_PARAMS.SUPPORT_RESISTANCE_BUFFER,
        useATR: RISK_PARAMS.USE_ATR_STOP_LOSS,
        useSupportResistance: RISK_PARAMS.USE_SUPPORT_RESISTANCE_STOP_LOSS,
        minStopLossPercent: RISK_PARAMS.MIN_STOP_LOSS_PERCENT,
        maxStopLossPercent: RISK_PARAMS.MAX_STOP_LOSS_PERCENT,
      };

      const updateResult = await updateTrailingStopLoss(
        symbol,
        side,
        entryPrice,
        currentPrice,
        currentStopLoss,
        config
      );

      if (updateResult.shouldUpdate && updateResult.newStopLoss) {
        return {
          success: true,
          shouldUpdate: true,
          data: {
            oldStopLoss: currentStopLoss,
            newStopLoss: updateResult.newStopLoss,
            improvement: ((Math.abs(updateResult.newStopLoss - currentStopLoss) / currentStopLoss) * 100).toFixed(2),
          },
          message: `✅ ${updateResult.reason}
- 旧止损: ${currentStopLoss.toFixed(4)}
- 新止损: ${updateResult.newStopLoss.toFixed(4)}`,
        };
      } else {
        return {
          success: true,
          shouldUpdate: false,
          message: `ℹ️ ${updateResult.reason}`,
        };
      }
    } catch (error: any) {
      logger.error(`更新移动止损失败: ${error.message}`);
      return {
        success: false,
        message: `更新失败: ${error.message}`,
      };
    }
  },
});

/**
 * 导出所有止损管理工具
 */
export const stopLossManagementTools = [
  calculateStopLossTool,
  checkOpenPositionTool,
  updateTrailingStopTool,
];
