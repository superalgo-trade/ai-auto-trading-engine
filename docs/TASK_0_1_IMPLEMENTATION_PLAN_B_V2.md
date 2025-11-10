# 任务0.1实施方案 V2.0（方案B - 混合模式）

## 🎯 核心理念升级

### 分批止盈的本质：风险倍数 + 移动止损

**传统方案的问题：**

```typescript
// ❌ 错误：基于固定百分比（30%/40%/50%）
stage1: { trigger: 30, closePercent: 20 }  // +30% 平仓20%
stage2: { trigger: 40, closePercent: 50 }  // +40% 平仓50%
stage3: { trigger: 50, closePercent: 100 } // +50% 全部清仓

// 问题：
// 1. 没有考虑实际风险大小
// 2. 与止损距离无关联
// 3. 无法体现"风险回报比"思维
```

**正确的分批止盈逻辑：**

```typescript
// ✅ 正确：基于风险倍数（R-Multiple）

假设：
- 入场价：$50,000
- 止损价：$49,000（-2% 价格距离，-20% 含10x杠杆）
- 风险 R = $1,000（或20%盈亏比）

分批止盈策略：
┌─────────────────────────────────────────────────────────┐
│ 1R（盈利 = 1倍风险）: 价格 $51,000 (+2%)               │
│   ├─ 动作1：平仓 1/3 (锁定利润)                         │
│   └─ 动作2：止损移至成本价 $50,000（保本交易）         │
│                                                          │
│ 2R（盈利 = 2倍风险）: 价格 $52,000 (+4%)               │
│   ├─ 动作1：平仓 1/3 (继续锁定)                         │
│   └─ 动作2：止损移至 $51,000（锁定1R利润）             │
│                                                          │
│ 3R+（盈利 ≥ 3倍风险）: 价格 $53,000+ (≥+6%)            │
│   ├─ 动作1：保留 1/3 仓位                               │
│   └─ 动作2：采用移动止损，让利润奔跑                   │
│                                                          │
│ 极限兜底：5R (价格 $55,000, +10%)                      │
│   └─ 最后的安全网，避免利润大幅回吐                    │
└─────────────────────────────────────────────────────────┘

核心原则：
1. 基于风险倍数，而非固定百分比
2. 每次平仓后移动止损，逐步保护利润
3. 最后1/3采用移动止损，博取大趋势
4. 极限止盈作为最后兜底
```

---

## 📋 执行计划（升级版）

### 推荐方案：B - 混合模式 V2.0 ⭐⭐⭐⭐⭐

**核心策略（重新设计）：**

1. **条件单极限止盈**：5R（风险的5倍），作为最后兜底
2. **分批止盈（主要机制）**：
   - 1R：平仓 1/3，止损移至成本价（保本）
   - 2R：平仓 1/3，止损移至 1R（锁定1倍风险利润）
   - 3R+：保留 1/3，移动止损让利润奔跑
3. **止损联动**：每次分批后自动更新止损位置

**优势：**

1. ✅ 体现专业交易员的"风险倍数"思维
2. ✅ 平衡"锁定利润"与"让利润奔跑"
3. ✅ 止损与止盈联动，系统化管理
4. ✅ 最后1/3用移动止损，博取大趋势

---

## 🔧 详细实施步骤

### 第一步：重新设计分批止盈配置（1小时）

#### 1.1 修改策略参数定义

**文件：** `src/agents/tradingAgent.ts`

