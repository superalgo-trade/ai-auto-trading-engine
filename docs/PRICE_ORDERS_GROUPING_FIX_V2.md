# 条件单分组显示问题修复 - 使用开仓订单ID关联

## 📋 问题描述

在前端"止盈止损"列表中，同一币种的多组条件单(止损+止盈)无法正确显示。

### 🐛 核心问题

**问题1**: 时间戳分组方案有严重缺陷

- 移动止损时，新止损订单与旧止盈订单时间相差很大
- 单独修改止损或止盈，无法保持配对关系
- 部分触发后重建，时间戳完全不同

**问题2**: 同一币种不同批次的订单被错误合并

- 只使用 `symbol_side_status` 作为分组键
- 导致多组历史记录只显示一组

### 💡 正确的解决方案

**使用开仓订单ID (`position_order_id`) 作为关联键**

✅ 开仓时记录订单ID  
✅ 创建止损止盈时关联该ID  
✅ 移动止损时保持关联  
✅ 前端按 `position_order_id` 分组  

---

## 🔧 实施方案

### 第1步: 修改数据库表结构

添加 `position_order_id` 字段到 `price_orders` 表:

```sql
ALTER TABLE price_orders ADD COLUMN position_order_id TEXT;
CREATE INDEX idx_price_orders_position_order_id ON price_orders(position_order_id);
```

**执行脚本**:

```bash
./scripts/add-position-order-id.sh
```

**表结构**:

```bash
id                  INTEGER PRIMARY KEY
order_id            TEXT NOT NULL UNIQUE    -- 条件单自己的ID
symbol              TEXT NOT NULL
side                TEXT NOT NULL
type                TEXT NOT NULL           -- 'stop_loss' 或 'take_profit'
trigger_price       REAL NOT NULL
order_price         REAL NOT NULL
quantity            REAL NOT NULL
status              TEXT NOT NULL           -- 'active', 'triggered', 'cancelled'
created_at          TEXT NOT NULL
updated_at          TEXT
triggered_at        TEXT
position_order_id   TEXT                    -- 🆕 关联的开仓订单ID
```

---

### 第2步: 修改开仓代码

**文件**: `src/tools/trading/tradeExecution.ts`

**修改点**: 创建条件单时传入开仓订单ID

```typescript
// 保存条件单到数据库（使用实际价格，并关联开仓订单ID）
const positionOrderId = order.id?.toString() || "";

if (slOrderId) {
  await dbClient.execute({
    sql: `INSERT INTO price_orders 
          (order_id, symbol, side, type, trigger_price, order_price, quantity, status, created_at, position_order_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [slOrderId, symbol, side, 'stop_loss', actualStopLoss, 0, finalQuantity, 'active', now, positionOrderId]
  });
}

