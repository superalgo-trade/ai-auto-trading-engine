# 条件单列表分组显示问题修复

## 问题描述

在前端"止盈止损"列表中,同一币种的多组条件单(止损+止盈)无法正确显示,导致只显示一组记录而不是全部记录。

### 问题现象

数据库中的数据:
```
id | order_id            | symbol | side | type        | trigger_price | quantity | status    | created_at           | triggered_at
1  | 1987905177549537280 | LTC    | long | stop_loss   | 107.3925      | 133.0    | cancelled | 2025-11-10 15:28:22  | 
2  | 1987905178346455040 | LTC    | long | take_profit | 108.075       | 133.0    | triggered | 2025-11-10 15:28:22  | 2025-11-10 15:33:40
3  | 1987908938607099904 | LTC    | long | stop_loss   | 107.3925      | 132.0    | triggered | 2025-11-10 15:43:19  | 2025-11-10 15:51:10
4  | 1987908939324325888 | LTC    | long | take_profit | 112.035       | 132.0    | cancelled | 2025-11-10 15:43:19  | 
5  | 1987912996369727488 | BNB    | long | stop_loss   | 988.6104      | 1250.0   | active    | 2025-11-10 15:59:26  | 
6  | 1987912997078564864 | BNB    | long | take_profit | 998.4708      | 1250.0   | active    | 2025-11-10 15:59:26  | 
```

- **第一组 LTC**(id 1-2): 15:28:22 创建,止盈触发 ✅ + 止损取消 ❌
- **第二组 LTC**(id 3-4): 15:43:19 创建,止损触发 ✅ + 止盈取消 ❌
- **第三组 BNB**(id 5-6): 15:59:26 创建,两个都活跃 ⏳

前端实际只显示了 **1组 LTC** 记录,而不是 **2组**。

## 根本原因

问题出在 `public/monitor-script.js` 的分组逻辑:

```javascript
// 🐛 错误的分组键
const key = `${order.symbol}_${order.side}_${order.status}`;
```

这个分组键只包含:
- `symbol`: 币种(如 LTC)
- `side`: 方向(long/short)  
- `status`: 状态(active/triggered/cancelled)

**致命缺陷**: 同一币种的两组不同时间创建的订单,如果状态相同,会被错误地合并到同一组!

### 错误分组示例

使用旧的分组逻辑:
- `LTC_long_triggered` → 包含 id=2(止盈) 或 id=3(止损),只保留一个
- `LTC_long_cancelled` → 包含 id=1(止损) 或 id=4(止盈),只保留一个

结果:两组 LTC 订单被错误合并成一组显示。

## 解决方案

### 1. 修改分组键逻辑

在分组键中加入 **创建时间戳**,以区分不同批次的订单:

```javascript
// ✅ 正确的分组键
const createdTimestamp = new Date(order.created_at).getTime();
const key = `${order.symbol}_${order.side}_${Math.floor(createdTimestamp / 1000)}`;
```

**说明**:
- 使用秒级时间戳(`Math.floor(createdTimestamp / 1000)`)进行分组
- 同一批次创建的止损和止盈订单时间戳相近(通常在同一秒内),会被分到同一组
- 不同批次的订单时间戳不同,会被分到不同组

### 2. 增强状态追踪

为每个止损和止盈单独记录状态:

```javascript
if (order.type === 'stop_loss') {
    groupedOrders[key].stopLoss = order.trigger_price;
    groupedOrders[key].stopLossStatus = order.status;  // 🆕 记录止损状态
} else if (order.type === 'take_profit') {
    groupedOrders[key].takeProfit = order.trigger_price;
    groupedOrders[key].takeProfitStatus = order.status;  // 🆕 记录止盈状态
}
```

### 3. 优化状态显示逻辑

更新组的整体状态,优先级: `triggered > active > cancelled`

```javascript
// 更新组的整体状态
if (order.status === 'triggered') {
    groupedOrders[key].status = 'triggered';
} else if (order.status === 'active' && groupedOrders[key].status !== 'triggered') {
    groupedOrders[key].status = 'active';
} else if (!groupedOrders[key].status || groupedOrders[key].status === 'cancelled') {
    groupedOrders[key].status = order.status;
}
```

### 4. 添加视觉标识

在止损和止盈价格旁边添加状态标识:

```javascript
// 止损价格后添加状态标识
const statusBadge = group.stopLossStatus === 'triggered' ? ' <span class="status-badge triggered">✓</span>' :
                   group.stopLossStatus === 'cancelled' ? ' <span class="status-badge cancelled">✕</span>' : '';
stopLossText = `$${formatPriceBySymbol(group.symbol, group.stopLoss)}${statusBadge}`;
```

### 5. 美化CSS样式

添加状态标识样式:

```css
.positions-table .status-badge {
    display: inline-block;
    font-size: 0.75em;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: 6px;
}

.positions-table .status-badge.triggered {
    background-color: rgba(0, 255, 170, 0.2);
    color: var(--accent-green);
    border: 1px solid var(--accent-green);
    text-shadow: 0 0 3px var(--accent-green);
}

.positions-table .status-badge.cancelled {
    background-color: rgba(136, 136, 136, 0.2);
    color: #888;
    border: 1px solid #666;
}
```

## 修复效果

修复后,前端将正确显示:

```
币种  方向  止损价格              当前价格  止盈价格              数量   状态    创建时间
BNB   LONG  $988.61 (-0.96%)      $998.47   $998.47 (+1.03%)      1250   活跃    11/10 23:59
LTC   LONG  $107.39 (-0.36%) ✓    $107.39   $112.03 (+3.95%) ✕    132    已触发  11/10 23:43
LTC   LONG  $107.39 (-0.36%) ✕    $107.78   $108.08 (+0.27%) ✓    133    已触发  11/10 23:28
```

**说明**:
- ✓ = 已触发(triggered)
- ✕ = 已取消(cancelled)
- 无标识 = 活跃(active)

## 影响范围

### 修改的文件

1. **`public/monitor-script.js`**
   - 修改分组键逻辑(第 307-344 行)
   - 增强状态追踪和显示(第 383-407 行)

2. **`public/monitor-styles.css`**
   - 添加状态标识样式(第 1044-1066 行)

### 兼容性

- ✅ 不影响后端API
- ✅ 不影响数据库结构
- ✅ 仅修改前端展示逻辑
- ✅ 向后兼容旧数据

## 测试建议

1. **查看历史记录**: 验证历史订单能正确分组显示
2. **创建新订单**: 验证新订单能正确显示
3. **触发订单**: 验证触发/取消状态能正确显示标识
4. **多币种测试**: 验证不同币种的订单不会混淆

## 技术要点

### 为什么使用秒级时间戳?

```javascript
Math.floor(createdTimestamp / 1000)
```

- 同一批次的止损和止盈订单通常在几十毫秒内创建完成
- 秒级时间戳可以将它们分到同一组
- 不同批次的订单至少相隔几秒甚至几分钟,能有效区分

### 状态优先级设计

`triggered > active > cancelled`

- **triggered**: 订单已执行,最重要
- **active**: 订单等待中,次重要  
- **cancelled**: 订单已取消,最不重要

如果一组中止损触发、止盈取消,整组状态显示为"已触发"。

## 总结

这次修复解决了条件单列表无法正确显示多组历史记录的问题。核心改进是:

1. ✅ **分组键优化**: 加入时间戳区分不同批次
2. ✅ **状态追踪**: 单独记录止损和止盈的状态
3. ✅ **视觉优化**: 添加✓/✕标识,一目了然
4. ✅ **状态智能**: 自动判断组的整体状态

修复日期: 2025-11-11
