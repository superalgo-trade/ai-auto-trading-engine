# 多交易所支持更新说明

## ✨ 新功能

ai-auto-trading 现已支持多个交易所！

### 支持的交易所

- ✅ **Gate.io** - USDT 永续合约（测试网 & 正式网）
- ✅ **Binance（币安）** - USDT-M 永续合约（测试网 & 正式网）

### 快速切换

只需在 `.env` 文件中修改一个配置即可切换交易所：

```env
# 使用 Gate.io
EXCHANGE_NAME=gate

# 或使用 Binance
EXCHANGE_NAME=binance
```

## 📖 详细文档

查看完整的多交易所使用指南：[docs/MULTI_EXCHANGE_GUIDE.md](./docs/MULTI_EXCHANGE_GUIDE.md)

包含内容：

- 配置方法
- API 密钥获取
- 功能对比
- 切换步骤
- 故障排查
- 最佳实践

## 🚀 快速开始

### 1. 配置环境变量

编辑 `.env` 文件：

```env
# 选择交易所
EXCHANGE_NAME=gate  # 或 binance

# Gate.io 配置（如果使用 Gate.io）
GATE_API_KEY=your_api_key
GATE_API_SECRET=your_api_secret
GATE_USE_TESTNET=true

# Binance 配置（如果使用 Binance）
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
BINANCE_USE_TESTNET=true
```

### 2. 启动系统

```bash
npm run trading:start
```

系统会自动根据 `EXCHANGE_NAME` 配置连接到相应的交易所。

## 🏗️ 技术架构

### 统一接口设计

```typescript
// 统一的交易所接口
interface IExchangeClient {
  getFuturesTicker(contract: string): Promise<TickerInfo>;
  getPositions(): Promise<PositionInfo[]>;
  placeOrder(params: OrderParams): Promise<OrderResponse>;
  // ... 更多方法
}

// 使用工厂模式创建客户端
const client = getExchangeClient(); // 自动根据环境变量选择
```

### 自动格式转换

系统自动处理不同交易所的合约命名格式：

```typescript
const client = getExchangeClient();

// 自动转换为正确格式
const contract = client.normalizeContract('BTC');
// Gate.io: BTC_USDT
// Binance: BTC/USDT:USDT

// 获取价格
const ticker = await client.getFuturesTicker(contract);
```

## 📊 功能对比

| 功能 | Gate.io | Binance |
|------|---------|---------|
| 永续合约交易 | ✅ | ✅ |
| 测试网支持 | ✅ | ✅ |
| AI 自主决策 | ✅ | ✅ |
| 多时间框架分析 | ✅ | ✅ |
| 智能风控 | ✅ | ✅ |
| 实时监控界面 | ✅ | ✅ |

## ⚠️ 注意事项

1. **测试网优先**：强烈建议先在测试网充分测试
2. **API 权限**：确保 API 密钥有足够权限（读取、交易）
3. **费率差异**：不同交易所手续费率可能不同
4. **数据迁移**：切换交易所前建议重置数据库

## 🔧 代码示例

### 在代码中使用

```typescript
import { getExchangeClient } from './exchanges';

// 获取客户端（自动根据环境变量）
const client = getExchangeClient();

// 统一的 API 调用方式
const account = await client.getFuturesAccount();
const positions = await client.getPositions();
const ticker = await client.getFuturesTicker(
  client.normalizeContract('BTC')
);
```

### 添加新交易所

实现 `IExchangeClient` 接口即可：

```typescript
export class NewExchangeClient implements IExchangeClient {
  // 实现所有必需的方法
  async getFuturesTicker(contract: string) {
    // 具体实现
  }
  // ...
}
```

## 📝 更新日志

### v0.2.0 - 多交易所支持

- ✨ 新增 Binance 交易所支持
- ♻️ 重构交易所客户端为统一接口
- 🏗️ 实现交易所工厂模式
- 📚 添加完整的多交易所使用指南
- 🔧 自动处理不同交易所的合约命名格式

### 文件变更

**新增文件：**

- `src/exchanges/IExchangeClient.ts` - 统一接口定义
- `src/exchanges/GateExchangeClient.ts` - Gate.io 实现
- `src/exchanges/BinanceExchangeClient.ts` - Binance 实现
- `src/exchanges/ExchangeFactory.ts` - 交易所工厂
- `src/exchanges/index.ts` - 模块导出
- `docs/MULTI_EXCHANGE_GUIDE.md` - 使用指南

**更新文件：**

- `src/tools/trading/*.ts` - 使用新的交易所接口
- `src/services/gateClient.ts` - 标记为已弃用（但保持向后兼容）
- `.env.example` - 添加新的环境变量配置
- `.env` - 更新配置示例

## 🤝 贡献

欢迎为项目添加更多交易所支持！

查看 [MULTI_EXCHANGE_GUIDE.md](./docs/MULTI_EXCHANGE_GUIDE.md) 了解如何添加新交易所。

## 📞 支持

- 📖 查看文档：[docs/MULTI_EXCHANGE_GUIDE.md](./docs/MULTI_EXCHANGE_GUIDE.md)
- 🐛 报告问题：[GitHub Issues](https://github.com/yourusername/ai-auto-trading/issues)
- 💬 讨论交流：[GitHub Discussions](https://github.com/yourusername/ai-auto-trading/discussions)

---

**⚠️ 风险提示**：本系统仅供教育和研究目的。加密货币交易具有重大风险，可能导致资金损失。请务必先在测试网充分测试，仅投资您能承受损失的资金。
