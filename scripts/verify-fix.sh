#!/bin/bash

# 异常交易数据修复 - 验证脚本
# 用于验证修复后的系统运行状态

set -e

echo "======================================================"
echo "  异常交易数据修复 - 验证报告"
echo "======================================================"
echo ""

DB_FILE="./.voltagent/trading.db"

if [ ! -f "$DB_FILE" ]; then
    echo "❌ 错误：数据库文件不存在"
    exit 1
fi

# 1. 检查唯一索引是否存在
echo "📊 检查1: 验证唯一索引..."
INDEX_EXISTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_close_events_trigger_order_unique';")

if [ "$INDEX_EXISTS" -eq 1 ]; then
    echo "✅ 唯一索引已正确创建"
else
    echo "❌ 错误：唯一索引不存在"
    exit 1
fi

# 2. 检查重复记录
echo ""
echo "📊 检查2: 扫描重复的平仓事件记录..."
DUPLICATES=$(sqlite3 "$DB_FILE" "
    SELECT COUNT(*) FROM (
        SELECT trigger_order_id, COUNT(*) as cnt 
        FROM position_close_events 
        WHERE trigger_order_id IS NOT NULL AND trigger_order_id != ''
        GROUP BY trigger_order_id 
        HAVING COUNT(*) > 1
    );
")

if [ "$DUPLICATES" -eq 0 ]; then
    echo "✅ 无重复记录"
else
    echo "⚠️  发现 $DUPLICATES 个重复的条件单ID"
    echo ""
    echo "详细信息:"
    sqlite3 "$DB_FILE" "
        SELECT trigger_order_id, COUNT(*) as count 
        FROM position_close_events 
        WHERE trigger_order_id IS NOT NULL AND trigger_order_id != ''
        GROUP BY trigger_order_id 
        HAVING COUNT(*) > 1
        ORDER BY count DESC;
    "
fi

# 3. 检查数据完整性
echo ""
echo "📊 检查3: 数据完整性验证..."

TOTAL_CLOSE_EVENTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM position_close_events;")
TOTAL_CLOSE_TRADES=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM trades WHERE type='close';")
UNIQUE_TRIGGER_IDS=$(sqlite3 "$DB_FILE" "SELECT COUNT(DISTINCT trigger_order_id) FROM position_close_events WHERE trigger_order_id IS NOT NULL AND trigger_order_id != '';")

echo "  平仓事件记录数: $TOTAL_CLOSE_EVENTS"
echo "  平仓交易记录数: $TOTAL_CLOSE_TRADES"
echo "  唯一条件单ID数: $UNIQUE_TRIGGER_IDS"

# 4. 检查不一致状态
echo ""
echo "📊 检查4: 系统不一致状态..."

UNRESOLVED_ISSUES=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM inconsistent_states WHERE resolved = 0;")

if [ "$UNRESOLVED_ISSUES" -eq 0 ]; then
    echo "✅ 无未解决的不一致状态"
else
    echo "⚠️  发现 $UNRESOLVED_ISSUES 个未解决的不一致状态"
    echo ""
    echo "详细信息:"
    sqlite3 "$DB_FILE" "
        SELECT operation, symbol, error_message, created_at 
        FROM inconsistent_states 
        WHERE resolved = 0 
        ORDER BY created_at DESC 
        LIMIT 5;
    " -header -column
fi

# 5. 检查孤儿条件单
echo ""
echo "📊 检查5: 孤儿条件单检测..."

ORPHAN_ORDERS=$(sqlite3 "$DB_FILE" "
    SELECT COUNT(*) FROM price_orders po
    WHERE status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM positions p 
        WHERE p.symbol = po.symbol AND p.side = po.side
    );
")

if [ "$ORPHAN_ORDERS" -eq 0 ]; then
    echo "✅ 无孤儿条件单"
else
    echo "⚠️  发现 $ORPHAN_ORDERS 个孤儿条件单（持仓已关闭但条件单仍活跃）"
    echo ""
    echo "详细信息:"
    sqlite3 "$DB_FILE" "
        SELECT po.symbol, po.side, po.type, po.created_at 
        FROM price_orders po
        WHERE status = 'active'
        AND NOT EXISTS (
            SELECT 1 FROM positions p 
            WHERE p.symbol = po.symbol AND p.side = po.side
        )
        ORDER BY po.created_at DESC;
    " -header -column
fi

# 6. 最近的平仓事件
echo ""
echo "📊 检查6: 最近的平仓事件..."
echo ""
sqlite3 "$DB_FILE" "
    SELECT 
        symbol,
        side,
        close_reason,
        ROUND(pnl, 2) as pnl,
        ROUND(pnl_percent, 2) as 'pnl%',
        datetime(created_at) as time
    FROM position_close_events 
    ORDER BY created_at DESC 
    LIMIT 5;
" -header -column

echo ""
echo "======================================================"
echo "  验证完成"
echo "======================================================"
echo ""

# 总结
if [ "$DUPLICATES" -eq 0 ] && [ "$UNRESOLVED_ISSUES" -eq 0 ] && [ "$ORPHAN_ORDERS" -eq 0 ]; then
    echo "✅ 所有检查通过！系统状态正常"
    exit 0
else
    echo "⚠️  发现一些需要注意的问题，请检查上述详细信息"
    exit 0  # 不退出错误，只是提醒
fi
