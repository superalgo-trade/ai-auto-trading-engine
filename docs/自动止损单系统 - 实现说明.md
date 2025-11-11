# 自动止损单系统 - 实现说明

## 🎯 核心改进

### 问题分析

**原有问题：**

- 交易循环间隔 20 分钟，期间价格波动无法及时响应
- 即使达到止损/止盈价位，也要等到下个周期才能平仓
- 存在"等待平仓期间盈利变亏损"的风险

**解决方案：**

- ✅ 开仓时自动在交易所设置止损止盈订单
- ✅ 止损单在交易所服务器端执行，不受本地程序限制
- ✅ 即使本地程序崩溃，交易所仍会自动执行止损
- ✅ 支持动态调整止损位（移动止损）

---

## 🏗️ 架构设计

### 1. 统一交易所接口扩展

在 `IExchangeClient` 接口中新增三个方法：

```typescript
/**
 * 设置持仓的止损止盈价格
 */
setPositionStopLoss(
  contract: string,
  stopLoss?: number,
  takeProfit?: number
): Promise<{
  success: boolean;
  stopLossOrderId?: string;
  takeProfitOrderId?: string;
  message?: string;
}>;

/**
 * 取消持仓的止损止盈订单
 */
cancelPositionStopLoss(contract: string): Promise<{
  success: boolean;
  message?: string;
}>;

/**
 * 获取持仓的止损止盈订单状态
 */
getPositionStopLossOrders(contract: string): Promise<{
  stopLossOrder?: any;
  takeProfitOrder?: any;
}>;
```

### 2. 交易所特定实现

#### Gate.io 实现

**技术方案：** 使用 Gate.io 的**条件单（Price Triggered Orders）**

- **止损单：** 创建市价条件单，当价格触及止损位时自动平仓
  - 多单：触发规则 `rule=2`（价格 <= 止损价时触发）
  - 空单：触发规则 `rule=1`（价格 >= 止损价时触发）

- **止盈单：** 创建市价条件单，当价格触及止盈位时自动平仓
  - 多单：触发规则 `rule=1`（价格 >= 止盈价时触发）
  - 空单：触发规则 `rule=2`（价格 <= 止盈价时触发）

**API 端点：**

```typescript
// 创建条件单
POST /api/v4/futures/{settle}/price_orders

// 查询条件单
GET /api/v4/futures/{settle}/price_orders?contract={contract}&status=open

// 取消条件单
DELETE /api/v4/futures/{settle}/price_orders?contract={contract}
```

#### Binance 实现

**技术方案：** 使用 Binance 的**条件市价单**

- **止损单：** `STOP_MARKET` 订单
  - `workingType=MARK_PRICE`（使用标记价格触发，避免插针）
  - `priceProtect=TRUE`（启用价格保护）
  - `closePosition=true`（平掉整个仓位）

- **止盈单：** `TAKE_PROFIT_MARKET` 订单
  - `workingType=MARK_PRICE`
  - `priceProtect=TRUE`
  - `closePosition=true`

**API 端点：**

```typescript
// 创建止损止盈单
POST /fapi/v1/order

// 查询未成交订单
GET /fapi/v1/openOrders?symbol={symbol}

// 取消订单
DELETE /fapi/v1/order?symbol={symbol}&orderId={orderId}
```

---

## 📦 新增功能

### 1. 开仓自动设置止损 (`openPosition`)

**工作流程：**

```typescript
1. 执行市价开仓
2. 等待订单成交，获取实际成交价格
3. 如果启用科学止损（ENABLE_SCIENTIFIC_STOP_LOSS=true）：
   a. 调用 calculateScientificStopLoss() 计算止损位
   b. 计算止盈位（风险回报比 1:2）
   c. 调用 exchangeClient.setPositionStopLoss() 设置止损止盈单
   d. 将止损止盈价格和订单ID保存到数据库
4. 返回开仓结果
```

**代码示例：**

```typescript
// 计算科学止损位
const stopLossResult = await calculateScientificStopLoss(
  symbol,
  side,
  actualFillPrice,
  stopLossConfig,
  "1h"
);

calculatedStopLoss = stopLossResult.stopLossPrice;

// 计算止盈位（风险回报比 1:2）
const stopLossDistance = Math.abs(actualFillPrice - calculatedStopLoss);
calculatedTakeProfit = side === "long"
  ? actualFillPrice + stopLossDistance * 2
  : actualFillPrice - stopLossDistance * 2;

// 设置止损止盈订单
const result = await exchangeClient.setPositionStopLoss(
  contract,
  calculatedStopLoss,
  calculatedTakeProfit
);
```

