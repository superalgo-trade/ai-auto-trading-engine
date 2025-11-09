# 平仓事件追踪功能

## 概述

系统现已支持完整的平仓事件追踪功能，用于记录所有由止损/止盈触发的平仓操作，并将这些信息提供给AI决策系统以优化交易策略。

## 主要功能

### 1. 平仓事件记录

当条件单（止损/止盈）触发时，系统会自动：

- 在 `trades` 表中记录平仓交易（包含盈亏、手续费等）
- 在 `position_close_events` 表中记录平仓事件详情
- 更新 `price_orders` 表中的条件单状态为 `triggered`
- 取消反向条件单（止损触发时取消止盈，反之亦然）
- 从 `positions` 表中删除已平仓的持仓

### 2. AI决策集成

AI交易系统会在每次决策时获取近期（24小时内）的平仓事件，包括：

- 平仓原因（止损触发、止盈触发、手动平仓）
- 触发价格和成交价格
- 盈亏金额和盈亏百分比
- 事件统计（胜率、净盈亏）
- 策略优化建议

这些信息帮助AI：

- 评估止损/止盈设置的有效性
- 识别策略问题和改进方向
- 优化未来的入场和退出决策
- 学习成功和失败的交易模式

### 3. 前端展示

前端交易历史页面会显示所有完整的交易记录：

- 开仓和平仓配对展示
- 持仓时间计算
- 总手续费（开仓 + 平仓）
- 净盈亏显示
- 按时间倒序排列

## 数据库表结构

### position_close_events

```sql
CREATE TABLE position_close_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,                  -- 交易对（如BTC、ETH）
  side TEXT NOT NULL,                    -- 方向（long/short）
  close_reason TEXT NOT NULL,            -- 平仓原因
  trigger_price REAL,                    -- 触发价格
  close_price REAL NOT NULL,             -- 实际成交价格
  entry_price REAL NOT NULL,             -- 开仓价格
  quantity REAL NOT NULL,                -- 数量
  pnl REAL NOT NULL,                     -- 盈亏金额（USDT）
  pnl_percent REAL NOT NULL,             -- 盈亏百分比（含杠杆）
  trigger_order_id TEXT,                 -- 触发的条件单ID
  close_trade_id TEXT,                   -- 平仓交易ID
  created_at TEXT NOT NULL,              -- 创建时间
  processed INTEGER DEFAULT 0            -- 是否已被AI处理
);
```

### close_reason 类型

- `stop_loss_triggered`: 止损单触发
- `take_profit_triggered`: 止盈单触发
- `manual`: 手动平仓
- `forced`: 强制平仓（如36小时限制）

## 迁移指南

### 新安装

新安装的系统会自动创建 `position_close_events` 表，无需手动操作。

### 现有系统升级

运行以下命令添加新表：

```bash
npx tsx src/database/migrate-add-close-events.ts
```

## 工作流程

```bash
条件单触发
    ↓
验证平仓交易存在
    ↓
更新条件单状态 (active → triggered)
    ↓
取消反向条件单
    ↓
记录平仓交易 (trades表)
    ↓
记录平仓事件 (position_close_events表)
    ↓
删除持仓记录
    ↓
AI下次决策时读取事件
    ↓
标记事件为已处理
```

## 监控和调试

### 查看近期平仓事件

```sql
SELECT * FROM position_close_events 
WHERE created_at > datetime('now', '-24 hours')
ORDER BY created_at DESC;
```

### 查看未处理的事件

```sql
SELECT * FROM position_close_events 
WHERE processed = 0
ORDER BY created_at DESC;
```

### 查看特定币种的平仓历史

```sql
SELECT * FROM position_close_events 
WHERE symbol = 'BTC'
ORDER BY created_at DESC
LIMIT 10;
```

## 性能优化

- 使用索引 `idx_close_events_processed` 加速查询未处理事件
- 使用索引 `idx_close_events_symbol` 加速按币种查询
- 自动标记已处理事件，避免重复计算
- 限制查询时间窗口（24小时）减少数据量

## 注意事项

1. **时间窗口**: AI只读取24小时内的平仓事件，更早的事件被认为已过时
2. **自动标记**: 事件被AI读取后会自动标记为已处理（processed=1）
3. **数据保留**: 所有事件都会永久保留，用于历史分析和回测
4. **盈亏计算**: pnl_percent已包含杠杆效应，无需额外计算

## 相关文件

- `src/database/schema.ts` - 数据库表定义
- `src/database/migrate-add-close-events.ts` - 迁移脚本
- `src/scheduler/priceOrderMonitor.ts` - 条件单监控和事件记录
- `src/agents/tradingAgent.ts` - AI提示词生成（包含事件信息）
- `src/scheduler/tradingLoop.ts` - 主交易循环（读取事件）
- `src/api/routes.ts` - API接口（前端数据展示）

## 未来改进

- [ ] 添加事件导出功能（CSV/JSON）
- [ ] 实现事件通知（Telegram/Email）
- [ ] 添加事件可视化图表
- [ ] 支持按事件类型过滤和分析
- [ ] 实现事件驱动的策略优化建议