```typescript
export interface StrategyParams {
  // ...existing code...
  
  // 🔧 重新设计：基于风险倍数的分批止盈
  partialTakeProfit: {
    // 第一阶段：1R (盈利 = 1倍风险)
    stage1: {
      rMultiple: number;        // 风险倍数（如 1）
      closePercent: number;     // 平仓百分比（如 33.33）
      moveStopLossTo: 'entry' | 'breakeven';  // 移动止损至入场价（保本）
      description: string;
    };
    // 第二阶段：2R (盈利 = 2倍风险)
    stage2: {
      rMultiple: number;        // 风险倍数（如 2）
      closePercent: number;     // 平仓百分比（如 50）
      moveStopLossTo: 'stage1' | '1R';  // 移动止损至1R位置
      description: string;
    };
    // 第三阶段：3R+ (盈利 ≥ 3倍风险)
    stage3: {
      rMultiple: number;        // 风险倍数（如 3）
      closePercent: number;     // 平仓百分比（如 100，或保留部分）
      useTrailingStop: boolean; // 是否使用移动止损
      trailingStopATRMultiplier?: number; // 移动止损的ATR倍数
      description: string;
    };
  };
  
  // 极限止盈（兜底保护）
  extremeTakeProfit: {
    rMultiple: number;  // 风险倍数（如 5）
    description: string;
  };
  
  // ...existing code...
}
```

#### 1.2 更新各策略配置

**文件：** `src/agents/tradingAgent.ts` (以balanced策略为例)

```typescript
"balanced": {
  name: "平衡策略",
  description: "攻守兼备，20分钟执行周期",
  // ...existing code...
  
  // ✅ 新的分批止盈配置（基于风险倍数）
  partialTakeProfit: {
    stage1: {
      rMultiple: 1,              // 1R（盈利 = 1倍风险）
      closePercent: 33.33,       // 平仓 1/3
      moveStopLossTo: 'entry',   // 止损移至成本价
      description: "1R 锁定1/3利润，止损移至成本价，确保不亏",
    },
    stage2: {
      rMultiple: 2,              // 2R（盈利 = 2倍风险）
      closePercent: 50,          // 平仓剩余的 1/2（即总仓位的1/3）
      moveStopLossTo: '1R',      // 止损移至1R位置
      description: "2R 锁定1/3利润，止损移至1R，保护已有利润",
    },
    stage3: {
      rMultiple: 3,              // 3R+（盈利 ≥ 3倍风险）
      closePercent: 0,           // 不强制平仓，保留1/3让利润奔跑
      useTrailingStop: true,     // 使用移动止损
      trailingStopATRMultiplier: 2.0,  // 2倍ATR移动止损
      description: "3R+ 保留1/3仓位，用移动止损博取大趋势",
    },
  },
  
  // 极限止盈（兜底）
  extremeTakeProfit: {
    rMultiple: 5,  // 5R（盈利 = 5倍风险）
    description: "极限兜底保护，避免利润大幅回吐",
  },
  
  // ...existing code...
},
```

#### 1.3 调整条件单止盈倍数

**文件：** `src/tools/trading/tradeExecution.ts:550-570`

```typescript
// 🔧 修改前：
calculatedTakeProfit = side === "long"
  ? actualFillPrice + stopLossDistance * 2  // 2:1盈亏比
  : actualFillPrice - stopLossDistance * 2;

// ✅ 修改后：基于策略配置的极限止盈倍数
const extremeRMultiple = params.extremeTakeProfit.rMultiple;  // 如 5
calculatedTakeProfit = side === "long"
  ? actualFillPrice + stopLossDistance * extremeRMultiple
  : actualFillPrice - stopLossDistance * extremeRMultiple;

logger.info(`📊 风控配置:`);
logger.info(`   风险 R = ${formatUSDT(stopLossDistance * actualFillSize)} (止损距离)`);
logger.info(`   止损价: ${formatStopLossPrice(symbolName, calculatedStopLoss)} (科学止损)`);
logger.info(`   极限止盈: ${formatStopLossPrice(symbolName, calculatedTakeProfit)} (${extremeRMultiple}R，兜底保护)`);
logger.info(`   分批止盈策略（基于风险倍数）:`);
logger.info(`      1R (${formatStopLossPrice(symbolName, actualFillPrice + stopLossDistance * (side === 'long' ? 1 : -1))}): 平仓33%，止损→成本价`);
logger.info(`      2R (${formatStopLossPrice(symbolName, actualFillPrice + stopLossDistance * (side === 'long' ? 2 : -2))}): 平仓33%，止损→1R`);
logger.info(`      3R+ (${formatStopLossPrice(symbolName, actualFillPrice + stopLossDistance * (side === 'long' ? 3 : -3))}+): 保留33%，移动止损`);
logger.info(`   ⚠️  正常情况由分批止盈处理，极限止盈(${extremeRMultiple}R)仅在意外暴涨时触发`);
```

