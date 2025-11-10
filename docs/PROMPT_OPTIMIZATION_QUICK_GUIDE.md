# AI Prompt 优化快速指南

## 🎯 本次优化解决的问题

**问题:** AI Agent 可能在同一个交易周期内:

1. 先执行分批止盈 (`executePartialTakeProfit`) → 自动移动止损
2. 再执行移动止损 (`updateTrailingStop`) → 又移动一次止损

**后果:** 止损被移动两次,可能导致保护不当

---

## ✅ 解决方案

### 方案1: 工具层硬性保护 (自动生效)

在 `updateTrailingStop` 工具中添加了 **5分钟冷却期**:

- 如果最近5分钟内执行过分批止盈
- 工具会自动拒绝移动止损请求
- 返回错误信息告知 AI

**代码位置:** `/src/tools/trading/stopLossManagement.ts`

**无需配置,自动生效!**

### 方案2: Prompt 层软性引导 (AI 学习)

在 AI 提示词中添加了详细的案例说明:

- 正确案例: 如何正确使用工具
- 错误案例: 常见错误及原因
- 具体示例: 带价格数值的完整流程

**代码位置:** `/src/agents/tradingAgent.ts`

**帮助 AI 更好地理解规则!**

---

## 🚀 如何验证优化生效

### 步骤1: 查看日志

在交易日志中查找以下关键字:

```bash
# 成功的冷却期保护
grep "冷却期内拒绝移动止损" logs/pm2-out.log

# 或者使用系统日志
tail -f logs/pm2-out.log | grep "冷却期"
```

**预期输出:**

```bash
[stop-loss-management] BTC 在 1.2 分钟前刚执行过分批止盈，冷却期内拒绝移动止损
```

### 步骤2: 监控工具调用

检查数据库的分批止盈历史:

```bash
# 查看最近的分批止盈记录
sqlite3 .voltagent/trading.db "SELECT symbol, stage, timestamp FROM partial_take_profit_history WHERE status='completed' ORDER BY timestamp DESC LIMIT 10;"
```

**正常情况:**

- 每次分批止盈后的5分钟内
- 不应该有对应币种的止损更新

### 步骤3: 检查 AI 行为

观察 AI 的工具调用顺序:

```bash
# 查看 AI 的决策过程
tail -f logs/pm2-out.log | grep -E "(checkPartialTakeProfit|executePartialTakeProfit|updateTrailingStop)"
```

**理想模式:**

```bash
[AI] 调用 checkPartialTakeProfitOpportunity()
[AI] 调用 executePartialTakeProfit('BTC', '1')
[AI] 本周期结束 (不再调用 updateTrailingStop)
```

**被保护的模式:**

```bash
[AI] 调用 executePartialTakeProfit('BTC', '1') → 成功
[AI] 调用 updateTrailingStop('BTC', ...) → 被拒绝: 冷却期内
```

---

## 📊 关键指标

### 正常运行指标

| 指标 | 预期值 | 说明 |
|-----|-------|-----|
| 冷却期拒绝次数 | 低 (< 5%) | 说明 AI 遵守了 prompt 规则 |
| 分批止盈成功率 | 高 (> 95%) | 系统正常运行 |
| 止损移动异常 | 0 | 无重复移动或方向错误 |

### 异常指标

如果发现以下情况,需要检查:

| 异常 | 可能原因 | 解决方案 |
|-----|---------|---------|
| 冷却期拒绝 > 20% | AI 未理解规则 | 检查 prompt 是否正确加载 |
| 分批止盈失败 | 持仓或数据问题 | 检查持仓状态和数据库 |
| 止损未移动 | 工具未被调用 | 检查 AI 决策流程 |

---

## 🔧 配置选项

### 调整冷却期时间 (可选)

如果5分钟冷却期不合适,可以修改代码:

**文件:** `/src/tools/trading/stopLossManagement.ts`

**修改位置:**

```typescript
// 当前: 5分钟冷却期
if (minutesSinceLastExecution < 5) {

// 修改为: 3分钟冷却期
if (minutesSinceLastExecution < 3) {
```

**建议值:**

- 超短线策略: 3分钟
- 波段策略: 5分钟 (默认)
- 长线策略: 10分钟

### 环境变量配置

相关的环境变量 (无需修改):

```bash
# 是否启用移动止损
ENABLE_TRAILING_STOP_LOSS=true

# 是否启用科学止损
ENABLE_SCIENTIFIC_STOP_LOSS=true
```

---

## 🐛 故障排查

### 问题1: 冷却期不生效

**症状:** 仍然看到重复的止损移动

**检查步骤:**

1. 确认代码已更新并重启程序
2. 检查数据库表 `partial_take_profit_history` 是否存在
3. 查看日志是否有数据库查询错误

**解决方案:**

```bash
# 检查数据库表
sqlite3 .voltagent/trading.db ".schema partial_take_profit_history"

# 重启程序
pm2 restart ecosystem.config.cjs
```

### 问题2: 工具被过度拒绝

**症状:** 几乎所有 `updateTrailingStop` 都被拒绝

**可能原因:**

- 冷却期太长
- 分批止盈频繁执行

**解决方案:**

- 调整冷却期时间 (见上文)
- 检查分批止盈的触发频率是否异常

### 问题3: AI 仍然违反规则

**症状:** 日志显示 AI 尝试重复调用

**可能原因:**

- Prompt 未正确加载
- AI 模型理解能力问题

**解决方案:**

1. 检查 `/src/agents/tradingAgent.ts` 的案例说明是否存在
2. 重启程序确保 prompt 重新加载
3. 查看 AI 的完整提示词 (启用调试日志)

---

## 📚 相关文档

- **优化总结:** `/docs/PROMPT_OPTIMIZATION_SUMMARY.md` - 详细的优化方案和原理
- **实施记录:** `/docs/PROMPT_OPTIMIZATION_IMPLEMENTATION.md` - 具体的代码变更
- **快速指南:** 本文档 - 快速上手和验证

---

## ✅ 检查清单

在部署到生产环境前,请确认:

- [ ] 代码已更新 (`stopLossManagement.ts` 和 `tradingAgent.ts`)
- [ ] 数据库表 `partial_take_profit_history` 存在
- [ ] 编译通过,无错误 (`npm run build` 或 `tsc`)
- [ ] 测试环境验证通过
- [ ] 备份了当前的代码版本 (git commit)
- [ ] 准备了回滚方案 (见实施记录文档)

部署后监控 (至少运行24小时):

- [ ] 查看冷却期拒绝的日志
- [ ] 验证分批止盈流程正常
- [ ] 检查止损移动是否合理
- [ ] 监控是否有新的错误或异常
- [ ] 观察 AI 的工具调用模式

---

## 💡 最佳实践

1. **定期查看日志** - 每天检查一次,确保系统正常运行
2. **监控关键指标** - 使用 `/scripts/db-status.sh` 查看统计
3. **及时响应异常** - 发现异常立即分析原因
4. **持续优化** - 根据实际运行情况调整参数

---

## 🆘 需要帮助?

如果遇到问题:

1. 查看本文档的"故障排查"章节
2. 查看详细文档 (`PROMPT_OPTIMIZATION_SUMMARY.md`)
3. 检查日志文件 (`logs/pm2-out.log`, `logs/pm2-error.log`)
4. 查看 GitHub Issues 或联系开发团队

- 祝交易顺利! 🚀**
