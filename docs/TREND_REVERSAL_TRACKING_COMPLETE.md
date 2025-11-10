# 趋势反转平仓原因追踪功能完成

## 📋 问题诊断

从日志中发现，AI 提示词明确指出 "**趋势明确反转（3+时间框架信号一致）**" 是主动平仓的重要理由之一，但系统存在以下问题：

1. ❌ `accountManagement.ts` 的平仓原因映射表（`reasonMap`）中没有 "趋势反转" 对应的翻译
2. ❌ `closePosition` 工具没有 `reason` 参数，无法区分不同平仓原因
3. ❌ AI 代理提示词中没有指导 AI 在趋势反转时传入特定的 reason 代码
4. ❌ 前端无法正确显示"趋势反转平仓"的标签

## ✅ 解决方案

### 1. 扩展平仓原因映射表

**文件**: `src/tools/trading/accountManagement.ts`

**修改位置**: 第 430-441 行（`getCloseEventsTool` 中的 `reasonMap`）

```typescript
// 翻译平仓原因
const reasonMap: Record<string, string> = {
  'stop_loss_triggered': '止损触发',
  'take_profit_triggered': '止盈触发',
  'manual_close': 'AI手动平仓',
  'ai_decision': 'AI主动平仓',          // 新增
  'trend_reversal': '趋势反转平仓',     // ⭐ 新增！
  'forced_close': '系统强制平仓',
  'partial_close': '分批平仓',
  'trailing_stop': '移动止损触发',
  'peak_drawdown': '峰值回撤平仓',
  'time_limit': '持仓时间到期',
};
```

### 2. 为 closePosition 工具添加 reason 参数

**文件**: `src/tools/trading/tradeExecution.ts`

**修改位置**: 第 766-775 行（`closePositionTool` 定义）

```typescript
export const closePositionTool = createTool({
  name: "closePosition",
  description: "平仓 - 关闭指定币种的持仓",
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS).describe("币种代码"),
    percentage: z.number().min(1).max(100).default(100).describe("平仓百分比（1-100）"),
    reason: z.enum([                                    // ⭐ 新增参数！
      'manual_close',      // AI手动平仓（默认）
      'trend_reversal',    // 趋势反转平仓
      'ai_decision',       // AI主动平仓
      'peak_drawdown',     // 峰值回撤平仓
      'time_limit',        // 持仓时间到期
    ]).optional().describe("平仓原因代码（可选）：trend_reversal=趋势反转, manual_close=AI手动平仓（默认）, peak_drawdown=峰值回撤, time_limit=持仓时间到期"),
  }),
  execute: async ({ symbol, percentage, reason = 'manual_close' }) => {
    // ... 使用 reason 参数记录平仓事件
  },
});
```

**修改位置**: 第 1120-1147 行（平仓事件记录逻辑）

```typescript
// 📝 记录平仓事件到 position_close_events 表
const closeEventTime = getChinaTimeISO();
await dbClient.execute({
  sql: `INSERT INTO position_close_events 
        (symbol, side, entry_price, exit_price, quantity, leverage, 
         pnl, fee, close_reason, trigger_type, order_id, 
         created_at, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    symbol,
    side,
    entryPrice,
    actualExitPrice,
    actualCloseSize,
    leverage,
    pnl,
    totalFee,
    reason,          // ⭐ 使用传入的平仓原因代码（而非硬编码）
    'ai_decision',   // 触发类型：AI决策
    order.id?.toString() || "",
    closeEventTime,
    1,  // 已处理
  ],
});

logger.info(`📝 已记录平仓事件: ${symbol} ${side} 原因=${reason}`);
```

### 3. 更新 AI 代理提示词指导

**文件**: `src/agents/tradingAgent.ts`

**修改 1**: 第 724-727 行（决策流程）

```typescript
步骤2：检查平仓触发
├─ 峰值回撤 ≥ 30.00% → 危险信号，调用 closePosition({ symbol, reason: 'peak_drawdown' })
├─ 趋势反转（3+时间框架信号一致）→ 调用 closePosition({ symbol, reason: 'trend_reversal' })  // ⭐
└─ 持仓时间 ≥ 36小时 → 调用 closePosition({ symbol, reason: 'time_limit' })
```

**修改 2**: 第 1172-1174 行（仓位管理规则）

```typescript
- **趋势反转必须先平仓**：如果当前持有 BTC 多单，想开 BTC 空单时，必须先平掉多单
  （使用 closePosition({ symbol: 'BTC', reason: 'trend_reversal' })）  // ⭐
- **执行顺序**：趋势反转时 → 先执行 closePosition({ symbol, reason: 'trend_reversal' }) 
  平掉原仓位 → 再执行 openPosition 开新方向                             // ⭐
```

**修改 3**: 第 792-795 行（错误案例指导）

```typescript
✅ 正确做法: 信任交易所的止损单，只在以下情况主动平仓：
    • 趋势明确反转（3+时间框架信号一致）→ closePosition({ symbol, reason: 'trend_reversal' })      // ⭐
    • 峰值回撤 ≥ 30.00% → closePosition({ symbol, reason: 'peak_drawdown' })                           // ⭐
    • 持仓时间 ≥ 36小时 → closePosition({ symbol, reason: 'time_limit' })                              // ⭐
