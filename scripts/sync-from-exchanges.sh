#!/bin/bash

# ai-auto-trading - AI 加密货币自动交易系统
# Copyright (C) 2025 losesky
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

# =====================================================
# 从交易所同步账户并重置数据库（兼容 Gate.io 和 Binance）
# =====================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${RED}❌ 错误: .env 文件不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 找到 .env 文件${NC}"

# 读取环境变量
source .env

# 读取交易所配置
EXCHANGE_NAME=${EXCHANGE_NAME:-gate}
EXCHANGE_NAME=$(echo "$EXCHANGE_NAME" | tr '[:upper:]' '[:lower:]')
EXCHANGE_DISPLAY=$(echo "$EXCHANGE_NAME" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')

echo "=================================================="
echo "  从 ${EXCHANGE_DISPLAY} 同步账户资金"
echo "=================================================="
echo ""

# 根据交易所检查 API 配置
if [ "$EXCHANGE_NAME" = "gate" ]; then
    if [ -z "$GATE_API_KEY" ] || [ -z "$GATE_API_SECRET" ]; then
        echo -e "${RED}❌ 错误: 未配置 Gate.io API 密钥${NC}"
        echo ""
        echo "请在 .env 文件中配置："
        echo "  GATE_API_KEY=your_key"
        echo "  GATE_API_SECRET=your_secret"
        exit 1
    fi
    echo -e "${GREEN}✅ Gate.io API 配置检查通过${NC}"
    
elif [ "$EXCHANGE_NAME" = "binance" ]; then
    if [ -z "$BINANCE_API_KEY" ] || [ -z "$BINANCE_API_SECRET" ]; then
        echo -e "${RED}❌ 错误: 未配置 Binance API 密钥${NC}"
        echo ""
        echo "请在 .env 文件中配置："
        echo "  BINANCE_API_KEY=your_key"
        echo "  BINANCE_API_SECRET=your_secret"
        exit 1
    fi
    echo -e "${GREEN}✅ Binance API 配置检查通过${NC}"
    
else
    echo -e "${RED}❌ 错误: 不支持的交易所 ${EXCHANGE_NAME}${NC}"
    echo -e "${YELLOW}支持的交易所: gate, binance${NC}"
    exit 1
fi
echo ""

# 显示警告
echo -e "${YELLOW}⚠️  警告:${NC}"
echo "   此操作将："
echo "   1. 从 ${EXCHANGE_DISPLAY} 获取当前账户余额"
echo "   2. 以该余额作为新的初始资金"
echo "   3. 重置所有历史数据和收益率统计"
echo "   4. 同步当前持仓到数据库"
echo ""

# 询问确认
read -p "确定要继续吗？[y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  操作已取消${NC}"
    exit 0
fi

echo ""
echo "=================================================="
echo "  开始同步..."
echo "=================================================="
echo ""

# 执行同步脚本
npx tsx --env-file=.env ./src/database/sync-from-exchanges.ts

echo ""
echo "=================================================="
echo -e "${GREEN}✅ 同步完成！${NC}"
echo "=================================================="
echo ""

