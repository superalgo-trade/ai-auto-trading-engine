# 自动止损单 - 快速使用指南

## 🚀 这是什么？

**一句话说明：** 开仓后自动在交易所设置止损单，不再受 20 分钟交易循环限制！

### 核心优势

- ✅ **即时止损：** 价格触及止损位立即平仓（不用等 20 分钟）
- ✅ **程序崩溃也安全：** 止损单在交易所服务器端，本地程序挂了也能止损
- ✅ **自动执行：** 开仓时自动设置，无需手动操作
- ✅ **科学计算：** 基于 ATR 和支撑位动态计算止损位
- ✅ **动态调整：** 盈利后可以上移止损保护利润

---

## 📝 配置（3 步完成）

在 `.env` 文件中只需 3 个配置：

```bash
# 1️⃣ 启用科学止损系统
ENABLE_SCIENTIFIC_STOP_LOSS=true

# 2️⃣ 启用追踪止损（可选，推荐开启）
ENABLE_TRAILING_STOP_LOSS=true

# 3️⃣ 启用开仓过滤器（强烈推荐）
ENABLE_STOP_LOSS_FILTER=true
```

**就这样！** 🎉 详细参数已经预配置好，不需要手动设置。

---

## 🎯 使用示例

### 场景 1：正常开仓（自动设置止损）

```typescript
// AI 发现 BTC 交易机会
await openPosition({
  symbol: "BTC",
  side: "long",
  leverage: 10,
  amountUsdt: 100
});

// 系统自动执行：
// ✅ 市价开仓
// ✅ 计算科学止损（如 -3%）
// ✅ 计算止盈位（如 +6%，1:2 风险回报比）
// ✅ 在交易所设置止损止盈订单 ← 新功能！

// 日志输出：
// 📊 计算科学止损位...
// ✅ 科学止损计算完成:
//    入场价: 50000.0000
//    止损价: 48500.0000 (3.00%)
//    止盈价: 53000.0000 (6.00%)
// ✅ 止损止盈订单已设置 (止损单ID: 12345, 止盈单ID: 12346)
```

**效果：**

- 如果价格跌破 48500，交易所自动平仓（不用等 20 分钟！）
- 如果价格涨到 53000，交易所自动止盈

### 场景 2：盈利后上移止损

```typescript
// 每个交易周期检查持仓
const positions = await getPositions();

for (const pos of positions) {
  const pnl = (pos.unrealizedPnl / pos.margin) * 100;
  
  if (pnl > 3) {
    // 盈利超过 3%，考虑上移止损
    
    // 步骤1：检查是否应该更新
    const update = await updateTrailingStop({
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      currentPrice: pos.markPrice,
      currentStopLoss: pos.stopLoss
    });
    
    if (update.shouldUpdate) {
      // 步骤2：实际更新交易所订单
      await updatePositionStopLoss({
        symbol: pos.symbol,
        stopLoss: update.data.newStopLoss
      });
      
      console.log(`✅ ${pos.symbol} 止损已上移至 ${update.data.newStopLoss}`);
      console.log(`   保护了 ${update.data.improvement}% 的利润`);
    }
  }
}
```

**效果：**

- BTC 从 50000 涨到 52500（盈利 5%）
- 止损从 48500 上移到 51500
- 即使回调，最多只亏 1000（原来可能亏 1500）

---

## 🔍 工具说明

### AI Agent 可用的工具

#### 1. `openPosition` - 开仓（已自动集成止损）

```typescript
await openPosition({
  symbol: "BTC",
  side: "long",
  leverage: 10,
  amountUsdt: 100
});
```

**新增功能：** 开仓成功后自动设置止损止盈订单

#### 2. `updatePositionStopLoss` - 更新止损单

```typescript
await updatePositionStopLoss({
  symbol: "BTC",
  stopLoss: 51500,      // 新止损价
  takeProfit: 55000     // 新止盈价（可选）
});
```

**用途：**

- 盈利后上移止损
- 根据市场变化调整止损
- 重新设置止盈目标

#### 3. `updateTrailingStop` - 检查移动止损（建议）

```typescript
const result = await updateTrailingStop({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000,
  currentPrice: 52500,
  currentStopLoss: 48500
});

if (result.shouldUpdate) {
  // 建议更新到 result.data.newStopLoss
}
```

**用途：** 检查是否应该上移止损（不会实际修改订单）

#### 4. `calculateStopLoss` - 计算止损位

```typescript
const result = await calculateStopLoss({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000
});

// result.stopLossPrice: 48500
// result.stopLossDistancePercent: 3.00
```

**用途：** 获取推荐的止损价格

#### 5. `checkOpenPosition` - 开仓前检查

```typescript
const check = await checkOpenPosition({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000
});

if (check.shouldOpen) {
  // ✅ 开仓条件合理
} else {
  // ⚠️ 不建议开仓（止损距离过大/波动极端等）
}
```

**用途：** 开仓前检查止损合理性，过滤不佳的交易机会

---

## 📊 监控和检查

### 查看日志