**日志输出：**

```typescript
📊 计算科学止损位...
✅ 科学止损计算完成:
   入场价: 50000.0000
   止损价: 48500.0000 (3.00%)
   止盈价: 53000.0000 (6.00%)
   计算方法: HYBRID (ATR + 支撑位)
   质量评分: 75/100
✅ 止损止盈订单已设置 (止损单ID: 12345, 止盈单ID: 12346)
```

### 2. 动态更新止损 (`updatePositionStopLoss`)

**使用场景：**

1. **移动止损：** 盈利后上移止损保护利润
2. **调整止盈：** 根据市场情况修改目标价位
3. **重新设置：** 市场波动变化后重新计算

**工作流程：**

```typescript
1. 检查持仓是否存在
2. 取消旧的止损止盈订单
3. 创建新的止损止盈订单
4. 更新数据库中的持仓信息
```

**AI 使用示例：**

```typescript
// 场景：BTC 多单已盈利 5%，检查是否可以上移止损

// 步骤1：检查是否需要更新（建议）
const checkResult = await updateTrailingStop({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000,
  currentPrice: 52500,
  currentStopLoss: 48500
});

if (checkResult.shouldUpdate) {
  // 步骤2：实际更新交易所订单
  await updatePositionStopLoss({
    symbol: "BTC",
    stopLoss: checkResult.data.newStopLoss,
    takeProfit: 55000  // 可选，不传则保持原止盈
  });
}
```

### 3. 查询止损单状态

**用途：** 在每个交易周期检查止损单是否仍然有效

```typescript
const orders = await exchangeClient.getPositionStopLossOrders(contract);

if (orders.stopLossOrder) {
  console.log("止损单状态:", orders.stopLossOrder.status);
  console.log("触发价格:", orders.stopLossOrder.stopPrice);
}

if (orders.takeProfitOrder) {
  console.log("止盈单状态:", orders.takeProfitOrder.status);
  console.log("触发价格:", orders.takeProfitOrder.stopPrice);
}
```

---

## 🔄 完整交易流程

### 开仓流程（已集成止损）

```typescript
AI 分析市场 → 发现交易机会
    ↓
checkOpenPosition(symbol, side, price)  // 开仓前检查
    ↓
    ├─ shouldOpen=false → 放弃交易
    └─ shouldOpen=true → 继续
           ↓
       calculateStopLoss(symbol, side, price)  // 计算止损（可选）
           ↓
       openPosition(symbol, side, amount, leverage)
           ↓
       【市价单成交】
           ↓
       【自动计算科学止损】
           ↓
       【设置止损止盈订单】← 新增功能！
           ↓
       返回成功
```

### 持仓管理流程（每个周期）

```typescript
获取所有持仓
    ↓
对每个持仓：
    ↓
    ├─ 检查止损单状态
    │   ├─ 已触发 → 持仓应该已平仓
    │   └─ 仍有效 → 继续
    │
    ├─ 计算当前盈亏
    │   ├─ 盈利 > 3% → 考虑上移止损
    │   │   ↓
    │   │   updateTrailingStop() 检查
    │   │   ↓
    │   │   如果 shouldUpdate:
    │   │   └─ updatePositionStopLoss() 实际更新
    │   │
    │   ├─ 达到止盈目标 → closePosition()
    │   └─ 正常持有 → 继续
    │
    └─ 检查其他平仓条件
        ├─ 达到持仓时长限制
        ├─ 市场条件变化
        └─ 等等...
```

---

## 🔧 配置说明

### 环境变量

```bash
# ========== 科学止损系统配置 ==========

# 1️⃣ 启用科学止损系统（强烈推荐）
ENABLE_SCIENTIFIC_STOP_LOSS=true

# 2️⃣ 启用追踪止损（动态保护利润，推荐开启）
ENABLE_TRAILING_STOP_LOSS=true

# 3️⃣ 启用开仓过滤器（开仓前检查止损合理性，强烈推荐）
ENABLE_STOP_LOSS_FILTER=true

# ========== 高级配置（可选）==========
# 以下参数会被各策略的配置覆盖

ATR_PERIOD=14                       # ATR 计算周期
ATR_MULTIPLIER=2.0                  # ATR 倍数
SUPPORT_RESISTANCE_LOOKBACK=20      # 支撑/阻力位回溯周期
MIN_STOP_LOSS_QUALITY_SCORE=40      # 最低质量分数
```

