# 条件单管理修复总结

## 修复日期

2025-01-XX

## 问题描述

### 问题1：前端显示所有条件单（包括已取消的）

**现象**：监控界面的"止盈止损"标签显示了所有状态的条件单，包括已取消的订单。

**期望**：只显示活跃（active）的条件单。

### 问题2：平仓时未取消交易所的条件单

**现象**：平仓时只更新了数据库，但没有调用交易所 API 取消条件单，导致交易所后台仍有挂单。

**期望**：平仓时必须同时取消交易所的条件单，并更新数据库。

---

## 修复内容

### 1. 后端逻辑修复（`src/tools/trading/tradeExecution.ts`）

#### 修复点1：统一使用 `cancelPositionStopLoss` 方法

**位置**：`closePositionTool` 函数，第 1091-1113 行

**修复前**：

- 只更新数据库，不调用交易所 API
- 或者逐个取消订单（效率低且容易遗漏）

**修复后**：

```typescript
// 🔥 关键修复：平仓时必须取消交易所的所有条件单
try {
  const cancelResult = await exchangeClient.cancelPositionStopLoss(contract);
  if (cancelResult.success) {
    logger.info(`✅ 已取消 ${symbol} 在交易所的所有止损止盈订单`);
    
    // 更新数据库中该币种所有活跃条件单的状态为 cancelled
    const now = new Date().toISOString();
    await dbClient.execute({
      sql: `UPDATE price_orders 
            SET status = 'cancelled', updated_at = ?
            WHERE symbol = ? AND status = 'active'`,
      args: [now, symbol]
    });
    logger.info(`✅ 已更新数据库中 ${symbol} 的条件单状态`);
  }
} catch (cancelError: any) {
  logger.error(`❌ 取消条件单异常: ${cancelError.message}`);
}
```

**关键改进**：

- ✅ 统一使用 `exchangeClient.cancelPositionStopLoss(contract)` 方法
- ✅ 一次性取消该币种的所有条件单（止损 + 止盈）
- ✅ 同时更新数据库中的订单状态
- ✅ 兼容 Binance 和 Gate.io

#### 修复点2：清理语法错误

**位置**：第 1156-1162 行

**修复前**：

```typescript
await Promise.allSettled(cancelPromises).catch(() => {
  })()
);

await Promise.all(cancelPromises);  // 重复且变量作用域错误
```

**修复后**：

```typescript
await Promise.allSettled(cancelPromises);
```

---

### 2. 前端显示修复（`public/monitor-script.js`）

#### 修复点1：只显示活跃订单

**位置**：`loadPriceOrdersData` 函数，第 278 行

```javascript
// 只显示活跃的条件单
const activeOrders = data.priceOrders.filter(order => order.status === 'active');
```

#### 修复点2：添加当前价格列

**位置**：第 342-344 行

```javascript
// 获取当前价格
const currentPrice = this.cryptoPrices.get(group.symbol);
const currentPriceText = currentPrice ? 
    `$${formatPriceBySymbol(group.symbol, currentPrice)}` : '--';
```

#### 修复点3：合并止损和止盈到一行

**位置**：第 285-310 行

```javascript
// 按币种和方向分组，合并止损和止盈
const groupedOrders = {};

activeOrders.forEach(order => {
    const key = `${order.symbol}_${order.side}_${order.status}`;
    
    if (!groupedOrders[key]) {
        groupedOrders[key] = {
            symbol: order.symbol,
            side: order.side,
            status: order.status,
            quantity: order.quantity,
            created_at: order.created_at,
            stopLoss: null,
            takeProfit: null
        };
    }
    
    if (order.type === 'stop_loss') {
        groupedOrders[key].stopLoss = order.trigger_price;
    } else if (order.type === 'take_profit') {
        groupedOrders[key].takeProfit = order.trigger_price;
    }
});
```

---

## 测试要点

### 测试场景1：开仓后检查条件单

1. 确保 `ENABLE_SCIENTIFIC_STOP_LOSS=true`
2. 开仓一个新持仓
3. 检查：
   - ✅ 前端"止盈止损"标签显示 1 个持仓（2 个订单）
   - ✅ 表格显示 1 行，包含止损和止盈价格
   - ✅ 当前价格列显示实时价格
   - ✅ 数据库 `price_orders` 表有 2 条 `status='active'` 记录
   - ✅ 交易所后台有 2 个挂单（可通过交易所 UI 验证）

