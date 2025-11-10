#!/bin/bash

# 为 price_orders 表添加 position_order_id 字段
# 用于关联开仓订单,解决条件单分组显示问题

DB_PATH="./.voltagent/trading.db"

echo "===================================================="
echo "  为 price_orders 表添加 position_order_id 字段"
echo "===================================================="
echo ""

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    echo "❌ 错误: 数据库文件不存在: $DB_PATH"
    exit 1
fi

echo "📊 当前表结构:"
sqlite3 "$DB_PATH" ".schema price_orders"
echo ""

# 检查字段是否已存在
FIELD_EXISTS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(price_orders);" | grep -c "position_order_id")

if [ "$FIELD_EXISTS" -gt 0 ]; then
    echo "✅ position_order_id 字段已存在,无需添加"
    echo ""
    sqlite3 "$DB_PATH" "PRAGMA table_info(price_orders);"
    exit 0
fi

echo "➕ 添加 position_order_id 字段..."

# 添加字段
sqlite3 "$DB_PATH" "ALTER TABLE price_orders ADD COLUMN position_order_id TEXT;"

# 创建索引
echo "📑 创建索引..."
sqlite3 "$DB_PATH" "CREATE INDEX IF NOT EXISTS idx_price_orders_position_order_id ON price_orders(position_order_id);"

echo ""
echo "✅ 字段添加成功!"
echo ""
echo "📊 更新后的表结构:"
sqlite3 "$DB_PATH" ".schema price_orders"
echo ""
echo "📋 字段信息:"
sqlite3 "$DB_PATH" "PRAGMA table_info(price_orders);"
echo ""
echo "===================================================="
echo "  完成!"
echo "===================================================="
