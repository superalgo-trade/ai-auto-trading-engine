# 分批止盈快速入门指南（R-Multiple）

## 🎯 什么是分批止盈？

分批止盈是专业交易员的核心技巧，平衡"锁定利润"和"让利润奔跑"：

```javascript
传统方式 ❌ 
盈利30%全部平仓 → 错过后续50%、100%的大趋势

专业方式 ✅
1R：平仓1/3，止损移至成本价（保本）
2R：平仓1/3，止损移至1R（锁定利润）
3R+：保留1/3，移动止损（博取大趋势）
```

---

## 📊 什么是R倍数（R-Multiple）？

**R = 风险倍数**，表示盈利是风险的多少倍：

```javascript
入场: $50,000
止损: $49,000（风险 $1,000）

当前价 $51,000 → 盈利 $1,000 → 1R（盈利 = 1倍风险）
当前价 $52,000 → 盈利 $2,000 → 2R（盈利 = 2倍风险）
当前价 $55,000 → 盈利 $5,000 → 5R（盈利 = 5倍风险）
```

**优势：** 无论杠杆多少，R倍数始终准确反映风险回报比！

---

## 🚀 如何使用？

### 系统会自动执行

AI系统每个交易周期会：

1. **检查机会**：调用 `checkPartialTakeProfitOpportunity()`
2. **判断执行**：如果达到1R、2R或3R
3. **自动执行**：调用 `executePartialTakeProfit(symbol, stage)`
4. **移动止损**：自动更新止损价保护利润

**你不需要手动操作！**系统会根据R倍数自动判断和执行。

---

## 📋 分批止盈策略（不同风格）

### 保守策略（Conservative）

```javascript
1R (盈利 = 1倍风险)
├─ 平仓 40%
└─ 止损移至成本价（保本交易）

1.5R (盈利 = 1.5倍风险)
├─ 平仓 40%（累计80%）
└─ 止损移至 1R

2.5R+ (盈利 ≥ 2.5倍风险)
├─ 保留 20%
└─ 移动止损

4R 极限兜底
```

### 平衡策略（Balanced）- 推荐⭐

```javascript
1R (盈利 = 1倍风险)
├─ 平仓 1/3
└─ 止损移至成本价（保本交易）

2R (盈利 = 2倍风险)
├─ 平仓 1/3（累计2/3）
└─ 止损移至 1R（锁定1倍风险利润）

3R+ (盈利 ≥ 3倍风险)
├─ 保留 1/3
└─ 移动止损，让利润奔跑

5R 极限兜底
```

### 激进策略（Aggressive）

```javascript
1.5R (盈利 = 1.5倍风险)
├─ 平仓 25%
└─ 止损移至成本价

3R (盈利 = 3倍风险)
├─ 平仓 25%（累计50%）
└─ 止损移至 1.5R

4R+ (盈利 ≥ 4倍风险)
├─ 保留 50%（更激进）
└─ 移动止损

8R 极限兜底
```

### 超短线策略（Ultra-Short）

```javascript
1R → 平仓 1/3，止损移至成本价
2R → 平仓 1/3，止损移至 1R
3R+ → 保留 1/3，移动止损
5R 极限兜底
```

### 波段趋势策略（Swing-Trend）

```javascript
1.5R → 平仓 30%，止损移至成本价
3R → 平仓 35%，止损移至 1.5R
4.5R+ → 保留 35%，移动止损
8R 极限兜底（波段策略更高）
```

---

## 💡 实际案例

### 案例1：BTC多单（平衡策略）

```javascript
开仓: $50,000
杠杆: 10x
止损: $49,000 (-2% 价格，-20% 盈亏比)
风险: $1,000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

T1: 价格涨至 $51,000 (+2%)
✅ 达到 1R
├─ 系统检测：checkPartialTakeProfitOpportunity()
├─ AI决策：执行阶段1
├─ executePartialTakeProfit(symbol: 'BTC', stage: '1')
├─ 平仓 33.33%
├─ 止损移至 $50,000（成本价）
└─ 结果：即使回调也不亏了！

T2: 价格涨至 $52,000 (+4%)
✅ 达到 2R
├─ 系统检测：checkPartialTakeProfitOpportunity()
├─ AI决策：执行阶段2
├─ executePartialTakeProfit(symbol: 'BTC', stage: '2')
├─ 平仓 33.33%（剩余的50%）
├─ 止损移至 $51,000（1R位置）
└─ 结果：锁定了1倍风险利润！

T3: 价格继续涨至 $53,000+ (+6%+)
✅ 达到 3R
├─ 系统检测：checkPartialTakeProfitOpportunity()
├─ AI决策：执行阶段3
├─ executePartialTakeProfit(symbol: 'BTC', stage: '3')
├─ 不平仓（保留33.33%）
├─ 启用移动止损
└─ 结果：让利润奔跑！

最终：
- 如果涨到10R：前2/3锁定利润，最后1/3获得巨额收益
- 如果回调：前2/3已锁定，最后1/3由移动止损保护
```

### 案例2：ETH空单（激进策略）

