# 修复硬编码问题 - MIN_OPPORTUNITY_SCORE 参数化

## 问题描述

在 `tradingAgent.ts` 文件中，多处使用了硬编码的评分阈值（70分、60分、80分），应该从环境变量 `MIN_OPPORTUNITY_SCORE` 中读取，以便灵活配置。

## 修改内容

### 1. 添加读取环境变量的函数（第620-623行）

```typescript
/**
 * 从环境变量读取最小开仓机会评分阈值
 */
export function getMinOpportunityScore(): number {
  return Number.parseInt(process.env.MIN_OPPORTUNITY_SCORE || "80", 10);
}
```

**说明：**

- 从环境变量 `MIN_OPPORTUNITY_SCORE` 读取最小评分阈值
- 默认值为 80 分（当环境变量未设置时）
- 使用 `parseInt` 的第二个参数 10（十进制），修复了原来的 `parseInt(..., 5)` 错误

### 2. 在提示词生成函数中使用该变量（第644行）

```typescript
// 获取最小开仓机会评分阈值
const minOpportunityScore = getMinOpportunityScore();
```

**位置：** `generateTradingPrompt` 函数开头

### 3. 在交易指令生成函数中使用该变量（第1266行）

```typescript
// 获取最小开仓机会评分阈值
const minOpportunityScore = getMinOpportunityScore();
```

**位置：** `generateInstructions` 函数开头

### 4. 替换所有硬编码的评分阈值

#### 第743-747行（决策流程中的评分标准）

**修改前：**

```typescript
├─ 评分 ≥ 80分：高质量机会，可以考虑开仓
├─ 评分 60-80分：中等机会，需谨慎评估当前情况
├─ 评分 < 60分：低质量机会，强烈建议观望
└─ ⚠️ 如果所有机会评分都 < 80分，原则上不应开仓
```

**修改后：**

```typescript
├─ 评分 ≥ ${minOpportunityScore}分：高质量机会，可以考虑开仓
├─ 评分 ${Math.floor(minOpportunityScore * 0.75)}-${minOpportunityScore - 1}分：中等机会，需谨慎评估当前情况
├─ 评分 < ${Math.floor(minOpportunityScore * 0.75)}分：低质量机会，强烈建议观望
└─ ⚠️ 如果所有机会评分都 < ${minOpportunityScore}分，原则上不应开仓
```

**动态计算逻辑：**

- 高质量：≥ minOpportunityScore（例如 ≥ 80分）
- 中等质量：75%-99% 的阈值（例如 60-79分，当阈值为80时）
- 低质量：< 75% 的阈值（例如 < 60分，当阈值为80时）

#### 第772、778-779行（严格约束和案例说明）

**修改前：**

```typescript
• ❌ 禁止在评分都 < 70分时强行开仓（除非有极其充分的理由）
...
1. 调用 analyze_opening_opportunities() → 返回 XRP 67分（均值回归）、BTC 55分（趋势跟踪）
2. 判断：XRP 67分接近70分，可考虑；BTC 55分太低，放弃
```

**修改后：**

```typescript
• ❌ 禁止在评分都 < ${Math.floor(minOpportunityScore * 0.875)}分时强行开仓（除非有极其充分的理由）
...
1. 调用 analyze_opening_opportunities() → 返回 XRP ${Math.floor(minOpportunityScore * 0.84)}分（均值回归）、BTC ${Math.floor(minOpportunityScore * 0.69)}分（趋势跟踪）
2. 判断：XRP ${Math.floor(minOpportunityScore * 0.84)}分接近${minOpportunityScore}分，可考虑；BTC ${Math.floor(minOpportunityScore * 0.69)}分太低，放弃
```

**动态计算逻辑：**

- 禁止开仓阈值：87.5% 的最小评分（例如 70分，当阈值为80时）
- 案例中的XRP评分：84% 的最小评分（例如 67分，当阈值为80时）
- 案例中的BTC评分：69% 的最小评分（例如 55分，当阈值为80时）

#### 第1812-1815行（新开仓评估流程）

**修改前：**

```typescript
- 评分 ≥ 70分：高质量机会，可以考虑开仓
- 评分 60-69分：中等机会，需谨慎评估
- 评分 < 60分：低质量机会，强烈建议观望
- ⚠️ 如果所有机会评分都 < 70分，原则上不应开仓
```

**修改后：**

```typescript
- 评分 ≥ ${minOpportunityScore}分：高质量机会，可以考虑开仓
- 评分 ${Math.floor(minOpportunityScore * 0.75)}-${minOpportunityScore - 1}分：中等机会，需谨慎评估
- 评分 < ${Math.floor(minOpportunityScore * 0.75)}分：低质量机会，强烈建议观望
- ⚠️ 如果所有机会评分都 < ${minOpportunityScore}分，原则上不应开仓
```

#### 第1860行（严格约束总结）

**修改前：**

```typescript
- ❌ 禁止在工具评分都 < 70分时强行开仓
```

**修改后：**

```typescript
- ❌ 禁止在工具评分都 < ${minOpportunityScore}分时强行开仓
```

#### 第1930-1933行（决策优先级）

**修改前：**

```typescript
- 第2步：基于评分结果决策（≥70分才考虑，<60分强烈建议观望）
...
- ❌ 禁止在所有评分 < 70分时强行开仓
```

**修改后：**

```typescript
- 第2步：基于评分结果决策（≥${minOpportunityScore}分才考虑，<${Math.floor(minOpportunityScore * 0.75)}分强烈建议观望）
...
- ❌ 禁止在所有评分 < ${minOpportunityScore}分时强行开仓
```

## 环境变量配置

在 `.env` 文件中已有配置：

```properties
# 开仓评分阈值
MIN_OPPORTUNITY_SCORE=80        # 最小开仓机会评分（默认：80分）
```

**说明：**

- 默认值为 80 分
- 可根据交易策略调整（例如激进策略可降低到70分，保守策略可提高到90分）
- 所有相关的评分阈值会自动按比例调整

## 修改效果

经过修改后，系统将：

1. **灵活配置**：通过修改 `.env` 文件中的 `MIN_OPPORTUNITY_SCORE` 即可调整所有相关阈值
2. **自动计算**：中等质量阈值（75%）和低质量阈值会自动按比例计算
3. **一致性**：提示词中所有地方使用同一个阈值，避免不一致
4. **可维护性**：不再需要修改代码即可调整评分标准

## 阈值计算示例

当 `MIN_OPPORTUNITY_SCORE=80` 时：

- 高质量：≥ 80分
- 中等质量：60-79分（75% × 80 = 60）
- 低质量：< 60分
- 禁止开仓：< 70分（87.5% × 80 = 70）

当 `MIN_OPPORTUNITY_SCORE=70` 时：

- 高质量：≥ 70分
- 中等质量：53-69分（75% × 70 = 52.5 ≈ 53）
- 低质量：< 53分
- 禁止开仓：< 61分（87.5% × 70 = 61.25 ≈ 61）

当 `MIN_OPPORTUNITY_SCORE=90` 时：

- 高质量：≥ 90分
- 中等质量：68-89分（75% × 90 = 67.5 ≈ 68）
- 低质量：< 68分
- 禁止开仓：< 79分（87.5% × 90 = 78.75 ≈ 79）

## 相关文件

- `/home/losesky/ai-auto-trading/src/agents/tradingAgent.ts` - 主要修改文件
- `/home/losesky/ai-auto-trading/.env` - 环境变量配置文件
