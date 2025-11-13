# 交易统计功能开发计划 (TODO)

> **目标**：构建全面的交易统计分析模块，帮助交易员深入理解系统表现、发现问题、优化策略

---

## 📊 现状分析

### 已实现的基础功能 ✅

- 总交易次数统计
- 盈利/亏损交易数量
- 胜率计算（winRate）
- 总盈亏（totalPnl）
- 最大单笔盈利/亏损
- 账户历史记录（总资产、已实现/未实现盈亏、收益率）
- 持仓信息（入场价、当前盈亏、杠杆等）
- 交易记录（开仓/平仓详情）

### 缺失的核心功能 ❌

- ❌ R倍数分布分析
- ❌ 盈利因子计算
- ❌ 策略绩效对比
- ❌ 回撤详细分析
- ❌ 时间维度分析
- ❌ 币种表现对比
- ❌ 风险指标（夏普比率、索提诺比率、卡玛比率）
- ❌ 平均持仓时长统计
- ❌ 市场状态相关的胜率分析
- ❌ 数据可视化图表

---

## 🎯 开发计划

### 阶段 1：核心统计指标 (高优先级) 🔴

#### 1.1 R倍数分布分析

**价值说明**：R倍数是专业交易员最重要的指标，反映真实的风险调整收益。

**待实现功能**：

- [ ] **数据库增强**
  - [ ] 在 `trades` 表添加 `r_multiple` 字段（平仓时计算并存储）
  - [ ] 在 `positions` 表添加 `entry_stop_loss` 字段（记录开仓时的止损价格，用于R值计算）
  - [ ] 创建数据库迁移脚本

- [ ] **后端API**
  - [ ] 新增 `/api/stats/r-multiple-distribution` 端点
    - 返回数据：

      ```typescript
      {
        distribution: {
          negative: number,      // <0R 的交易数
          zero_to_one: number,   // 0-1R
          one_to_two: number,    // 1-2R
          two_to_three: number,  // 2-3R
          three_plus: number     // >3R
        },
        average_r: number,       // 平均R倍数
        median_r: number,        // 中位数R倍数
        best_trade_r: number,    // 最佳R倍数
        worst_trade_r: number,   // 最差R倍数
        expectancy: number       // 期望值（平均R × 胜率）
      }
      ```
  
- [ ] **计算逻辑实现**
  - [ ] 在平仓时计算R倍数：`R = (exitPrice - entryPrice) / (entryPrice - stopLoss)`
  - [ ] 对于做空：`R = (entryPrice - exitPrice) / (stopLoss - entryPrice)`
  - [ ] 期望值计算：`Expectancy = (AvgWin × WinRate) - (AvgLoss × LossRate)`

- [ ] **前端展示**
  - [ ] 添加R倍数分布柱状图（使用Chart.js或类似库）
  - [ ] 显示平均R、中位数R
  - [ ] 显示期望值指标

**对交易员的价值**：

- ✅ 了解系统是否真正盈利（平均R>0才有正期望）
- ✅ 识别是否有足够的大赢交易（需要有>3R的交易来弥补小亏损）
- ✅ 评估风险管理效果（R倍数分布是否健康）

---

#### 1.2 盈利因子（Profit Factor）

**价值说明**：盈利因子是衡量系统质量的黄金指标，>1.5被认为是优秀系统。

**待实现功能**：

- [ ] **后端API**
  - [ ] 新增 `/api/stats/profit-factor` 端点
    - 返回数据：

      ```typescript
      {
        profit_factor: number,        // 总盈利 / 总亏损
        total_wins: number,           // 总盈利金额
        total_losses: number,         // 总亏损金额（绝对值）
        average_win: number,          // 平均盈利
        average_loss: number,         // 平均亏损
        win_loss_ratio: number,       // 盈亏比（平均盈利/平均亏损）
        break_even_win_rate: number   // 盈亏平衡所需胜率
      }
      ```

- [ ] **计算逻辑**
  - [ ] 总盈利 = SUM(pnl WHERE pnl > 0)
  - [ ] 总亏损 = ABS(SUM(pnl WHERE pnl < 0))
  - [ ] 盈利因子 = 总盈利 / 总亏损
  - [ ] 盈亏平衡胜率 = 1 / (1 + 盈亏比)

- [ ] **前端展示**
  - [ ] 盈利因子大数字显示（>2.0绿色，1.5-2.0黄色，<1.5红色）
  - [ ] 盈亏比可视化
  - [ ] 盈亏平衡胜率对比实际胜率

**对交易员的价值**：

- ✅ 快速判断系统质量（盈利因子越高越好）
- ✅ 理解胜率和盈亏比的平衡关系
- ✅ 发现改进方向（是提高胜率还是提高盈亏比？）

---

#### 1.3 回撤详细分析

