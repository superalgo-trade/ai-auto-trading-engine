#!/bin/bash

# open-nof1.ai - AI 加密货币自动交易系统
# Copyright (C) 2025 195440
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
# 数据库初始化脚本
# =====================================================

set -e  # 遇到错误立即退出

echo "=================================================="
echo "  AI 加密货币交易系统 - 数据库初始化"
echo "=================================================="
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
    echo "请先创建 .env 文件并配置必要的环境变量："
    echo "  - GATE_API_KEY"
    echo "  - GATE_API_SECRET"
    echo "  - OPENAI_API_KEY"
    echo "  - INITIAL_BALANCE"
    echo "  - DATABASE_URL"
    echo ""
    echo "参考 ENV_SETUP.md 文档了解详细配置说明"
    exit 1
fi

echo -e "${GREEN}✅ 找到 .env 文件${NC}"

# 读取环境变量
source .env

# 检查必需的环境变量
MISSING_VARS=()

if [ -z "$GATE_API_KEY" ]; then
    MISSING_VARS+=("GATE_API_KEY")
fi

if [ -z "$GATE_API_SECRET" ]; then
    MISSING_VARS+=("GATE_API_SECRET")
fi

if [ -z "$OPENAI_API_KEY" ]; then
    MISSING_VARS+=("OPENAI_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ 错误: 缺少必需的环境变量:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "请在 .env 文件中配置这些变量"
    exit 1
fi

echo -e "${GREEN}✅ 环境变量检查通过${NC}"

# 设置默认值
DATABASE_URL=${DATABASE_URL:-"file:./.voltagent/trading.db"}
INITIAL_BALANCE=${INITIAL_BALANCE:-1000}

# 创建 .voltagent 目录
VOLTAGENT_DIR=".voltagent"
if [ ! -d "$VOLTAGENT_DIR" ]; then
    echo ""
    echo -e "${BLUE}📁 创建数据目录: $VOLTAGENT_DIR${NC}"
    mkdir -p "$VOLTAGENT_DIR"
    echo -e "${GREEN}✅ 目录创建成功${NC}"
else
    echo -e "${GREEN}✅ 数据目录已存在${NC}"
fi

# 显示配置信息
echo ""
echo "=================================================="
echo "  配置信息"
echo "=================================================="
echo -e "${BLUE}数据库 URL:${NC} $DATABASE_URL"
echo -e "${BLUE}初始资金:${NC} $INITIAL_BALANCE USDT"
echo -e "${BLUE}测试网模式:${NC} ${GATE_USE_TESTNET:-false}"
echo -e "${BLUE}交易间隔:${NC} ${TRADING_INTERVAL_MINUTES:-5} 分钟"
echo -e "${BLUE}最大杠杆:${NC} ${MAX_LEVERAGE:-10}x"
echo ""

# 询问是否继续
read -p "是否继续初始化数据库？[Y/n] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
    echo -e "${YELLOW}⚠️  初始化已取消${NC}"
    exit 0
fi

# 检查数据库文件是否已存在
if [[ $DATABASE_URL == file:* ]]; then
    DB_FILE="${DATABASE_URL#file:}"
    if [ -f "$DB_FILE" ]; then
        echo ""
        echo -e "${YELLOW}⚠️  警告: 数据库文件已存在: $DB_FILE${NC}"
        read -p "是否重新初始化（将清空现有数据）？[y/N] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}🗑️  删除现有数据库文件...${NC}"
            rm -f "$DB_FILE" "${DB_FILE}-shm" "${DB_FILE}-wal"
            echo -e "${GREEN}✅ 已删除${NC}"
        fi
    fi
fi

# 执行数据库初始化
echo ""
echo "=================================================="
echo "  开始初始化数据库"
echo "=================================================="
echo ""

# 运行 TypeScript 初始化脚本
npx tsx --env-file=.env ./src/database/init.ts

echo ""
echo "=================================================="
echo -e "${GREEN}✅ 数据库初始化完成！${NC}"
echo "=================================================="
echo ""
echo "接下来可以运行："
echo -e "  ${BLUE}npm run trading:start${NC}  - 启动交易系统"
echo -e "  ${BLUE}npm run dev${NC}            - 开发模式运行"
echo ""