---

### 第二步：实现基于风险倍数的分批止盈工具（3-4小时）

**新建文件：** `src/tools/trading/takeProfitManagement.ts`

```typescript
import { z } from "zod";
import { createTool } from "@agentic/core";
import { createLogger } from "../../utils/logger";
import { getExchangeClient } from "../../exchanges";
import { createClient } from "@libsql/client";
import { getTradingStrategy, getStrategyParams } from "../../agents/tradingAgent";
import { syncConditionalOrderQuantity } from "../../services/conditionalOrderSync";
import { RISK_PARAMS } from "../../config/riskParams";

const logger = createLogger({
  name: "take-profit-management",
  level: "info",
});

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

/**
 * 计算风险倍数（R-Multiple）
 * 
 * @param entryPrice 入场价格
 * @param currentPrice 当前价格
 * @param stopLossPrice 止损价格
 * @param side 方向
 * @returns 风险倍数
 */
function calculateRMultiple(
  entryPrice: number,
  currentPrice: number,
  stopLossPrice: number,
  side: 'long' | 'short'
): number {
  // 计算风险距离（R）
  const riskDistance = Math.abs(entryPrice - stopLossPrice);
  
  // 计算盈利距离
  const profitDistance = side === 'long' 
    ? currentPrice - entryPrice
    : entryPrice - currentPrice;
  
  // 风险倍数 = 盈利距离 / 风险距离
  const rMultiple = profitDistance / riskDistance;
  
  return rMultiple;
}

/**
 * 自动分批止盈工具（基于风险倍数）
 */
export const executePartialTakeProfitTool = createTool({
  name: "executePartialTakeProfit",
  description: `自动分批止盈 - 基于风险倍数（R-Multiple）系统化管理。

核心理念：
- 1R：平仓1/3，止损移至成本价（保本交易）
- 2R：平仓1/3，止损移至1R（锁定利润）
- 3R+：保留1/3，移动止损博取大趋势

工作原理：
1. 计算当前风险倍数（盈利/风险）
2. 判断是否达到阈值（1R/2R/3R）
3. 执行对应的平仓和止损移动
4. 同步条件单数量

