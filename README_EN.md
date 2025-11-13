# NexusQuant | 灵枢量化

> 📖 **Complete Documentation** | This is the full English documentation. For a quick overview, see the [main README](./README.md).
>
> **Cryptocurrency Trading Monitor - AI-Driven Multi-Strategy, Multi-Timeframe System**
>
> **AI 驱动的多策略、多时间框架加密货币交易监控系统**

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

## Overview

**NexusQuant (灵枢量化)** is a next-generation AI-driven cryptocurrency automated trading system that fundamentally reimagines quantitative trading through deep integration of large language models with institutional-grade trading practices. Unlike traditional algorithmic systems with hard-coded strategies, this system achieves **true intelligent autonomy** by leveraging AI's reasoning capabilities for real-time market analysis and adaptive decision-making.

### 🎯 Core Philosophy

**AI-First Approach**: The system treats AI not as a signal generator, but as an autonomous trading agent with complete decision-making authority over market analysis, strategy selection, position management, and risk control.

**Adaptive Intelligence**: Instead of fixed rules that break in changing markets, the system continuously adapts through:

- **Market State Recognition Engine** - Automatically identifies trend/range/reversal patterns across 8 distinct market states
- **Dynamic Strategy Router** - Selects optimal strategies (trend-following, mean-reversion, breakout) based on current conditions
- **Intelligent Opportunity Scoring** - Quantifies and ranks all trading opportunities with multi-factor analysis

**Professional Risk Management**: Implements institutional-grade risk controls:

- **Scientific Stop-Loss System** - ATR-based adaptive stops with support/resistance awareness
- **R-Multiple Partial Profits** - Professional risk-reward ratio based profit-taking
- **Server-Side Protection** - Exchange-hosted conditional orders protect against local failures
- **Transaction Integrity** - Database transaction rollback mechanisms ensure data consistency

![ai-auto-trading](./public/image.png)

## 🚀 What Makes Us Different

### 1. **State-Adaptive Position Opening System** 🎯

Unlike traditional systems that use fixed entry signals, our **Market State Recognition Engine** automatically identifies 8 distinct market states and routes to the optimal strategy:

| Market State | Strategy | Win Condition | Priority |
|-------------|----------|---------------|----------|
| `uptrend_oversold` | Mean Reversion | Pullback in uptrend | ⭐⭐⭐⭐⭐ |
| `downtrend_overbought` | Mean Reversion | Rally in downtrend | ⭐⭐⭐⭐⭐ |
| `uptrend_continuation` | Trend Following | Momentum continuation | ⭐⭐⭐⭐ |
| `downtrend_continuation` | Trend Following | Downtrend persistence | ⭐⭐⭐⭐ |
| `ranging_oversold` | Mean Reversion | Oversold bounce | ⭐⭐⭐ |
| `ranging_overbought` | Mean Reversion | Overbought fade | ⭐⭐⭐ |
| `ranging_neutral` | Wait | No clear edge | ⭐ |
| `no_clear_signal` | Wait | Conflicting signals | ⭐ |

**Key Benefits**:

- ✅ **Avoids false breakouts** in ranging markets
- ✅ **Captures trend reversals** with oversold/overbought detection
- ✅ **Adapts to volatility regimes** automatically
- ✅ **Quantifiable opportunity scoring** for every symbol

**Technical Implementation**:

```typescript
// Market state analyzer combines multiple timeframes
const stateAnalysis = {
  trendStrength: calculateEMATrend(timeframes['1h']),      // EMA20/EMA50 relationship
  overboughtOversold: calculateRSI(timeframes['15m']),     // RSI7/RSI14 levels
  volatilityRegime: calculateATR(timeframes['1h']),        // ATR-based activity
  priceDeviation: calculatePriceDeviation(timeframes),     // Distance from key levels
  multiTimeframeAlignment: checkTimeframeConsistency()     // Cross-timeframe validation
};
```

### 2. **Scientific Stop-Loss System** 🛡️

Most systems use fixed percentage stops. We implement **institutional-grade adaptive stops**:

**ATR-Based Dynamic Calculation**:

- Each strategy has optimal ATR multipliers (ultra-short: 1.5x, swing: 2.5x, conservative: 3.0x)
- Considers support/resistance levels for smarter placement
- Adjusts for high/low volatility regimes automatically

**Server-Side Execution**:

- Stop orders placed on exchange servers (Gate.io Price Triggered Orders, Binance STOP_MARKET)
- Protection persists even if local program crashes
- Zero execution delay when stop is hit

**Pre-Entry Validation**:

```typescript
// Automatically rejects trades with insufficient stop space
const validation = checkOpenPosition({
  symbol: 'BTC',
  side: 'long',
  entryPrice: 50000
});

if (!validation.canOpen) {
  // Trade rejected: "Stop-loss space only 1.2%, minimum required 2.0%"
}
```

**Intelligent Trailing**:

