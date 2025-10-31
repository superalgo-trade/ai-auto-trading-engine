# 使用 Node.js 20 LTS 版本作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装基础工具
RUN apk add --no-cache bash sqlite

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖（包括 devDependencies，用于构建）
RUN npm ci

# 复制项目文件
COPY . .

# 构建项目
RUN npm run build

# 清理 devDependencies，只保留生产依赖
RUN npm prune --production

# 创建数据库目录
RUN mkdir -p .voltagent

# 设置环境变量
ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

# 暴露端口
EXPOSE 3100

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# 启动应用
CMD ["npm", "run", "start"]