优势：
- 科学的风险管理
- 平衡"锁定"与"奔跑"
- 止损与止盈联动`,
  parameters: z.object({
    symbol: z.enum(RISK_PARAMS.TRADING_SYMBOLS),
  }),
  execute: async ({ symbol }) => {
    try {
      const exchangeClient = getExchangeClient();
      const contract = exchangeClient.normalizeContract(symbol);
      
      // 1. 获取持仓信息
      const positions = await exchangeClient.getPositions();
      const position = positions.find(p => p.contract === contract);
      
      if (!position) {
        return {
          success: false,
          message: `未找到 ${symbol} 的持仓`,
        };
      }
      
      const posSize = parseFloat(position.size);
      if (Math.abs(posSize) === 0) {
        return {
          success: false,
          message: `${symbol} 持仓数量为0`,
        };
      }
      
      const side = posSize > 0 ? 'long' : 'short';
      const currentPrice = parseFloat(position.markPrice || '0');
      const entryPrice = parseFloat(position.entryPrice || '0');
      
      // 2. 从数据库获取止损价格
      const dbPosResult = await dbClient.execute({
        sql: `SELECT stop_loss FROM positions WHERE symbol = ?`,
        args: [symbol],
      });
      
      if (dbPosResult.rows.length === 0) {
        return {
          success: false,
          message: `未找到 ${symbol} 的数据库记录`,
        };
      }
      
      const stopLossPrice = parseFloat(dbPosResult.rows[0].stop_loss as string || '0');
      
      if (stopLossPrice === 0) {
        return {
          success: false,
          message: `${symbol} 未设置止损价格，无法计算风险倍数`,
        };
      }
      
      // 3. 计算风险倍数
      const rMultiple = calculateRMultiple(entryPrice, currentPrice, stopLossPrice, side);
      
      logger.info(`${symbol} 当前风险倍数: ${rMultiple.toFixed(2)}R`);
      logger.info(`  入场价: ${entryPrice}, 当前价: ${currentPrice}, 止损价: ${stopLossPrice}`);
      
      // 4. 获取策略配置
      const strategy = getTradingStrategy();
      const params = getStrategyParams(strategy);
      const tpConfig = params.partialTakeProfit;
      
      // 5. 查询已执行的分批记录
      const executedQuery = await dbClient.execute({
        sql: `SELECT stage FROM partial_take_profit_records WHERE symbol = ? ORDER BY stage`,
        args: [symbol],
      });
      
      const executedStages = new Set(executedQuery.rows.map(r => r.stage as string));
      
      // 6. 判断应该执行哪个阶段
      let targetStage: 'stage1' | 'stage2' | 'stage3' | null = null;
      let stageConfig: any = null;
      
      if (rMultiple >= tpConfig.stage3.rMultiple && !executedStages.has('stage3')) {
        targetStage = 'stage3';
        stageConfig = tpConfig.stage3;
      } else if (rMultiple >= tpConfig.stage2.rMultiple && !executedStages.has('stage2')) {
        targetStage = 'stage2';
        stageConfig = tpConfig.stage2;
      } else if (rMultiple >= tpConfig.stage1.rMultiple && !executedStages.has('stage1')) {
        targetStage = 'stage1';
        stageConfig = tpConfig.stage1;
      }
      
      if (!targetStage) {
        return {
          success: true,
          executed: false,
          message: `${symbol} 当前 ${rMultiple.toFixed(2)}R，未达到止盈阈值`,
          data: {
            currentRMultiple: rMultiple.toFixed(2),
            nextStage: executedStages.has('stage1')
              ? (executedStages.has('stage2') ? 'stage3' : 'stage2')
              : 'stage1',
            nextThreshold: executedStages.has('stage1')
              ? (executedStages.has('stage2') ? tpConfig.stage3.rMultiple : tpConfig.stage2.rMultiple)
              : tpConfig.stage1.rMultiple,
          },
        };
      }
      
      // 7. 执行分批平仓
      logger.info(`✅ ${symbol} 达到 ${targetStage} 阈值（${rMultiple.toFixed(2)}R ≥ ${stageConfig.rMultiple}R）`);
      logger.info(`   策略: ${stageConfig.description}`);
      
      let closePercent = stageConfig.closePercent;
      
      // Stage3 特殊处理：如果启用移动止损，则不平仓
      if (targetStage === 'stage3' && stageConfig.useTrailingStop) {
        logger.info(`   ${targetStage}: 保留剩余仓位，启用移动止损让利润奔跑`);
        closePercent = 0;  // 不平仓
      }
      
      if (closePercent > 0) {
        // 导入平仓工具
        const { closePositionTool } = await import("./tradeExecution.js");
        
        const closeResult = await closePositionTool.execute({
          symbol,
          percentage: closePercent,
        });
        
        if (!closeResult.success) {
          return closeResult;
        }
        
        logger.info(`✅ ${symbol} ${targetStage} 平仓成功: ${closePercent}%`);
      }
      
      // 8. 移动止损
      let newStopLoss: number | null = null;
      
      if (targetStage === 'stage1') {
        // 1R：止损移至成本价
        newStopLoss = entryPrice;
        logger.info(`   移动止损至成本价: ${newStopLoss} (保本交易)`);
        
      } else if (targetStage === 'stage2') {
        // 2R：止损移至1R位置
        const riskDistance = Math.abs(entryPrice - stopLossPrice);
        newStopLoss = side === 'long'
          ? entryPrice + riskDistance * 1  // 1R位置
          : entryPrice - riskDistance * 1;
        logger.info(`   移动止损至1R位置: ${newStopLoss} (锁定1倍风险利润)`);
        
      } else if (targetStage === 'stage3' && stageConfig.useTrailingStop) {
        // 3R+：使用移动止损（基于ATR）
        logger.info(`   启用移动止损（${stageConfig.trailingStopATRMultiplier}x ATR）让利润奔跑`);
        
        // 调用移动止损工具
        const { updateTrailingStopTool } = await import("./stopLossManagement.js");
        
        const trailingResult = await updateTrailingStopTool.execute({
          symbol,
          entryPrice,
          currentPrice,
          currentStopLoss: stopLossPrice,
        });
        
        if (trailingResult.success && trailingResult.updated) {
          newStopLoss = trailingResult.newStopLoss!;
          logger.info(`   移动止损已更新: ${newStopLoss}`);
        }
      }
      
      // 9. 更新数据库中的止损价格
      if (newStopLoss !== null) {
        await dbClient.execute({
          sql: `UPDATE positions SET stop_loss = ? WHERE symbol = ?`,
          args: [newStopLoss, symbol],
        });
        
        logger.info(`✅ ${symbol} 止损已更新至: ${newStopLoss}`);
      }
      
      // 10. 同步条件单数量（如果有平仓）
      if (closePercent > 0 && targetStage !== 'stage3') {
        logger.info(`🔄 同步条件单数量...`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const updatedPositions = await exchangeClient.getPositions();
        const updatedPosition = updatedPositions.find(p => p.contract === contract);
        
        if (updatedPosition) {
          const remainingQuantity = Math.abs(parseFloat(updatedPosition.size));
          
          const syncResult = await syncConditionalOrderQuantity(symbol, remainingQuantity);
          
          if (!syncResult.success) {
            logger.warn(`⚠️  条件单同步失败: ${syncResult.message}`);
          } else {
            logger.info(`✅ 条件单同步成功`);
          }
        }
      }
      
      // 11. 记录执行状态
      await dbClient.execute({
        sql: `INSERT INTO partial_take_profit_records 
              (symbol, stage, close_percent, r_multiple, executed_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          symbol,
          targetStage,
          closePercent,
          rMultiple,
          new Date().toISOString(),
        ],
      });
      
      // 12. 返回结果
      return {
        success: true,
        executed: true,
        stage: targetStage,
        rMultiple: rMultiple.toFixed(2),
        closePercent,
        newStopLoss,
        message: `✅ ${symbol} ${targetStage} 执行完成: ${stageConfig.description}`,
        data: {
          currentRMultiple: rMultiple.toFixed(2),
          executedStage: targetStage,
          closePercent,
          newStopLoss,
          description: stageConfig.description,
        },
      };
      
    } catch (error: any) {
      logger.error(`分批止盈执行失败: ${error.message}`, error);
      return {
        success: false,
        message: `执行失败: ${error.message}`,
      };
    }
  },
});
```

---

### 第三步：数据库表结构调整（0.5小时）

**文件：** `src/database/schema.ts`

```typescript
export interface PartialTakeProfitRecord {
  id: number;
  symbol: string;
  stage: 'stage1' | 'stage2' | 'stage3';
  close_percent: number;
  r_multiple: number;  // 🔧 新增：记录执行时的风险倍数
  executed_at: string;
}