- Only moves stop in favorable direction (long: up only, short: down only)
- Prevents "lowering protection" mistakes
- Recalculates based on current ATR, not entry ATR

### 3. **R-Multiple Partial Profit System** 💰

Professional traders think in **risk multiples (R)**. Our system automates this approach:

**How It Works**:

```typescript
// R = (Current Price - Entry Price) / (Entry Price - Stop Loss)
// Example: Entry $50k, Stop $48k, Current $54k
// R = (54000 - 50000) / (50000 - 48000) = 2R (2x initial risk)

Strategy configurations:
{
  "balanced": {
    "stage1": { "rMultiple": 2, "closePercent": 30 },  // Lock 30% at 2R
    "stage2": { "rMultiple": 3, "closePercent": 50 },  // Lock 50% more at 3R
    "stage3": { "rMultiple": 5, "closePercent": 100 }, // Exit remaining at 5R
    "extremeProfit": 10                                 // Safety net at 10R
  }
}
```

**Advantages Over Fixed Targets**:

- ✅ **Risk-adjusted** - 2R in low volatility = same risk as 1R in high volatility
- ✅ **Strategy-specific** - Aggressive strategies target higher R-multiples
- ✅ **Automatic execution** - AI checks every cycle, no manual intervention
- ✅ **Dynamic stop movement** - After each partial profit, stop moves to breakeven or higher

### 4. **Transaction Integrity Protection** 🔒

Many trading systems suffer from **data inconsistency** between exchange and database. We solve this with:

**Database Transaction Rollback**:

```typescript
await db.transaction(async (tx) => {
  // Step 1: Delete position (MUST be first to avoid false positives)
  await tx.delete(positions).where(eq(positions.symbol, symbol));
  
  // Step 2: Update conditional orders
  await tx.update(priceOrders).set({ status: 'triggered' });
  
  // Step 3: Record close event
  await tx.insert(positionCloseEvents).values({...});
  
  // If ANY step fails, ALL steps rollback
});
```

**Inconsistent State Recording**:

- All operation failures logged to `inconsistent_states` table
- Health monitoring system detects unresolved states
- Web dashboard shows real-time health status (🟢 Normal / 🟡 Warning / 🔴 Critical)

**Idempotency Protection**:

```typescript
// Prevents duplicate trade records
await db.insert(trades).values({...})
  .onConflictDoNothing({ target: [trades.orderId] });
```

### 5. **Intelligent Opportunity Scoring** 📊

Every potential trade receives a **quantitative score** based on:

| Factor | Weight | Example Metrics |
|--------|--------|-----------------|
| Signal Strength | 40% | Trend alignment, momentum, pattern clarity |
| Risk-Reward | 25% | Distance to stop vs. target, R-multiple potential |
| Market Conditions | 20% | Liquidity, volatility regime, time of day |
| Position Correlation | 15% | Existing exposure, symbol correlation |

**Minimum Score Filtering**:

```bash
# Only opens trades scoring above threshold
MIN_OPPORTUNITY_SCORE=60  # Configurable per strategy

# Example scoring breakdown:
BTC Long: 78/100
├─ Signal: 32/40 (strong uptrend, RSI oversold)
├─ R-R: 20/25 (3.5R potential vs 1R risk)
├─ Market: 16/20 (high liquidity, normal volatility)
└─ Correlation: 10/15 (no conflicting positions)
```

### 6. **System Health Monitoring** 🏥

Real-time health dashboard with three states:

- 🟢 **Green (Normal)**: All systems operational
- 🟡 **Yellow (Warning)**: Non-critical issues detected (orphaned orders auto-fixed)
- 🔴 **Red (Critical)**: Serious issues requiring attention (exchange/DB inconsistencies)

**Automated Health Checks**:

- Orphaned conditional orders detection and cleanup
- Exchange ↔ Database position consistency validation
- API connectivity monitoring
- Transaction integrity verification

**Proactive Alerts**:

