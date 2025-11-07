# ai-auto-trading

<div align="center">

[![VoltAgent](https://img.shields.io/badge/Framework-VoltAgent-purple.svg)](https://voltagent.dev)
[![OpenAI Compatible](https://img.shields.io/badge/AI-OpenAI_Compatible-orange.svg)](https://openrouter.ai)
[![Gate.io](https://img.shields.io/badge/Exchange-Gate.io-00D4AA.svg)](https://www.gatesite.org/signup/VQBEAwgL?ref_type=103)
[![Binance](https://img.shields.io/badge/Exchange-Binance-F0B90B.svg)](https://www.binance.com)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Runtime-Node.js%2020+-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

| [English](./README_EN.md) | [简体中文](./README_ZH.md) | [日本語](./README_JA.md) |
|:---:|:---:|:---:|

</div>

## 系统概述

ai-auto-trading 是一个 AI 驱动的加密货币自动交易系统，将大语言模型智能与量化交易实践深度融合。系统基于 VoltAgent 框架构建，通过赋予 AI 完全的市场分析和交易决策自主权，实现真正的智能化交易。

本系统采用**AI 自主决策**的设计理念，摒弃传统的硬编码交易规则，让 AI 模型基于实时市场数据和技术指标进行自主学习和决策。系统集成 **Gate.io** 和 **Binance** 两大主流交易所，支持永续合约交易，覆盖 BTC、ETH、SOL 等主流加密货币。

![ai-auto-trading](./public/image.png)

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
| 交易所 | [Gate.io](https://www.gatesite.org/signup/VQBEAwgL?ref_type=103) / [Binance](https://www.binance.com) | 永续合约交易（测试网 & 正式网） |
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

- [立即注册 Binance](https://www.binance.com)
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
- Binance 正式网: <https://www.binance.com/zh-CN/my/settings/api-management>

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

- **多模型支持**：DeepSeek V3.2、Grok 4、Claude 4.5、Gemini 2.5 等
- **自主分析**：基于实时市场数据和技术指标自主决策
- **多时间框架**：5分钟、15分钟、1小时、4小时多维度分析
- **5种交易策略**：超短线、波段趋势、稳健、平衡、激进

### 💹 完整交易功能

- **支持交易所**：Gate.io、Binance（自动适配合约计价方式）
- **支持币种**：BTC、ETH、SOL、BNB、XRP、DOGE、BCH、HYPE、SUI、ADA、AVAX、LTC、LINK 等
- **合约类型**：永续合约（Gate.io 币本位/Binance USDT本位 自动适配）
- **杠杆范围**：1-15倍（可配置）
- **科学止损系统** ⭐ NEW：基于 ATR 智能计算止损位，服务器端执行，自动保护资金
- **风险管理**：止损、止盈、移动止盈、分批止盈、峰值回撤保护

### 📊 实时监控

- **Web 仪表板**：<http://localhost:3100> 实时监控
- **账户指标**：余额、收益率、夏普比率
- **持仓管理**：实时盈亏、持仓时长、杠杆倍数
- **AI 决策日志**：完整记录每次决策过程

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

如果您还没有 Gate.io 账户，推荐通过邀请码注册：

**注册信息**：

- **邀请链接**：<https://www.gatesite.org/signup/VQBEAwgL?ref_type=103>
- **邀请码**：`VQBEAwgL`

**使用邀请码的好处**：

- ✅ 获得交易手续费返佣
- ✅ 支持开源项目持续开发
- ✅ 完全免费，无额外费用

> **提示**：测试网和正式网使用同一账户，建议先在测试网充分测试。

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
