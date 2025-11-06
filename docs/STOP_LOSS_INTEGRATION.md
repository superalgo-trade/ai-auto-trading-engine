# 科学止损系统 - 集成说明

## 更新内容

为了解决科学止损与原有固定止损配置的冲突问题，我们进行了以下更新：

### 1. 策略参数结构更新

在 `StrategyParams` 接口中添加了新的科学止损配置：

```typescript
interface StrategyParams {
  // ... 其他配置
  
  // ===== 止损配置 =====
  
  // 科学止损配置（优先使用）
  scientificStopLoss?: {
    enabled: boolean;           // 是否启用
    atrMultiplier: number;      // ATR倍数
    useSupport: boolean;        // 是否使用支撑/阻力位
    minDistance: number;        // 最小止损距离%
    maxDistance: number;        // 最大止损距离%
  };
  
  // 固定止损配置（备用方案）
  stopLoss: {
    low: number;
    mid: number;
    high: number;
    deprecated?: boolean;       // 标记为已弃用
  };
  
  // ... 其他配置
}
```

### 2. 各策略的科学止损配置

#### 超短线策略（Ultra-Short）

```typescript
scientificStopLoss: {
  enabled: RISK_PARAMS.ENABLE_SCIENTIFIC_STOP_LOSS,
  atrMultiplier: 1.5,           // 较紧的止损
  useSupport: true,
  minDistance: 0.3,             // 最小0.3%
  maxDistance: 2.0,             // 最大2.0%
}
```

#### 波段趋势策略（Swing-Trend）

```typescript
scientificStopLoss: {
  enabled: RISK_PARAMS.ENABLE_SCIENTIFIC_STOP_LOSS,
  atrMultiplier: 2.5,           // 较宽的止损，给趋势更多空间
  useSupport: true,
  minDistance: 1.0,             // 最小1.0%
  maxDistance: 6.0,             // 最大6.0%
}
```

#### 保守策略（Conservative）

```typescript
scientificStopLoss: {
  enabled: RISK_PARAMS.ENABLE_SCIENTIFIC_STOP_LOSS,
  atrMultiplier: 2.5,           // 较宽的止损
  useSupport: true,
  minDistance: 1.0,             // 最小1.0%
  maxDistance: 4.0,             // 最大4.0%
}
```

#### 平衡策略（Balanced）

```typescript
scientificStopLoss: {
  enabled: RISK_PARAMS.ENABLE_SCIENTIFIC_STOP_LOSS,
  atrMultiplier: 2.0,           // 标准止损
  useSupport: true,
  minDistance: 0.5,             // 最小0.5%
  maxDistance: 5.0,             // 最大5.0%
}
```

#### 激进策略（Aggressive）

```typescript
scientificStopLoss: {
  enabled: RISK_PARAMS.ENABLE_SCIENTIFIC_STOP_LOSS,
  atrMultiplier: 1.5,           // 较紧的止损
  useSupport: true,
  minDistance: 0.5,             // 最小0.5%
  maxDistance: 5.0,             // 最大5.0%
}
```

### 3. AI 提示词更新

#### 风控规则展示

在每周期提示词中，AI 会看到：

```bash
【AI战术决策 - 强烈建议遵守】
┌─────────────────────────────────────────┐
│ ⭐ 科学止损（优先使用）：                │
│   ✅ 已启用 - 基于ATR2.0x和支撑/阻力位  │
│   • 开仓前检查: checkOpenPosition()      │
│   • 计算止损: calculateStopLoss()        │
│   • 动态调整: updateTrailingStop()       │
│                                         │
│ 策略止损（备用）：-5.0% ~ -10.0%（已弃用）│
│ ...其他配置...                           │
└─────────────────────────────────────────┘
```

#### 决策流程更新

```bash
【决策流程 - 按优先级执行】
(1) 持仓管理（最优先 - 使用科学止损）：
   a) 检查科学止损：calculateStopLoss() 计算当前合理止损位
   b) 考虑移动止损：updateTrailingStop() 为盈利持仓上移止损
   c) 执行平仓决策：检查止损/止盈/峰值回撤 → closePosition
   
(2) 新开仓评估（科学过滤）：
   a) 分析市场数据：识别双向机会（做多/做空）
   b) 开仓前检查：checkOpenPosition() 验证止损合理性
   c) 计算止损位：calculateStopLoss() 确定精确止损价
   d) 执行开仓：openPosition（使用科学止损建议）
```

