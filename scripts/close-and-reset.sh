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
# 平仓并重置数据库脚本
# =====================================================
# 
# 功能：
# 1. 取消所有条件单（止损止盈订单）
# 2. 平仓所有当前持仓
# 3. 清空数据库所有数据
# 4. 重新初始化数据库
# 
# 使用方法：
#   bash scripts/close-and-reset.sh
#   或
#   npm run db:close-and-reset
# =====================================================

set -e  # 遇到错误立即退出

echo "================================================================================"
echo "🔄 AI 加密货币交易系统 - 平仓并重置数据库"
echo "================================================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo -e "${RED}❌ 错误: .env 文件不存在${NC}"
    echo ""
    echo "请先创建 .env 文件并配置必要的环境变量"
    exit 1
fi

echo -e "${GREEN}✅ 找到 .env 文件${NC}"
echo ""

# 读取环境变量
source .env

# 检查必需的环境变量
MISSING_VARS=()

# 检查交易所配置
EXCHANGE_NAME=${EXCHANGE_NAME:-gate}
EXCHANGE_NAME=$(echo "$EXCHANGE_NAME" | tr '[:upper:]' '[:lower:]')

if [ "$EXCHANGE_NAME" = "gate" ]; then
    if [ -z "$GATE_API_KEY" ]; then
        MISSING_VARS+=("GATE_API_KEY")
    fi
    if [ -z "$GATE_API_SECRET" ]; then
        MISSING_VARS+=("GATE_API_SECRET")
    fi
elif [ "$EXCHANGE_NAME" = "binance" ]; then
    if [ -z "$BINANCE_API_KEY" ]; then
        MISSING_VARS+=("BINANCE_API_KEY")
    fi
    if [ -z "$BINANCE_API_SECRET" ]; then
        MISSING_VARS+=("BINANCE_API_SECRET")
    fi
else
    echo -e "${RED}❌ 错误: 不支持的交易所 ${EXCHANGE_NAME}${NC}"
    echo -e "${YELLOW}支持的交易所: gate, binance${NC}"
    exit 1
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ 以下环境变量未配置：${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "请在 .env 文件中配置这些变量"
    exit 1
fi

echo -e "${GREEN}✅ 交易所配置: ${EXCHANGE_NAME}${NC}"

# 二次确认
echo -e "${YELLOW}⚠️  警告: 此操作将执行以下内容：${NC}"
echo ""
echo "  1. 取消所有条件单（止损止盈订单）"
echo "  2. 平仓所有当前持仓（市价单）"
echo "  3. 删除所有历史交易记录"
echo "  4. 删除所有持仓信息"
echo "  5. 删除所有账户历史"
echo "  6. 重新初始化数据库到初始状态"
echo ""
echo -e "${RED}此操作不可恢复！${NC}"
echo ""

read -p "确认执行平仓并重置？(输入 yes 确认): " -r
echo ""

if [[ $REPLY != "yes" ]]; then
    echo -e "${YELLOW}❌ 已取消操作${NC}"
    exit 0
fi

echo "================================================================================"
echo -e "${BLUE}开始执行平仓并重置...${NC}"
echo "================================================================================"
echo ""

# 执行 TypeScript 脚本
npx tsx --env-file=.env ./src/database/close-and-reset.ts

echo ""
echo "================================================================================"
echo -e "${GREEN}✅ 操作完成！${NC}"
echo "================================================================================"
echo ""
echo "接下来可以："
echo -e "  ${BLUE}npm run trading:start${NC}  - 重新启动交易系统"
echo -e "  ${BLUE}npm run dev${NC}            - 开发模式运行"
echo ""

