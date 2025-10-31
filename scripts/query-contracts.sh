#!/bin/bash

# 查询 Gate.io 支持的合约

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示标题
echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Gate.io 合约查询工具${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# 获取脚本所在目录的父目录（项目根目录）
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${RED}❌ 错误: .env 文件不存在${NC}"
    echo -e "${YELLOW}请先运行 npm run setup 进行初始化${NC}"
    exit 1
fi

# 加载环境变量
export $(grep -v '^#' .env | xargs)

# 检查 Gate.io API 配置
if [ -z "$GATE_API_KEY" ] || [ -z "$GATE_API_SECRET" ]; then
    echo -e "${RED}❌ 错误: 未配置 Gate.io API 密钥${NC}"
    echo -e "${YELLOW}请在 .env 文件中配置 GATE_API_KEY 和 GATE_API_SECRET${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Gate.io API 配置检查通过${NC}"
echo ""

# 显示当前环境
if [ "$GATE_USE_TESTNET" = "true" ]; then
    echo -e "${YELLOW}⚠️  当前使用测试网环境${NC}"
else
    echo -e "${BLUE}ℹ️  当前使用正式网环境${NC}"
fi
echo ""

# 运行查询脚本
echo -e "${BLUE}开始查询合约列表...${NC}"
echo ""

npx tsx scripts/query-supported-contracts.ts

# 检查执行结果
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 查询完成${NC}"
else
    echo ""
    echo -e "${RED}❌ 查询失败${NC}"
    exit 1
fi