#### 止损决策说明

```bash
a) 止损决策（必须严格遵守）：
   
   ⭐ 优先使用科学止损（推荐）：
   - 调用 calculateStopLoss() 重新计算当前合理止损位
   - 基于 ATR2.0x 和支撑/阻力位动态计算
   - 止损范围：0.5%-5.0%
   - 如果当前价格触及科学止损位：
     * 立即调用 closePosition 平仓（不要犹豫）
     * 市场波动加剧时，科学止损会自动放宽空间
   
   备用固定止损（科学止损未启用时使用）：
   - 检查 pnl_percent 是否触及策略止损线
   - ...（原有逻辑）
```

#### 新开仓工作流

```bash
b) 新开仓评估（新币种）：
   
   ⭐ 科学止损工作流（推荐）：
   步骤1: 调用 checkOpenPosition() 检查止损合理性
          - 自动拒绝止损距离过大、市场波动极端的交易
          - 只有检查通过（shouldOpen=true）才继续
   步骤2: 调用 calculateStopLoss() 计算精确止损位
          - 获取基于ATR和支撑/阻力的科学止损价格
          - 了解止损距离、质量评分、波动率等信息
   步骤3: 执行 openPosition() 开仓
          - 心中明确止损位
          - 下个周期会根据科学止损判断是否平仓
```

## 优先级规则

### 启用科学止损时（`ENABLE_SCIENTIFIC_STOP_LOSS=true`）

1. **开仓前**：
   - ✅ 优先：`checkOpenPosition()` → 过滤不合理的交易
   - ✅ 优先：`calculateStopLoss()` → 获取精确止损价
   - ❌ 忽略：固定止损配置（`stopLoss.low/mid/high`）

2. **持仓管理**：
   - ✅ 优先：`calculateStopLoss()` → 重新计算当前止损位
   - ✅ 可选：`updateTrailingStop()` → 动态调整止损（如启用）
   - ❌ 降级：固定止损仅作为极限红线参考

3. **止损判断**：
   - 主要依据：科学止损计算的止损价格
   - 辅助参考：固定止损作为最后防线（防止极端情况）

### 禁用科学止损时（`ENABLE_SCIENTIFIC_STOP_LOSS=false`）

回退到原有的固定止损逻辑：

- 使用 `stopLoss.low/mid/high` 配置
- 根据杠杆选择对应的止损线
- 不调用科学止损工具

## 环境变量控制

```bash
# 全局开关（主控）
ENABLE_SCIENTIFIC_STOP_LOSS=true          # 启用科学止损系统

# 科学止损详细配置
ATR_PERIOD=14                              # ATR计算周期
ATR_MULTIPLIER=2.0                         # ATR倍数（会被策略覆盖）
USE_ATR_STOP_LOSS=true                     # 使用ATR止损
USE_SUPPORT_RESISTANCE_STOP_LOSS=true     # 使用支撑/阻力止损
MIN_STOP_LOSS_PERCENT=0.5                  # 最小止损距离
MAX_STOP_LOSS_PERCENT=5.0                  # 最大止损距离

# 开仓过滤器
ENABLE_STOP_LOSS_FILTER=true               # 启用开仓过滤
MIN_STOP_LOSS_QUALITY_SCORE=40             # 最低质量评分

# 移动止损（可选）
ENABLE_TRAILING_STOP_LOSS=false            # 启用移动止损
TRAILING_STOP_CHECK_INTERVAL=6             # 检查间隔
```

## 工作原理

### 1. 开仓场景

```bash
AI 发现交易机会
    ↓
checkOpenPosition(symbol, side, price)
    ↓
检查：止损距离、市场波动、质量评分
    ↓
    ├─ shouldOpen=false → 拒绝开仓
    └─ shouldOpen=true → 继续
           ↓
       calculateStopLoss(symbol, side, price)
           ↓
       获取：止损价、止损距离、质量评分
           ↓
       openPosition(symbol, side, amount, leverage)
           ↓
       （心中记住止损位，下周期检查）
```

### 2. 持仓管理场景

```bash
每个周期检查持仓
    ↓
calculateStopLoss(symbol, side, entryPrice)
    ↓
获取当前合理止损位
    ↓
比较 currentPrice vs stopLossPrice
    ↓
    ├─ 触及止损 → closePosition()
    ├─ 盈利>3% → 考虑 updateTrailingStop()
    └─ 正常持有 → 继续观察
```

### 3. 冲突解决