// 建表SQL
CREATE TABLE IF NOT EXISTS partial_take_profit_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  stage TEXT NOT NULL,
  close_percent REAL NOT NULL,
  r_multiple REAL NOT NULL,  -- 风险倍数
  executed_at TEXT NOT NULL
);

CREATE INDEX idx_partial_tp_symbol ON partial_take_profit_records(symbol);
```

---

### 第四步：实现条件单同步服务（同V1.0）

**文件：** `src/services/conditionalOrderSync.ts`

（代码与V1.0版本相同，不再重复）

---

### 第五步：更新AI提示词（0.5小时）

**文件：** `src/agents/tradingAgent.ts`

```typescript
【硬性风控底线 - 系统强制执行】
┌─────────────────────────────────────────────────────────┐
│ ⛔ 科学止损保护：交易所服务器端24/7监控                 │
│   • 触及止损位立即平仓（不受程序限制）                  │
│   • 如超过止损阈值未平仓：系统强制介入                  │
│                                                          │
│ 🎯 极限止盈兜底：5R（盈利=5倍风险）                    │
│   • 意外暴涨时的最后兜底保护                            │
│   • 正常情况由分批止盈优先处理                          │
│                                                          │
│ 📊 分批止盈（主要机制）：基于风险倍数（R-Multiple）    │
│                                                          │
│   1R（盈利 = 1倍风险）：                                │
│   ├─ 平仓 1/3 仓位（锁定部分利润）                      │
│   └─ 止损移至成本价（确保该笔交易至少不亏）            │
│                                                          │
│   2R（盈利 = 2倍风险）：                                │
│   ├─ 平仓 1/3 仓位（继续锁定利润）                      │
│   └─ 止损移至1R位置（保护已有1倍风险利润）             │
│                                                          │
│   3R+（盈利 ≥ 3倍风险）：                               │
│   ├─ 保留 1/3 仓位（让利润奔跑）                        │
│   └─ 采用移动止损（2x ATR），博取大趋势行情            │
│                                                          │
│   核心原则：                                             │
│   • 风险倍数 R = 盈利距离 / 止损距离                    │
│   • 平衡"锁定利润"与"让利润奔跑"                       │
│   • 止损与止盈联动，逐步保护利润                        │
│   • 系统自动执行，无需AI手动干预                        │
│                                                          │
│ ⏰ 持仓时间 ≥ 36小时：强制平仓                         │
└─────────────────────────────────────────────────────────┘

