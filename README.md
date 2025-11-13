# 灵枢量化 | NexusQuant

> **AI 驱动的多策略、多时间框架加密货币交易监控系统**
> 
> **Cryptocurrency Trading Monitor - AI-Driven Multi-Strategy, Multi-Timeframe System**

<div align="center">

[![VoltAgent](https://img.shields.io/badge/Framework-VoltAgent-purple.svg)](https://voltagent.dev)
[![OpenAI Compatible](https://img.shields.io/badge/AI-OpenAI_Compatible-orange.svg)](https://openrouter.ai)
[![Gate.io](https://img.shields.io/badge/Exchange-Gate.io-00D4AA.svg)](https://www.gatesite.org/signup/VQBEAwgL?ref_type=103)
[![Binance](https://img.shields.io/badge/Exchange-Binance-F0B90B.svg)](https://www.maxweb.red/referral/earn-together/refer2earn-usdc/claim?hl=zh-CN&ref=GRO_28502_NCRQJ&utm_source=default)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Runtime-Node.js%2020+-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

| [English](./README_EN.md) | [简体中文](./README_ZH.md) | [日本語](./README_JA.md) |
|:---:|:---:|:---:|

</div>

## 系统概述

**灵枢量化（NexusQuant）** 是新一代 AI 驱动的加密货币自动交易系统，通过深度融合大语言模型与机构级交易实践，从根本上重新定义了量化交易。

### 🎯 核心理念

**AI 优先**：系统将 AI 视为自主交易代理，赋予其对市场分析、策略选择、持仓管理和风险控制的完全决策权。

**自适应智能**：通过市场状态识别引擎（8种市场状态）、动态策略路由器和智能机会评分系统，实现真正的市场适应性。

**专业风控**：ATR 自适应止损、R-Multiple 分批止盈、服务器端条件单保护、数据库事务回滚机制。

![ai-auto-trading](./public/image.png)

## 🚀 核心竞争力

### 1. **状态自适应开仓系统**

自动识别 8 种市场状态（上涨趋势超卖、下跌趋势超买、趋势延续、震荡超买超卖等），智能路由到最优策略，避免假突破，捕捉趋势反转。

### 2. **科学止损系统**

- 基于 ATR 动态计算止损位
- 服务器端执行，程序崩溃也有效
- 开仓前验证止损空间
- 智能追踪，只向有利方向移动

### 3. **R-Multiple 分批止盈**

专业风险倍数思维，自动化分批止盈（2R、3R、5R），每次部分止盈后自动移动止损到保本或更高。

### 4. **事务完整性保护**

数据库事务回滚机制、不一致状态记录、幂等性保护，确保交易所与数据库数据完全一致。

### 5. **智能机会评分**

多因子量化评分（信号强度40%、风险回报25%、市场条件20%、持仓相关性15%），只开高分交易。

### 6. **系统健康监控**

实时三色健康指示（🟢🟡🔴）、自动化健康检查、孤儿订单检测清理、主动告警。

## 系统架构

```bash
┌─────────────────────────────────────────────────────────┐
│                   Trading Agent (AI)                    │
│              (DeepSeek V3.2 / Gork4 / Claude)           │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├─── Market Data Analysis
                  ├─── Position Management
                  └─── Trade Execution Decisions
                  
┌─────────────────┴───────────────────────────────────────┐
│                    VoltAgent Core                       │
│              (Agent Orchestration & Tool Routing)       │
└─────────┬───────────────────────────────────┬───────────┘
          │                                   │
┌─────────┴──────────┐            ┌───────────┴───────────┐
│    Trading Tools   │            │   Gate.io API Client  │
│                    │            │                       │
│ - Market Data      │◄───────────┤ - Order Management    │
│ - Account Info     │            │ - Position Query      │
│ - Trade Execution  │            │ - Market Data Stream  │
└─────────┬──────────┘            └───────────────────────┘
          │
┌─────────┴──────────┐
│   LibSQL Database  │
│                    │
│ - Account History  │
│ - Trade Signals    │
│ - Agent Decisions  │
└────────────────────┘
```

### 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | [VoltAgent](https://voltagent.dev) | AI Agent 编排与工具调用 |
| AI 模型 | OpenAI 兼容 API | DeepSeek V3.2, Grok 4, Claude 4.5, Gemini 2.5 等 |
| 交易所 | [Gate.io](https://www.gatesite.org/signup/VQBEAwgL?ref_type=103) / [Binance](https://www.maxweb.red/referral/earn-together/refer2earn-usdc/claim?hl=zh-CN&ref=GRO_28502_NCRQJ&utm_source=default) | 永续合约交易（测试网 & 正式网） |
| 数据库 | LibSQL (SQLite) | 本地数据持久化 |
| Web 服务 | Hono | 高性能监控界面 |
| 语言 | TypeScript | 类型安全开发 |
| 运行时 | Node.js 20.19+ | JavaScript 运行环境 |

## 快速开始

### 第一步：选择并注册交易所账户

本项目支持 **Gate.io** 和 **Binance** 两大交易所。请根据您的需求选择：

#### 选项 A：Gate.io（推荐用于测试）

- [立即注册 Gate.io](https://www.gatesite.org/signup/VQBEAwgL?ref_type=103)
- 邀请码：`VQBEAwgL`
- 优势：完善的测试网环境，适合新手学习

#### 选项 B：Binance（全球最大交易所）

- [立即注册 Binance](https://www.maxweb.red/referral/earn-together/refer2earn-usdc/claim?hl=zh-CN&ref=GRO_28502_NCRQJ&utm_source=default)
- 优势：交易量大、流动性好、支持测试网

```bash
> **新手建议**：先使用测试网环境学习，零风险体验完整功能。
> - Gate.io 测试网: https://testnet.gate.com/
> - Binance 测试网: https://testnet.binancefuture.com/
```

### 第二步：环境准备

- Node.js >= 20.19.0
- npm 或 pnpm 包管理器
- Git 版本控制工具

### 第三步：安装项目

```bash
# 克隆仓库
git clone <repository-url>
cd ai-auto-trading

# 安装依赖
npm install
```

### 第四步：配置

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
nano .env
```

关键配置项：

```env
# 服务器
PORT=3100

# 交易配置
TRADING_INTERVAL_MINUTES=5                   # 交易周期（分钟）
TRADING_STRATEGY=balanced                    # 策略：ultra-short/swing-trend/conservative/balanced/aggressive
TRADING_SYMBOLS=BTC,ETH,SOL,BNB,XRP          # 交易币种（逗号分隔）
MAX_LEVERAGE=15                              # 最大杠杆
MAX_POSITIONS=5                              # 最大持仓数
INITIAL_BALANCE=1000                         # 初始资金
ACCOUNT_STOP_LOSS_USDT=50                    # 止损线
ACCOUNT_TAKE_PROFIT_USDT=20000               # 止盈线

# 科学止损系统（推荐开启）
ENABLE_SCIENTIFIC_STOP_LOSS=true             # 启用科学止损
ENABLE_TRAILING_STOP_LOSS=true               # 启用追踪止损
ENABLE_STOP_LOSS_FILTER=true                 # 启用开仓过滤

# 交易所选择（gate 或 binance）
EXCHANGE_NAME=gate

# Gate.io 配置（当 EXCHANGE_NAME=gate 时必需）
GATE_API_KEY=your_api_key_here
GATE_API_SECRET=your_api_secret_here
GATE_USE_TESTNET=true

# Binance 配置（当 EXCHANGE_NAME=binance 时必需）
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
BINANCE_USE_TESTNET=true

# AI 模型（OpenAI 兼容）
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL_NAME=deepseek/deepseek-v3.2-exp
```

**API 密钥获取**：

**AI 模型：**

- OpenRouter: <https://openrouter.ai/keys>
- OpenAI: <https://platform.openai.com/api-keys>
- DeepSeek: <https://platform.deepseek.com/api_keys>

**交易所：**

- Gate.io 测试网: <https://www.gate.io/testnet>
- Gate.io 正式网: <https://www.gatesite.org/signup/VQBEAwgL?ref_type=103> （邀请码 `VQBEAwgL` 可获返佣）
- Binance 测试网: <https://testnet.binancefuture.com/>
- Binance 正式网: <https://www.maxweb.red/referral/earn-together/refer2earn-usdc/claim?hl=zh-CN&ref=GRO_28502_NCRQJ&utm_source=default>

### 第五步：数据库初始化

```bash
npm run db:init
```

### 第六步：启动交易系统

```bash
# 开发模式(热重载)
npm run dev

# 生产模式
npm run trading:start
```

### 第七步：访问监控界面

浏览器打开：<http://localhost:3100>

## 完整文档

查看详细文档：

- **[英文完整文档](./README_EN.md)** - Complete documentation
- **[中文完整文档](./README_ZH.md)** - 完整功能列表、配置指南、故障排查
- **[日文完整文档](./README_JA.md)** - 完全なドキュメント

### 文档内容

- ✅ 5种交易策略详解
- ✅ 完整配置指南
- ✅ 所有命令参考
- ✅ PM2/Docker 部署
- ✅ 故障排查
- ✅ API 文档

## 核心特性

### 🤖 AI 驱动决策

**多模型支持**：

- DeepSeek V3.2、Grok 4、Claude 4.5、Gemini 2.5 等
- 透明的决策推理过程记录
- 支持自定义提示工程

**上下文化分析**：

- 实时价格、成交量、K线形态
- 技术指标（RSI、MACD、布林带、ATR）
- 多时间框架（5m、15m、1h、4h）
- 持仓盈亏和风险敞口
- 历史交易和绩效指标

**5 种交易策略**：

| 策略 | 月收益目标 | 风险 | 最适场景 |
|------|----------|------|---------|
| 超短线 | 40%+ | 高 | 剥头皮、高频 |
| 波段趋势 | 40%+ | 高 | 捕捉多日趋势 |
| 稳健 | 10-20% | 低 | 资本保值 |
| 平衡 ⭐ | 20-40% | 中 | 推荐使用 |
| 激进 | 40%+ | 高 | 追求最大增长 |

### 💹 专业交易基础设施

**交易所**：

- Gate.io + Binance（统一接口）
- 测试网 & 正式网
- 13+ 主流加密货币
- 1-15倍策略自适应杠杆

**订单执行**：

- 市价单即时执行
- 服务器端条件单（止损/止盈）
- 订单簿深度验证
- 亚秒级下单延迟

### 📊 企业级监控

**实时 Web 仪表板**（`http://localhost:3100`）：

- **账户概览**
  - 当前余额和净值
  - 日/周/总收益率
  - 夏普比率和最大回撤
  
- **活跃持仓**
  - 实时盈亏（未实现 + 已实现）
  - 入场价、当前价、杠杆
  - 持仓时长及警告
  - 止损和止盈水平

- **交易历史**
  - 完整订单日志
  - 胜率和平均 R 倍数
  - 手续费和净利润

- **交易统计与绩效分析** 📈
  - 胜率分析、R倍数分布
  - 盈利因子、策略对比
  - 回撤分析、时间维度分析
  - 币种表现、风险指标
  
  *对交易员的价值*：
  - 识别有效策略
  - 发现盈亏规律
  - 优化仓位大小
  - 及早发现策略退化

- **AI 决策透明度**
  - 完整推理过程
  - 市场状态识别
  - 策略选择理由

- **系统健康状态** 🟢🟡🔴
  - 实时健康指示器
  - 孤儿订单检测
  - 数据一致性检查

### 🛡️ 机构级风险管理

**科学止损系统**：

- ATR 自适应动态计算
- 服务器端执行保护
- 开仓前空间验证
- 智能追踪止损

**R-Multiple 分批止盈**：

- 基于风险倍数（2R、3R、5R）
- 自动执行无需干预
- 每次止盈后移动止损

**传统风控**：

- 单笔止损-30%强制平仓
- 持仓36小时强制平仓
- 峰值回撤保护
- 账户级止损止盈线

## 风险声明

⚠️ **本系统仅供教育和研究目的。加密货币交易具有重大风险,可能导致资金损失。**

- 务必先在测试网测试策略
- 仅投资您能承受损失的资金
- 用户对所有交易活动承担全部责任
- 系统性能不提供任何保证或担保

## 开源协议

本项目采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 协议。

### 主要条款

- **免费使用**: 您可以出于任何目的使用本软件
- **开源要求**: 任何修改必须在 AGPL-3.0 下发布
- **网络使用**: 如果作为服务提供必须公开源代码
- **无担保**: 软件按"原样"提供

完整条款请参见 [LICENSE](./LICENSE) 文件。

## 资源

### 节省交易成本 & 支持项目

✅ 获得交易手续费返佣
✅ 支持开源项目持续开发
✅ 完全免费，无额外费用

**如果您还没有 Gate.io 账户，推荐通过邀请码注册：**

- **邀请链接**：<https://www.gatesite.org/signup/VQBEAwgL?ref_type=103>
- **邀请码**：`VQBEAwgL`

**如果您还没有 Binance 账户，推荐通过邀请码注册：**

- **邀请链接**：<https://www.maxweb.red/referral/earn-together/refer2earn-usdc/claim?hl=zh-CN&ref=GRO_28502_NCRQJ&utm_source=default>
- **邀请码**：`GRO_28502_NCRQJ`

> **提示**：测试网和正式网使用同一账户，建议先在测试网充分测试。使用邀请码注册，您将获得交易返佣优惠，同时帮助维护这个开源项目的长期运营。这对您和项目都有益，且完全免费无任何额外费用。

### 相关链接

- [VoltAgent 文档](https://voltagent.dev/docs/)
- [OpenRouter 模型](https://openrouter.ai/models)
- [Gate.io API 文档](https://www.gate.io/docs/developers/apiv4/)
- [Gate.io 测试网](https://www.gate.io/testnet)

## 参与贡献

欢迎贡献！请参考[完整文档](./README_ZH.md#参与贡献)了解贡献指南。

---

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=losesky/ai-auto-trading&type=Date)](https://star-history.com/#losesky/ai-auto-trading&Date)

</div>