**问题**：科学止损计算 -3%，固定止损配置 -5%，听谁的？

**解决方案**：

- 科学止损 **优先**：AI 被明确告知优先使用科学止损
- 固定止损 **备用**：仅在科学止损未启用时使用
- 系统红线 **底线**：-30% 强制平仓（硬编码，不可突破）

**冲突场景示例**：

| 场景 | 科学止损 | 固定止损 | 实际执行 |
|------|----------|----------|----------|
| 科学启用，正常市场 | -3.2% | -5.0% | 使用 -3.2%（科学止损） |
| 科学启用，高波动 | -4.5% | -5.0% | 使用 -4.5%（科学止损自动放宽） |
| 科学启用，低波动 | -1.8% | -5.0% | 使用 -1.8%（科学止损自动收紧） |
| 科学禁用 | N/A | -5.0% | 使用 -5.0%（备用固定止损） |
| 极端情况 | -35% | -5.0% | -30% 强制平（系统红线） |

## 优势分析

### 解决的问题

1. **消除冲突**：
   - ❌ 之前：两套止损规则同时存在，AI 不知道用哪个
   - ✅ 现在：明确优先级，科学止损优先，固定止损备用

2. **提高灵活性**：
   - ❌ 之前：固定止损 -5%，无论市场波动如何
   - ✅ 现在：ATR 2.0x，高波动自动放宽，低波动自动收紧

3. **减少误杀**：
   - ❌ 之前：开仓即止损（止损设置太紧）
   - ✅ 现在：基于市场波动和支撑位科学计算

4. **提高质量**：
   - ❌ 之前：所有交易机会都尝试开仓
   - ✅ 现在：`checkOpenPosition()` 自动过滤不合理的交易

### 保持的优势

1. **向后兼容**：
   - 禁用科学止损时，回退到原有固定止损逻辑
   - 现有配置和代码无需修改

2. **渐进式迁移**：
   - 可以先启用科学止损观察效果
   - 如有问题可随时禁用回退

3. **策略定制**：
   - 每个策略有独立的科学止损配置
   - 保守策略：ATR 2.5x，最大止损 4%
   - 激进策略：ATR 1.5x，最大止损 5%

## 使用建议

### 1. 首次启用

```bash
# 在 .env 中配置
ENABLE_SCIENTIFIC_STOP_LOSS=true
ENABLE_STOP_LOSS_FILTER=true
MIN_STOP_LOSS_QUALITY_SCORE=40

# 启动系统观察 1-2 天
npm start
```

### 2. 监控效果

```bash
# 查看止损计算日志
tail -f logs/combined.log | grep "科学止损\|stop-loss"

# 统计被拒绝的开仓
grep "不建议开仓" logs/combined.log | wc -l

# 对比启用前后的止损触发率
```

### 3. 调优参数

如果发现问题，调整策略的科学止损配置：

```typescript
// 在 tradingAgent.ts 中
scientificStopLoss: {
  enabled: true,
  atrMultiplier: 2.0,    // 增大到 2.5 放宽止损
  useSupport: true,
  minDistance: 0.5,      // 增大到 1.0 避免太紧
  maxDistance: 5.0,      // 减小到 4.0 避免太远
}
```

### 4. 故障排查

-- 问题：科学止损未生效**

```bash
# 检查配置
grep "ENABLE_SCIENTIFIC_STOP_LOSS" .env

# 查看日志
tail -f logs/combined.log | grep "科学止损"

# 验证工具是否被调用
grep "calculateStopLoss\|checkOpenPosition" logs/combined.log
```

-- 问题：止损太频繁**

```bash
# 增加 ATR 倍数
# 在策略配置中: atrMultiplier: 2.0 → 2.5

# 或提高最小止损距离
# minDistance: 0.5 → 1.0
```

-- 问题：开仓机会太少**

```bash
# 降低质量评分要求
MIN_STOP_LOSS_QUALITY_SCORE=40 → 30

# 或放宽最大止损距离
# maxDistance: 5.0 → 6.0
```

## 总结

✅ **完全解决冲突**：科学止损优先，固定止损备用  
✅ **明确优先级**：AI 明确知道使用哪套止损逻辑  
✅ **向后兼容**：可随时禁用回退到原有逻辑  
✅ **策略定制**：每个策略有独立的科学止损配置  
✅ **渐进式迁移**：可以先测试再全面启用  

**记住：好的止损系统应该让 AI 明确知道规则优先级，避免混淆和冲突！**
