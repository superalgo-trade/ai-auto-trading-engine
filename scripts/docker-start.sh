#!/bin/bash

# Docker 启动脚本
# 用于简化 Docker 容器的启动流程

set -e

echo "🐋 open-nof1.ai Docker 启动脚本"
echo "================================"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose 是否可用
if ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装或版本过低"
    echo "请升级到 Docker Compose V2"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  警告: .env 文件不存在"
    if [ -f .env.example ]; then
        echo "📝 从 .env.example 创建 .env 文件..."
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请编辑配置后重新运行"
        echo "   nano .env"
        exit 0
    else
        echo "❌ 错误: .env.example 文件也不存在"
        exit 1
    fi
fi

# 检查必需的环境变量
echo "🔍 检查环境变量配置..."
if ! grep -q "GATE_API_KEY=your_api_key_here" .env && \
   ! grep -q "OPENAI_API_KEY=your_openai_key_here" .env; then
    echo "✅ 环境变量已配置"
else
    echo "⚠️  警告: 请确保已正确配置以下环境变量:"
    echo "   - GATE_API_KEY"
    echo "   - GATE_API_SECRET"
    echo "   - OPENAI_API_KEY"
    echo ""
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p voltagent-data logs

# 检查端口是否被占用
PORT=$(grep -E "^PORT=" .env | cut -d'=' -f2 || echo "3100")
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  警告: 端口 $PORT 已被占用"
    echo "   请修改 .env 文件中的 PORT 配置，或停止占用该端口的进程"
    exit 1
fi

# 选择环境
echo ""
echo "请选择运行环境:"
echo "1) 开发/测试环境 (docker-compose.yml)"
echo "2) 生产环境 (docker-compose.prod.yml)"
read -p "请选择 (1/2): " -n 1 -r
echo

COMPOSE_FILE="docker-compose.yml"
ENV_NAME="开发/测试"

if [[ $REPLY == "2" ]]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    ENV_NAME="生产"
    
    # 检查是否使用测试网
    if grep -q "GATE_USE_TESTNET=true" .env; then
        echo "⚠️  警告: 生产环境检测到 GATE_USE_TESTNET=true"
        read -p "是否继续使用测试网? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "请修改 .env 文件: GATE_USE_TESTNET=false"
            exit 0
        fi
    fi
fi

echo ""
echo "🚀 启动 $ENV_NAME 环境..."
echo "   配置文件: $COMPOSE_FILE"
echo ""

# 构建并启动
docker compose -f $COMPOSE_FILE up -d --build

# 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 检查容器状态
if docker compose -f $COMPOSE_FILE ps | grep -q "Up"; then
    echo ""
    echo "✅ 容器启动成功!"
    echo ""
    echo "📊 访问 Web 界面: http://localhost:$PORT"
    echo "📋 查看日志: docker compose -f $COMPOSE_FILE logs -f"
    echo "🛑 停止服务: docker compose -f $COMPOSE_FILE down"
    echo ""
    
    # 询问是否查看日志
    read -p "是否查看实时日志? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        docker compose -f $COMPOSE_FILE logs -f
    fi
else
    echo ""
    echo "❌ 容器启动失败"
    echo "查看详细日志:"
    docker compose -f $COMPOSE_FILE logs
    exit 1
fi

