#!/bin/bash

# Docker 日志查看脚本
# 用于方便查看容器日志

set -e

echo "📋 open-nof1.ai Docker 日志查看"
echo "================================"

# 检查 Docker Compose 是否可用
if ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    exit 1
fi

# 检测运行中的容器
RUNNING_CONTAINERS=$(docker ps --filter "name=open-nof1" --format "{{.Names}}")

if [ -z "$RUNNING_CONTAINERS" ]; then
    echo "ℹ️  没有运行中的 open-nof1.ai 容器"
    echo ""
    echo "💡 启动容器: ./scripts/docker-start.sh"
    exit 0
fi

echo "📋 运行中的容器:"
echo "$RUNNING_CONTAINERS"
echo ""

# 选择查看方式
echo "请选择查看方式:"
echo "1) 实时跟踪日志 (推荐)"
echo "2) 查看最近 100 行"
echo "3) 查看最近 500 行"
echo "4) 查看所有日志"
echo "5) 导出日志到文件"
read -p "请选择 (1-5): " -n 1 -r
echo
echo ""

# 确定使用哪个 compose 文件
COMPOSE_FILE="docker-compose.yml"
if echo "$RUNNING_CONTAINERS" | grep -q "prod"; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

case $REPLY in
    1)
        echo "🔄 实时跟踪日志 (Ctrl+C 退出)..."
        docker compose -f $COMPOSE_FILE logs -f
        ;;
    2)
        echo "📄 最近 100 行日志:"
        docker compose -f $COMPOSE_FILE logs --tail=100
        ;;
    3)
        echo "📄 最近 500 行日志:"
        docker compose -f $COMPOSE_FILE logs --tail=500
        ;;
    4)
        echo "📄 所有日志:"
        docker compose -f $COMPOSE_FILE logs
        ;;
    5)
        FILENAME="logs/docker-export-$(date +%Y%m%d-%H%M%S).log"
        mkdir -p logs
        echo "💾 导出日志到: $FILENAME"
        docker compose -f $COMPOSE_FILE logs > "$FILENAME"
        echo "✅ 导出完成"
        echo "   文件大小: $(du -h "$FILENAME" | cut -f1)"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