```

**修改 4**: 第 1671-1677 行（工具说明）

```typescript
可用工具：
- 持仓管理：
  * closePosition（市价单，支持 reason 参数记录平仓原因：                      // ⭐ 新增说明
    trend_reversal=趋势反转, peak_drawdown=峰值回撤, 
    time_limit=时间到期, manual_close=手动平仓）
- 账户信息：getAccountBalance、getPositions、getOpenOrders、
  getCloseEvents（查询平仓事件历史）                                         // ⭐ 新增工具说明
```

## 🎯 功能实现效果

### AI 决策示例

当 AI 检测到趋势反转时（例如 BTC 多头转空头），会这样调用工具：

```typescript
// ❌ 之前：原因不明确
closePosition({ symbol: 'BTC' })

// ✅ 现在：明确标记原因
closePosition({ symbol: 'BTC', reason: 'trend_reversal' })
```

### 数据库记录

`position_close_events` 表会正确记录：

```sql
INSERT INTO position_close_events (
  symbol, side, entry_price, exit_price, quantity, leverage,
  pnl, fee, close_reason, trigger_type, order_id, created_at, processed
) VALUES (
  'BTC', 'long', 105000, 104500, 100, 10,
  -500, 52.5, 'trend_reversal', 'ai_decision', '123456', '2025-11-10 20:30:00', 1
);
```

### 前端显示

通过 `getCloseEvents` 工具查询时，返回的数据会包含正确的中文翻译：

```json
{
  "success": true,
  "events": [
    {
      "symbol": "BTC",
      "side": "long",
      "pnl": -500.00,
      "closeReason": "trend_reversal",
      "closeReasonText": "趋势反转平仓",    // ⭐ 自动翻译
      "triggerType": "ai_decision",
      "triggerTypeText": "AI决策",
      "createdAt": "2025-11-10 20:30:00"
    }
  ]
}
```

### AI 查询历史

AI 可以调用 `getCloseEvents` 查看历史平仓原因：

```typescript
// AI 调用示例
const history = await getCloseEvents({ symbol: 'ETH', limit: 10 });

// 返回结果（部分）：
// [
//   { symbol: 'ETH', closeReasonText: '趋势反转平仓', pnl: +120.50, ... },
//   { symbol: 'ETH', closeReasonText: '止盈触发', pnl: +89.30, ... },
// ]
```

## 📊 支持的平仓原因清单

| 代码 (`close_reason`) | 中文显示 | 使用场景 |
|---------------------|--------|---------|
| `trend_reversal` | 趋势反转平仓 | AI 检测到 3+ 时间框架趋势反转信号时 |
| `peak_drawdown` | 峰值回撤平仓 | 持仓盈亏从峰值回撤 ≥ 30% 时 |
| `time_limit` | 持仓时间到期 | 持仓时间 ≥ 36 小时强制平仓 |
| `manual_close` | AI手动平仓 | AI 主动决策平仓（默认值） |
| `ai_decision` | AI主动平仓 | AI 基于策略主动平仓 |
| `stop_loss_triggered` | 止损触发 | 交易所止损单自动触发 |
| `take_profit_triggered` | 止盈触发 | 交易所止盈单自动触发 |
| `trailing_stop` | 移动止损触发 | 移动止损单自动触发 |
| `partial_close` | 分批平仓 | 分批止盈平仓 |
| `forced_close` | 系统强制平仓 | 系统风控强制平仓 |

## 🔍 验证方法

### 1. 编译验证

```bash
cd /home/losesky/ai-auto-trading
npm run build
```

**结果**: ✅ 编译成功，无 TypeScript 错误

### 2. 数据库查询验证

等待 AI 触发趋势反转平仓后，可以查询数据库验证：

```bash
sqlite3 ./.voltagent/trading.db \
  "SELECT symbol, side, close_reason, pnl, created_at 
   FROM position_close_events 
   WHERE close_reason = 'trend_reversal' 
   ORDER BY created_at DESC 
   LIMIT 5;"
```

### 3. API 查询验证

调用 `getCloseEvents` 工具查看翻译是否正确：

```typescript
// 在 AI 决策中调用
const events = await getCloseEvents({ limit: 20 });
// 检查 events.closeReasonText 是否为 "趋势反转平仓"
```

## 📈 影响范围

### 直接影响

1. ✅ AI 可以明确记录趋势反转平仓原因
2. ✅ 数据库 `position_close_events` 表正确记录 `close_reason = 'trend_reversal'`
3. ✅ 前端通过 API 可以正确显示"趋势反转平仓"标签
4. ✅ AI 可以查询历史平仓事件并理解每次平仓的具体原因

### 间接影响

1. ✅ 提高了系统的透明度和可追溯性
2. ✅ 方便用户理解 AI 的决策逻辑
3. ✅ 为后续数据分析提供更精准的分类（例如统计趋势反转平仓的准确率）
4. ✅ 帮助 AI 通过历史数据学习和优化策略

## 🎉 总结

本次修改完整解决了 "趋势反转平仓原因无法追踪和显示" 的问题，确保：

1. **AI 决策层**：提示词明确指导何时使用 `reason: 'trend_reversal'`
2. **执行层**：`closePosition` 工具支持 `reason` 参数并正确记录到数据库
3. **数据层**：`position_close_events` 表正确存储平仓原因代码
4. **展示层**：`getCloseEvents` 工具提供中文翻译映射，前端可正确显示
5. **查询层**：AI 和用户可以通过工具查询历史平仓事件及原因

**所有修改均已完成，编译通过，功能完整！** ✨
