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
 * 基础风险参数配置（从环境变量读取，支持灵活配置）
 */

// 从环境变量读取交易币种列表（逗号分隔）
const DEFAULT_TRADING_SYMBOLS = 'BTC,ETH,SOL,XRP,BNB,BCH';
const tradingSymbolsStr = process.env.TRADING_SYMBOLS || DEFAULT_TRADING_SYMBOLS;
const tradingSymbols = tradingSymbolsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

// 从环境变量读取配置，提供默认值
export const RISK_PARAMS = {
  // 最大持仓数
  MAX_POSITIONS: Number.parseInt(process.env.MAX_POSITIONS || '5', 10),
  
  // 最大杠杆倍数
  MAX_LEVERAGE: Number.parseInt(process.env.MAX_LEVERAGE || '15', 10),
  
  // 交易币种列表（作为元组以支持 zod.enum）
  TRADING_SYMBOLS: tradingSymbols as [string, ...string[]],
  
  // 最大持仓小时数
  MAX_HOLDING_HOURS: Number.parseInt(process.env.MAX_HOLDING_HOURS || '36', 10),
  
  // 最大持仓周期数（根据持仓小时数自动计算：小时数 * 6，因为每10分钟一个周期）
  get MAX_HOLDING_CYCLES() {
    return this.MAX_HOLDING_HOURS * 6;
  },
  
  // 账户回撤风控阈值
  // 禁止新开仓的回撤阈值（⚠️ 已禁用 - 相关检查已被注释，不再限制开仓）
  ACCOUNT_DRAWDOWN_NO_NEW_POSITION_PERCENT: Number.parseInt(process.env.ACCOUNT_DRAWDOWN_NO_NEW_POSITION_PERCENT || '15', 10),
  
  // 强制平仓的回撤阈值（⚠️ 已禁用 - 相关检查已被注释，不再强制平仓）
  ACCOUNT_DRAWDOWN_FORCE_CLOSE_PERCENT: Number.parseInt(process.env.ACCOUNT_DRAWDOWN_FORCE_CLOSE_PERCENT || '20', 10),
  
  // 警告提醒的回撤阈值（达到此阈值时，提醒谨慎交易）
  ACCOUNT_DRAWDOWN_WARNING_PERCENT: Number.parseInt(process.env.ACCOUNT_DRAWDOWN_WARNING_PERCENT || '10', 10),
  
  // ===== 科学止损配置 =====
  // 是否启用科学止损系统
  ENABLE_SCIENTIFIC_STOP_LOSS: process.env.ENABLE_SCIENTIFIC_STOP_LOSS !== 'false', // 默认启用
  
  // ATR 相关配置
  ATR_PERIOD: Number.parseInt(process.env.ATR_PERIOD || '14', 10), // ATR计算周期
  ATR_MULTIPLIER: Number.parseFloat(process.env.ATR_MULTIPLIER || '2.0'), // ATR倍数（1.5-3.0推荐）
  
  // 支撑/阻力位配置
  SUPPORT_RESISTANCE_LOOKBACK: Number.parseInt(process.env.SUPPORT_RESISTANCE_LOOKBACK || '20', 10), // 回溯周期
  SUPPORT_RESISTANCE_BUFFER: Number.parseFloat(process.env.SUPPORT_RESISTANCE_BUFFER || '0.1'), // 缓冲区%
  
  // 止损策略选择
  USE_ATR_STOP_LOSS: process.env.USE_ATR_STOP_LOSS !== 'false', // 使用ATR止损（默认启用）
  USE_SUPPORT_RESISTANCE_STOP_LOSS: process.env.USE_SUPPORT_RESISTANCE_STOP_LOSS !== 'false', // 使用支撑/阻力止损（默认启用）
  
  // 止损距离限制
  MIN_STOP_LOSS_PERCENT: Number.parseFloat(process.env.MIN_STOP_LOSS_PERCENT || '0.5'), // 最小止损距离%
  MAX_STOP_LOSS_PERCENT: Number.parseFloat(process.env.MAX_STOP_LOSS_PERCENT || '5.0'), // 最大止损距离%
  
  // 开仓过滤器（基于止损合理性）
  ENABLE_STOP_LOSS_FILTER: process.env.ENABLE_STOP_LOSS_FILTER !== 'false', // 启用止损过滤器
  MIN_STOP_LOSS_QUALITY_SCORE: Number.parseInt(process.env.MIN_STOP_LOSS_QUALITY_SCORE || '40', 10), // 最低质量评分
  
  // 移动止损配置
  ENABLE_TRAILING_STOP_LOSS: process.env.ENABLE_TRAILING_STOP_LOSS === 'true', // 启用移动止损（默认关闭）
  TRAILING_STOP_CHECK_INTERVAL: Number.parseInt(process.env.TRAILING_STOP_CHECK_INTERVAL || '6', 10), // 检查间隔（周期数）
} as const;