**价值说明**：回撤是风险管理的核心，交易员需要知道系统的最坏情况。

**待实现功能**：

- [ ] **数据库增强**
  - [ ] 创建 `equity_curve` 表

    ```sql
    CREATE TABLE equity_curve (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      equity REAL NOT NULL,
      peak_equity REAL NOT NULL,
      drawdown_percent REAL NOT NULL,
      drawdown_usdt REAL NOT NULL,
      is_new_peak BOOLEAN DEFAULT 0
    );
    ```

- [ ] **后端API**
  - [ ] 新增 `/api/stats/drawdown-analysis` 端点
    - 返回数据：

      ```typescript
      {
        max_drawdown_percent: number,     // 最大回撤百分比
        max_drawdown_usdt: number,        // 最大回撤金额
        max_drawdown_start: string,       // 回撤开始时间
        max_drawdown_end: string,         // 回撤结束时间
        max_drawdown_duration_hours: number,  // 回撤持续时长
        recovery_time_hours: number,      // 恢复时长
        current_drawdown_percent: number, // 当前回撤
        drawdowns: Array<{               // 所有回撤周期
          start_date: string,
          end_date: string,
          peak_equity: number,
          trough_equity: number,
          drawdown_percent: number,
          duration_hours: number,
          recovery_hours: number
        }>
      }
      ```

- [ ] **计算逻辑**
  - [ ] 实时记录权益曲线（每次账户更新时）
  - [ ] 识别峰值和谷底
  - [ ] 计算回撤百分比和持续时间
  - [ ] 追踪恢复周期

- [ ] **前端展示**
  - [ ] 权益曲线图（显示回撤区域）
  - [ ] 最大回撤可视化
  - [ ] 回撤持续时间统计
  - [ ] 当前回撤状态警示

**对交易员的价值**：

- ✅ 了解最坏情况，做好心理准备
- ✅ 评估系统稳定性（回撤越小越稳定）
- ✅ 调整仓位大小（根据可承受的最大回撤）
- ✅ 及早发现系统退化（当前回撤超过历史记录）

---

### 阶段 2：策略与维度分析 (中优先级) 🟡

#### 2.1 策略绩效对比

**价值说明**：识别哪个策略在当前市场环境下最有效。

**待实现功能**：

- [ ] **数据库增强**
  - [ ] 在 `trades` 表添加 `strategy_name` 字段
  - [ ] 在 `positions` 表已有 `strategy_type` 字段，确保记录完整

- [ ] **后端API**
  - [ ] 新增 `/api/stats/strategy-performance` 端点
    - 返回数据（每个策略）：

      ```typescript
      {
        strategies: {
          'ultra-short': {
            total_trades: number,
            win_rate: number,
            profit_factor: number,
            total_pnl: number,
            average_r: number,
            max_drawdown: number,
            avg_holding_time_hours: number
          },
          'balanced': { ... },
          // ... 其他策略
        },
        best_strategy: string,      // 表现最好的策略（按盈利因子）
        current_strategy: string     // 当前使用的策略
      }
      ```

- [ ] **前端展示**
  - [ ] 策略对比表格
  - [ ] 雷达图（多维度对比）
  - [ ] 当前策略高亮显示
  - [ ] 策略推荐建议

**对交易员的价值**：

- ✅ 发现最适合当前市场的策略
- ✅ 及时切换策略以适应市场变化
- ✅ 评估不同策略的风险收益特征

---

#### 2.2 时间维度分析

**价值说明**：发现盈利/亏损的时间规律，避开不利时段。

**待实现功能**：

- [ ] **后端API**
  - [ ] 新增 `/api/stats/time-analysis` 端点
    - 返回数据：

      ```typescript
      {
        hourly: {                 // 每小时表现（UTC时间）
          0: { trades: number, win_rate: number, pnl: number },
          1: { ... },
          // ... 0-23小时
        },
        daily: {                  // 每天表现（周一到周日）
          monday: { trades: number, win_rate: number, pnl: number },
          // ...
        },
        monthly: {                // 每月表现
          2025-01: { trades: number, win_rate: number, pnl: number },
          // ...
        },
        best_trading_hours: number[],   // 表现最好的时段
        worst_trading_hours: number[]   // 表现最差的时段
      }
      ```

- [ ] **前端展示**
  - [ ] 24小时热力图（显示每小时盈亏）
  - [ ] 周胜率柱状图
  - [ ] 月度收益曲线
  - [ ] 最佳/最差时段提示

**对交易员的价值**：

- ✅ 识别市场活跃时段
- ✅ 避开历史表现不佳的时段
- ✅ 优化交易时间安排

---

#### 2.3 币种表现对比

**价值说明**：识别哪些加密货币最适合当前系统。

**待实现功能**：

