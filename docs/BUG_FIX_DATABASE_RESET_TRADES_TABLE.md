# Bug 修复报告: 数据库重置未完全清空 trades 表

## 🐛 Bug 描述

执行 `npm run db:close-and-reset` 或 `npm run db:reset` 后，数据库状态显示仍然保留了旧的交易记录。

### 问题现象

```bash
npm run db:close-and-reset

# 执行完成后，查看状态:
📝 交易记录数: 9

最近 5 笔交易:
   [2025/11/10 12:45:58] ADA undefined 7142 张 @ 0.5893
   [2025/11/10 12:45:13] HYPE undefined 117.97 张 @ 42.658
   # ... (应该是0条记录)
```

**预期行为:** 交易记录应该被完全清空，显示 0 条记录。

**实际行为:** 交易记录没有被删除，旧数据仍然存在。

---

## 🔍 根本原因

### 表名不一致

数据库中实际使用的表名和重置脚本中删除的表名不匹配:

| 位置 | 实际表名 | 脚本中的表名 | 结果 |
|------|---------|------------|------|
| **schema.ts** | `trades` | - | ✅ 正确定义 |
| **db-status.sh** | `trades` | - | ✅ 正确查询 |
| **reset.ts (旧)** | - | `trade_logs` | ❌ 删除了错误的表 |
| **close-and-reset.ts (旧)** | - | `trade_logs` | ❌ 删除了错误的表 |

### 问题根源

1. **Schema 定义正确:** `src/database/schema.ts` 中定义的是 `trades` 表
2. **查询正确:** `scripts/db-status.sh` 查询的是 `trades` 表
3. **删除错误:** 重置脚本删除的是 `trade_logs` 表（不存在的表）

**结果:**

- 删除操作成功执行（SQLite 的 `DROP TABLE IF EXISTS` 不会报错）
- 但实际的 `trades` 表没有被删除
- 重新创建表时，由于 `trades` 表已存在，旧数据保留

---

## ✅ 修复方案

### 1. 统一使用 schema.ts 中的定义

**修改文件:**

- `src/database/reset.ts`
- `src/database/close-and-reset.ts`

**修改内容:**

#### A. 导入正确的 CREATE_TABLES_SQL

```typescript
// 修改前
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS trade_logs (
  // ...
);
`;

// 修改后
import { CREATE_TABLES_SQL } from "./schema";
```

#### B. 删除正确的表名

```typescript
// 修改前
await client.execute("DROP TABLE IF EXISTS trade_logs");

// 修改后  
await client.execute("DROP TABLE IF EXISTS trades");
```

#### C. 添加遗漏的 system_config 表

```typescript
// 新增
await client.execute("DROP TABLE IF EXISTS system_config");
```

---

## 📋 修改清单

### 文件 1: `src/database/reset.ts`

**修改内容:**

1. ✅ 导入 `CREATE_TABLES_SQL` from `./schema`
2. ✅ 删除本地的 `CREATE_TABLES_SQL` 定义
3. ✅ 修改 `trade_logs` → `trades`
4. ✅ 添加 `system_config` 表的删除

**修改后的删除列表:**

```typescript
await client.execute("DROP TABLE IF EXISTS trades");           // 修正
await client.execute("DROP TABLE IF EXISTS agent_decisions");
await client.execute("DROP TABLE IF EXISTS trading_signals");
await client.execute("DROP TABLE IF EXISTS positions");
await client.execute("DROP TABLE IF EXISTS account_history");
await client.execute("DROP TABLE IF EXISTS price_orders");
await client.execute("DROP TABLE IF EXISTS position_close_events");
await client.execute("DROP TABLE IF EXISTS partial_take_profit_history");
await client.execute("DROP TABLE IF EXISTS system_config");    // 新增
```

### 文件 2: `src/database/close-and-reset.ts`

**修改内容:**

1. ✅ 导入 `CREATE_TABLES_SQL` from `./schema`
2. ✅ 删除本地的 `CREATE_TABLES_SQL` 定义
3. ✅ 修改 `trade_logs` → `trades`
4. ✅ 添加 `system_config` 表的删除

---

## 🧪 验证修复

### 测试步骤

```bash
# 1. 编译检查
npm run typecheck
# ✅ 无错误

