#!/bin/bash

# 条件单分组显示修复 - 快速部署脚本
# 使用开仓订单ID关联方案

set -e  # 遇到错误立即退出

echo "===================================================="
echo "  条件单分组显示修复 - 快速部署"
echo "===================================================="
echo ""

# 第1步: 添加数据库字段
echo "📊 第1步: 添加数据库字段 position_order_id"
./scripts/add-position-order-id.sh
echo ""

# 第2步: 重新编译项目
echo "🔨 第2步: 编译 TypeScript 代码"
npm run build
echo ""

# 第3步: 重启服务
echo "🔄 第3步: 重启服务"
if [ -f "ecosystem.config.cjs" ]; then
    echo "使用 PM2 重启..."
    pm2 restart ecosystem.config.cjs
elif [ -f "docker-compose.yml" ]; then
    echo "使用 Docker Compose 重启..."
    docker-compose restart
else
    echo "⚠️  请手动重启服务"
fi
echo ""

# 第4步: 验证
echo "✅ 部署完成！"
echo ""
echo "📋 验证步骤:"
echo "  1. 打开前端页面: http://localhost:3000"
echo "  2. 切换到 '止盈止损' 标签页"
echo "  3. 检查历史记录是否正确分组显示"
echo ""
echo "🔍 查看数据库:"
echo "  sqlite3 ./.voltagent/trading.db \"SELECT id, symbol, type, status, position_order_id FROM price_orders ORDER BY created_at DESC LIMIT 10;\""
echo ""
echo "===================================================="
