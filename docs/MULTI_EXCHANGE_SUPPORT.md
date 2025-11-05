# 多交易所支持文档

## 概述

ai-auto-trading 系统现已支持 **Gate.io** 和 **Binance** 两大主流交易所，实现了完整的多交易所架构，可以通过环境变量轻松切换。

## 支持的交易所

### Gate.io

- **合约类型**：币本位反向合约（BTC_USD）
- **计价单位**：张（每张对应固定美元价值）
- **保证金**：以币种本身计价（如 BTC 合约用 BTC 做保证金）
- **盈亏计算**：币本位，盈亏以币种计算
- **测试网**：<https://testnet.gate.com/>
- **正式网**：<https://www.gate.io/>

### Binance

- **合约类型**：USDT本位正向合约（BTCUSDT）
- **计价单位**：个（直接以币种数量计价）
- **保证金**：以 USDT 计价
- **盈亏计算**：USDT本位，盈亏以 USDT 计算
- **测试网**：<https://testnet.binancefuture.com/>
- **正式网**：<https://www.binance.com/>

## 快速切换交易所

### 方法 1：使用 setup.sh 脚本（推荐）

```bash
bash scripts/setup.sh
```

脚本会引导您：

1. 选择交易所（Gate.io / Binance）
2. 输入对应的 API Key 和 Secret
3. 选择测试网/正式网
4. 配置其他参数

### 方法 2：手动修改 .env 文件

```env
# 修改 EXCHANGE_NAME 为 gate 或 binance
EXCHANGE_NAME=binance

# 配置对应交易所的 API 密钥
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
BINANCE_USE_TESTNET=true
```

## 架构设计

### 统一接口（IExchangeClient）

系统通过 `IExchangeClient` 接口定义了统一的交易所操作规范：

```typescript
interface IExchangeClient {
  // 基础信息
  getContractType(): 'inverse' | 'linear';
  normalizeContract(symbol: string): string;
  extractSymbol(contract: string): string;

  // 市场数据
  getFuturesTicker(contract: string): Promise<TickerInfo>;
  getFuturesCandles(contract: string, interval: string, limit: number): Promise<CandleData[]>;
  getFundingRate(contract: string): Promise<{ rate: number; nextFundingTime: Date }>;

  // 账户信息
  getFuturesAccount(): Promise<AccountInfo>;
  getPositions(): Promise<PositionInfo[]>;

  // 交易执行
  placeOrder(params: OrderParams): Promise<OrderResponse>;
  closePosition(contract: string, size?: number): Promise<void>;
  setLeverage(contract: string, leverage: number): Promise<void>;

  // 计算方法（自动适配不同计价方式）
  calculateQuantity(symbol: string, price: number, usdt: number, leverage: number): number;
  calculatePnl(position: PositionInfo, currentPrice: number): number;
}
```

### 自动适配机制

#### 1. 合约格式适配

```typescript
// Gate.io: BTC → BTC_USD
gateClient.normalizeContract('BTC') // 返回 'BTC_USD'

// Binance: BTC → BTCUSDT  
binanceClient.normalizeContract('BTC') // 返回 'BTCUSDT'
```

#### 2. 数量计算适配

**Gate.io（币本位）：**

```typescript
// 公式：张数 = (保证金金额 * 杠杆 * 当前价格²) / 合约面值
// 例：10 USDT，10倍杠杆，BTC 价格 100,000，合约面值 100 USD
const quantity = (10 * 10 * 100000 * 100000) / 100
// = 100,000,000 张
```

**Binance（USDT本位）：**

```typescript
// 公式：数量 = (保证金金额 * 杠杆) / 当前价格
// 例：10 USDT，10倍杠杆，BTC 价格 100,000
const quantity = (10 * 10) / 100000
// = 0.001 BTC
```

#### 3. 盈亏计算适配

**Gate.io（币本位）：**

```typescript
// 做多盈亏 = 合约数量 * 合约面值 * (1/开仓价格 - 1/当前价格)
// 做空盈亏 = 合约数量 * 合约面值 * (1/当前价格 - 1/开仓价格)
```

**Binance（USDT本位）：**

```typescript
// 做多盈亏 = 持仓数量 * (当前价格 - 开仓价格)
// 做空盈亏 = 持仓数量 * (开仓价格 - 当前价格)
```

## 配置说明

### 环境变量

```env
# ============================================
# 交易所选择
# ============================================
# 可选值：gate 或 binance
EXCHANGE_NAME=gate

# ============================================
# Gate.io 配置（当 EXCHANGE_NAME=gate 时必需）
# ============================================
GATE_API_KEY=your_gate_api_key
GATE_API_SECRET=your_gate_api_secret
GATE_USE_TESTNET=true

# ============================================
# Binance 配置（当 EXCHANGE_NAME=binance 时必需）
# ============================================
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
BINANCE_USE_TESTNET=true

# ============================================
# 通用交易配置
# ============================================
TRADING_INTERVAL_MINUTES=5
MAX_LEVERAGE=10
INITIAL_BALANCE=1000
```

## 功能兼容性