if (tpOrderId) {
  await dbClient.execute({
    sql: `INSERT INTO price_orders 
          (order_id, symbol, side, type, trigger_price, order_price, quantity, status, created_at, position_order_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [tpOrderId, symbol, side, 'take_profit', actualTakeProfit, 0, finalQuantity, 'active', now, positionOrderId]
  });
}
```

---

### 第3步: 修改止损移动代码

**文件**: `src/tools/trading/stopLossManagement.ts`

**关键逻辑**: 移动止损时从旧条件单继承 `position_order_id`

```typescript
// 0. 从旧的条件单中获取 position_order_id
let positionOrderId: string | null = null;
const oldOrderResult = await dbClient.execute({
  sql: `SELECT position_order_id FROM price_orders 
        WHERE symbol = ? AND status = 'active' AND position_order_id IS NOT NULL
        LIMIT 1`,
  args: [symbol],
});

if (oldOrderResult.rows.length > 0) {
  positionOrderId = oldOrderResult.rows[0].position_order_id as string;
}

// 1. 取消旧条件单
await dbClient.execute({
  sql: `UPDATE price_orders SET status = 'cancelled', updated_at = ? WHERE symbol = ? AND status = 'active'`,
  args: [now, symbol],
});

// 2. 创建新条件单，保持 position_order_id 关联
await dbClient.execute({
  sql: `INSERT INTO price_orders 
        (order_id, symbol, side, type, trigger_price, order_price, quantity, status, created_at, position_order_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [..., positionOrderId]  // 保持关联
});
```

---

### 第4步: 修改前端分组逻辑

**文件**: `public/monitor-script.js`

**关键改进**: 优先使用 `position_order_id`，向后兼容时间戳方案

```javascript
recentOrders.forEach(order => {
    let key;
    
    if (order.position_order_id) {
        // ✅ 优先使用 position_order_id (开仓订单ID) 作为分组键
        key = `${order.symbol}_${order.side}_${order.position_order_id}`;
    } else {
        // ⚠️ 对于没有 position_order_id 的历史数据，使用时间戳分组（向后兼容）
        const createdTimestamp = new Date(order.created_at).getTime();
        key = `${order.symbol}_${order.side}_${Math.floor(createdTimestamp / 1000)}`;
    }
    
    if (!groupedOrders[key]) {
        groupedOrders[key] = {
            symbol: order.symbol,
            side: order.side,
            status: order.status,
            quantity: order.quantity,
            created_at: order.created_at,
            position_order_id: order.position_order_id,  // 🆕 记录开仓订单ID
            stopLoss: null,
            takeProfit: null,
            stopLossStatus: null,
            takeProfitStatus: null
        };
    }
    
    // 记录止损/止盈价格和状态
    if (order.type === 'stop_loss') {
        groupedOrders[key].stopLoss = order.trigger_price;
        groupedOrders[key].stopLossStatus = order.status;
    } else if (order.type === 'take_profit') {
        groupedOrders[key].takeProfit = order.trigger_price;
        groupedOrders[key].takeProfitStatus = order.status;
    }
    
    // 更新组的整体状态
    if (order.status === 'triggered') {
        groupedOrders[key].status = 'triggered';
    } else if (order.status === 'active' && groupedOrders[key].status !== 'triggered') {
        groupedOrders[key].status = 'active';
    }
});
```

---

## 📊 数据关联示意图

### 开仓流程

```bash
开仓订单 (order.id = "12345")
    ├─> 止损单 (order_id = "SL001", position_order_id = "12345")
    └─> 止盈单 (order_id = "TP001", position_order_id = "12345")
```

### 移动止损流程

```bash
开仓订单 (order.id = "12345")
    ├─> 旧止损单 (order_id = "SL001", position_order_id = "12345") [cancelled]
    ├─> 新止损单 (order_id = "SL002", position_order_id = "12345") [active] ✅ 继承关联
    └─> 原止盈单 (order_id = "TP001", position_order_id = "12345") [active]
```

**关键**: 无论何时创建，都通过 `position_order_id` 关联到同一个开仓订单！

---

## ✅ 修复效果

### 修复前（时间戳方案）

**问题场景**: 移动止损后

```bash
开仓订单 "12345"
├─> 止盈单 (created_at: 23:28:22, position_order_id = "12345")
└─> 新止损单 (created_at: 23:43:19, position_order_id = "12345")
```

❌ 旧方案: 时间戳不同 → 分到不同组 → 显示异常

### 修复后（开仓订单ID方案）

**同样场景**:

```bash
开仓订单 "12345"
├─> 止盈单 (position_order_id = "12345")
└─> 新止损单 (position_order_id = "12345")
```

✅ 新方案: `position_order_id` 相同 → 分到同一组 → 显示正确！

### 前端显示

```bash
币种  方向  止损价格              当前价格  止盈价格              数量   状态    创建时间
BNB   LONG  $988.61 (-0.96%)      $998.47   $998.47 (+1.03%)      1250   活跃    11/10 23:59
LTC   LONG  $107.39 (-0.36%) ✓    $107.39   $112.03 (+3.95%) ✕    132    已触发  11/10 23:43
LTC   LONG  $107.39 (-0.36%) ✕    $107.78   $108.08 (+0.27%) ✓    133    已触发  11/10 23:28
```

**说明**:

- ✓ = 已触发(triggered)
- ✕ = 已取消(cancelled)
- 每组都是同一个开仓订单的止损+止盈配对

---

## 🎯 技术要点

### 为什么使用 `position_order_id`?

| 方案 | 优点 | 缺点 |
|------|------|------|
| **时间戳分组** | 实现简单 | ❌ 移动止损后时间不同 ❌ 无法处理单独修改 |
| **开仓订单ID** | ✅ 永久关联 ✅ 支持任意修改 ✅ 逻辑清晰 | 需要修改数据库 |

### 向后兼容

对于没有 `position_order_id` 的历史数据:

- 前端自动降级到时间戳分组
- 不影响历史数据的显示
- 新数据自动使用正确的关联

### 状态优先级

```bash
triggered > active > cancelled
```

如果一组中止损触发、止盈取消，整组状态显示为"已触发"。

---

## 📝 修改的文件清单

### 1. 数据库脚本

- ✅ `scripts/add-position-order-id.sh` - 添加字段的迁移脚本

### 2. 后端代码

- ✅ `src/tools/trading/tradeExecution.ts` - 开仓时记录关联
- ✅ `src/tools/trading/stopLossManagement.ts` - 移动止损时保持关联

### 3. 前端代码

- ✅ `public/monitor-script.js` - 按 `position_order_id` 分组
- ✅ `public/monitor-styles.css` - 状态标识样式

### 4. 文档

- ✅ `docs/PRICE_ORDERS_GROUPING_FIX_V2.md` - 本文档

---

## 🧪 测试场景

### 1. 正常开仓

- [x] 创建止损止盈时记录 `position_order_id`
- [x] 前端正确分组显示

### 2. 移动止损

- [x] 取消旧止损，创建新止损
- [x] 新止损继承 `position_order_id`
- [x] 前端仍然与止盈在同一组

### 3. 单独修改止盈

- [x] 取消旧止盈，创建新止盈
- [x] 新止盈继承 `position_order_id`
- [x] 前端仍然与止损在同一组

### 4. 历史数据兼容

- [x] 没有 `position_order_id` 的数据降级到时间戳分组
- [x] 显示正常，不报错

---

## 🎉 总结

这次修复彻底解决了条件单分组显示问题，核心改进：

1. ✅ **数据关联**: 使用开仓订单ID永久关联
2. ✅ **支持修改**: 移动止损/止盈保持分组
3. ✅ **视觉优化**: ✓/✕标识，一目了然
4. ✅ **向后兼容**: 历史数据自动降级
5. ✅ **代码规范**: 数据库设计更合理

**修复日期**: 2025-11-11  
**版本**: V2 (基于开仓订单ID关联)
