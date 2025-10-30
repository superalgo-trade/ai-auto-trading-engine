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
# 完整环境设置脚本
# =====================================================

set -e

echo "=================================================="
echo "  AI 加密货币交易系统 - 环境设置向导"
echo "=================================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 步骤 1: 检查 Node.js
echo -e "${CYAN}[步骤 1/5]${NC} 检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未找到 Node.js${NC}"
    echo "请先安装 Node.js >= 20.19.0"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js 版本: $NODE_VERSION${NC}"

# 步骤 2: 安装依赖
echo ""
echo -e "${CYAN}[步骤 2/5]${NC} 检查项目依赖..."
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 安装项目依赖...${NC}"
    npm install
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
else
    echo -e "${GREEN}✅ 依赖已安装${NC}"
fi

# 步骤 3: 创建 .env 文件
echo ""
echo -e "${CYAN}[步骤 3/5]${NC} 配置环境变量..."

if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  .env 文件已存在${NC}"
    read -p "是否重新配置？[y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}跳过环境变量配置${NC}"
        SKIP_ENV=true
    fi
fi

if [ -z "$SKIP_ENV" ]; then
    echo ""
    echo "请输入必需的配置信息："
    echo ""
    
    # Gate.io API Key
    read -p "Gate.io API Key: " GATE_API_KEY
    read -p "Gate.io API Secret: " GATE_API_SECRET
    
    # OpenAI API Key (支持 OpenRouter 或其他兼容供应商)
    read -p "OpenAI API Key (支持 OpenRouter): " OPENAI_API_KEY
    read -p "OpenAI Base URL (默认: https://openrouter.ai/api/v1): " OPENAI_BASE_URL
    OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://openrouter.ai/api/v1}
    
    # 初始资金
    read -p "初始资金 (USDT) [默认: 1000]: " INITIAL_BALANCE
    INITIAL_BALANCE=${INITIAL_BALANCE:-1000}
    
    # 是否使用测试网
    read -p "使用测试网？[Y/n]: " USE_TESTNET
    if [[ $USE_TESTNET =~ ^[Nn]$ ]]; then
        GATE_USE_TESTNET="false"
    else
        GATE_USE_TESTNET="true"
    fi
    
    # 服务器端口
    read -p "服务器端口 [默认: 3141]: " PORT
    PORT=${PORT:-3141}
    
    # 交易间隔
    read -p "交易间隔 (分钟) [默认: 5]: " TRADING_INTERVAL
    TRADING_INTERVAL=${TRADING_INTERVAL:-5}
    
    # 最大杠杆
    read -p "最大杠杆 [默认: 10]: " MAX_LEVERAGE
    MAX_LEVERAGE=${MAX_LEVERAGE:-10}
    
    # 创建 .env 文件
    cat > .env << EOF
# ===========================================
# AI 加密货币自动交易系统 - 环境变量配置
# ===========================================

# ============================================
# 服务器配置
# ============================================
PORT=$PORT

# ============================================
# 交易配置
# ============================================
TRADING_INTERVAL_MINUTES=$TRADING_INTERVAL
MAX_LEVERAGE=$MAX_LEVERAGE
INITIAL_BALANCE=$INITIAL_BALANCE

# ============================================
# 数据库配置
# ============================================
DATABASE_URL=file:./.voltagent/trading.db

# ============================================
# Gate.io API 配置
# ============================================
GATE_API_KEY=$GATE_API_KEY
GATE_API_SECRET=$GATE_API_SECRET
GATE_USE_TESTNET=$GATE_USE_TESTNET

# ============================================
# AI 模型配置
# ============================================
OPENAI_API_KEY=$OPENAI_API_KEY
OPENAI_BASE_URL=$OPENAI_BASE_URL
EOF
    
    echo -e "${GREEN}✅ .env 文件创建成功${NC}"
fi

# 步骤 4: 创建必要目录
echo ""
echo -e "${CYAN}[步骤 4/5]${NC} 创建必要目录..."
mkdir -p .voltagent
mkdir -p logs
echo -e "${GREEN}✅ 目录创建完成${NC}"

# 步骤 5: 初始化数据库
echo ""
echo -e "${CYAN}[步骤 5/5]${NC} 初始化数据库..."
read -p "现在初始化数据库？[Y/n] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    bash scripts/init-db.sh
else
    echo -e "${YELLOW}⚠️  跳过数据库初始化${NC}"
    echo "稍后可运行: ${BLUE}npm run db:init${NC}"
fi

# 完成
echo ""
echo "=================================================="
echo -e "${GREEN}✅ 环境设置完成！${NC}"
echo "=================================================="
echo ""
echo "可用命令："
echo ""
echo -e "  ${BLUE}npm run trading:start${NC}    - 启动交易系统"
echo -e "  ${BLUE}npm run trading:stop${NC}     - 停止交易系统"
echo -e "  ${BLUE}npm run trading:restart${NC}  - 重启交易系统"
echo -e "  ${BLUE}npm run db:init${NC}          - 初始化数据库"
echo -e "  ${BLUE}npm run db:reset${NC}         - 重置数据库"
echo -e "  ${BLUE}npm run db:status${NC}        - 查看数据库状态"
echo ""
echo "文档："
echo -e "  ${CYAN}README.md${NC}         - 项目说明"
echo -e "  ${CYAN}ENV_SETUP.md${NC}      - 环境配置指南"
echo -e "  ${CYAN}QUICKSTART.md${NC}     - 快速开始"
echo ""

