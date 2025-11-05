# 交易所合约计价差异说明

**创建时间**: 2025-01-XX  
**重要性**: 🔴 **极高** - 直接影响保证金计算和盈亏计算

---

## 🚨 重要发现

在修复硬编码合约格式的过程中，发现了一个**关键的架构问题**：

**Gate.io 和 Binance 使用完全不同的合约计价方式！**

---

## 📊 合约计价方式对比

### Gate.io - 币本位反向合约 (Coin-Margined / Inverse)

#### 特点

- **计价单位**: 币（如 BTC, ETH）
- **张数定义**: 1张 = 固定数量的币
  - BTC: 1张 = 0.0001 BTC
  - ETH: 1张 = 0.01 ETH
  - SOL: 1张 = 1 SOL
  
#### 计算公式

**保证金计算**:

```typescript
保证金 = (张数 × quantoMultiplier × 价格) / 杠杆
```

**示例**:

```typescript
开仓 100张 BTC, 价格 50000 USDT, 10x杠杆
保证金 = (100 × 0.0001 × 50000) / 10 = 50 USDT
```

**盈亏计算**:

```typescript
做多盈亏 = (平仓价 - 开仓价) × 张数 × quantoMultiplier
做空盈亏 = (开仓价 - 平仓价) × 张数 × quantoMultiplier
```

---

### Binance - USDT本位正向合约 (USDT-Margined / Linear)

特点

- **计价单位**: USDT
- **数量定义**: 直接以 USDT 名义价值表示
- **没有"张数"概念**: 数量 = 合约数量（coins）

计算公式

**保证金计算**:

```typescript
保证金 = 名义价值 / 杠杆
名义价值 = 数量 × 价格
```

**示例**:

```typescript
开仓 0.01 BTC, 价格 50000 USDT, 10x杠杆
名义价值 = 0.01 × 50000 = 500 USDT
保证金 = 500 / 10 = 50 USDT
```

**盈亏计算**:

```typescript
做多盈亏 = (平仓价 - 开仓价) × 数量
做空盈亏 = (开仓价 - 平仓价) × 数量
```

---

## ⚠️ 当前代码的问题

### 问题 1: tradeExecution.ts 中的计算假设

**当前代码** (line 298-313):

```typescript
// Gate.io 永续合约的保证金计算
// 注意：Gate.io 使用"张数"作为单位，每张合约代表一定数量的币
// 对于 BTC_USDT: 1张 = 0.0001 BTC
// 保证金计算：保证金 = (张数 * quantoMultiplier * 价格) / 杠杆

// 获取合约乘数
const quantoMultiplier = await getQuantoMultiplier(contract);
const minSize = contractInfo.orderSizeMin || 1;
const maxSize = contractInfo.orderSizeMax || 1000000;

// 计算可以开多少张合约
// adjustedAmountUsdt = (quantity * quantoMultiplier * currentPrice) / leverage
// => quantity = (adjustedAmountUsdt * leverage) / (quantoMultiplier * currentPrice)
let quantity = (adjustedAmountUsdt * leverage) / (quantoMultiplier * currentPrice);

// 向下取整到整数张数（合约必须是整数）
quantity = Math.floor(quantity);
```

**问题**: 这个计算逻辑**仅适用于 Gate.io**！

对于 Binance:

- ❌ 不应该有 quantoMultiplier 参与计算
- ❌ 数量不需要向下取整到整数
- ❌ 应该直接计算币的数量

### 问题 2: 盈亏计算假设

**当前代码** (多处):

```typescript
// 盈亏 = 价格变化 × 张数 × quantoMultiplier
const grossPnl = priceChange * quantity * quantoMultiplier;
```

**问题**: 对于 Binance, 不需要 quantoMultiplier

正确的 Binance 盈亏:

```typescript
// 盈亏 = 价格变化 × 数量（直接是币的数量）
const grossPnl = priceChange * quantity;
```

---

## 🔧 解决方案

### 方案 1: 在 IExchangeClient 接口中添加计价类型标识

```typescript
export interface IExchangeClient {
  // ...existing methods...
  
  /**
   * 获取合约计价类型
   * @returns 'inverse' = 反向合约(币本位), 'linear' = 正向合约(USDT本位)
   */
  getContractType(): 'inverse' | 'linear';
  
  /**
   * 计算开仓所需数量
   * @param amountUsdt 保证金金额 (USDT)
   * @param price 当前价格
   * @param leverage 杠杆倍数
   * @returns 数量（Gate.io=张数, Binance=币数量）
   */
  calculateQuantity(amountUsdt: number, price: number, leverage: number, contract: string): Promise<number>;
  
  /**
   * 计算盈亏
   * @param entryPrice 开仓价
   * @param exitPrice 平仓价
   * @param quantity 数量
   * @param side 方向
   * @param contract 合约名称
   * @returns 盈亏 (USDT)
   */
  calculatePnl(entryPrice: number, exitPrice: number, quantity: number, side: 'long' | 'short', contract: string): Promise<number>;
}
```

### 方案 2: 在各个 Client 中实现专用方法

#### GateExchangeClient

```typescript
export class GateExchangeClient implements IExchangeClient {
  getContractType(): 'inverse' | 'linear' {
    return 'inverse';
  }
  
  async calculateQuantity(amountUsdt: number, price: number, leverage: number, contract: string): Promise<number> {
    const quantoMultiplier = await getQuantoMultiplier(contract);
    // Gate.io: quantity = (amountUsdt * leverage) / (quantoMultiplier * price)
    let quantity = (amountUsdt * leverage) / (quantoMultiplier * price);
    return Math.floor(quantity); // 向下取整到整数张数
  }
  
  async calculatePnl(entryPrice: number, exitPrice: number, quantity: number, side: 'long' | 'short', contract: string): Promise<number> {
    const quantoMultiplier = await getQuantoMultiplier(contract);
    const priceChange = side === 'long' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
    return priceChange * quantity * quantoMultiplier;
  }
}
```