- [ ] **后端API**
  - [ ] 新增 `/api/stats/symbol-performance` 端点
    - 返回数据（每个币种）：

      ```typescript
      {
        symbols: {
          'BTC': {
            total_trades: number,
            win_rate: number,
            profit_factor: number,
            total_pnl: number,
            average_r: number,
            best_strategy: string,      // 该币种最佳策略
            avg_holding_hours: number
          },
          // ... 其他币种
        },
        top_performers: string[],        // 表现最好的币种
        worst_performers: string[]       // 表现最差的币种
      }
      ```

- [ ] **前端展示**
  - [ ] 币种排行榜（按盈利排序）
  - [ ] 每个币种的详细统计卡片
  - [ ] 币种-策略热力图（哪个币种配哪个策略最好）

**对交易员的价值**：

- ✅ 调整交易币种列表（移除表现差的，增加表现好的）
- ✅ 发现某些币种的特殊规律
- ✅ 优化每个币种的策略配置

---

### 阶段 3：高级风险指标 (中优先级) 🟡

#### 3.1 夏普比率（Sharpe Ratio）

**价值说明**：衡量风险调整后收益，业界标准指标。

**待实现功能**：

- [ ] **后端API**
  - [ ] 新增 `/api/stats/risk-metrics` 端点
    - 返回数据：

      ```typescript
      {
        sharpe_ratio: number,         // 夏普比率（>1优秀，>2卓越）
        sortino_ratio: number,        // 索提诺比率（只考虑下行风险）
        calmar_ratio: number,         // 卡玛比率（收益率/最大回撤）
        annual_return: number,        // 年化收益率
        annual_volatility: number,    // 年化波动率
        downside_deviation: number    // 下行偏差
      }
      ```

- [ ] **计算逻辑**
  - [ ] 夏普比率 = (平均收益率 - 无风险利率) / 收益率标准差
  - [ ] 索提诺比率 = (平均收益率 - 无风险利率) / 下行偏差
  - [ ] 卡玛比率 = 年化收益率 / 最大回撤百分比
  - [ ] 使用日收益率数据计算，然后年化

- [ ] **前端展示**
  - [ ] 风险指标仪表盘
  - [ ] 与行业基准对比
  - [ ] 风险等级评估（低/中/高）

**对交易员的价值**：

- ✅ 专业化的绩效评估
- ✅ 与其他交易系统对比
- ✅ 向投资者展示风险调整后的真实收益

---

#### 3.2 市场状态相关胜率分析

**价值说明**：评估系统的市场状态识别能力。

**待实现功能**：

- [ ] **后端API**
  - [ ] 新增 `/api/stats/market-state-performance` 端点
    - 返回数据：

      ```typescript
      {
        market_states: {
          'uptrend_oversold': {
            trades: number,
            win_rate: number,
            avg_r: number,
            strategy_used: string
          },
          'downtrend_overbought': { ... },
          // ... 所有8种市场状态
        },
        best_states: string[],      // 胜率最高的市场状态
        worst_states: string[]      // 需要改进的市场状态
      }
      ```

- [ ] **前端展示**
  - [ ] 市场状态胜率矩阵
  - [ ] 状态-策略配对分析
  - [ ] 状态识别准确度评估

**对交易员的价值**：

- ✅ 验证市场状态识别引擎的有效性
- ✅ 优化状态-策略映射规则
- ✅ 识别系统的优势和弱点市场

---

### 阶段 4：可视化与用户体验 (低优先级) 🟢

#### 4.1 交互式图表库集成

**待实现功能**：

- [ ] 选择并集成图表库（推荐 Chart.js 或 ECharts）
- [ ] 实现以下图表：
  - [ ] 权益曲线图（实时更新）
  - [ ] R倍数分布柱状图
  - [ ] 策略对比雷达图
  - [ ] 时间热力图
  - [ ] 回撤区域可视化
  - [ ] 月度收益柱状图

#### 4.2 统计报告导出

**待实现功能**：

- [ ] PDF报告生成（日报/周报/月报）
- [ ] CSV数据导出
- [ ] 分享链接生成

#### 4.3 自定义统计周期

**待实现功能**：

- [ ] 前端添加日期范围选择器
- [ ] 后端支持自定义时间区间查询
- [ ] 对比不同时间段的表现

---

## 🗂️ 技术实施细节

### 数据库迁移脚本模板

```typescript
// src/database/migrate-add-stats-fields.ts
import { createClient } from "@libsql/client";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function migrate() {
  // 1. 添加R倍数字段
  await dbClient.execute(`
    ALTER TABLE trades ADD COLUMN r_multiple REAL;
  `);
  
  // 2. 添加策略名称字段
  await dbClient.execute(`
    ALTER TABLE trades ADD COLUMN strategy_name TEXT;
  `);
  
  // 3. 添加入场止损字段
  await dbClient.execute(`
    ALTER TABLE positions ADD COLUMN entry_stop_loss REAL;
  `);
  
  // 4. 创建权益曲线表
  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS equity_curve (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      equity REAL NOT NULL,
      peak_equity REAL NOT NULL,
      drawdown_percent REAL NOT NULL,
      drawdown_usdt REAL NOT NULL,
      is_new_peak BOOLEAN DEFAULT 0
    );
  `);
  
  console.log("✅ 统计功能数据库迁移完成");
}