💡 专业交易员的智慧：
"当盈利达到1R时，平仓1/3并将止损移至成本价，确保该笔交易
至少不亏。当盈利达到2R时，再平仓1/3。剩余仓位采用移动止损，
博取更大的趋势行情。这样既锁定了部分利润，又保留了让利润
继续增长的可能性。"
```

---

### 第六步：测试验证（1-2小时）

#### 测试场景1：完整的分批止盈流程

```typescript
假设：
- 开仓: 100张 @ $50,000
- 止损: $49,000 (-2% 价格距离)
- 风险 R = $1,000 (或 20% 含10x杠杆)
- 极限止盈: $55,000 (5R, +10%)

执行流程：
T1: 价格涨到 $51,000 (+2%, 1R)
    ✅ Stage1触发
    ├─ 平仓 33.33张（1/3）
    ├─ 止损移至 $50,000（成本价，保本）
    └─ 同步条件单：100张 → 66.67张
    
    剩余: 66.67张 @ $50,000, 止损 $50,000
    状态: 确保该笔交易至少不亏

T2: 价格涨到 $52,000 (+4%, 2R)
    ✅ Stage2触发
    ├─ 平仓 33.33张（剩余的50%，即总仓位的1/3）
    ├─ 止损移至 $51,000（1R位置，锁定1倍风险利润）
    └─ 同步条件单：66.67张 → 33.34张
    
    剩余: 33.34张 @ $50,000, 止损 $51,000
    状态: 锁定了66.67张的利润，无论如何不会亏损

T3: 价格涨到 $53,000 (+6%, 3R)
    ✅ Stage3触发
    ├─ 不平仓（保留1/3让利润奔跑）
    └─ 启用移动止损（2x ATR）
    
    剩余: 33.34张，使用移动止损跟踪

T4a: 价格继续涨到 $55,000 (5R，极限止盈触发)
    ✅ 极限止盈兜底
    └─ 平仓剩余33.34张
    
    总结:
    - 33.33张 @ $51,000 (+2%, +20% 含杠杆)
    - 33.33张 @ $52,000 (+4%, +40% 含杠杆)
    - 33.34张 @ $55,000 (+10%, +100% 含杠杆)
    - 平均: +5.33% 价格, +53.3% 含杠杆

T4b: 或者移动止损被触发
    ✅ 移动止损保护
    └─ 平仓剩余33.34张 @ 某个更高价格
    
    优势: 博取到了更大的趋势
```

#### 测试场景2：风险倍数计算验证

```typescript
// 测试不同杠杆下的风险倍数

案例1: 10倍杠杆
- 入场: $50,000
- 止损: $49,000 (-2% 价格, -20% 盈亏比)
- 1R目标: $51,000 (+2% 价格, +20% 盈亏比)
- 2R目标: $52,000 (+4% 价格, +40% 盈亏比)

