# 科学止损系统 - 快速入门示例

## 🚀 快速开始（只需 3 个配置！）

### 1. 超简单配置

在 `.env` 文件中只需添加 **3 个全局开关**：

```bash
# ✅ 第一步：启用科学止损系统
ENABLE_SCIENTIFIC_STOP_LOSS=true

# ✅ 第二步：启用追踪止损（可选，推荐开启）
ENABLE_TRAILING_STOP_LOSS=true

# ✅ 第三步：启用开仓过滤器（强烈推荐）
ENABLE_STOP_LOSS_FILTER=true
```

**就这样！** 🎉

每个策略的详细止损参数已经预配置好：

- 超短线策略：ATR 1.5x，止损 0.5-3%
- 波段趋势策略：ATR 2.5x，止损 1.0-6%
- 保守策略：ATR 3.0x，止损 1.5-7%
- 平衡策略：ATR 2.0x，止损 0.8-5%
- 激进策略：ATR 1.5x，止损 0.5-4%

> 📝 **提示**：不需要设置 `ATR_MULTIPLIER`、`MIN_STOP_LOSS_PERCENT` 等参数，  
> 系统会根据你选择的策略自动使用最优配置！

### 2. AI Agent 自动使用（无需手动操作）

系统已集成到 AI Agent，AI 会自动调用。你只需启动系统：

```bash
npm start
```

### 3. AI 使用示例对话

#### 场景 1：开仓前检查

**AI：** 我发现 BTC 有做多机会，当前价格 50000，让我先检查止损是否合理...

```typescript
调用工具: checkOpenPosition({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000
})
```

**结果：**

```typescript
✅ 止损设置合理，可以开仓
- 止损价: 48500
- 止损距离: 3.00%
- 质量评分: 75/100
```

**AI：** 止损检查通过，现在计算精确的止损位...

```typescript
调用工具: calculateStopLoss({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000,
  timeframe: "1h"
})
```

**结果：**

```typescript
- 计算方法: HYBRID (ATR + 支撑位)
- 止损价: 48500
- ATR14: 1500 (3.00%)
- 支撑位: 48800
- 波动率: MEDIUM
- 建议: 市场波动正常，止损设置合理
```

**AI：** 止损计算完成，执行开仓...

#### 场景 2：开仓被拒绝

**AI：** 我发现 ETH 有做空机会，当前价格 3000，让我检查...

```typescript
调用工具: checkOpenPosition({
  symbol: "ETH",
  side: "short",
  entryPrice: 3000
})
```

**结果：**

```typescript
⚠️ 不建议开仓: 市场波动极端剧烈，暂缓交易
- 波动率: EXTREME
- ATR: 180 (6.00%)
```

**AI：** 由于市场波动过大，我决定放弃此次交易机会，等待更好的入场时机。

#### 场景 3：移动止损

**AI：** BTC 多单已盈利 5%，让我检查是否可以上移止损...

```typescript
调用工具: updateTrailingStop({
  symbol: "BTC",
  side: "long",
  entryPrice: 50000,
  currentPrice: 52500,
  currentStopLoss: 48500
})
```

**结果：**

```typescript
✅ 止损上移 6.19%，保护利润
- 旧止损: 48500
- 新止损: 51500
```

**AI：** 已成功上移止损至 51500，保护了 3% 的利润。

---

## 📊 实际交易流程示例

### 完整的交易决策流程

```typescript
1. 市场分析
   ├─ 获取价格: getMarketPrice("BTC")
   ├─ 技术指标: getTechnicalIndicators("BTC")
   └─ 资金费率: getFundingRate("BTC")

2. 开仓决策
   ├─ 检查账户: getAccountBalance()
   ├─ 检查持仓: getPositions()
   └─ ✨ 止损检查: checkOpenPosition("BTC", "long", 50000)
       ├─ 通过 → 继续
       └─ 拒绝 → 放弃交易

3. 计算参数
   ├─ ✨ 计算止损: calculateStopLoss("BTC", "long", 50000)
   ├─ 计算仓位: 根据账户资金和止损距离
   └─ 选择杠杆: 根据波动率调整

4. 执行开仓
   └─ openPosition({
       symbol: "BTC",
       side: "long",
       amountUsdt: 100,
       leverage: 10
     })

5. 持仓管理
   ├─ 每个周期检查盈亏
   ├─ 达到盈利目标 → 考虑部分止盈
   └─ ✨ 盈利超过 3% → updateTrailingStop() 上移止损
```

---

## 🎯 不同策略的配置建议

### 超短线策略（分钟级）

```bash
# 使用较短的 ATR 周期和较紧的止损
ATR_PERIOD=10
ATR_MULTIPLIER=1.5
MIN_STOP_LOSS_PERCENT=0.3
MAX_STOP_LOSS_PERCENT=2.0

# 严格的过滤标准
ENABLE_STOP_LOSS_FILTER=true
MIN_STOP_LOSS_QUALITY_SCORE=50

# 禁用移动止损（快进快出）
ENABLE_TRAILING_STOP_LOSS=false
```

### 短线策略（小时级）

```bash
# 标准配置
ATR_PERIOD=14
ATR_MULTIPLIER=2.0
MIN_STOP_LOSS_PERCENT=0.5
MAX_STOP_LOSS_PERCENT=4.0

# 适度过滤
ENABLE_STOP_LOSS_FILTER=true
MIN_STOP_LOSS_QUALITY_SCORE=40

# 可选移动止损
ENABLE_TRAILING_STOP_LOSS=true
TRAILING_STOP_CHECK_INTERVAL=6
```

