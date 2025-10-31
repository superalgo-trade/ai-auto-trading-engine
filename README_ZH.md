# open-nof1.ai

<div align="center">

[![VoltAgent](https://img.shields.io/badge/Framework-VoltAgent-purple.svg)](https://voltagent.dev)
[![OpenAI Compatible](https://img.shields.io/badge/AI-OpenAI_Compatible-orange.svg)](https://openrouter.ai)
[![Gate.io](https://img.shields.io/badge/Exchange-Gate.io-00D4AA.svg)](https://www.gate.io)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Runtime-Node.js%2020+-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

| [English](./README.md) | [简体中文](./README_ZH.md) | [日本語](./README_JA.md) |
|:---:|:---:|:---:|

</div>

## 系统概述

open-nof1.ai 是一个 AI 驱动的加密货币自动交易系统，将大语言模型智能与量化交易实践深度融合。系统基于 Agent 框架构建，通过赋予 AI 完全的市场分析和交易决策自主权，实现真正的智能化交易。

本系统采用**最小人工干预**的设计理念，摒弃传统的硬编码交易规则，让 AI 模型基于原始市场数据进行自主学习和决策。系统集成 Gate.io 交易所（支持测试网和正式网），提供完整的永续合约交易能力，覆盖 BTC、ETH、SOL 等主流加密货币，支持从数据采集、智能分析、风险管理到交易执行的全流程自动化。

![open-nof1.ai](./public/image.png)

## 目录

- [系统概述](#系统概述)
- [系统架构](#系统架构)
- [核心特性](#核心特性)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [配置说明](#配置说明)
- [命令参考](#命令参考)
- [生产部署](#生产部署)
- [故障排查](#故障排查)
- [开发指南](#开发指南)
- [API 文档](#api-文档)
- [参与贡献](#参与贡献)
- [开源协议](#开源协议)

## 系统架构

```
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

| 组件 | 技术 | 用途 |
|------|------|------|
| 框架 | [VoltAgent](https://voltagent.dev) | AI Agent 编排与管理 |
| AI 提供商 | OpenAI 兼容 API | 支持 OpenRouter、OpenAI、DeepSeek 等兼容供应商 |
| 交易所 | [Gate.io](https://www.gate.io) | 加密货币交易(测试网 & 正式网) |
| 数据库 | LibSQL (SQLite) | 本地数据持久化 |
| Web 服务器 | Hono | 高性能 HTTP 框架 |
| 开发语言 | TypeScript | 类型安全开发 |
| 运行时 | Node.js 20+ | JavaScript 运行环境 |

### 核心设计理念

- **数据驱动**: 向 AI 提供原始市场数据，不进行预处理或添加主观判断
- **自主决策**: AI 拥有完全的分析和交易决策权限，无硬编码策略限制
- **多维度分析**: 聚合多时间框架数据(5分钟、15分钟、1小时、4小时)提供全面市场视图
- **透明可追溯**: 完整记录每一次决策过程，便于回测分析和策略优化
- **持续学习**: 系统自动积累交易经验，不断优化决策模型

## 核心特性

### AI 驱动决策

- **模型支持**: DeepSeek V3.2、Grok4、Claude 4.5、Gemini Pro 2.5
- **数据输入**: 实时价格、成交量、K线形态、技术指标
- **自主分析**: 无预配置交易信号
- **多时间框架**: 跨多个时间窗口聚合数据
- **风险管理**: AI 控制的仓位规模和杠杆管理

### 完整交易功能

- **支持资产**: BTC、ETH、SOL、BNB、XRP、DOGE、GT、TRUMP、ADA、WLFI
- **合约类型**: USDT 结算永续合约
- **杠杆范围**: 1倍至10倍(可配置)
- **订单类型**: 市价单、止损、止盈
- **持仓方向**: 做多和做空
- **实时执行**: 通过 Gate.io API 亚秒级下单

### 实时监控界面

- **Web 仪表板**: 访问地址 `http://localhost:3100`
- **账户指标**: 余额、净值、未实现盈亏
- **持仓概览**: 当前持仓、入场价格、杠杆倍数
- **交易历史**: 完整的交易记录与时间戳
- **AI 决策日志**: 透明展示模型推理过程
- **技术指标**: 市场数据和信号的可视化

### 风险管理系统

- **自动止损**: 可配置的百分比止损
- **止盈订单**: 自动利润兑现
- **仓位限制**: 每个资产的最大敞口
- **杠杆控制**: 可配置的最大杠杆
- **交易节流**: 交易之间的最小间隔
- **审计追踪**: 完整的数据库日志记录

### 生产就绪部署

- **测试网支持**: 零风险策略验证
- **进程管理**: PM2 集成确保可靠性
- **容器化**: Docker 支持隔离部署
- **自动恢复**: 失败时自动重启
- **日志记录**: 全面的错误和信息日志
- **健康监控**: 内置健康检查端点

## 快速开始

### 前置要求

- Node.js >= 20.19.0
- npm 或 pnpm 包管理器
- Git 版本控制工具

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd open-nof1.ai

# 安装依赖
npm install
```

### 配置

在项目根目录创建 `.env` 文件:

```env
# 服务器配置
PORT=3100

# 交易参数
TRADING_INTERVAL_MINUTES=5      # 交易循环间隔
MAX_LEVERAGE=10                 # 最大杠杆倍数
INITIAL_BALANCE=2000            # 初始资金(USDT)

# 数据库
DATABASE_URL=file:./.voltagent/trading.db

# Gate.io API 凭证(建议先使用测试网!)
GATE_API_KEY=your_api_key_here
GATE_API_SECRET=your_api_secret_here
GATE_USE_TESTNET=true

# AI 模型提供商（OpenAI 兼容 API）
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://openrouter.ai/api/v1  # 可选，支持 OpenRouter、OpenAI、DeepSeek 等
AI_MODEL_NAME=deepseek/deepseek-v3.2-exp      # 模型名称
```

**API 密钥获取**:
- OpenRouter: https://openrouter.ai/keys
- OpenAI: https://platform.openai.com/api-keys
- DeepSeek: https://platform.deepseek.com/api_keys
- Gate.io 测试网: https://www.gate.io/testnet
- Gate.io 正式网: https://www.gate.io/myaccount/api_key_manage

### 数据库初始化

```bash
npm run db:init
```

### 启动交易系统

```bash
# 开发模式(热重载)
npm run dev

# 生产模式
npm run trading:start
```

### 访问 Web 仪表板

在浏览器中访问 `http://localhost:3100`

## 项目结构

```
open-nof1.ai/
├── src/
│   ├── index.ts                      # 应用入口
│   ├── agents/
│   │   └── tradingAgent.ts           # AI 交易 Agent 实现
│   ├── api/
│   │   └── routes.ts                 # 监控界面 HTTP API 端点
│   ├── database/
│   │   ├── init.ts                   # 数据库初始化逻辑
│   │   ├── schema.ts                 # 数据库模式定义
│   │   └── sync-from-gate.ts         # 交易所数据同步
│   ├── scheduler/
│   │   └── tradingLoop.ts            # 交易循环编排
│   ├── services/
│   │   ├── gateClient.ts             # Gate.io API 客户端封装
│   │   └── multiTimeframeAnalysis.ts # 多时间框架数据聚合器
│   ├── tools/
│   │   └── trading/                  # VoltAgent 工具实现
│   │       ├── accountManagement.ts  # 账户查询与管理
│   │       ├── marketData.ts         # 市场数据获取
│   │       └── tradeExecution.ts     # 订单下达与管理
│   ├── types/
│   │   └── gate.d.ts                 # TypeScript 类型定义
│   └── utils/
│       └── timeUtils.ts              # 时间/日期工具函数
├── public/                           # Web 仪表板静态文件
│   ├── index.html                    # 仪表板 HTML
│   ├── app.js                        # 仪表板 JavaScript
│   └── style.css                     # 仪表板样式
├── scripts/                          # 运维脚本
│   ├── init-db.sh                    # 数据库设置脚本
│   ├── kill-port.sh                  # 服务关闭脚本
│   └── sync-from-gate.sh             # 数据同步脚本
├── .env                              # 环境配置
├── .voltagent/                       # 数据存储目录
│   └── trading.db                    # SQLite 数据库文件
├── ecosystem.config.cjs              # PM2 进程配置
├── package.json                      # Node.js 依赖
├── tsconfig.json                     # TypeScript 配置
└── Dockerfile                        # 容器构建定义
```

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 | 是否必需 |
|------|------|--------|---------|
| `PORT` | HTTP 服务器端口 | 3100 | 否 |
| `TRADING_INTERVAL_MINUTES` | 交易循环间隔(分钟) | 5 | 否 |
| `MAX_LEVERAGE` | 最大杠杆倍数 | 10 | 否 |
| `INITIAL_BALANCE` | 初始资金(USDT) | 2000 | 否 |
| `DATABASE_URL` | SQLite 数据库文件路径 | file:./.voltagent/trading.db | 否 |
| `GATE_API_KEY` | Gate.io API 密钥 | - | 是 |
| `GATE_API_SECRET` | Gate.io API 密钥 | - | 是 |
| `GATE_USE_TESTNET` | 使用测试网环境 | true | 否 |
| `OPENAI_API_KEY` | OpenAI 兼容的 API 密钥 | - | 是 |
| `OPENAI_BASE_URL` | API 基础地址 | https://openrouter.ai/api/v1 | 否 |
| `AI_MODEL_NAME` | 模型名称 | deepseek/deepseek-v3.2-exp | 否 |

### AI 模型配置

系统支持任何兼容 OpenAI API 的供应商：

**OpenRouter** (推荐，支持多种模型):
```bash
OPENAI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL_NAME=deepseek/deepseek-v3.2-exp  # 或 x-ai/grok-4-fast, anthropic/claude-4.5-sonnet
```

**OpenAI**:
```bash
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MODEL_NAME=gpt-4o  # 或 gpt-4o-mini
```

**DeepSeek**:
```bash
OPENAI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL_NAME=deepseek-chat  # 或 deepseek-coder
```

支持的模型（通过不同供应商）:
- `deepseek/deepseek-v3.2-exp` - 高性价比，推荐
- `x-ai/grok-4-fast` - 快速响应
- `openai/gpt-4o` - 高质量推理
- `anthropic/claude-4.5-sonnet` - 强大的分析能力
- `google/gemini-pro-2.5` - 多模态支持

要更换模型,请修改 `src/agents/tradingAgent.ts` 中的配置。

## 命令参考

### 开发

```bash
# 开发模式(热重载)
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 自动修复代码问题
npm run lint:fix
```

### 交易系统操作

```bash
# 启动交易系统
npm run trading:start

# 停止交易系统
npm run trading:stop

# 重启交易系统
npm run trading:restart
```

### 数据库管理

```bash
# 初始化数据库结构
npm run db:init

# 重置数据库(清空所有数据)
npm run db:reset

# 平仓并重置数据库(先平仓所有持仓，再重置数据库)
npm run db:close-and-reset

# 检查数据库状态
npm run db:status

# 从 Gate.io 同步数据
npm run db:sync

# 同步持仓数据
npm run db:sync-positions
```

### Docker 容器管理

```bash
# 使用快速启动脚本（推荐）
npm run docker:start

# 停止容器
npm run docker:stop

# 查看日志
npm run docker:logs

# 构建镜像
npm run docker:build

# 使用 Docker Compose
npm run docker:up          # 启动开发环境
npm run docker:down        # 停止开发环境
npm run docker:restart     # 重启容器

# 生产环境
npm run docker:prod:up     # 启动生产环境
npm run docker:prod:down   # 停止生产环境
```

### PM2 进程管理

```bash
# 启动守护进程
npm run pm2:start

# 以开发模式启动
npm run pm2:start:dev

# 停止进程
npm run pm2:stop

# 重启进程
npm run pm2:restart

# 查看日志
npm run pm2:logs

# 实时监控
npm run pm2:monit

# 列出所有进程
npm run pm2:list

# 删除进程
npm run pm2:delete
```

### 构建与生产

```bash
# 构建生产版本
npm run build

# 运行生产构建
npm start
```

## 生产部署

### PM2 部署(推荐)

PM2 为长时间运行的 Node.js 应用提供强大的进程管理。

**安装和设置**:

```bash
# 1. 全局安装 PM2
npm install -g pm2

# 2. 启动应用
npm run pm2:start

# 3. 启用开机自启
pm2 startup
pm2 save

# 4. 监控日志
npm run pm2:logs
```

**PM2 配置** (`ecosystem.config.cjs`):

```javascript
module.exports = {
  apps: [
    {
      name: 'open-nof1.ai',
      script: 'tsx',
      args: '--env-file=.env ./src',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Shanghai'
      }
    }
  ]
};
```

### Docker 部署

**构建和运行**:

```bash
# 构建 Docker 镜像
docker build -t open-nof1.ai:latest .

# 运行容器
docker run -d \
  --name open-nof1.ai \
  -p 3100:3100 \
  --env-file .env \
  --restart unless-stopped \
  -v ./voltagent-data:/app/.voltagent \
  -v ./logs:/app/logs \
  open-nof1.ai:latest

# 查看日志
docker logs -f open-nof1.ai

# 停止容器
docker stop open-nof1.ai

# 删除容器
docker rm open-nof1.ai
```

**Docker Compose**(推荐):

```bash
# 使用快速启动脚本
./scripts/docker-start.sh

# 或手动使用 Docker Compose
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

## 故障排查

### 常见问题

#### 数据库锁定

**错误**: `database is locked`

**解决方案**:
```bash
# 停止所有运行实例
npm run trading:stop
# 或强制终止
pkill -f "tsx"

# 删除数据库锁文件
rm -f .voltagent/trading.db-shm
rm -f .voltagent/trading.db-wal

# 重启
npm run trading:start
```

#### API 凭证未配置

**错误**: `GATE_API_KEY and GATE_API_SECRET must be set in environment variables`

**解决方案**:
```bash
# 验证 .env 文件
cat .env | grep GATE_API

# 编辑配置
nano .env
```

#### 端口被占用

**错误**: `EADDRINUSE: address already in use :::3100`

**解决方案**:
```bash
# 方法 1: 使用停止脚本
npm run trading:stop

# 方法 2: 手动终止进程
lsof -ti:3100 | xargs kill -9

# 方法 3: 在 .env 中更改端口
# 设置 PORT=3200
```

#### 技术指标返回零

**原因**: K线数据格式不匹配

**解决方案**:
```bash
# 拉取最新更新
git pull

# 重新安装依赖
npm install

# 重启系统
npm run trading:restart
```

#### AI 模型 API 错误

**错误**: `OpenAI API error` 或连接失败

**解决方案**:
- 验证 `OPENAI_API_KEY` 是否正确
- 确认 `OPENAI_BASE_URL` 配置正确
  - OpenRouter: `https://openrouter.ai/api/v1`
  - OpenAI: `https://api.openai.com/v1`
  - DeepSeek: `https://api.deepseek.com/v1`
- 确保 API 密钥有足够额度
- 检查网络连接和防火墙设置
- 验证对应服务商的服务状态

### 日志记录

```bash
# 查看实时终端日志
npm run trading:start

# 查看 PM2 日志
npm run pm2:logs

# 查看历史日志文件
tail -f logs/trading-$(date +%Y-%m-%d).log

# 查看 PM2 错误日志
tail -f logs/pm2-error.log
```

### 数据库检查

```bash
# 检查数据库状态
npm run db:status

# 进入 SQLite 交互模式
sqlite3 .voltagent/trading.db

# SQLite 命令
.tables                      # 列出所有表
.schema account_history      # 查看表结构
SELECT * FROM account_history ORDER BY timestamp DESC LIMIT 10;
.exit                        # 退出 SQLite
```

## API 文档

### REST API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/account` | GET | 当前账户状态和余额 |
| `/api/positions` | GET | 活跃持仓 |
| `/api/trades` | GET | 交易历史 |
| `/api/decisions` | GET | AI 决策日志 |
| `/api/health` | GET | 系统健康检查 |

### WebSocket 支持

实时数据流支持:
- 账户更新
- 持仓变化
- 新交易执行
- AI 决策事件

## 最佳实践

### 测试网测试

**重要**: 正式网部署前务必在测试网充分测试。

```bash
# 在 .env 中配置
GATE_USE_TESTNET=true
```

测试网优势:
- 使用虚拟资金零金融风险
- 完整模拟真实交易环境
- 验证 AI 策略有效性
- 在各种条件下测试系统可靠性

### 资金管理

切换到正式网时:
- 使用最小资金启动(建议: 100-500 USDT)
- 监控几天的表现
- 根据验证结果逐步扩大资金规模
- 设置合适的止损百分比

### 定期备份

```bash
# 备份数据库
cp .voltagent/trading.db .voltagent/trading.db.backup-$(date +%Y%m%d)

# 自动备份脚本
#!/bin/bash
backup_dir="backups"
mkdir -p $backup_dir
cp .voltagent/trading.db "$backup_dir/trading-$(date +%Y%m%d-%H%M%S).db"
```

### 监控与调整

- 定期查看 Web 仪表板指标
- 分析 AI 决策日志中的模式
- 监控错误日志和系统告警
- 根据市场条件调整参数

### 风险控制

- 设置保守的最大杠杆(建议: 3-5倍)
- 定义每笔交易的最大仓位规模
- 跨多个资产分散投资
- 避免在极端市场波动期间交易

### 切换到正式网

**警告**: 正式网部署前确保已完成彻底的测试网验证。

```bash
# 1. 停止系统
# 按 Ctrl+C

# 2. 编辑 .env 文件
nano .env

# 3. 更新配置
GATE_USE_TESTNET=false
GATE_API_KEY=your_mainnet_api_key
GATE_API_SECRET=your_mainnet_api_secret

# 4. 重启系统
npm run trading:start
```

## 资源

### 外部链接

- [VoltAgent 文档](https://voltagent.dev/docs/)
- [OpenRouter 模型目录](https://openrouter.ai/models)
- [OpenAI API 参考](https://platform.openai.com/docs/api-reference)
- [DeepSeek API 文档](https://platform.deepseek.com/api-docs/)
- [Gate.io API 参考](https://www.gate.io/docs/developers/apiv4/)
- [Gate.io 测试网](https://www.gate.io/testnet)

## 风险声明

**本系统仅供教育和研究目的。加密货币交易具有重大风险,可能导致资金损失。**

- 务必先在测试网测试策略
- 仅投资您能承受损失的资金
- 理解并接受所有交易风险
- AI 决策不保证盈利
- 用户对所有交易活动承担全部责任
- 系统性能不提供任何保证或担保
- 过往表现不代表未来结果

## 开源协议

本项目采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 协议。

### 主要条款

- **免费使用**: 您可以出于任何目的使用本软件
- **开源要求**: 任何修改或衍生作品必须在 AGPL-3.0 下发布
- **网络使用**: 如果您通过网络提供本软件服务,必须公开源代码
- **无担保**: 软件按"原样"提供,不提供任何形式的担保

完整条款请参见 [LICENSE](./LICENSE) 文件。

### 为什么选择 AGPL-3.0?

我们选择 AGPL-3.0 以确保:
- 交易社区从所有改进中受益
- 金融软件的透明度
- 防止专有分支
- 保护用户自由

## 参与贡献

欢迎贡献!请遵循以下指南:

### 报告问题

- 使用 GitHub Issues 报告 bug 和功能请求
- 提供详细的重现步骤
- 包含系统信息和日志
- 创建新问题前检查是否已存在相同问题

### Pull Request

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改时遵循 [Conventional Commits](https://www.conventionalcommits.org/)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

### 代码规范

- 遵循现有的 TypeScript 代码风格
- 为新功能添加测试
- 根据需要更新文档
- 确保所有测试通过
- 提交前运行 linter

### 提交信息规范

遵循 Conventional Commits 规范:

```
<类型>[可选 范围]: <描述>

[可选 正文]

[可选 脚注]
```

类型:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `style`: 代码样式变更(格式化等)
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试添加或修改
- `chore`: 构建过程或辅助工具变更
- `ci`: CI/CD 配置变更

---
<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=195440/open-nof1.ai&type=Date)](https://star-history.com/#195440/open-nof1.ai&Date)

</div>
