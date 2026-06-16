#!/bin/bash
# 简单验证数据库 Schema

echo "🔍 检查 positions 表结构..."
echo ""

# 使用 SQLite 命令行工具查看表结构
sqlite3 trading.db ".schema positions" | grep -E "(market_state|strategy_type|signal_strength|opportunity_score)"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 策略相关字段已成功添加到 positions 表"
  echo ""
  
  echo "📋 完整的新字段:"
  sqlite3 trading.db "PRAGMA table_info(positions)" | grep -E "(market_state|strategy_type|signal_strength|opportunity_score)"
  
  echo ""
  echo "📊 当前持仓统计:"
  sqlite3 trading.db "SELECT COUNT(*) as total FROM positions WHERE status IN ('open', 'partial_close')" 
  
  exit 0
else
  echo ""
  echo "❌ 未找到策略相关字段"
  exit 1
fi