验证: R = (51000 - 50000) / (50000 - 49000) = 1.0 ✅

案例2: 5倍杠杆
- 入场: $50,000
- 止损: $48,000 (-4% 价格, -20% 盈亏比)
- 1R目标: $52,000 (+4% 价格, +20% 盈亏比)
- 2R目标: $54,000 (+8% 价格, +40% 盈亏比)

验证: R = (52000 - 50000) / (50000 - 48000) = 1.0 ✅

结论: 风险倍数与杠杆无关，只与价格距离有关
```

#### 验收清单

- [ ] 风险倍数计算正确
- [ ] 1R触发时平仓1/3，止损移至成本价
- [ ] 2R触发时平仓1/3，止损移至1R
- [ ] 3R触发时启用移动止损
- [ ] 条件单数量正确同步
- [ ] 数据库记录完整（包含r_multiple）
- [ ] 日志清晰显示风险倍数和执行逻辑
- [ ] 极限止盈(5R)作为最后兜底

---

## 📊 方案对比：V1.0 vs V2.0

| 维度 | V1.0（固定百分比） | V2.0（风险倍数）⭐ |
|-----|------------------|-------------------|
| **止盈触发条件** | 固定百分比（30%/40%/50%） | 风险倍数（1R/2R/3R+） |
| **适应性** | 所有交易统一标准 | 根据实际风险动态调整 |
| **专业性** | 业余水平 | 专业交易员标准 |
| **止损联动** | ❌ 无 | ✅ 每阶段移动止损 |
| **利润保护** | 仅分批平仓 | 分批+止损联动+移动止损 |
| **理论基础** | 经验主义 | 风险管理理论 |
| **可回测性** | 一般 | 优秀（明确的R值） |

**升级要点：**

1. **从固定百分比 → 风险倍数**
   - ❌ 不再使用 "+30%" 这样的固定值
   - ✅ 改用 "1R"（1倍风险）这样的相对值

2. **引入止损联动**
   - ❌ V1.0: 分批平仓后止损不变
   - ✅ V2.0: 1R→止损至成本价，2R→止损至1R

3. **最后1/3用移动止损**
   - ❌ V1.0: 3R也是固定平仓
   - ✅ V2.0: 3R保留仓位，用移动止损博取大趋势

---

## 🎯 核心价值

### 体现专业交易员的"让利润奔跑"智慧

```typescript
┌─────────────────────────────────────────┐
│  "在趋势交易中，最大的利润往往来自     │
│   最后的1/3仓位。前面的分批平仓是       │
│   为了保证心态，最后的仓位才是为了       │
│   抓住真正的大行情。"                   │
│                                          │
│  -- 专业量化交易员的核心理念             │
└─────────────────────────────────────────┘
```

**V2.0完美实现了这个理念：**

1. **1R锁定1/3**：心理安慰，确保不亏
2. **2R再锁1/3**：保护利润，留有余地
3. **3R让利润奔跑**：移动止损，博取10R、20R的超级行情

---

## 📅 实施时间表（更新）

| 步骤 | 任务 | 预计时间 | 累计时间 |
|-----|------|---------|---------|
| 1 | 重新设计分批止盈配置 | 1小时 | 1小时 |
| 2 | 实现风险倍数分批止盈工具 | 3-4小时 | 4-5小时 |
| 3 | 数据库表结构调整 | 0.5小时 | 4.5-5.5小时 |
| 4 | 条件单同步服务（同V1.0） | 2-3小时 | 6.5-8.5小时 |
| 5 | 更新AI提示词 | 0.5小时 | 7-9小时 |
| 6 | 测试验证 | 1-2小时 | 8-11小时 |
| **总计** | | **8-11小时** | |

- 注：相比V1.0增加了3-5小时，但核心价值提升显著**

---

**文档版本：** v2.0（基于风险倍数的专业版）
**创建时间：** 2025-11-10
**状态：** ✅ 推荐执行（体现专业交易员智慧）