```bash
# 查看止损相关日志
tail -f logs/combined.log | grep "止损"

# 查看止损单创建
grep "止损单已创建" logs/combined.log

# 查看止损单更新
grep "止损已上移" logs/combined.log
```

### 查看数据库

```sql
-- 查看持仓的止损设置
SELECT symbol, side, entry_price, stop_loss, profit_target
FROM positions
WHERE quantity != 0;
```

---

## ⚠️ 注意事项

### 1. 止损单类型

- **Gate.io：** 使用条件单（Price Triggered Orders）
- **Binance：** 使用 STOP_MARKET 订单

两者都是**市价条件单**，触发后立即以市价平仓。

### 2. 触发价格

- **Gate.io：** 使用最新成交价触发
- **Binance：** 使用标记价格触发（避免插针）

### 3. 止损单可能失效的情况

- 网络问题导致订单未成功创建
- 交易所维护期间
- 持仓被手动平仓后止损单仍存在

**建议：** 每个周期检查止损单状态，确保有效

```typescript
const orders = await exchangeClient.getPositionStopLossOrders("BTC_USDT");
if (!orders.stopLossOrder) {
  console.warn("⚠️ 止损单不存在，请重新设置");
}
```

### 4. 滑点风险

止损触发后是**市价平仓**，可能存在滑点：

- 低流动性时段：滑点可能较大
- 剧烈波动时：可能跳空超过止损价

**建议：** 避免在低流动性时段开仓（如凌晨）

---

## 🎓 最佳实践

### 1. 开仓前检查

```typescript
// ✅ 推荐：完整流程
const check = await checkOpenPosition("BTC", "long", 50000);
if (check.shouldOpen) {
  await openPosition("BTC", "long", 10, 100);
}

// ❌ 不推荐：跳过检查
await openPosition("BTC", "long", 10, 100);
```

### 2. 定期上移止损

```typescript
// 每小时检查一次持仓
// 如果盈利 > 3%，考虑上移止损
if (pnl > 3) {
  const update = await updateTrailingStop({...});
  if (update.shouldUpdate) {
    await updatePositionStopLoss({...});
  }
}
```

### 3. 监控止损单状态

```typescript
// 每个周期检查止损单是否仍然有效
const orders = await exchangeClient.getPositionStopLossOrders(contract);
if (!orders.stopLossOrder && position.quantity !== 0) {
  // 止损单丢失，重新设置
  await updatePositionStopLoss({
    symbol: position.symbol,
    stopLoss: position.stopLoss
  });
}
```

---

## 🚨 故障排查

### 问题 1：止损单未创建

**现象：** 开仓成功，但日志显示"设置止损单失败"

**原因：**

- 交易所 API 限流
- 网络问题
- 交易所维护

**解决：**

- 下个周期手动调用 `updatePositionStopLoss` 补设止损
- 检查交易所 API 状态
- 检查网络连接

### 问题 2：止损单被自动取消

**现象：** 止损单突然消失

**原因：**

- 持仓被部分平仓（止损单针对整个仓位）
- 交易所系统问题
- 手动取消了订单

**解决：**

- 重新设置止损单
- 检查交易所公告

### 问题 3：止损未触发

**现象：** 价格已跌破止损位，但仓位仍在

**原因：**

- 使用的触发价格类型不同（最新价 vs 标记价）
- 止损单状态异常
- 交易所延迟

**解决：**

- 手动平仓
- 查看止损单状态
- 联系交易所客服

---

## 📈 效果评估

### 预期改进

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| 止损响应时间 | 平均 10 分钟 | < 1 秒 |
| 最大回撤 | 可能超过预期 | 严格控制在止损位 |
| 盈利保护 | 等待下个周期 | 立即保护 |
| 系统稳定性 | 依赖本地程序 | 交易所服务器保障 |

### 监控指标

```bash
# 止损触发率
grep "触发止损" logs/combined.log | wc -l

# 止损单创建成功率
created=$(grep "止损单已创建" logs/combined.log | wc -l)
failed=$(grep "设置止损单失败" logs/combined.log | wc -l)
echo "成功率: $(echo "scale=2; $created * 100 / ($created + $failed)" | bc)%"

# 平均止损距离
grep "止损距离" logs/combined.log | awk '{print $NF}' | sed 's/%//' | awk '{sum+=$1; n++} END {print sum/n "%"}'
```

---

## 🎉 总结

### 核心改进

✅ **解决了 20 分钟循环间隔的问题**  
✅ **止损在交易所服务器端执行，即时响应**  
✅ **程序崩溃也不影响止损**  
✅ **支持动态调整止损位**  
✅ **完全兼容 Gate.io 和 Binance**  

### 下一步

1. ✅ 启用科学止损：`ENABLE_SCIENTIFIC_STOP_LOSS=true`
2. ✅ 启动系统：`npm start`
3. ✅ 观察日志：检查止损单是否正常创建
4. ✅ 测试移动止损：盈利后上移止损
5. ✅ 监控效果：统计止损触发率和保护效果

---

**记住：止损是交易的生命线，现在它不再受 20 分钟限制了！** 🛡️✨
