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
 * 数据库模式定义
 */

export interface Trade {
  id: number;
  order_id: string;
  symbol: string;
  side: 'long' | 'short';
  type: 'open' | 'close';
  price: number;
  quantity: number;
  leverage: number;
  pnl?: number;
  fee?: number;
  timestamp: string;
  status: 'pending' | 'filled' | 'cancelled';
}

export interface Position {
  id: number;
  symbol: string;
  quantity: number;
  entry_price: number;
  current_price: number;
  liquidation_price: number;
  unrealized_pnl: number;
  leverage: number;
  side: 'long' | 'short';
  profit_target?: number;
  stop_loss?: number;
  tp_order_id?: string;
  sl_order_id?: string;
  entry_order_id: string;
  opened_at: string;
  confidence?: number;
  risk_usd?: number;
  peak_pnl_percent?: number; // 历史最高盈亏百分比（考虑杠杆）
  partial_close_percentage?: number; // 已通过分批止盈平掉的百分比 (0-100)
  // 策略信息字段（用于记录开仓决策依据）
  market_state?: string; // 市场状态（如 'uptrend_oversold', 'ranging_neutral' 等）
  strategy_type?: string; // 策略类型（如 'trend_following', 'mean_reversion', 'breakout'）
  signal_strength?: number; // 信号强度（0-1）
  opportunity_score?: number; // 机会评分（0-100）
}

export interface AccountHistory {
  id: number;
  timestamp: string;
  total_value: number;
  available_cash: number;
  unrealized_pnl: number;
  realized_pnl: number;
  return_percent: number;
  sharpe_ratio?: number;
}

export interface TradingSignal {
  id: number;
  symbol: string;
  timestamp: string;
  price: number;
  ema_20: number;
  ema_50?: number;
  macd: number;
  rsi_7: number;
  rsi_14: number;
  volume: number;
  open_interest?: number;
  funding_rate?: number;
  atr_3?: number;
  atr_14?: number;
}

export interface AgentDecision {
  id: number;
  timestamp: string;
  iteration: number;
  market_analysis: string;
  decision: string;
  actions_taken: string;
  account_value: number;
  positions_count: number;
}

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  updated_at: string;
}

export interface PriceOrder {
  id: number;
  order_id: string;
  position_order_id?: string;  // 关联的开仓订单ID
  symbol: string;
  side: 'long' | 'short';
  type: 'stop_loss' | 'take_profit';
  trigger_price: number;
  order_price: number;
  quantity: number;
  status: 'active' | 'triggered' | 'cancelled';
  created_at: string;
  updated_at?: string;
  triggered_at?: string;
}

export interface PositionCloseEvent {
  id: number;
  symbol: string;
  side: 'long' | 'short';
  close_reason: 'stop_loss_triggered' | 'take_profit_triggered' | 'manual_close' | 'ai_decision' | 'trend_reversal' | 'peak_drawdown' | 'time_limit' | 'partial_close' | 'trailing_stop' | 'forced_close';
  trigger_type: 'exchange_order' | 'ai_decision' | 'system_risk' | 'manual_operation';
  trigger_price?: number;
  close_price: number;
  entry_price: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnl_percent: number;
  fee?: number;
  trigger_order_id?: string;
  close_trade_id?: string;
  order_id?: string;
  created_at: string;
  processed: boolean;
}

/**
 * 分批止盈历史记录（基于风险倍数）
 */
export interface PartialTakeProfitHistory {
  id: number;
  symbol: string;
  stage: number;                    // 阶段：1=1R, 2=2R, 3=3R+
  r_multiple: number;               // 当时的R倍数
  trigger_price: number;            // 触发价格
  close_percent: number;            // 平仓百分比
  closed_quantity: number;          // 已平仓数量
  remaining_quantity: number;       // 剩余数量
  pnl: number;                      // 本次盈亏
  new_stop_loss_price?: number;     // 新的止损价格
  status: 'completed' | 'failed';   // 状态
  notes?: string;                   // 备注
  timestamp: string;                // 执行时间
}

/**
 * SQL 建表语句
 */