### 测试场景2：平仓后检查条件单清理

1. 平仓一个持仓（100% 平仓）
2. 检查：
   - ✅ 前端"止盈止损"标签显示 0 个持仓
   - ✅ 表格为空或显示"暂无条件单"
   - ✅ 数据库 `price_orders` 表该币种的订单状态变为 `cancelled`
   - ✅ 交易所后台该币种的挂单已全部取消
   - ✅ 日志显示：`✅ 已取消 XXX 在交易所的所有止损止盈订单`

### 测试场景3：多持仓混合测试

1. 开仓 3 个不同币种
2. 平仓其中 1 个
3. 检查：
   - ✅ 前端显示 2 个持仓（4 个活跃订单）
   - ✅ 已平仓币种的订单不显示
   - ✅ 数据库只有 4 条 `status='active'` 记录
   - ✅ 交易所只有 4 个挂单

### 测试场景4：部分平仓测试

1. 开仓 1 个持仓
2. 部分平仓（50%）
3. 检查：
   - ✅ 前端仍显示该持仓的条件单
   - ✅ 条件单数量字段更新为剩余数量
   - ✅ 交易所挂单仍存在

---

## 验证命令

### 1. 检查数据库状态

```bash
# 查看所有条件单
sqlite3 .voltagent/trading.db "SELECT symbol, side, type, status, trigger_price FROM price_orders ORDER BY created_at DESC LIMIT 10;"

# 查看活跃条件单
sqlite3 .voltagent/trading.db "SELECT symbol, side, type, status, trigger_price FROM price_orders WHERE status='active';"
```

### 2. 检查日志

```bash
# 查看最近的平仓日志
tail -100 logs/combined.log | grep -E "(平仓|取消条件单|cancelPositionStopLoss)"
```

### 3. 检查 TypeScript 编译

```bash
npx tsc --noEmit
```

---

## 兼容性说明

### Binance

- ✅ 使用 `cancelAllOpenOrders` API
- ✅ 正向合约（USDT 本位）
- ✅ 统一接口 `cancelPositionStopLoss`

### Gate.io

- ✅ 使用 `cancel_price_triggered_order_list` API
- ✅ 反向合约（币本位）
- ✅ 统一接口 `cancelPositionStopLoss`

---

## 相关文件

### 修改的文件

- `src/tools/trading/tradeExecution.ts` - 后端平仓逻辑
- `public/monitor-script.js` - 前端显示逻辑
- `public/monitor-styles.css` - 样式调整

### 涉及的交易所接口

- `src/exchanges/IExchangeClient.ts` - 统一接口定义
- `src/exchanges/BinanceExchangeClient.ts` - Binance 实现
- `src/exchanges/GateExchangeClient.ts` - Gate.io 实现

### 数据库表

- `price_orders` - 条件单记录表
  - `status`: 'active' | 'triggered' | 'cancelled'
  - `type`: 'stop_loss' | 'take_profit'

---

## 注意事项

1. **幂等性**：取消操作是幂等的，重复取消不会报错
2. **异常处理**：即使取消失败，也会记录日志但不阻塞平仓流程
3. **双重保险**：先使用批量取消 API，再逐个检查数据库中的订单 ID
4. **前端过滤**：前端只显示 `status='active'` 的订单，不依赖后端过滤
5. **实时价格**：从持仓数据中提取当前价格，每 3 秒更新一次

---

## 未来改进建议

1. **增加同步任务**：定期从交易所同步条件单状态，确保数据库与交易所一致
2. **增加手动取消**：前端添加"取消"按钮，允许手动取消条件单
3. **增加历史记录**：保留已取消订单的历史，用于回溯分析
4. **增加告警**：如果取消失败，发送告警通知

---

## 测试结果

**日期**：待填写  
**测试人员**：待填写  
**环境**：生产环境 / 测试环境  
**交易所**：Binance / Gate.io  

| 测试场景 | 结果 | 备注 |
|---------|------|------|
| 开仓后条件单创建 | ⬜ | |
| 平仓后条件单取消 | ⬜ | |
| 前端只显示活跃订单 | ⬜ | |
| 当前价格显示 | ⬜ | |
| 多持仓混合测试 | ⬜ | |
| 部分平仓测试 | ⬜ | |

---

**修复完成** ✅