#### BinanceExchangeClient

```typescript
export class BinanceExchangeClient implements IExchangeClient {
  getContractType(): 'inverse' | 'linear' {
    return 'linear';
  }
  
  async calculateQuantity(amountUsdt: number, price: number, leverage: number, contract: string): Promise<number> {
    // Binance: 名义价值 = amountUsdt * leverage
    // 数量(币) = 名义价值 / price
    const notionalValue = amountUsdt * leverage;
    return notionalValue / price; // 保留小数，Binance 支持小数数量
  }
  
  async calculatePnl(entryPrice: number, exitPrice: number, quantity: number, side: 'long' | 'short', contract: string): Promise<number> {
    const priceChange = side === 'long' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
    return priceChange * quantity; // 直接计算，不需要 quantoMultiplier
  }
}
```

### 方案 3: 修改 tradeExecution.ts

```typescript
// 修改前
let quantity = (adjustedAmountUsdt * leverage) / (quantoMultiplier * currentPrice);
quantity = Math.floor(quantity);

// 修改后
let quantity = await exchangeClient.calculateQuantity(adjustedAmountUsdt, currentPrice, leverage, contract);
```

```typescript
// 修改前
const grossPnl = priceChange * quantity * quantoMultiplier;

// 修改后
const grossPnl = await exchangeClient.calculatePnl(entryPrice, exitPrice, quantity, side, contract);
```

---

## 📋 需要修改的文件

### 高优先级（直接影响交易）

✅ **src/exchanges/IExchangeClient.ts**

- 添加 `getContractType()` 方法
- 添加 `calculateQuantity()` 方法
- 添加 `calculatePnl()` 方法

✅ **src/exchanges/GateExchangeClient.ts**

- 实现新方法（反向合约逻辑）

✅ **src/exchanges/BinanceExchangeClient.ts**

- 实现新方法（正向合约逻辑）

✅ **src/tools/trading/tradeExecution.ts**

- 修改开仓计算逻辑（约10处）
- 修改平仓盈亏计算（约5处）

✅ **src/scheduler/tradingLoop.ts**

- 修改盈亏修复逻辑
- 修改持仓风控计算

### 中优先级（数据一致性）

⚠️ **src/database/sync-from-exchanges.ts**

- 修改持仓同步逻辑

⚠️ **src/database/close-and-reset.ts**

- 修改平仓逻辑

⚠️ **scripts/fix-historical-pnl.ts**

- 修改历史盈亏修复

---

## 🧪 测试验证

### 测试用例 1: Gate.io 开仓

```typescript
// 输入
amountUsdt = 50
price = 50000
leverage = 10
contract = "BTC_USDT"

// Gate.io (quantoMultiplier = 0.0001)
quantity = (50 * 10) / (0.0001 * 50000) = 100 张
保证金 = 50 USDT
```

### 测试用例 2: Binance 开仓

```typescript
// 输入
amountUsdt = 50
price = 50000
leverage = 10
contract = "BTC/USDT:USDT"

// Binance
notionalValue = 50 * 10 = 500 USDT
quantity = 500 / 50000 = 0.01 BTC
保证金 = 50 USDT
```

### 测试用例 3: 盈亏计算

```typescript
// 做多 BTC, 开仓 50000, 平仓 51000

// Gate.io (100张)
pnl = (51000 - 50000) * 100 * 0.0001 = 10 USDT

// Binance (0.01 BTC)
pnl = (51000 - 50000) * 0.01 = 10 USDT
```

---

## ⏰ 实施优先级

### 🔴 P0 - 立即修复（阻塞 Binance 使用）

- 添加接口方法
- 实现 Gate.io 方法（保持现有逻辑）
- 实现 Binance 方法（新逻辑）
- 修改 tradeExecution.ts

### 🟡 P1 - 尽快修复（数据一致性）

- 修改 tradingLoop.ts
- 修改数据库脚本

### 🟢 P2 - 后续优化

- 添加单元测试
- 添加集成测试
- 更新文档

---

## 📚 参考文档

### Gate.io

- [永续合约API](https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%B0%B8%E7%BB%AD%E5%90%88%E7%BA%A6-futures)
- [合约规格](https://www.gate.io/help/futures/perpetual/21765)

### Binance

- [USDT-M 永续合约](https://binance-docs.github.io/apidocs/futures/en/)
- [合约规格](https://www.binance.com/en/futures/trading-rules/perpetual)

---

## ✅ 建议行动

1. **立即**: 添加新的接口方法到 IExchangeClient
2. **立即**: 在 GateExchangeClient 中实现（封装现有逻辑）
3. **立即**: 在 BinanceExchangeClient 中实现（新逻辑）
4. **今日**: 修改 tradeExecution.ts 使用新方法
5. **明日**: 修改其他受影响文件
6. **测试**: 在测试网验证 Gate.io 功能不受影响
7. **测试**: 在测试网验证 Binance 功能正常

---

## 🎯 结论

这是一个**架构级别的问题**，必须在支持 Binance 之前解决。

当前代码假设所有交易所都使用 Gate.io 的反向合约模式，这对 Binance 的 USDT-M 合约是完全错误的。

**不修复此问题，Binance 交易将会**:

- ❌ 计算错误的开仓数量
- ❌ 计算错误的保证金
- ❌ 计算错误的盈亏
- ❌ 可能导致爆仓或资金损失

**修复后**:

- ✅ 支持两种合约计价模式
- ✅ 正确计算保证金和盈亏
- ✅ 可以安全使用 Binance
- ✅ 易于扩展其他交易所