export const CREATE_TABLES_SQL = `
-- 交易记录表
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  type TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  leverage INTEGER NOT NULL,
  pnl REAL,
  fee REAL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- 持仓表
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  quantity REAL NOT NULL,
  entry_price REAL NOT NULL,
  current_price REAL NOT NULL,
  liquidation_price REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  leverage INTEGER NOT NULL,
  side TEXT NOT NULL,
  profit_target REAL,
  stop_loss REAL,
  tp_order_id TEXT,
  sl_order_id TEXT,
  entry_order_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  confidence REAL,
  risk_usd REAL,
  peak_pnl_percent REAL DEFAULT 0,
  partial_close_percentage REAL DEFAULT 0,
  market_state TEXT,
  strategy_type TEXT,
  signal_strength REAL,
  opportunity_score REAL,
  metadata TEXT
);

-- 账户历史表
CREATE TABLE IF NOT EXISTS account_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  total_value REAL NOT NULL,
  available_cash REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  return_percent REAL NOT NULL,
  sharpe_ratio REAL
);

-- 技术指标表
CREATE TABLE IF NOT EXISTS trading_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  price REAL NOT NULL,
  ema_20 REAL NOT NULL,
  ema_50 REAL,
  macd REAL NOT NULL,
  rsi_7 REAL NOT NULL,
  rsi_14 REAL NOT NULL,
  volume REAL NOT NULL,
  open_interest REAL,
  funding_rate REAL,
  atr_3 REAL,
  atr_14 REAL
);

-- Agent 决策记录表
CREATE TABLE IF NOT EXISTS agent_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  iteration INTEGER NOT NULL,
  market_analysis TEXT NOT NULL,
  decision TEXT NOT NULL,
  actions_taken TEXT NOT NULL,
  account_value REAL NOT NULL,
  positions_count INTEGER NOT NULL
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 条件单表（止损止盈订单）
CREATE TABLE IF NOT EXISTS price_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  position_order_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  type TEXT NOT NULL,
  trigger_price REAL NOT NULL,
  order_price REAL DEFAULT 0,
  quantity REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  triggered_at TEXT
);

-- 持仓平仓事件表（记录所有平仓事件，供AI决策使用）
CREATE TABLE IF NOT EXISTS position_close_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  close_reason TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_price REAL,
  close_price REAL NOT NULL,
  entry_price REAL NOT NULL,
  quantity REAL NOT NULL,
  leverage INTEGER NOT NULL,
  pnl REAL NOT NULL,
  pnl_percent REAL NOT NULL,
  fee REAL,
  trigger_order_id TEXT,
  close_trade_id TEXT,
  order_id TEXT,
  created_at TEXT NOT NULL,
  processed INTEGER DEFAULT 0
);

-- 分批止盈历史记录表
CREATE TABLE IF NOT EXISTS partial_take_profit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  side TEXT,
  stage INTEGER NOT NULL,
  r_multiple REAL NOT NULL,
  trigger_price REAL NOT NULL,
  close_percent REAL NOT NULL,
  closed_quantity REAL NOT NULL,
  remaining_quantity REAL NOT NULL,
  pnl REAL NOT NULL,
  new_stop_loss_price REAL,
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  timestamp TEXT NOT NULL
);

-- 不一致状态追踪表（事务保护）
CREATE TABLE IF NOT EXISTS inconsistent_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT,
  exchange_success INTEGER NOT NULL,
  db_success INTEGER NOT NULL,
  exchange_order_id TEXT,
  error_message TEXT,
  resolved INTEGER DEFAULT 0,
  resolved_at TEXT,
  resolved_by TEXT,
  resolution_notes TEXT,
  created_at TEXT NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON trading_signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON trading_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON account_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON agent_decisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_orders_symbol ON price_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_price_orders_status ON price_orders(status);
CREATE INDEX IF NOT EXISTS idx_price_orders_order_id ON price_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_close_events_processed ON position_close_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_close_events_symbol ON position_close_events(symbol);
CREATE INDEX IF NOT EXISTS idx_partial_taking_profit_symbol ON partial_take_profit_history(symbol);
CREATE INDEX IF NOT EXISTS idx_partial_taking_profit_status ON partial_take_profit_history(status);
CREATE INDEX IF NOT EXISTS idx_inconsistent_states_resolved ON inconsistent_states(resolved, created_at);
CREATE INDEX IF NOT EXISTS idx_inconsistent_states_symbol ON inconsistent_states(symbol);
CREATE INDEX IF NOT EXISTS idx_inconsistent_states_operation ON inconsistent_states(operation);
`;