migrate();
```

### API路由结构

```typescript
// src/api/routes.ts 中添加
app.get("/api/stats/r-multiple-distribution", async (c) => { ... });
app.get("/api/stats/profit-factor", async (c) => { ... });
app.get("/api/stats/drawdown-analysis", async (c) => { ... });
app.get("/api/stats/strategy-performance", async (c) => { ... });
app.get("/api/stats/time-analysis", async (c) => { ... });
app.get("/api/stats/symbol-performance", async (c) => { ... });
app.get("/api/stats/risk-metrics", async (c) => { ... });
app.get("/api/stats/market-state-performance", async (c) => { ... });
```

### 前端组件结构

```html
<!-- public/index.html 中添加 -->
<div id="statistics-dashboard">
  <div class="stats-section">
    <h3>R倍数分布</h3>
    <canvas id="r-multiple-chart"></canvas>
  </div>
  
  <div class="stats-section">
    <h3>盈利因子</h3>
    <div id="profit-factor-display"></div>
  </div>
  
  <div class="stats-section">
    <h3>回撤分析</h3>
    <canvas id="drawdown-chart"></canvas>
  </div>
  
  <!-- ... 其他统计模块 -->
</div>
```

---

## 📅 实施时间表

| 阶段 | 预计工时 | 优先级 | 开始日期 | 完成日期 |
|------|---------|--------|---------|---------|
| 阶段1.1: R倍数分布 | 8小时 | 🔴 高 | - | - |
| 阶段1.2: 盈利因子 | 4小时 | 🔴 高 | - | - |
| 阶段1.3: 回撤分析 | 6小时 | 🔴 高 | - | - |
| 阶段2.1: 策略对比 | 6小时 | 🟡 中 | - | - |
| 阶段2.2: 时间分析 | 6小时 | 🟡 中 | - | - |
| 阶段2.3: 币种对比 | 4小时 | 🟡 中 | - | - |
| 阶段3.1: 风险指标 | 5小时 | 🟡 中 | - | - |
| 阶段3.2: 市场状态 | 5小时 | 🟡 中 | - | - |
| 阶段4: 可视化 | 10小时 | 🟢 低 | - | - |
| **总计** | **54小时** | - | - | - |

---

## 🎓 开发建议

### 1. 渐进式开发

- 先实现阶段1的核心统计指标（R倍数、盈利因子、回撤）
- 在真实交易环境中验证数据准确性
- 收集用户反馈后再开发后续功能

### 2. 数据准确性优先

- 所有统计计算必须经过单元测试验证
- 对比手工计算结果确保准确性
- 考虑边界情况（零交易、所有交易盈利/亏损等）

### 3. 性能优化

- 对于历史数据统计，考虑使用缓存
- 大量数据计算可以异步执行
- 数据库查询优化（添加必要的索引）

### 4. 用户体验

- 统计数据要有清晰的解释说明
- 使用颜色编码（绿色=好，红色=差）
- 提供行业基准对比参考

---

## 📚 参考资料

### R倍数计算

- Van Tharp《Trade Your Way to Financial Freedom》
- 期望值公式：E = (W × Avg Win) - (L × Avg Loss)

### 风险指标

- 夏普比率：>1为优秀，>2为卓越
- 索提诺比率：只考虑下行波动
- 卡玛比率：收益/最大回撤

### 行业基准

- 对冲基金平均夏普比率：0.5-1.0
- 优秀量化系统盈利因子：>1.5
- 可接受的最大回撤：<20%

---

## 🚀 快速开始

### 开发者指南

1. 从阶段1.1开始（R倍数分布）
2. 创建数据库迁移脚本
3. 实现后端API端点
4. 前端添加展示组件
5. 测试验证数据准确性
6. 提交PR并记录完成状态

### 测试清单

- [ ] 单元测试（计算逻辑）
- [ ] 集成测试（API端点）
- [ ] 边界测试（空数据、极端值）
- [ ] 性能测试（大量历史数据）
- [ ] 用户验收测试

---

## 📝 维护与更新

本文档应当：

- ✅ 每完成一个功能后更新状态
- ✅ 根据实际开发调整预估工时
- ✅ 记录遇到的技术难点和解决方案
- ✅ 收集用户反馈并调整优先级

---

**文档创建日期**：2025-01-13  
**最后更新日期**：2025-01-13  
**维护者**：ai-auto-trading 开发团队
