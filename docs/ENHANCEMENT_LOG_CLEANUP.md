# Shell 脚本增强：添加日志清理功能

## 📅 更新日期

2025-11-10

## 🎯 更新目的

为数据库重置脚本添加日志清理功能，使系统能够完全重置到干净状态。

## ✅ 更新内容

### 1. 更新的脚本

#### `scripts/close-and-reset.sh`

- ✅ 添加日志清理步骤
- ✅ 更新警告信息（新增第7项：清空所有日志文件）

#### `scripts/close-reset-and-start.sh`

- ✅ 添加独立的日志清理步骤（步骤 3/8）
- ✅ 更新所有步骤编号（从 7 步改为 8 步）
- ✅ 更新警告信息（新增第3项：清空所有日志文件）
- ✅ 更新完成提示信息

### 2. 日志清理功能

**清理的日志文件:**

1. **PM2 日志**
   - `logs/pm2-out.log` - 标准输出日志
   - `logs/pm2-error.log` - 错误日志

2. **logs 目录下的所有 .log 文件**
   - 使用 `find` 命令查找并清空所有 `.log` 文件
   - 保留文件但清空内容

3. **PM2 内部日志缓存**
   - 执行 `pm2 flush` 清空 PM2 的日志缓存

**实现代码:**

```bash
# 清空 PM2 日志
if [ -f "logs/pm2-out.log" ]; then
    > logs/pm2-out.log
    echo -e "${GREEN}✓${NC} 已清空 logs/pm2-out.log"
fi

if [ -f "logs/pm2-error.log" ]; then
    > logs/pm2-error.log
    echo -e "${GREEN}✓${NC} 已清空 logs/pm2-error.log"
fi

# 清空其他可能的日志文件
if [ -d "logs" ]; then
    # 清空 .log 文件但保留文件
    find logs -type f -name "*.log" -exec sh -c '> "{}"' \;
    echo -e "${GREEN}✓${NC} 已清空 logs 目录下的所有 .log 文件"
fi

# 清空 PM2 日志（如果 PM2 在运行）
if command -v pm2 &> /dev/null; then
    pm2 flush 2>/dev/null || true
    echo -e "${GREEN}✓${NC} 已清空 PM2 日志"
fi
```

### 3. 执行流程变化

#### 旧流程（7步）

```bash
步骤 1/7: 检查环境
步骤 2/7: 停止现有进程和释放端口
步骤 3/7: 平仓所有持仓并重置数据库
步骤 4/7: 检查依赖
步骤 5/7: 显示当前配置
步骤 6/7: 显示系统状态
步骤 7/7: 完成
```

#### 新流程（8步）

```bash
步骤 1/8: 检查环境
步骤 2/8: 停止现有进程和释放端口
步骤 3/8: 清空日志文件 ⭐ 新增
步骤 4/8: 平仓所有持仓并重置数据库
步骤 5/8: 检查依赖
步骤 6/8: 显示当前配置
步骤 7/8: 显示系统状态
步骤 8/8: 完成
```

## 📋 使用方法

### 命令 1: `npm run db:close-and-reset`

**执行流程:**

```bash
npm run db:close-and-reset
```

**将会清理:**

- ✅ 交易所条件单
- ✅ 交易所持仓
- ✅ 所有日志文件 ⭐ 新增
- ✅ 数据库所有数据
- ✅ 重新初始化并同步

### 命令 2: 直接执行脚本

```bash
bash scripts/close-and-reset.sh
```

**将会清理:**

- ✅ 交易所条件单
- ✅ 交易所持仓
- ✅ 所有日志文件 ⭐ 新增
- ✅ 数据库所有数据

## 🎯 日志清理的优势

### 1. **完全重置**

- 系统恢复到完全干净的状态
- 没有历史日志干扰

### 2. **节省磁盘空间**

- 长期运行可能积累大量日志
- 定期清理可释放磁盘空间

### 3. **避免日志混淆**

- 清空旧日志，新日志更清晰
- 便于问题诊断和调试

### 4. **安全性**

- 清除可能包含敏感信息的日志
- 重置前清理历史记录

## 📊 清理效果示例

**执行前:**

```bash
$ ls -lh logs/
total 125M
-rw-r--r-- 1 user user  85M Nov 10 14:00 pm2-out.log
-rw-r--r-- 1 user user  40M Nov 10 14:00 pm2-error.log
-rw-r--r-- 1 user user 512K Nov 10 14:00 app.log
```

**执行清理后:**

```bash
$ ls -lh logs/
total 12K
-rw-r--r-- 1 user user    0 Nov 10 14:16 pm2-out.log
-rw-r--r-- 1 user user    0 Nov 10 14:16 pm2-error.log
-rw-r--r-- 1 user user    0 Nov 10 14:16 app.log
```

**节省空间:** 125M → 0 bytes ✅

## ⚠️ 注意事项

### 1. **日志不可恢复**

一旦清空，日志文件将无法恢复。如果需要保留历史日志：

```bash
# 备份日志（执行重置前）
mkdir -p logs/backup
cp logs/*.log logs/backup/
# 或
tar -czf logs-backup-$(date +%Y%m%d-%H%M%S).tar.gz logs/
```

### 2. **PM2 日志**

如果使用 PM2 管理进程，PM2 也有自己的日志系统：

```bash
# 查看 PM2 日志位置
pm2 show <app-name>

# PM2 日志通常在
~/.pm2/logs/
```

脚本会自动执行 `pm2 flush` 清空 PM2 的日志缓存。

### 3. **自定义日志**

如果你的应用写入了其他位置的日志，需要手动清理：

```bash
# 示例：清理应用自定义日志
rm -f /path/to/custom/logs/*.log
```

## 🔄 与其他脚本的关系

### `db:reset` vs `db:close-and-reset`

| 功能 | `db:reset` | `db:close-and-reset` |
|------|-----------|---------------------|
| 平仓 | ❌ | ✅ |
| 重置数据库 | ✅ | ✅ |
| 清空日志 | ❌ | ✅ ⭐ |
| 同步数据 | ❌ | ✅ |

**建议:**

- 开发测试用 `db:reset`（快速，不清理日志）
- 生产重启用 `db:close-and-reset`（完整，清理日志）

## 🚀 未来改进

### 可选: 添加日志归档功能

```bash
# 归档而不是删除
BACKUP_DIR="logs/archive/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
mv logs/*.log "$BACKUP_DIR/"
echo "日志已归档到: $BACKUP_DIR"
```

### 可选: 添加日志清理选项

```bash
read -p "是否清空日志？(y/N): " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 清空日志
fi
```

### 可选: 清理更多文件

```bash
# 清理临时文件
rm -rf tmp/*

# 清理缓存
rm -rf .cache/*

# 清理构建产物
rm -rf dist/*
```

## ✅ 总结

**更新内容:**

- ✅ 两个重置脚本都添加了日志清理功能
- ✅ 清理 PM2 日志和所有 .log 文件
- ✅ 更新了步骤编号和提示信息
- ✅ 完整的错误处理（使用 `|| true` 防止失败）

**优势:**

- 🧹 系统更干净
- 💾 节省磁盘空间
- 🔍 便于调试和诊断
- 🔒 清除敏感信息

**建议:**

- 重要日志执行前先备份
- 定期执行清理释放空间
- 根据需要自定义清理范围

---

**更新日期:** 2025-11-10  
**作者:** losesky  
**相关文档:** `/docs/DATABASE_RESET_COMMANDS_COMPARISON.md`  
**License:** GNU AGPL v3