- Email notifications for critical issues (optional)
- Real-time web dashboard updates every 30 seconds
- Detailed issue breakdown on hover

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## Architecture

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

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | [VoltAgent](https://voltagent.dev) | AI Agent orchestration and management |
| AI Provider | OpenAI Compatible API | Supports OpenRouter, OpenAI, DeepSeek and other compatible providers |
| Exchange | [Gate.io](https://www.gatesite.org/signup/VQBEAwgL?ref_type=103) / [Binance](https://www.maxweb.red/referral/earn-together/refer2earn-usdc/claim?hl=zh-CN&ref=GRO_28502_NCRQJ&utm_source=default) | Cryptocurrency trading (testnet & mainnet) |
| Database | LibSQL (SQLite) | Local data persistence |
| Web Server | Hono | High-performance HTTP framework |
| Language | TypeScript | Type-safe development |
| Runtime | Node.js 20+ | JavaScript runtime |

### Core Design Philosophy

- **AI Autonomous Decision-Making**: AI makes completely autonomous decisions based on real-time market data and technical indicators
- **Multi-Strategy Support**: 5 trading strategies (ultra-short, swing-trend, conservative, balanced, aggressive)
- **Multi-Timeframe Analysis**: Aggregates 5m, 15m, 1h, 4h data for comprehensive market view
- **Intelligent Risk Control**: Stop-loss, take-profit, trailing stops, partial profit-taking, peak drawdown protection
- **Transparent and Traceable**: Complete recording of every decision for backtesting and strategy optimization

## Key Features

### 🤖 AI-Powered Autonomous Trading

**Unlike rule-based bots, our AI truly reasons about the market:**

- **Multi-Model Support**: DeepSeek V3.2, Grok 4, Claude 4.5, Gemini 2.5
  - Models fine-tuned for financial decision-making
  - Transparent reasoning in decision logs
  - Supports custom prompt engineering

- **Contextual Market Analysis**: AI receives comprehensive market context
  - Real-time price, volume, candlestick patterns
  - Technical indicators (RSI, MACD, Bollinger Bands, ATR)
  - Multi-timeframe data (5m, 15m, 1h, 4h)
  - Current position P&L and risk exposure
  - Recent trade history and performance metrics

- **5 Distinct Trading Strategies**: Each with unique risk/reward profiles

| Strategy | Target Monthly Return | Risk Level | Best For |
|----------|----------------------|------------|----------|
| `ultra-short` | 40%+ | High | Scalping, high-frequency opportunities |
| `swing-trend` | 40%+ | High | Capturing multi-day trends |
| `conservative` | 10-20% | Low | Capital preservation priority |
| `balanced` ⭐ | 20-40% | Medium | Risk-reward equilibrium (recommended) |
| `aggressive` | 40%+ | High | Maximum growth, higher drawdowns |

### 💹 Professional Trading Infrastructure

**Exchange Integration**:

- **Dual Exchange Support**: Gate.io + Binance (unified interface)
- **Testnet & Mainnet**: Risk-free testing before live deployment
- **Asset Coverage**: 13+ major cryptocurrencies
  - BTC, ETH, SOL, BNB, XRP, DOGE, BCH, HYPE, SUI, ADA, AVAX, LTC, LINK
- **USDT-Settled Perpetuals**: Simplified margin management
- **Leverage**: 1-15x (strategy-adaptive)

**Order Execution**:

- **Market Orders**: Instant execution for entries/exits
- **Conditional Orders**: Server-side stop-loss and take-profit
  - Gate.io: Price Triggered Orders API
  - Binance: STOP_MARKET / TAKE_PROFIT_MARKET
- **Slippage Protection**: Order book depth validation before execution
- **Low-Latency**: Sub-second order placement

### 📊 Enterprise-Grade Monitoring

**Real-Time Web Dashboard** (`http://localhost:3100`):

- **Account Overview**
  - Current balance and equity
  - Daily/weekly/all-time returns
  - Sharpe ratio and maximum drawdown
  - Peak asset tracking
  
- **Active Positions**
  - Real-time P&L (unrealized + realized)
  - Entry price, current price, leverage
  - Holding duration with time-based warnings
  - Stop-loss and take-profit levels
  - Peak P&L and current drawdown percentage

- **Trading History**
  - Complete order log with timestamps
  - Entry/exit details and profit/loss
  - Win rate and average R-multiple
  - Fee breakdown and net profit

- **Trading Statistics & Performance Analytics** 📈
  - **Win Rate Analysis**: Track success rate across different market conditions
  - **R-Multiple Distribution**: Visualize risk-adjusted returns (how many R's per trade)
  - **Profit Factor**: Gross profit / Gross loss ratio
  - **Average Hold Time**: Identify optimal holding periods
  - **Strategy Performance Comparison**: Compare results across 5 strategies
  - **Drawdown Analysis**: Maximum drawdown, drawdown duration, recovery time
  - **Time-based Performance**: Hourly/daily/weekly profit analysis
  - **Symbol Performance**: Identify which cryptocurrencies perform best
  - **Monthly/Quarterly Reports**: Comprehensive performance summaries
  - **Risk Metrics**: Sharpe ratio, Sortino ratio, Calmar ratio
  
  *Why It Matters for Traders*:
  - Identify which strategies work best in current market conditions
  - Spot patterns in winning/losing trades to improve decision-making
  - Understand true risk-adjusted returns beyond simple P&L
  - Optimize position sizing based on historical performance
  - Detect strategy degradation early and adapt

- **AI Decision Transparency**
  - Full reasoning for each action
  - Market state identification results
  - Strategy selection justification
  - Risk assessment breakdown

- **System Health Status** 🟢🟡🔴
  - Real-time health indicator
  - Orphaned order detection
  - Exchange-DB consistency checks
  - API connectivity monitoring

### 🛡️ Institutional-Grade Risk Management

#### Scientific Stop-Loss System ⭐ NEW

- **Intelligent Stop-Loss Calculation**: Dynamically calculates stop-loss levels based on ATR (Average True Range)
- **Strategy-Adaptive**: Each strategy has independent stop-loss parameters (ultra-short 0.5-3%, swing 1.0-6%, etc.)
- **Server-Side Execution**: Stop-loss orders execute on exchange servers, independent of local program
- **Automatic Protection**: Stop-loss orders trigger automatically even if program crashes
- **Entry Filtering**: Automatically rejects trading opportunities with insufficient stop-loss space
- **Intelligent Trailing Stop**: Recalculates stop-loss based on current price and market volatility, only allowing favorable movement
  - Long positions: New stop-loss must be higher than old stop-loss (stop moves up, protection enhanced)
  - Short positions: New stop-loss must be lower than old stop-loss (stop moves down, protection enhanced)
  - Rejects any operation that reduces protection, ensuring continuous risk control improvement

**Configuration Example**:

```env
ENABLE_SCIENTIFIC_STOP_LOSS=true      # Enable scientific stop-loss
ENABLE_TRAILING_STOP_LOSS=true        # Enable trailing stop-loss
ENABLE_STOP_LOSS_FILTER=true          # Enable entry filtering
```

Detailed Documentation: [Scientific Stop-Loss Quick Start](./docs/STOP_LOSS_QUICK_START.md)

#### Traditional Risk Controls

- **Stop-Loss Protection**: Forced liquidation at -30% loss
- **Time Limits**: Forced closure after 36 hours
- **Trailing Stops**: Automatically raise stop-loss after profit milestones
- **Partial Profit-Taking**: Lock profits in stages to reduce drawdown risk
- **Peak Drawdown Protection**: Auto-close when drawdown exceeds threshold
- **Account Stop-Loss/Take-Profit**: Global account-level stop and profit lines

### Production-Ready Deployment

- **Testnet Support**: Risk-free strategy validation
- **Process Management**: PM2 daemon with auto-restart
- **Containerized Deployment**: Docker/Docker Compose support
- **Complete Logging**: Detailed trade and error logs
- **Data Persistence**: SQLite local database

## Quick Start

### Prerequisites

- Node.js >= 20.19.0
- npm or pnpm package manager
- Git version control

### Installation

```bash
# Clone repository
git clone <repository-url>
cd ai-auto-trading

# Install dependencies
npm install

```

### Configuration

Create `.env` file in project root:

```env
# Server Configuration
PORT=3100

# Trading Configuration
TRADING_INTERVAL_MINUTES=5                   # Trading cycle (minutes)
TRADING_STRATEGY=balanced                    # Strategy: ultra-short/swing-trend/conservative/balanced/aggressive
TRADING_SYMBOLS=BTC,ETH,SOL,BNB,XRP,DOGE,BCH # Trading symbols (comma-separated)
MAX_LEVERAGE=15                              # Maximum leverage
MAX_POSITIONS=5                              # Maximum positions
MAX_HOLDING_HOURS=36                         # Maximum holding time (hours)
INITIAL_BALANCE=1000                         # Initial capital (USDT)
ACCOUNT_STOP_LOSS_USDT=50                    # Account stop-loss line
ACCOUNT_TAKE_PROFIT_USDT=20000               # Account take-profit line

# Scientific Stop-Loss System (Recommended)
ENABLE_SCIENTIFIC_STOP_LOSS=true             # Enable scientific stop-loss
ENABLE_TRAILING_STOP_LOSS=true               # Enable trailing stop-loss
ENABLE_STOP_LOSS_FILTER=true                 # Enable entry filtering

# Database
DATABASE_URL=file:./.voltagent/trading.db

# Gate.io API Credentials (use testnet first!)
GATE_API_KEY=your_api_key_here
GATE_API_SECRET=your_api_secret_here
GATE_USE_TESTNET=true

# AI Model Provider (OpenAI Compatible API)
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://openrouter.ai/api/v1  # Optional, supports OpenRouter, OpenAI, DeepSeek, etc.
AI_MODEL_NAME=deepseek/deepseek-v3.2-exp      # Model name
```

**API Key Acquisition**:

- OpenRouter: <https://openrouter.ai/keys>
- OpenAI: <https://platform.openai.com/api-keys>
- DeepSeek: <https://platform.deepseek.com/api_keys>
- Gate.io Testnet: <https://www.gate.io/testnet>
- Gate.io Mainnet: <https://www.gatesite.org/signup/VQBEAwgL?ref_type=103>

> **Tip**: Use invitation code `VQBEAwgL` to get trading fee rebates.

### Database Initialization

```bash
npm run db:init
```

### Start Trading System

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run trading:start
```

### Access Web Dashboard

Navigate to `http://localhost:3100` in your browser.

## Project Structure

```bash
ai-auto-trading/
├── src/
│   ├── index.ts                      # Application entry point
│   ├── agents/
│   │   └── tradingAgent.ts           # AI trading agent implementation
│   ├── api/
│   │   └── routes.ts                 # HTTP API endpoints for monitoring
│   ├── config/
│   │   └── riskParams.ts             # Risk parameters configuration
│   ├── database/
│   │   ├── init.ts                   # Database initialization logic
│   │   ├── schema.ts                 # Database schema definitions
│   │   ├── sync-from-exchanges.ts    # Exchange data synchronization
│   │   ├── sync-positions-only.ts    # Sync positions only
│   │   └── close-and-reset.ts        # Close positions and reset database
│   ├── exchanges/                    # Exchange clients (unified interface)
│   │   ├── IExchangeClient.ts        # Exchange interface definition
│   │   ├── GateExchangeClient.ts     # Gate.io implementation
│   │   ├── BinanceExchangeClient.ts  # Binance implementation
│   │   ├── ExchangeFactory.ts        # Exchange factory (auto-selection)
│   │   └── index.ts                  # Unified exports
│   ├── scheduler/
│   │   ├── tradingLoop.ts            # Trading cycle orchestration
│   │   └── accountRecorder.ts        # Account state recorder
│   ├── services/
│   │   └── multiTimeframeAnalysis.ts # Multi-timeframe data aggregator
│   ├── tools/
│   │   └── trading/                  # VoltAgent tool implementations
│   │       ├── accountManagement.ts  # Account query and management
│   │       ├── marketData.ts         # Market data retrieval
│   │       ├── tradeExecution.ts     # Order placement and management
│   │       └── index.ts              # Unified tool exports
│   ├── types/
│   │   └── gate.d.ts                 # TypeScript type definitions
│   └── utils/
│       ├── timeUtils.ts              # Time/date utility functions
│       ├── priceFormatter.ts         # Price formatting utilities
│       ├── contractUtils.ts          # Contract utility functions
│       └── index.ts                  # Unified utility exports
├── public/                           # Web dashboard static files
│   ├── index.html                    # Dashboard HTML
│   ├── app.js                        # Dashboard JavaScript
│   ├── style.css                     # Dashboard styles
│   ├── monitor-script.js             # Monitoring scripts
│   ├── monitor-styles.css            # Monitoring styles
│   └── price-formatter.js            # Price formatting
├── scripts/                          # Operational scripts
│   ├── init-db.sh                    # Database initialization script
│   ├── setup.sh                      # Environment setup script
│   ├── sync-from-exchanges.sh        # Sync data from exchanges
│   ├── sync-positions.sh             # Sync positions data
│   ├── close-and-reset.sh            # Close positions and reset
│   ├── db-status.sh                  # Database status check
│   ├── kill-port.sh                  # Service shutdown script
│   ├── docker-start.sh               # Docker start script
│   └── docker-stop.sh                # Docker stop script
├── docs/                             # Project documentation
├── logs/                             # Log files directory
├── .env                              # Environment configuration
├── .env.example                      # Environment configuration example
├── .voltagent/                       # Data storage directory
│   └── trading.db                    # SQLite database file
├── ecosystem.config.cjs              # PM2 process configuration
├── docker-compose.yml                # Docker Compose development config
├── docker-compose.prod.yml           # Docker Compose production config
├── package.json                      # Node.js dependencies
├── tsconfig.json                     # TypeScript configuration
├── tsdown.config.ts                  # Build configuration
└── Dockerfile                        # Container build definition
```

### Core Trading Parameters

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP server port | 3100 | No |
| `TRADING_INTERVAL_MINUTES` | Trading loop interval in minutes | 5 | No |
| `TRADING_STRATEGY` | Active strategy (ultra-short/swing-trend/conservative/balanced/aggressive) | balanced | No |
| `TRADING_SYMBOLS` | Comma-separated list of trading symbols | BTC,ETH,SOL,XRP,BNB,BCH | No |
| `MAX_LEVERAGE` | Maximum leverage multiplier | 15 | No |
| `MAX_POSITIONS` | Maximum number of concurrent positions | 5 | No |
| `MAX_HOLDING_HOURS` | Maximum holding time before forced close | 36 | No |
| `INITIAL_BALANCE` | Initial capital in USDT | 1000 | No |

#### Scientific Stop-Loss Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENABLE_SCIENTIFIC_STOP_LOSS` | Enable ATR-based adaptive stop-loss | false | No |
| `ENABLE_TRAILING_STOP_LOSS` | Enable dynamic stop movement as profit grows | false | No |
| `ENABLE_STOP_LOSS_FILTER` | Reject trades with insufficient stop-loss space | false | No |

**Recommended Configuration**:

```env
ENABLE_SCIENTIFIC_STOP_LOSS=true
ENABLE_TRAILING_STOP_LOSS=true
ENABLE_STOP_LOSS_FILTER=true
```

#### Opportunity Scoring & Market State

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MIN_OPPORTUNITY_SCORE` | Minimum score to open position (0-100) | Strategy-specific | No |
| `ENABLE_MARKET_STATE_ANALYSIS` | Enable 8-state market recognition | true | No |
| `ENABLE_OPPORTUNITY_SCORING` | Enable multi-factor opportunity scoring | true | No |

**Strategy-Specific Defaults**:

- Ultra-short: 55 points (more selective)
- Swing-trend: 50 points (balanced)
- Conservative: 65 points (very selective)
- Balanced: 60 points (recommended)
- Aggressive: 45 points (more opportunities)

#### Account-Level Risk Management

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ACCOUNT_STOP_LOSS_USDT` | Force close all positions if balance drops below | 50 | No |
| `ACCOUNT_TAKE_PROFIT_USDT` | Force close all positions if balance reaches | 20000 | No |
| `ACCOUNT_DRAWDOWN_WARNING_PERCENT` | Drawdown % to trigger warning alerts | 20 | No |
| `ACCOUNT_DRAWDOWN_NO_NEW_POSITION_PERCENT` | Drawdown % to stop new positions | 30 | No |
| `ACCOUNT_DRAWDOWN_FORCE_CLOSE_PERCENT` | Drawdown % to force close everything | 50 | No |

#### Exchange Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `EXCHANGE_NAME` | Exchange selection (gate or binance) | gate | Yes |
| `GATE_API_KEY` | Gate.io API key | - | When EXCHANGE_NAME=gate |
| `GATE_API_SECRET` | Gate.io API secret | - | When EXCHANGE_NAME=gate |
| `GATE_USE_TESTNET` | Use Gate.io testnet | true | No |
| `BINANCE_API_KEY` | Binance API key | - | When EXCHANGE_NAME=binance |
| `BINANCE_API_SECRET` | Binance API secret | - | When EXCHANGE_NAME=binance |
| `BINANCE_USE_TESTNET` | Use Binance testnet | true | No |

#### AI Model Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI compatible API key | - | Yes |
| `OPENAI_BASE_URL` | API base URL | <https://openrouter.ai/api/v1> | No |
| `AI_MODEL_NAME` | Model identifier | deepseek/deepseek-v3.2-exp | No |

#### Database & System

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | SQLite database file path | file:./.voltagent/trading.db | No |
| `SYNC_CONFIG_ON_STARTUP` | Sync config to database on startup | true | No |
| `ENABLE_HEALTH_MONITORING` | Enable system health checks | true | No |

### Trading Strategy Deep Dive

Each strategy has unique characteristics optimized for different market conditions:

#### 1. Ultra-Short Strategy (`ultra-short`)

**Characteristics**:

- Target: 40%+ monthly return
- Holding time: Minutes to hours
- High frequency: Multiple trades per day
- Stop-loss: 0.5-3% (tight, ATR 1.5x)
- Take-profit: R-multiple stages at 2R, 3R, 5R
- Best for: High liquidity symbols, volatile markets

**Risk Parameters**:

```typescript
{
  atrMultiplier: 1.5,
  minStopLossPercent: 0.5,
  maxStopLossPercent: 3.0,
  minOpportunityScore: 55,
  partialTakeProfit: {
    stage1: { rMultiple: 2, closePercent: 30 },
    stage2: { rMultiple: 3, closePercent: 50 },
    stage3: { rMultiple: 5, closePercent: 100 }
  }
}
```

#### 2. Swing-Trend Strategy (`swing-trend`)

**Characteristics**:

- Target: 40%+ monthly return
- Holding time: Days to weeks
- Medium frequency: 2-5 trades per week
- Stop-loss: 1.0-6% (wider, ATR 2.5x)
- Take-profit: R-multiple stages at 3R, 5R, 8R
- Best for: Strong trending markets

**Risk Parameters**:

```typescript
{
  atrMultiplier: 2.5,
  minStopLossPercent: 1.0,
  maxStopLossPercent: 6.0,
  minOpportunityScore: 50,
  partialTakeProfit: {
    stage1: { rMultiple: 3, closePercent: 30 },
    stage2: { rMultiple: 5, closePercent: 50 },
    stage3: { rMultiple: 8, closePercent: 100 }
  }
}
```

#### 3. Conservative Strategy (`conservative`)

**Characteristics**:

- Target: 10-20% monthly return
- Holding time: Hours to days
- Low frequency: Capital preservation priority
- Stop-loss: 1.5-7% (widest, ATR 3.0x)
- Take-profit: Early exits at 2R, 3R, 4R
- Best for: Risk-averse traders, uncertain markets

**Risk Parameters**:

```typescript
{
  atrMultiplier: 3.0,
  minStopLossPercent: 1.5,
  maxStopLossPercent: 7.0,
  minOpportunityScore: 65,  // Most selective
  partialTakeProfit: {
    stage1: { rMultiple: 2, closePercent: 40 },
    stage2: { rMultiple: 3, closePercent: 60 },
    stage3: { rMultiple: 4, closePercent: 100 }
  }
}
```

#### 4. Balanced Strategy (`balanced`) ⭐ Recommended

**Characteristics**:

- Target: 20-40% monthly return
- Holding time: Hours to days
- Medium frequency: Risk-reward equilibrium
- Stop-loss: 0.8-5% (moderate, ATR 2.0x)
- Take-profit: Balanced stages at 2.5R, 4R, 6R
- Best for: Most market conditions, beginners

**Risk Parameters**:

```typescript
{
  atrMultiplier: 2.0,
  minStopLossPercent: 0.8,
  maxStopLossPercent: 5.0,
  minOpportunityScore: 60,
  partialTakeProfit: {
    stage1: { rMultiple: 2.5, closePercent: 30 },
    stage2: { rMultiple: 4, closePercent: 50 },
    stage3: { rMultiple: 6, closePercent: 100 }
  }
}
```

#### 5. Aggressive Strategy (`aggressive`)

**Characteristics**:

- Target: 40%+ monthly return
- Holding time: Minutes to hours
- High frequency: Maximum growth pursuit
- Stop-loss: 0.5-4% (tight, ATR 1.5x)
- Take-profit: Aggressive stages at 3R, 5R, 10R
- Best for: Experienced traders, high risk tolerance

**Risk Parameters**:

```typescript
{
  atrMultiplier: 1.5,
  minStopLossPercent: 0.5,
  maxStopLossPercent: 4.0,
  minOpportunityScore: 45,  // Least selective
  partialTakeProfit: {
    stage1: { rMultiple: 3, closePercent: 20 },
    stage2: { rMultiple: 5, closePercent: 30 },
    stage3: { rMultiple: 10, closePercent: 100 }
  }
}
```

- AI Model Configuration

The system supports any OpenAI API compatible provider. Choose the provider that best fits your needs:

#### OpenRouter (Recommended)

**Advantages**: Access to multiple models through single API, competitive pricing

```env
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=sk-or-v1-xxxxx

# Recommended models:
AI_MODEL_NAME=deepseek/deepseek-v3.2-exp      # Best value, fast reasoning
# AI_MODEL_NAME=x-ai/grok-4-fast               # Fast execution
# AI_MODEL_NAME=anthropic/claude-4.5-sonnet    # Strong analysis
```

#### OpenAI

**Advantages**: Most reliable, low latency

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-xxxxx
AI_MODEL_NAME=gpt-4o          # Recommended
# AI_MODEL_NAME=gpt-4o-mini   # Budget option
```

#### DeepSeek

**Advantages**: Specialized in coding/analysis, very affordable

```env
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_API_KEY=sk-xxxxx
AI_MODEL_NAME=deepseek-chat
```

**Model Comparison**:

| Model | Provider | Cost | Speed | Reasoning | Best For |
|-------|----------|------|-------|-----------|----------|
| deepseek-v3.2-exp | OpenRouter | $ | Fast | Excellent | General use ⭐ |
| grok-4-fast | OpenRouter | $$ | Very Fast | Good | High frequency |
| claude-4.5-sonnet | OpenRouter | $$$ | Medium | Excellent | Complex analysis |
| gpt-4o | OpenAI | $$ | Fast | Excellent | Reliability |
| gpt-4o-mini | OpenAI | $ | Very Fast | Good | Budget trading |

## Best Practices

### 1. Start with Testnet

**Critical**: Always test on testnet before using real funds.

```env
# Testnet configuration
GATE_USE_TESTNET=true        # or BINANCE_USE_TESTNET=true
INITIAL_BALANCE=1000         # Virtual funds for testing
```

**Testnet Benefits**:

- Zero financial risk
- Full trading simulation
- Validate AI strategy effectiveness
- Test system reliability under various conditions
- Practice configuration optimization

### 2. Capital Management

When moving to mainnet:

- **Start Small**: Begin with 100-500 USDT
- **Monitor Performance**: Track for several days
- **Gradual Scaling**: Increase capital based on verified results
- **Set Appropriate Stop-Loss**: Configure `ACCOUNT_STOP_LOSS_USDT`

**Example Progression**:

```bash
Week 1-2: $100   (testing, learning system)
Week 3-4: $500   (if positive results)
Week 5+:  $2000+ (if consistently profitable)
```

### 3. Regular Monitoring

**Daily Tasks**:

- Check web dashboard (`http://localhost:3100`)
- Review AI decision logs
- Monitor open positions
- Check system health status (🟢🟡🔴)

**Weekly Tasks**:

- Analyze win rate and average R-multiple
- Review strategy performance
- Adjust parameters if needed
- Database backup

### 4. Database Backup

```bash
# Manual backup
cp .voltagent/trading.db .voltagent/backup/trading-$(date +%Y%m%d).db

# Automated daily backup (add to crontab)
0 2 * * * cd /path/to/ai-auto-trading && cp .voltagent/trading.db .voltagent/backup/trading-$(date +%Y%m%d).db
```

### 5. Strategy Selection Guide

**Choose your strategy based on**:

| If You Want... | Recommended Strategy | Risk Tolerance |
|----------------|---------------------|----------------|
| **Steady growth, low stress** | Conservative | Low |
| **Balanced approach** | Balanced ⭐ | Medium |
| **Maximum returns** | Aggressive | High |
| **Quick scalping** | Ultra-Short | High |
| **Trend riding** | Swing-Trend | Medium-High |

### 6. Risk Management Tips

**Position Sizing**:

```bash
# Conservative: 2% risk per trade
# Balanced: 3-5% risk per trade
# Aggressive: 5-10% risk per trade
```

**Diversification**:

```bash
# Recommended symbol selection
TRADING_SYMBOLS=BTC,ETH,SOL,XRP,BNB   # Major coins (lower volatility)
# Or mix with smaller caps
TRADING_SYMBOLS=BTC,ETH,SOL,ADA,AVAX  # Balanced diversification
```

**Leverage Rules**:

```bash
# Never use maximum leverage on all positions
# Example: If MAX_LEVERAGE=15, typically use 3-5x for most trades
# Save higher leverage for high-confidence setups only
```

## Troubleshooting

### Common Issues

#### Database Locked

**Error**: `database is locked`

**Solution**:

```bash
# Stop all instances
npm run trading:stop
# Or force kill
pkill -f "tsx"

# Remove lock files
rm -f .voltagent/trading.db-shm
rm -f .voltagent/trading.db-wal

# Restart
npm run trading:start
```

#### API Credentials Not Set

**Error**: `GATE_API_KEY and GATE_API_SECRET must be set`

**Solution**:

```bash
# Verify .env file
cat .env | grep GATE_API

# Edit configuration
nano .env
```

#### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3100`

**Solution**:

```bash
# Method 1: Use stop script
npm run trading:stop

# Method 2: Kill process manually
lsof -ti:3100 | xargs kill -9

# Method 3: Change port in .env
# Set PORT=3200
```

#### AI Model API Error

**Error**: `OpenAI API error` or connection failed

**Solution**:

- Verify `OPENAI_API_KEY` is correct
- Confirm `OPENAI_BASE_URL` is properly set
  - OpenRouter: `https://openrouter.ai/api/v1`
  - DeepSeek: `https://api.deepseek.com/v1`
- Ensure API key has sufficient credits
- Check network connectivity and firewall
- Verify service provider status

### Logs

```bash
# View real-time terminal logs
npm run trading:start

# View PM2 logs
npm run pm2:logs

# View historical log files
tail -f logs/trading-$(date +%Y-%m-%d).log

# View PM2 error logs
tail -f logs/pm2-error.log
```

### Database Inspection

```bash
# Check database status
npm run db:status

# Enter SQLite interactive mode
sqlite3 .voltagent/trading.db

# SQLite commands
.tables                                  # List all tables
.schema account_history                  # View table structure
SELECT * FROM account_history ORDER BY timestamp DESC LIMIT 10;
.exit                                    # Exit SQLite
```

## Production Deployment

### PM2 Deployment (Recommended)

PM2 provides robust process management for long-running Node.js applications.

**Installation and Setup**:

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Start application
npm run pm2:start

# 3. Enable startup on boot
pm2 startup
pm2 save

# 4. Monitor logs
npm run pm2:logs
```

### Docker Deployment

**Build and Run**:

```bash
# Build Docker image
docker build -t ai-auto-trading:latest .

# Run container
docker run -d \
  --name ai-auto-trading \
  --env-file .env \
  -p 3100:3100 \
  -v $(pwd)/.voltagent:/app/.voltagent \
  ai-auto-trading:latest

# View logs
docker logs -f ai-auto-trading

# Stop container
docker stop ai-auto-trading

# Remove container
docker rm ai-auto-trading
```

**Docker Compose** (Recommended):

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Restart services
docker compose restart
```

## API Documentation

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account` | GET | Current account status and balance |
| `/api/positions` | GET | Active positions |
| `/api/trades` | GET | Trading history |
| `/api/decisions` | GET | AI decision logs |
| `/api/health` | GET | System health check |
| `/api/market/{symbol}` | GET | Market data for specific symbol |

**Example Request**:

```bash
# Get account status
curl http://localhost:3100/api/account

# Get positions
curl http://localhost:3100/api/positions

# Get recent trades
curl http://localhost:3100/api/trades?limit=10
```

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Areas for Contribution**:

- New trading strategies
- Additional exchanges integration
- Enhanced AI prompts
- Performance optimizations
- Documentation improvements
- Bug fixes

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

**Key Points**:

- ✅ Free to use, modify, and distribute
- ✅ Source code must be disclosed when deployed as a service
- ✅ Modifications must use the same license
- ✅ Commercial use allowed

See the [LICENSE](./LICENSE) file for full details.

---

<div align="center">

**Built with ❤️ using [VoltAgent](https://voltagent.dev)**

[Report Bug](https://github.com/your-repo/issues) · [Request Feature](https://github.com/your-repo/issues)

</div>