### 波段策略（日级）

```bash
# 使用较长的 ATR 周期和较宽的止损
ATR_PERIOD=20
ATR_MULTIPLIER=2.5
MIN_STOP_LOSS_PERCENT=1.0
MAX_STOP_LOSS_PERCENT=6.0

# 宽松的过滤
ENABLE_STOP_LOSS_FILTER=true
MIN_STOP_LOSS_QUALITY_SCORE=30

# 启用移动止损
ENABLE_TRAILING_STOP_LOSS=true
TRAILING_STOP_CHECK_INTERVAL=24
```

---

## 💡 常见使用技巧

### 技巧 1：根据市场状态动态调整

**市场平静时（ATR < 2%）：**

```bash
ATR_MULTIPLIER=1.5  # 收紧止损
```

**市场活跃时（ATR 2-4%）：**

```bash
ATR_MULTIPLIER=2.0  # 标准止损
```

**市场剧烈时（ATR > 4%）：**

```bash
ATR_MULTIPLIER=2.5  # 放宽止损
MIN_STOP_LOSS_QUALITY_SCORE=50  # 提高过滤标准
```

### 技巧 2：组合使用工具

```typescript
// 1. 先检查是否应该开仓
const check = await checkOpenPosition("BTC", "long", 50000);

if (check.shouldOpen) {
  // 2. 计算详细的止损参数
  const stopLoss = await calculateStopLoss("BTC", "long", 50000);
  
  // 3. 根据止损距离计算仓位大小
  const riskAmount = accountBalance * 0.02;  // 单笔风险 2%
  const positionSize = riskAmount / (stopLoss.stopLossDistancePercent / 100);
  
  // 4. 执行开仓
  await openPosition({
    symbol: "BTC",
    side: "long",
    amountUsdt: positionSize,
    leverage: 10
  });
}
```

### 技巧 3：定期更新止损

```typescript
// 每小时检查一次持仓，看是否需要上移止损
setInterval(async () => {
  const positions = await getPositions();
  
  for (const position of positions) {
    const pnlPercent = (position.unrealizedPnl / position.margin) * 100;
    
    // 如果盈利超过 3%，考虑上移止损
    if (pnlPercent > 3) {
      const update = await updateTrailingStop({
        symbol: position.symbol,
        side: position.side,
        entryPrice: position.entryPrice,
        currentPrice: position.markPrice,
        currentStopLoss: position.stopLoss
      });
      
      if (update.shouldUpdate) {
        console.log(`${position.symbol} 止损已上移至 ${update.newStopLoss}`);
      }
    }
  }
}, 3600000);  // 每小时
```

---

## 🔍 监控和调试

### 查看止损计算日志

```bash
# 实时查看止损相关日志
tail -f logs/combined.log | grep "stop-loss"

# 查看特定币种的止损计算
grep "BTC.*止损计算完成" logs/combined.log

# 查看被拒绝的开仓
grep "不建议开仓" logs/combined.log
```

### 分析止损效果

```bash
# 统计止损被触发的次数
grep "触发止损" logs/combined.log | wc -l

# 查看平均止损距离
grep "止损距离" logs/combined.log | awk '{print $NF}' | grep -o '[0-9.]*' | awk '{sum+=$1; n++} END {print sum/n "%"}'

# 统计质量评分分布
grep "质量评分" logs/combined.log | awk '{print $NF}' | sort -n | uniq -c
```

---

## ⚠️ 注意事项

### 1. 止损不是万能的

- ❌ 不能完全避免损失
- ✅ 但能显著减少"开仓即止损"的情况
- ✅ 提高交易质量和盈亏比

### 2. 需要与其他风控配合

```typescript
科学止损 + 仓位管理 + 资金管理 + 情绪管理 = 稳定盈利
```

### 3. 定期回测和优化

- 每月回顾止损效果
- 根据市场变化调整参数
- 记录"被冤枉止损"和"该止没止"的案例

### 4. 不要过度优化

- 避免追求"完美"的止损
- 保持简单、可执行、可复制
- 重点关注"稳定性"而非"最优性"

---

## 📈 效果评估指标

### 好的止损系统应该具备

✅ **低误杀率**：真正的趋势不会被轻易止损  
✅ **快速止损**：错误的方向能及时止损  
✅ **高质量分数**：大部分交易的止损质量评分 > 50  
✅ **合理盈亏比**：止损距离 < 盈利目标距离  
✅ **适应性强**：在不同市场环境下都能稳定工作

### 评估周期建议

- **短期**（1周）：关注"误杀率"和"质量评分"
- **中期**（1月）：关注"盈亏比"和"胜率"
- **长期**（3月）：关注"夏普比率"和"最大回撤"

---

## 🎓 学习资源

### 推荐阅读

1. **《Technical Analysis of the Financial Markets》** - John J. Murphy
2. **《Volatility-Based Technical Analysis》** - Kirk Northington
3. **ATR 止损研究论文**：搜索 "ATR Stop Loss Optimization"

### 相关工具

- **TradingView**：手动绘制支撑/阻力位
- **Python Backtrader**：回测不同止损策略
- **Excel 模板**：计算 ATR 和止损位

---

## 🤝 反馈和改进

如果你在使用过程中遇到问题或有改进建议，欢迎：

1. 查看详细文档：`docs/SCIENTIFIC_STOP_LOSS_GUIDE.md`
2. 提交 Issue：描述问题和复现步骤
3. 分享经验：成功的参数配置和使用技巧

**记住：好的止损是交易成功的基石，花时间优化止损系统是值得的投资！** 🎯
