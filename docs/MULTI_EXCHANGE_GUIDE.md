# 多交易所支持指南

## 概述

ai-auto-trading 现已支持多个交易所，包括：

- **Gate.io**：USDT 永续合约
- **Binance**（币安）：USDT-M 永续合约

通过统一的交易所接口，您可以轻松切换不同的交易所，享受相同的AI自动交易功能。

## 配置方式

### 1. 在 `.env` 文件中配置

#### 使用 Gate.io（默认）

```env
# 交易所选择
EXCHANGE_NAME=gate

# Gate.io 配置
GATE_API_KEY=your_gate_api_key
GATE_API_SECRET=your_gate_api_secret
GATE_USE_TESTNET=true
```

#### 使用 Binance（币安）

```env
# 交易所选择
EXCHANGE_NAME=binance

# Binance 配置
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
BINANCE_USE_TESTNET=true
```

### 2. API 密钥获取

#### Gate.io

- **测试网**: <https://www.gate.io/testnet>
- **正式网**: <https://www.gatesite.org/signup/VQBEAwgL?ref_type=103>
- **邀请码**: `VQBEAwgL`（使用可享返佣）

#### Binance

- **测试网**: <https://testnet.binancefuture.com>
- **正式网**: <https://www.binance.com/register>

## 功能对比

| 功能 | Gate.io | Binance |
|------|---------|---------|
| 永续合约 | ✅ | ✅ |
| 测试网支持 | ✅ | ✅ |
| 市价单/限价单 | ✅ | ✅ |
| 杠杆设置 | ✅ | ✅ |
| 止损止盈 | ✅ | ✅ |
| 资金费率查询 | ✅ | ✅ |
| 历史持仓记录 | ✅ | ⚠️ 有限支持 |
| 结算历史 | ✅ | ⚠️ 有限支持 |

## 合约名称格式

不同交易所使用不同的合约命名格式：

- **Gate.io**: `BTC_USDT`（下划线分隔）
- **Binance**: `BTC/USDT:USDT`（斜杠分隔，带结算货币）

系统会自动处理格式转换，您只需在代码中使用币种符号（如 `BTC`），系统会自动调用 `normalizeContract()` 方法转换为正确的格式。

## 切换交易所步骤

### 方法 1：修改环境变量（推荐）

1. 停止当前运行的系统
2. 编辑 `.env` 文件
3. 修改 `EXCHANGE_NAME` 为目标交易所
4. 配置相应的 API 密钥
5. 重启系统

```bash
# 停止系统
npm run trading:stop

# 编辑配置
nano .env

# 重启系统
npm run trading:start
```

### 方法 2：使用不同的环境文件

创建多个环境文件：

```bash
# Gate.io 配置
.env.gate

# Binance 配置
.env.binance
```

启动时指定环境文件：

```bash
# 使用 Gate.io
tsx --env-file=.env.gate ./src

# 使用 Binance
tsx --env-file=.env.binance ./src
```

## 注意事项

### 1. 测试网测试

⚠️ **强烈建议先在测试网充分测试后再使用正式网！**

```env
# 测试网模式
GATE_USE_TESTNET=true
BINANCE_USE_TESTNET=true
```

### 2. API 权限

确保 API 密钥具有以下权限：

- ✅ 读取账户信息
- ✅ 读取持仓信息
- ✅ 下单权限
- ✅ 取消订单权限
- ❌ 不需要提币权限

### 3. IP 白名单

部分交易所支持 IP 白名单，建议启用以提高安全性。

### 4. 数据库迁移

切换交易所前，建议：

1. 平掉所有持仓
2. 重置数据库
3. 切换交易所
4. 重新开始交易

```bash
# 平仓并重置数据库
npm run db:close-and-reset
```

### 5. 费率差异

不同交易所的手续费率可能不同，建议查看各交易所的费率说明。

## 技术架构

### 统一接口设计

```typescript
// 定义统一接口
interface IExchangeClient {
  getFuturesTicker(contract: string): Promise<TickerInfo>;
  getFuturesCandles(contract: string, interval: string, limit: number): Promise<CandleData[]>;
  getFuturesAccount(): Promise<AccountInfo>;
  getPositions(): Promise<PositionInfo[]>;
  placeOrder(params: OrderParams): Promise<OrderResponse>;
  // ... 更多方法
}

// Gate.io 实现
class GateExchangeClient implements IExchangeClient {
  // 实现具体逻辑
}

// Binance 实现
class BinanceExchangeClient implements IExchangeClient {
  // 实现具体逻辑
}
```

### 工厂模式

```typescript
// 根据配置自动创建客户端
const client = createExchangeClient();

// 或手动指定
const client = createExchangeClient({
  exchangeName: 'binance',
  apiKey: 'xxx',
  apiSecret: 'yyy',
  isTestnet: true
});
```

### 在代码中使用

```typescript
import { getExchangeClient } from '../exchanges';

// 获取客户端（自动根据环境变量选择）
const client = getExchangeClient();

// 标准化合约名称
const contract = client.normalizeContract('BTC'); // Gate: BTC_USDT, Binance: BTC/USDT:USDT

// 获取价格
const ticker = await client.getFuturesTicker(contract);

// 下单
const order = await client.placeOrder({
  contract,
  size: 100,
  price: 50000,
});
```

## 故障排查

### 问题 1：连接失败

**原因**：API 密钥错误或网络问题

**解决**：

1. 检查 API 密钥是否正确
2. 确认网络连接正常
3. 检查是否使用了正确的测试网/正式网地址

### 问题 2：下单失败

**原因**：权限不足或参数错误

**解决**：

1. 确认 API 密钥有下单权限
2. 检查订单参数（数量、价格等）
3. 查看日志获取详细错误信息

### 问题 3：余额不足

**原因**：账户可用余额不足

**解决**：

1. 检查账户余额
2. 调整开仓金额
3. 降低杠杆倍数

## 最佳实践

### 1. 渐进式迁移

```bash
# 第 1 步：在测试网验证 Gate.io
EXCHANGE_NAME=gate
GATE_USE_TESTNET=true

# 第 2 步：在测试网验证 Binance  
EXCHANGE_NAME=binance
BINANCE_USE_TESTNET=true

# 第 3 步：少量资金正式网测试
BINANCE_USE_TESTNET=false
INITIAL_BALANCE=100

# 第 4 步：逐步增加资金
INITIAL_BALANCE=1000
```

### 2. 风险分散

考虑在多个交易所分散运行：

- 服务器1：运行 Gate.io 实例
- 服务器2：运行 Binance 实例
- 分散风险，互为备份

### 3. 监控告警

- 设置余额告警
- 监控 API 调用频率
- 记录异常日志

## 贡献

欢迎为项目添加更多交易所支持！

### 添加新交易所步骤

1. 在 `src/exchanges/` 创建新的客户端类
2. 实现 `IExchangeClient` 接口
3. 在 `ExchangeFactory.ts` 中注册
4. 添加相应的环境变量配置
5. 更新文档

示例代码框架：

```typescript
// src/exchanges/NewExchangeClient.ts
export class NewExchangeClient implements IExchangeClient {
  constructor(config: ExchangeConfig) {
    // 初始化
  }

  normalizeContract(symbol: string): string {
    // 实现合约名称格式化
  }

  async getFuturesTicker(contract: string): Promise<TickerInfo> {
    // 实现获取价格
  }

  // 实现其他方法...
}
```

## 支持

如有问题，请：

1. 查看日志文件：`logs/trading-*.log`
2. 检查环境变量配置
3. 提交 GitHub Issue

---

**注意**：本系统仅供教育和研究目的，交易有风险，投资需谨慎！