# 2. 执行重置
npm run db:close-and-reset

# 3. 检查状态
npm run db:status

# 预期结果:
# 📝 交易记录数: 0
# (不应该有任何旧交易记录)
```

### 预期输出

```bash
📊 账户历史记录: 1

💰 最新账户状态:
   总资产: 5000 USDT
   可用资金: 5000 USDT
   未实现盈亏: 0 USDT
   总收益率: 0%
   更新时间: 2025/11/10 14:16:02

📈 当前持仓数: 0

📝 交易记录数: 0          ✅ 应该是 0

🤖 AI 决策记录数: 0

📋 条件单记录数: 0

🔔 平仓事件记录数: 0

🎯 分批止盈记录数: 0
```

---

## 📊 影响范围

### 受影响的命令

1. ✅ `npm run db:reset` - 修复后会正确删除 trades 表
2. ✅ `npm run db:close-and-reset` - 修复后会正确删除 trades 表

### 不受影响的功能

- ✅ 数据库初始化 (`npm run db:init`)
- ✅ 持仓同步 (`npm run db:sync-positions`)
- ✅ 正常的交易记录写入

---

## 🎯 根本解决方案

### 最佳实践: Single Source of Truth

**原则:** 所有数据库 schema 定义应该集中在一个地方。

**实施:**

1. ✅ **唯一定义:** 所有表结构定义在 `src/database/schema.ts`
2. ✅ **导入使用:** 其他文件导入并使用这个定义
3. ✅ **避免重复:** 不要在多个文件中重复定义相同的 schema

**好处:**

- ✅ 避免不一致
- ✅ 易于维护
- ✅ 减少错误

---

## 🔄 未来改进

### 建议 1: 添加表名常量

```typescript
// src/database/constants.ts
export const TABLE_NAMES = {
  TRADES: 'trades',
  POSITIONS: 'positions',
  ACCOUNT_HISTORY: 'account_history',
  TRADING_SIGNALS: 'trading_signals',
  AGENT_DECISIONS: 'agent_decisions',
  PRICE_ORDERS: 'price_orders',
  POSITION_CLOSE_EVENTS: 'position_close_events',
  PARTIAL_TAKE_PROFIT_HISTORY: 'partial_take_profit_history',
  SYSTEM_CONFIG: 'system_config',
} as const;
```

### 建议 2: 添加删除表的辅助函数

```typescript
// src/database/helpers.ts
import { TABLE_NAMES } from './constants';

export async function dropAllTables(client: Client) {
  const tables = Object.values(TABLE_NAMES);
  for (const table of tables) {
    await client.execute(`DROP TABLE IF EXISTS ${table}`);
  }
}
```

### 建议 3: 添加集成测试

```typescript
// tests/database-reset.test.ts
describe('Database Reset', () => {
  it('should completely clear trades table', async () => {
    // 插入测试数据
    await insertTestTrade();
    
    // 执行重置
    await resetDatabase();
    
    // 验证
    const count = await getTradesCount();
    expect(count).toBe(0);
  });
});
```

---

## 📝 总结

### 问题

- ❌ 重置脚本删除错误的表名 (`trade_logs` vs `trades`)
- ❌ CREATE_TABLES_SQL 定义重复且不一致

### 修复

- ✅ 统一使用 `schema.ts` 中的定义
- ✅ 修正表名为 `trades`
- ✅ 添加遗漏的 `system_config` 表

### 影响

- ✅ `npm run db:reset` 现在正确工作
- ✅ `npm run db:close-and-reset` 现在正确工作
- ✅ 所有历史数据都会被正确清空

### 预防

- ✅ Single Source of Truth 原则
- ✅ 使用常量避免拼写错误
- ✅ 添加集成测试验证

---

**修复日期:** 2025-11-10  
**修复人:** losesky  
**影响版本:** v0.1.0  
**修复类型:** Bug Fix  
**严重程度:** 🔴 High (数据清理功能失效)
