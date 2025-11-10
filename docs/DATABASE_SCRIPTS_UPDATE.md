# 数据库脚本更新说明

## 更新目的

为支持新的 R-multiple 分批止盈系统,更新了数据库管理相关的脚本和工具,确保它们能够正确处理新增的 `partial_take_profit_history` 表。

## 更新内容

### 1. 数据库状态查看脚本 (`scripts/db-status.sh`)

**新增功能:**

- 显示分批止盈历史记录总数
- 显示最近 5 次分批止盈执行记录
- 显示条件单（止损止盈订单）统计和活跃订单
- 显示平仓事件记录和最近事件
- 记录包含:
  - 执行时间
  - 交易对
  - 阶段 (Stage 1/2/3)
  - R倍数
  - 平仓百分比
  - 触发价格
  - 盈亏金额
  - 平仓原因（止损/止盈/手动/强制）

**使用示例:**

```bash
npm run db:status
```

**输出示例:**

```text
📋 条件单记录数: 8
活跃条件单:
   BTC_USDT_SWAP [止损] 触发价: 44000 | 订单ID: 123456

🔔 平仓事件记录数: 15
最近 5 次平仓事件:
   [2025-01-15 14:20:15] BTC_USDT_SWAP [止损触发] @ 44050 | 盈亏: -120.50 USDT (-2.41%)
   [2025-01-15 15:30:22] ETH_USDT_SWAP [止盈触发] @ 2500 | 盈亏: +250.00 USDT (+5.00%)

🎯 分批止盈记录数: 12
最近 5 次分批止盈:
   [2025-01-15 14:30:21] BTC_USDT_SWAP Stage1 (R=1.00) 平仓40% @ 45500 | 盈亏: +180.50 USDT
   [2025-01-15 15:45:33] ETH_USDT_SWAP Stage2 (R=2.15) 平仓30% @ 2450 | 盈亏: +95.20 USDT
   ...
```

### 2. 数据库重置脚本 (`src/database/reset.ts`)

**更新内容:**

- 在删除表时添加对 `partial_take_profit_history` 表的删除
- 确保完全重置时清空所有数据,包括分批止盈历史

**影响的命令:**

```bash
npm run db:reset
```

### 3. 平仓并重置脚本 (`src/database/close-and-reset.ts`)

**更新内容:**

- 在 `CREATE_TABLES_SQL` 中添加 `partial_take_profit_history` 表的定义
- 在删除表时添加对 `partial_take_profit_history` 表的删除
- 添加相关索引以提高查询性能:
  - `idx_partial_taking_profit_symbol`: 按交易对查询
  - `idx_partial_taking_profit_status`: 按状态查询

**影响的命令:**

```bash
npm run db:close-and-reset
bash scripts/close-and-reset.sh
```

## 数据库表结构

### partial_take_profit_history 表

```sql
CREATE TABLE IF NOT EXISTS partial_take_profit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,                -- 交易对
    stage INTEGER NOT NULL,              -- 阶段: 1=1R, 2=2R, 3=3R+
    r_multiple REAL NOT NULL,            -- 当时的R倍数
    trigger_price REAL NOT NULL,         -- 触发价格
    close_percent REAL NOT NULL,         -- 平仓百分比
    closed_quantity REAL NOT NULL,       -- 已平仓数量
    remaining_quantity REAL NOT NULL,    -- 剩余数量
    pnl REAL NOT NULL,                   -- 本次盈亏
    new_stop_loss_price REAL,            -- 新的止损价格
    status TEXT NOT NULL DEFAULT 'completed',  -- 状态
    notes TEXT,                          -- 备注
    timestamp TEXT NOT NULL              -- 执行时间
);
```

## 兼容性说明

### 向后兼容

- 旧的数据库不会受到影响
- 首次运行迁移脚本会自动创建新表
- 没有分批止盈记录时,状态查看脚本会显示 0 条记录

### 迁移步骤

如果你的数据库是在更新前创建的,请运行以下命令以添加新表:

```bash
npm run db:migrate:partial-tp
```

或者完全重置数据库:

```bash
npm run db:reset
```

## 测试建议

### 1. 检查数据库状态

```bash
npm run db:status
```

### 2. 测试分批止盈功能

运行系统后,系统会自动在达到 R-multiple 目标时执行分批止盈,然后可以查看:

```bash
npm run db:status
```

### 3. 验证数据完整性

使用 SQLite 工具直接查询:

```bash
sqlite3 .voltagent/trading.db "SELECT * FROM partial_take_profit_history ORDER BY timestamp DESC LIMIT 10;"
```

## 相关文件

- `/scripts/db-status.sh` - 数据库状态查看脚本
- `/src/database/reset.ts` - 数据库重置脚本
- `/src/database/close-and-reset.ts` - 平仓并重置脚本
- `/src/database/schema.ts` - 数据库schema定义
- `/src/database/migrate-add-partial-take-profit-history.ts` - 迁移脚本

## 注意事项

1. **数据备份**: 在执行重置操作前,建议备份数据库文件
2. **生产环境**: 在生产环境中不要轻易使用 `db:reset`,会清空所有历史数据
3. **性能优化**: 新增的索引会提高查询性能,但会略微增加写入开销
4. **监控建议**: 定期查看 `db:status` 以监控分批止盈的执行情况

## 更新日期

2025-01-15

## 作者

losesky

---

**License**: GNU AGPL v3