### 策略配置

每个策略都有独立的科学止损配置（在 `tradingAgent.ts` 中）：

```typescript
// 超短线策略
scientificStopLoss: {
  enabled: true,
  atrMultiplier: 1.5,    // 较紧的止损
  useSupport: true,
  minDistance: 0.3,      // 最小0.3%
  maxDistance: 2.0,      // 最大2.0%
}

// 波段趋势策略
scientificStopLoss: {
  enabled: true,
  atrMultiplier: 2.5,    // 较宽的止损，给趋势更多空间
  useSupport: true,
  minDistance: 1.0,      // 最小1.0%
  maxDistance: 6.0,      // 最大6.0%
}
```

---

## 🎓 AI Agent 使用指南

### 工具列表

#### 1. `openPosition` - 开仓（已集成自动止损）

```typescript
await openPosition({
  symbol: "BTC",
  side: "long",
  leverage: 10,
  amountUsdt: 100
});

// 内部自动：
// 1. 市价开仓
// 2. 计算科学止损
// 3. 设置止损止盈订单（新增！）
```

#### 2. `calculateStopLoss` - 计算止损位

```typescript
const result = await calculateStopLoss({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000,
  timeframe: "1h"
});

// 返回：
// - stopLossPrice: 48500
// - stopLossDistancePercent: 3.00
// - method: "HYBRID"
// - qualityScore: 75
```

#### 3. `checkOpenPosition` - 开仓前检查

```typescript
const check = await checkOpenPosition({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000
});

if (check.shouldOpen) {
  // 开仓条件合理，继续
} else {
  // 不建议开仓（止损距离过大/波动极端等）
}
```

#### 4. `updateTrailingStop` - 检查移动止损（建议）

```typescript
const update = await updateTrailingStop({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000,
  currentPrice: 52500,
  currentStopLoss: 48500
});

if (update.shouldUpdate) {
  // 建议上移止损至 update.data.newStopLoss
}
```

#### 5. `updatePositionStopLoss` - 实际更新止损单（执行）

```typescript
await updatePositionStopLoss({
  symbol: "BTC",
  stopLoss: 51500,      // 新止损价
  takeProfit: 55000     // 新止盈价（可选）
});

// 内部执行：
// 1. 取消旧止损单
// 2. 创建新止损单
// 3. 更新数据库
```

### 推荐工作流

#### 开仓时

```typescript
// ✅ 推荐：完整流程
const check = await checkOpenPosition("BTC", "long", 50000);
if (check.shouldOpen) {
  const stopLoss = await calculateStopLoss("BTC", "long", 50000);
  await openPosition("BTC", "long", 10, 100);
  // openPosition 内部会自动设置止损单
}

// ⚠️ 不推荐：跳过检查
await openPosition("BTC", "long", 10, 100);
// 虽然会自动设置止损，但可能开仓条件不佳
```

#### 持仓管理时

```typescript
// 每小时检查一次
const positions = await getPositions();

for (const pos of positions) {
  const pnl = (pos.unrealizedPnl / pos.margin) * 100;
  
  if (pnl > 3) {
    // 盈利超过 3%，考虑上移止损
    const update = await updateTrailingStop({
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      currentPrice: pos.markPrice,
      currentStopLoss: pos.stopLoss
    });
    
    if (update.shouldUpdate) {
      await updatePositionStopLoss({
        symbol: pos.symbol,
        stopLoss: update.data.newStopLoss
      });
      
      console.log(`${pos.symbol} 止损已上移至 ${update.data.newStopLoss}`);
    }
  }
}
```

---

## 🛡️ 风控保护

### 多层次风控

1. **开仓前过滤（checkOpenPosition）**
   - 检查止损距离是否合理
   - 检查市场波动是否极端
   - 检查止损质量评分

2. **交易所服务器端止损**
   - 24/7 监控价格
   - 触发即刻平仓
   - 不受本地程序影响

3. **本地程序兜底**
   - 每个周期检查止损单状态
   - 如果止损单失效，手动平仓
   - 系统红线：-30% 强制平仓

4. **动态调整**
   - 盈利后上移止损保护利润
   - 根据市场波动调整止损距离