| 功能 | Gate.io | Binance | 说明 |
|------|---------|---------|------|
| 市场行情 | ✅ | ✅ | 实时价格、K线数据 |
| 账户查询 | ✅ | ✅ | 余额、保证金、可用资金 |
| 持仓管理 | ✅ | ✅ | 查询持仓、平仓 |
| 开仓交易 | ✅ | ✅ | 做多、做空 |
| 杠杆设置 | ✅ | ✅ | 1-125倍（具体限制由交易所决定） |
| 资金费率 | ✅ | ✅ | 查询资金费率和下次结算时间 |
| 止损止盈 | ✅ | ✅ | 自动风控机制 |
| 历史订单 | ✅ | ✅ | 查询历史交易记录 |

## 实现文件清单

### 核心交易所实现

- `src/exchanges/IExchangeClient.ts` - 统一接口定义
- `src/exchanges/GateExchangeClient.ts` - Gate.io 实现
- `src/exchanges/BinanceExchangeClient.ts` - Binance 实现
- `src/exchanges/ExchangeFactory.ts` - 工厂模式，根据配置创建客户端
- `src/exchanges/index.ts` - 模块导出

### 交易执行层

- `src/tools/trading/tradeExecution.ts` - 交易执行工具（已适配）
- `src/scheduler/tradingLoop.ts` - 交易主循环（已适配）
- `src/agents/tradingAgent.ts` - AI 交易代理（已适配）

### 数据层

- `src/database/init.ts` - 数据库初始化（已适配）
- `src/database/close-and-reset.ts` - 清仓重置（已适配）
- `src/database/sync-from-gate.ts` - 从交易所同步（已改名并适配）
- `scripts/fix-historical-pnl.ts` - 历史盈亏修复（已适配）

### API 层

- `src/api/routes.ts` - HTTP API 路由（已适配）

### Shell 工具

- `scripts/setup.sh` - 环境配置向导（已适配）
- `scripts/query-contracts.sh` - 查询合约信息（已适配）
- `reset.sh` - 数据库重置（已适配）
- `reset-and-start.sh` - 重置并启动（已适配）

## 测试建议

### 1. 测试网验证

**Gate.io 测试网：**

```bash
# .env 配置
EXCHANGE_NAME=gate
GATE_USE_TESTNET=true
GATE_API_KEY=your_testnet_key
GATE_API_SECRET=your_testnet_secret

# 启动系统
npm run trading:start
```

**Binance 测试网：**

```bash
# .env 配置
EXCHANGE_NAME=binance
BINANCE_USE_TESTNET=true
BINANCE_API_KEY=your_testnet_key
BINANCE_API_SECRET=your_testnet_secret

# 启动系统
npm run trading:start
```

### 2. 验证要点

- [ ] 账户余额显示正确
- [ ] 合约格式转换正确（BTC_USD vs BTCUSDT）
- [ ] 开仓数量计算正确
- [ ] 盈亏计算准确
- [ ] 手续费扣除正确
- [ ] 持仓查询完整
- [ ] 平仓操作成功
- [ ] 资金费率查询正确
- [ ] 日志显示清晰（无硬编码）

### 3. 小额实盘测试

在测试网验证通过后，建议：

1. 使用小额资金（如 10-50 USDT）
2. 设置较低杠杆（如 2-3倍）
3. 限制持仓数量（如 1-2个）
4. 观察 24-48 小时
5. 验证所有功能正常

## 常见问题

### Q: 如何切换交易所？

A: 修改 `.env` 文件中的 `EXCHANGE_NAME`，设置对应交易所的 API 密钥，然后重启系统。

### Q: Gate.io 和 Binance 可以同时使用吗？

A: 当前版本不支持同时使用多个交易所，但可以通过配置文件快速切换。

### Q: 合约格式为什么不同？

A: Gate.io 使用币本位反向合约（如 BTC_USD），Binance 使用 USDT本位正向合约（如 BTCUSDT）。系统会自动处理这些差异。

### Q: 盈亏计算有什么区别？

A:

- **Gate.io（币本位）**：盈亏以币种计算（如 BTC），然后按实时价格转换为 USDT
- **Binance（USDT本位）**：盈亏直接以 USDT 计算

系统已自动适配这两种方式。

### Q: 杠杆倍数限制？

A: 不同交易所、不同币种的杠杆限制不同：

- **Gate.io**：一般支持 1-125倍（部分币种可能更低）
- **Binance**：一般支持 1-125倍（部分币种可能更低）

建议根据风险承受能力设置合理杠杆（推荐 5-10倍）。

### Q: 手续费有差异吗？

A: 是的，不同交易所的手续费率不同，且会根据您的 VIP 等级调整。系统会自动读取实际手续费率进行计算。

## 风险提示

⚠️ **重要提示**

1. **务必先在测试网测试**：确保系统在您的账户配置下运行正常
2. **小额试运行**：正式网环境先用小额资金测试 24-48 小时
3. **监控日志**：注意观察系统日志，确保没有错误或异常
4. **API 权限**：确保 API Key 只开启必要的交易权限，禁用提币权限
5. **备份配置**：建议保存好配置文件和日志，便于问题排查

## 技术支持

如遇到问题，请：

1. 查看系统日志（`logs/` 目录）
2. 检查环境变量配置（`.env` 文件）
3. 查阅完整文档（`docs/` 目录）
4. 提交 Issue 到 GitHub

## 相关文档

- [合约计价差异说明](./CONTRACT_PRICING_DIFFERENCE.md)
- [完整修复报告](./COMPLETE_FIX_REPORT.md)
- [测试清单](./TEST_CHECKLIST.md)
- [项目 README](../README.md)

---

**更新时间**: 2025-01-XX  
**版本**: 2.0 Multi-Exchange