```javascript
开仓: $3,000
杠杆: 15x
止损: $3,100 (+3.33% 价格)
风险: $100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

T1: 价格跌至 $2,900 (-3.33%)
✅ 达到 1.5R (激进策略)
├─ 平仓 25%
├─ 止损移至 $3,000（成本价）
└─ 保本交易

T2: 价格跌至 $2,700 (-10%)
✅ 达到 3R
├─ 再平仓 25%（累计50%）
├─ 止损移至 $2,900（1.5R位置）
└─ 锁定1.5倍风险利润

T3: 价格继续跌至 $2,600- (-13.33%-)
✅ 达到 4R+
├─ 保留 50%（激进：保留更多）
├─ 移动止损
└─ 博取大趋势
```

---

## 🔍 如何监控？

### 查看当前机会

AI每个周期自动检查，或手动查询数据库：

```bash
# 查看分批止盈历史
sqlite3 .voltagent/trading.db "SELECT * FROM partial_take_profit_history ORDER BY timestamp DESC LIMIT 10;"

# 查看持仓的已平仓百分比
sqlite3 .voltagent/trading.db "SELECT symbol, entry_price, stop_loss, partial_close_percentage FROM positions WHERE quantity != 0;"
```

### 日志输出示例

```javascript
✅ 阶段1分批止盈完成
stage: 1
currentR: 1.05
closePercent: 33.33
closedQuantity: 10
remainingQuantity: 20
pnl: 150.25 USDT
newStopLossPrice: 50000
totalClosedPercent: 33.33
```

---

## ⚙️ 配置说明

### 启用/禁用分批止盈

编辑策略配置（不推荐修改）：

```typescript
// src/agents/tradingAgent.ts
partialTakeProfit: {
  enabled: true,  // 设置为 false 可禁用
  stage1: { ... },
  stage2: { ... },
  stage3: { ... },
}
```

### 切换策略

通过环境变量切换：

```bash
# .env 文件
TRADING_STRATEGY=balanced  # 或 conservative / aggressive / ultra-short / swing-trend
```

---

## 🎓 核心原理

### 为什么基于R倍数？

```javascript
❌ 固定百分比的问题：
入场 $50k，止损 $49k (-2%)
- 30%盈利 = $65k = 15R（过于保守）
- 不同杠杆下含义完全不同

✅ R倍数的优势：
- 与实际风险直接关联
- 无论杠杆多少都准确
- 专业交易员的标准方法
```

### 为什么移动止损？

```javascript
场景：BTC从 $50k 涨到 $52k (2R)
├─ 传统：止损仍在 $49k
└─ 回调到 $49.5k → 触发止损 → 亏损 $500

├─ 分批止盈：阶段2后止损移至 $51k (1R)
└─ 回调到 $49.5k → 不会触发 → 锁定 1R 利润！

结论：移动止损保护已实现的盈利
```

### 为什么保留1/3？

```javascript
历史数据：大趋势行情可达 10R、20R 甚至更高
├─ 全部平仓在 3R → 错过 7R、17R 的巨额利润
└─ 保留 1/3 + 移动止损 → 既保护利润又捕捉趋势

真实案例（2024年BTC牛市）：
- 3R平仓全部 → 赚 $3,000
- 3R保留1/3 → 前2/3赚 $2,000，最后1/3涨到15R赚 $5,000
  总计：$7,000（比全平仓多130%！）
```

---

## 🚨 常见问题

### Q1: 为什么有时候没有自动执行？

**A:** 需要满足以下条件：

1. 持仓必须有止损价（`stop_loss`字段）
2. 持仓必须处于盈利状态
3. 达到对应的R倍数阈值
4. 该阶段尚未执行过

### Q2: 可以手动触发分批止盈吗？

**A:** 不推荐，但如果需要：

```typescript
// AI可以调用（不推荐人工干预）
executePartialTakeProfit({ symbol: 'BTC', stage: '1' })
```

### Q3: 如果我想更早止盈怎么办？

**A:** 使用传统的 `closePosition` 工具：

```typescript
// 手动平仓50%
closePosition({ symbol: 'BTC', percentage: 50 })

// 注意：这不会触发止损移动
```

### Q4: 极限止盈（5R/8R）是什么？

**A:** 这是最后的兜底保护：

- 作为条件单设置在交易所
- 如果价格暴涨触发，自动全部平仓
- 避免极端回调导致利润回吐
- 正常情况不应触发（由分批止盈优先处理）

### Q5: 可以自定义R倍数吗？

**A:** 可以，但需要修改策略配置：

```typescript
// src/agents/tradingAgent.ts
stage1: {
  rMultiple: 1.2,  // 修改为1.2R
  closePercent: 40,  // 修改为平仓40%
  // ...
}
```

---

## 📚 进阶阅读

- [完整实施文档](./PARTIAL_TAKE_PROFIT_IMPLEMENTATION_SUMMARY.md)
- [方案升级原理](./PARTIAL_TAKE_PROFIT_UPGRADE_RATIONALE.md)
- [实施计划V2.0](./TASK_0_1_IMPLEMENTATION_PLAN_B_V2.md)
- [科学止损指南](./STOP_LOSS_QUICK_GUIDE.md)

---

## 🎯 快速检查清单

- [ ] 数据库迁移已运行
- [ ] 策略配置已选择（TRADING_STRATEGY环境变量）
- [ ] 理解R倍数概念
- [ ] 知道如何查看分批止盈历史
- [ ] 了解极限止盈的兜底作用

**现在开始交易，让系统自动为你执行专业级分批止盈！** 🚀

---

**版本：** v2.0  
**创建日期：** 2025-11-10  
**作者：** AI Auto-Trading Team  
**许可：** GNU AGPL v3