### 容错机制

```typescript
// 止损单设置失败的处理
if (!setStopLossResult.success) {
  logger.warn("⚠️ 设置止损单失败，将依赖本地程序监控");
  // 不阻止开仓，但会在下个周期手动检查
}

// 数据库更新失败的处理
try {
  await dbClient.execute(...);
} catch (dbError) {
  logger.error("更新数据库失败，但止损单已生效");
  // 订单已在交易所设置，数据库更新失败不影响风控
}
```

---

## 📊 监控和调试

### 日志监控

```bash
# 查看止损相关日志
tail -f logs/combined.log | grep "止损\|stop"

# 查看止损单创建
grep "止损单已创建" logs/combined.log

# 查看止损单更新
grep "止损已上移" logs/combined.log

# 查看止损触发
grep "触发止损" logs/combined.log
```

### 数据库查询

```sql
-- 查看持仓的止损设置
SELECT symbol, side, entry_price, stop_loss, profit_target, 
       sl_order_id, tp_order_id
FROM positions
WHERE quantity != 0;

-- 查看止损单ID
SELECT symbol, sl_order_id, tp_order_id, opened_at
FROM positions
WHERE sl_order_id IS NOT NULL;
```

### 交易所查询

```typescript
// 查询止损单状态
const orders = await exchangeClient.getPositionStopLossOrders("BTC_USDT");
console.log("止损单:", orders.stopLossOrder);
console.log("止盈单:", orders.takeProfitOrder);
```

---

## ⚡ 性能优化

### 1. 减少 API 调用

- 止损单在交易所服务器端执行，不需要频繁查询价格
- 只在需要更新时才调用 `updatePositionStopLoss`
- 每小时检查一次移动止损即可（不需要每分钟）

### 2. 批量操作

```typescript
// 批量检查多个持仓的移动止损
const updates = await Promise.all(
  positions.map(pos => updateTrailingStop({...}))
);

// 只更新需要调整的持仓
for (const [i, update] of updates.entries()) {
  if (update.shouldUpdate) {
    await updatePositionStopLoss({
      symbol: positions[i].symbol,
      stopLoss: update.data.newStopLoss
    });
  }
}
```

### 3. 错误恢复

```typescript
// 如果止损单创建失败，记录到数据库
if (!result.success) {
  await dbClient.execute({
    sql: "INSERT INTO failed_stop_loss_orders (symbol, reason, timestamp) VALUES (?, ?, ?)",
    args: [symbol, result.message, Date.now()]
  });
}

// 下个周期重试
const failedOrders = await dbClient.execute("SELECT * FROM failed_stop_loss_orders WHERE retried = 0");
for (const order of failedOrders.rows) {
  // 重试设置止损单...
}
```

---

## 🎉 总结

### 核心优势

✅ **即时风控：** 止损在交易所服务器端执行，不受本地程序限制  
✅ **降低滑点：** 交易所服务器响应速度远快于 20 分钟轮询  
✅ **保护利润：** 避免"等待平仓期间盈利变亏损"的情况  
✅ **系统稳定：** 即使本地程序崩溃，止损单仍会自动触发  
✅ **兼容双交易所：** Gate.io 和 Binance 都支持  
✅ **科学计算：** 基于 ATR 和支撑位的动态止损  
✅ **自动执行：** 开仓时自动设置，无需手动操作  

### 使用建议

1. **启用科学止损：** 设置 `ENABLE_SCIENTIFIC_STOP_LOSS=true`
2. **启用开仓过滤：** 设置 `ENABLE_STOP_LOSS_FILTER=true`
3. **启用移动止损：** 设置 `ENABLE_TRAILING_STOP_LOSS=true`
4. **定期检查：** 每小时检查一次持仓，考虑上移止损
5. **监控日志：** 关注止损单的创建和触发情况
6. **回测优化：** 根据实际效果调整 ATR 倍数和止损范围

### 注意事项

⚠️ **止损不是万能的：** 不能完全避免损失，但能显著减少风险  
⚠️ **需要配合其他风控：** 仓位管理、资金管理、情绪管理同样重要  
⚠️ **定期回测优化：** 根据市场变化调整参数  
⚠️ **交易所限制：** 注意交易所对条件单的数量和频率限制  

---

**记住：好的止损系统让你睡得安心，不用担心半夜暴跌！** 🌙💤
