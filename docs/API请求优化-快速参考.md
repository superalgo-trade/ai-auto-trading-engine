# API请求优化 - 快速参考

## 🎯 核心成果

| 优化项 | 优化前 | 优化后 | 降低幅度 |
|--------|--------|--------|----------|
| **API调用** | 99次 | 33次 | **-67%** |
| **提示词Tokens** | 8000 | 2400 | **-70%** |
| **总Tokens** | 12,000 | 4,000 | **-67%** |
| **每月费用** | ¥50 | ¥16.6 | **-67%** |

---

## 🔧 配置开关

### 环境变量 (.env)

```bash
# 启用精简模式 (默认true,建议保持)
USE_COMPACT_PROMPT=true
```

---

## 📝 优化清单

### ✅ 已实施

1. **提示词精简** (compactPrompt.ts)
   - 移除冗余说明
   - 压缩市场数据展示
   - 删除历史交易记录
   - 明确显示分批止盈阶段

2. **指令精简** (compactInstructions.ts)
   - 简化系统提示词
   - 压缩工具使用指导
   - 动态调整AI响应长度

3. **数据复用** (strategyRouter.ts)
   - routeMultipleStrategies接受预分析市场状态
   - 避免重复调用analyzeMarketState

4. **MTF缓存** (marketStateAnalyzer.ts)
   - 60秒内复用多时间框架数据
   - 智能缓存失效检查

---

## 🚨 验证方法

### 1. 查看缓存命中率

```bash
# 查看MTF缓存日志
grep "复用缓存的MTF数据" logs/pm2-out.log

# 查看市场状态复用日志
grep "复用已分析的市场状态" logs/pm2-out.log
```

### 2. 统计API调用

```bash
# 统计K线数据获取次数 (应为33次左右)
grep "获取K线数据" logs/pm2-out.log | wc -l
```

### 3. 验证分批止盈追踪

```bash
# 确认显示分批止盈阶段 (Stage1/Stage2/Stage3)
grep "Stage" logs/pm2-out.log | tail -5
```

---

## 🔄 回退方案

如需回退到完整版:

```bash
# 1. 修改.env
echo "USE_COMPACT_PROMPT=false" >> .env

# 2. 重启系统
pm2 restart all
```

---

## 📊 核心逻辑

### 数据流向

```bash
步骤1: analyzeMultipleMarketStates(11个币种)
  └─> 每个币种获取MTF数据 (缓存60秒)
  └─> 返回市场状态Map

步骤2: routeMultipleStrategies(11个币种, marketStates)
  └─> 复用步骤1的市场状态 ✓
  └─> getCachedMTFData() 复用缓存 ✓
  └─> 返回策略结果Map

步骤3: AI分析 (精简提示词 2400 tokens)
  └─> 精简指令 (800 tokens)
  └─> 精简响应 (800 tokens)
```

---

## 🎓 关键文件

| 文件 | 作用 | 修改类型 |
|------|------|----------|
| `compactPrompt.ts` | 生成精简提示词 | **新增** |
| `compactInstructions.ts` | 生成精简指令 | **新增** |
| `marketStateAnalyzer.ts` | MTF缓存机制 | **修改** |
| `strategyRouter.ts` | 数据复用逻辑 | **修改** |
| `opportunityAnalysis.ts` | 传递市场状态 | **修改** |

---

## 💡 MTF缓存机制

```typescript
// 缓存结构
const mtfCache = new Map<string, {
  data: MultiTimeframeAnalysis;
  timestamp: number;
}>();

// 缓存有效期
const MTF_CACHE_TTL = 60 * 1000; // 60秒

// 使用方式
const mtfData = await getCachedMTFData(symbol, ["SHORT_CONFIRM", "MEDIUM"]);
// 若缓存未过期,直接返回缓存数据 ✓
// 若缓存过期,重新获取并更新缓存
```

---

## ⚠️ 注意事项

1. **缓存时间**: MTF缓存60秒,对15分钟周期策略影响极小
2. **兼容性**: 完全兼容币安、Gate.io等多交易所
3. **分批止盈**: 不依赖历史记录,通过数据库字段追踪
4. **可逆性**: 通过环境变量可随时切换精简/完整版

---

## 📈 监控指标

### 每日检查

- ✅ API调用次数 < 40次/周期 (11个币种)
- ✅ 缓存命中率 > 60%
- ✅ 分批止盈追踪准确 (无Stage混淆)
- ✅ AI决策质量无下降

### 异常排查

- ❌ API调用 > 80次/周期 → 检查缓存是否生效
- ❌ Stage显示错误 → 检查partial_close_percentage字段
- ❌ AI拒绝决策 → 检查精简提示词是否完整

---

**快速链接**:

- 📖 [完整实施文档](./API请求优化-完整实施.md)
- 📝 [原始优化说明](./API请求优化说明.md)
- 🔧 [环境配置](./.env)

---

**最后更新**: 2025-01-XX  
**实施状态**: ✅ 已完成  
**生产验证**: 待监控
