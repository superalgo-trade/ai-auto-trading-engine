#!/bin/bash

# Git仓库管理脚本 - 支持提交(push)和获取(pull)操作

# 显示彩色输出
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
NC="\033[0m" # No Color

# 显示欢迎标题
clear
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  NOF1.AI 交易项目 - 双远程Git管理脚本  ${NC}"
echo -e "${BLUE}==========================================${NC}"
echo

# 检查git是否已安装
if ! command -v git &> /dev/null; then
    echo -e "${RED}错误: 未找到git命令。请先安装git。${NC}"
    exit 1
fi

# 切换到项目根目录
cd "$(dirname "$0")"
echo -e "${YELLOW}当前工作目录: $(pwd)${NC}"

# 检查是否已经是git仓库
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}初始化Git仓库...${NC}"
    git init
    echo -e "${GREEN}Git仓库初始化完成${NC}"
else
    echo -e "${GREEN}Git仓库已存在${NC}"
fi

# 创建或更新.gitignore文件
if [ ! -f ".gitignore" ]; then
    echo -e "${YELLOW}创建.gitignore文件...${NC}"
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build outputs
dist/
build/
*.js.map

# Environment variables
.env
.env.local
.env.production
.env.development

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Database
*.db
*.sqlite
*.sqlite3

# PM2
.pm2/

# Docker
.docker/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Temporary files
tmp/
temp/
*.tmp

# Trading data
trades/
positions/
*.csv
EOF
    echo -e "${GREEN}.gitignore文件已创建${NC}"
else
    echo -e "${GREEN}.gitignore文件已存在${NC}"
fi

# 配置Git用户信息（如果未配置）
if [ -z "$(git config --get user.name)" ]; then
    echo -e "${YELLOW}请输入您的Git用户名:${NC}"
    read git_username
    git config user.name "$git_username"
fi

if [ -z "$(git config --get user.email)" ]; then
    echo -e "${YELLOW}请输入您的Git邮箱:${NC}"
    read git_email
    git config user.email "$git_email"
fi

# 设置双远程仓库
echo -e "${YELLOW}配置远程仓库...${NC}"

# 配置个人仓库 (origin)
if ! git remote | grep -q "^origin$"; then
    echo -e "${YELLOW}添加个人仓库(origin)...${NC}"
    git remote add origin https://github.com/losesky/ai-auto-trading.git
    echo -e "${GREEN}个人仓库已添加${NC}"
else
    current_origin=$(git remote get-url origin 2>/dev/null)
    if [ "$current_origin" != "https://github.com/losesky/ai-auto-trading.git" ]; then
        echo -e "${YELLOW}更新个人仓库URL...${NC}"
        git remote set-url origin https://github.com/losesky/ai-auto-trading.git
        echo -e "${GREEN}个人仓库URL已更新${NC}"
    else
        echo -e "${GREEN}个人仓库(origin)已正确设置${NC}"
    fi
fi

# 配置上游源仓库 (upstream)
if ! git remote | grep -q "^upstream$"; then
    echo -e "${YELLOW}添加上游源仓库(upstream)...${NC}"
    git remote add upstream https://github.com/195440/nof1.ai.git
    echo -e "${GREEN}上游源仓库已添加${NC}"
else
    current_upstream=$(git remote get-url upstream 2>/dev/null)
    if [ "$current_upstream" != "https://github.com/195440/nof1.ai.git" ]; then
        echo -e "${YELLOW}更新上游源仓库URL...${NC}"
        git remote set-url upstream https://github.com/195440/nof1.ai.git
        echo -e "${GREEN}上游源仓库URL已更新${NC}"
    else
        echo -e "${GREEN}上游源仓库(upstream)已正确设置${NC}"
    fi
fi

# 显示远程仓库配置
echo
echo -e "${CYAN}当前远程仓库配置:${NC}"
echo -e "${GREEN}origin (个人仓库): $(git remote get-url origin)${NC}"
echo -e "${GREEN}upstream (上游源): $(git remote get-url upstream)${NC}"

# 显示菜单
show_menu() {
    echo
    echo -e "${CYAN}┌────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│         请选择您要执行的操作              │${NC}"
    echo -e "${CYAN}├────────────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│ 1. 从上游源仓库获取更新 (upstream pull)   │${NC}"
    echo -e "${CYAN}│ 2. 推送到个人仓库 (origin push)           │${NC}"
    echo -e "${CYAN}│ 3. 从个人仓库拉取 (origin pull)           │${NC}"
    echo -e "${CYAN}│ 4. 查看状态和历史                         │${NC}"
    echo -e "${CYAN}│ 5. 分支管理                               │${NC}"
    echo -e "${CYAN}│ 6. 远程仓库管理                           │${NC}"
    echo -e "${CYAN}│ 0. 退出                                   │${NC}"
    echo -e "${CYAN}└────────────────────────────────────────────┘${NC}"
    echo -e "${YELLOW}请输入选项 [0-6]: ${NC}"
    read -n 1 option
    echo
    return $option
}

# 从上游源仓库获取更新
pull_from_upstream() {
    echo -e "${BLUE}===== 从上游源仓库获取更新 =====${NC}"
    echo -e "${YELLOW}上游源仓库: $(git remote get-url upstream)${NC}"
    echo
    
    # 检查是否有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}您有未提交的更改。获取前建议先处理这些更改。${NC}"
        echo -e "${YELLOW}选项:${NC}"
        echo -e "${YELLOW}1. 存储更改(stash)后获取${NC}"
        echo -e "${YELLOW}2. 提交更改后获取${NC}"
        echo -e "${YELLOW}3. 尝试合并(可能会有冲突)${NC}"
        echo -e "${YELLOW}0. 取消获取${NC}"
        echo -e "${YELLOW}请选择 [0-3]: ${NC}"
        read -n 1 stash_option
        echo
        
        case $stash_option in
            1)
                echo -e "${YELLOW}存储更改...${NC}"
                git stash
                echo -e "${GREEN}更改已存储${NC}"
                ;;
            2)
                echo -e "${YELLOW}输入提交信息:${NC}"
                read commit_msg
                commit_msg="${commit_msg:-保存本地更改 - $(date '+%Y-%m-%d %H:%M:%S')}"
                git add .
                git commit -m "$commit_msg"
                echo -e "${GREEN}更改已提交${NC}"
                ;;
            3)
                echo -e "${YELLOW}继续获取并尝试合并...${NC}"
                ;;
            *)
                echo -e "${YELLOW}获取操作已取消${NC}"
                return 1
                ;;
        esac
    fi
    
    # 获取当前分支
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [ -z "$current_branch" ]; then
        current_branch="main"
    fi
    
    # 获取上游更新
    echo -e "${YELLOW}获取上游仓库信息...${NC}"
    git fetch upstream
    
    # 询问合并方式
    echo
    echo -e "${CYAN}选择合并方式:${NC}"
    echo -e "${CYAN}1. 合并 (merge) - 保留完整提交历史${NC}"
    echo -e "${CYAN}2. 变基 (rebase) - 保持提交历史线性${NC}"
    echo -e "${YELLOW}请选择 [1-2] (默认:1): ${NC}"
    read -n 1 merge_option
    echo
    merge_option="${merge_option:-1}"
    
    # 执行合并或变基
    if [ "$merge_option" = "2" ]; then
        echo -e "${YELLOW}从上游 $current_branch 分支变基...${NC}"
        if git rebase upstream/$current_branch; then
            echo -e "${GREEN}成功从上游仓库获取并变基代码${NC}"
            merge_success=true
        else
            echo -e "${RED}变基时出现冲突${NC}"
            merge_success=false
        fi
    else
        echo -e "${YELLOW}从上游 $current_branch 分支合并...${NC}"
        if git merge upstream/$current_branch; then
            echo -e "${GREEN}成功从上游仓库获取并合并代码${NC}"
            merge_success=true
        else
            echo -e "${RED}合并时出现冲突${NC}"
            merge_success=false
        fi
    fi
    
    if [ "$merge_success" = false ]; then
        echo -e "${RED}请手动解决冲突后执行:${NC}"
        echo -e "${YELLOW}  git add .${NC}"
        if [ "$merge_option" = "2" ]; then
            echo -e "${YELLOW}  git rebase --continue${NC}"
            echo -e "${RED}或者中止变基:${NC}"
            echo -e "${YELLOW}  git rebase --abort${NC}"
        else
            echo -e "${YELLOW}  git commit -m \"解决合并冲突\"${NC}"
            echo -e "${RED}或者中止合并:${NC}"
            echo -e "${YELLOW}  git merge --abort${NC}"
        fi
        return 1
    fi
    
    # 如果之前进行了stash，询问是否应用
    if [ "$stash_option" = "1" ]; then
        echo
        echo -e "${YELLOW}应用之前存储的更改...${NC}"
        if git stash apply; then
            echo -e "${GREEN}存储的更改已成功应用${NC}"
            echo -e "${YELLOW}是否删除存储记录? (y/N)${NC}"
            read -n 1 drop_stash
            echo
            if [ "$drop_stash" = "y" ] || [ "$drop_stash" = "Y" ]; then
                git stash drop
                echo -e "${GREEN}存储记录已删除${NC}"
            fi
        else
            echo -e "${RED}应用存储的更改时出现冲突。请手动解决冲突。${NC}"
        fi
    fi
    
    return 0
}

# 推送到个人仓库
push_to_origin_repo() {
    echo -e "${BLUE}===== 推送到个人仓库 =====${NC}"
    echo -e "${YELLOW}个人仓库: $(git remote get-url origin)${NC}"
    echo
    
    # 检查是否有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}当前有未提交的更改:${NC}"
        git status --short
        echo
        
        echo -e "${YELLOW}是否提交这些更改? (Y/n)${NC}"
        read -n 1 commit_changes
        echo
        
        if [ "$commit_changes" = "n" ] || [ "$commit_changes" = "N" ]; then
            echo -e "${YELLOW}跳过提交，仅推送已有提交${NC}"
        else
            # 添加所有文件到Git
            echo -e "${YELLOW}添加文件到Git...${NC}"
            git add .
            echo -e "${GREEN}文件已添加${NC}"
            
            # 提交更改
            echo -e "${YELLOW}提交更改...${NC}"
            default_commit_message="更新NOF1.AI交易项目 - $(date '+%Y-%m-%d %H:%M:%S')"
            echo -e "${YELLOW}默认提交信息: $default_commit_message${NC}"
            echo -e "${YELLOW}是否自定义提交信息? (y/N)${NC}"
            read -n 1 custom_msg
            echo
            
            commit_message="$default_commit_message"
            if [ "$custom_msg" = "y" ] || [ "$custom_msg" = "Y" ]; then
                echo -e "${YELLOW}请输入自定义提交信息:${NC}"
                read custom_commit_message
                commit_message="$custom_commit_message"
                echo -e "${GREEN}使用自定义提交信息${NC}"
            fi
            
            git commit -m "$commit_message"
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}更改已提交${NC}"
            else
                echo -e "${RED}提交失败${NC}"
                return 1
            fi
        fi
    else
        echo -e "${GREEN}没有未提交的更改${NC}"
    fi
    
    # 推送到个人仓库
    echo
    echo -e "${YELLOW}推送到个人仓库...${NC}"
    echo -e "${YELLOW}注意: 如果提示输入用户名和密码，请使用GitHub个人访问令牌作为密码${NC}"
    
    # 获取当前分支名
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [ -z "$current_branch" ]; then
        current_branch="main"
    fi
    
    # 检查是否需要强制推送
    echo -e "${YELLOW}是否强制推送(覆盖远程)? (y/N)${NC}"
    read -n 1 force_push
    echo
    
    force_flag=""
    if [ "$force_push" = "y" ] || [ "$force_push" = "Y" ]; then
        force_flag="--force"
        echo -e "${RED}警告: 将强制推送到远程仓库${NC}"
    fi
    
    # 尝试推送
    echo -e "${YELLOW}推送到个人仓库 $current_branch 分支...${NC}"
    if git push $force_flag -u origin $current_branch; then
        echo -e "${GREEN}成功推送到个人仓库${NC}"
        return 0
    else
        echo -e "${RED}推送失败。请检查您的GitHub凭据和网络连接。${NC}"
        echo -e "${RED}您可能需要创建并使用GitHub个人访问令牌作为密码。${NC}"
        echo -e "${BLUE}请访问: https://github.com/settings/tokens 创建个人访问令牌${NC}"
        return 1
    fi
}

# 从个人仓库获取代码
pull_from_origin() {
    echo -e "${BLUE}===== 从个人仓库获取代码 =====${NC}"
    echo -e "${YELLOW}个人仓库: $(git remote get-url origin)${NC}"
    echo
    
    # 检查是否有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}您有未提交的更改。获取前建议先处理这些更改。${NC}"
        echo -e "${YELLOW}选项:${NC}"
        echo -e "${YELLOW}1. 存储更改(stash)后获取${NC}"
        echo -e "${YELLOW}2. 丢弃更改并获取${NC}"
        echo -e "${YELLOW}3. 尝试合并(可能会有冲突)${NC}"
        echo -e "${YELLOW}0. 取消获取${NC}"
        echo -e "${YELLOW}请选择 [0-3]: ${NC}"
        read -n 1 stash_option
        echo
        
        case $stash_option in
            1)
                echo -e "${YELLOW}存储更改...${NC}"
                git stash
                echo -e "${GREEN}更改已存储${NC}"
                ;;
            2)
                echo -e "${YELLOW}丢弃更改...${NC}"
                git reset --hard
                echo -e "${GREEN}更改已丢弃${NC}"
                ;;
            3)
                echo -e "${YELLOW}继续获取并尝试合并...${NC}"
                ;;
            *)
                echo -e "${YELLOW}获取操作已取消${NC}"
                return 1
                ;;
        esac
    fi
    
    # 获取远程分支信息
    echo -e "${YELLOW}获取远程分支信息...${NC}"
    git fetch
    
    # 获取当前分支
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [ -z "$current_branch" ]; then
        current_branch="main" # 默认为main分支
    fi
    
    # 尝试拉取
    echo -e "${YELLOW}从个人仓库拉取 $current_branch 分支...${NC}"
    if git pull origin $current_branch; then
        echo -e "${GREEN}成功从个人仓库获取代码${NC}"
        
        # 如果之前进行了stash，尝试应用它
        if [ "$stash_option" = "1" ]; then
            echo -e "${YELLOW}应用之前存储的更改...${NC}"
            if git stash apply; then
                echo -e "${GREEN}存储的更改已成功应用${NC}"
                echo -e "${YELLOW}是否删除存储记录? (y/N)${NC}"
                read -n 1 drop_stash
                echo
                if [ "$drop_stash" = "y" ] || [ "$drop_stash" = "Y" ]; then
                    git stash drop
                    echo -e "${GREEN}存储记录已删除${NC}"
                fi
            else
                echo -e "${RED}应用存储的更改时出现冲突。请手动解决冲突。${NC}"
                echo -e "${YELLOW}您可以使用 'git stash show' 查看存储的更改${NC}"
                echo -e "${YELLOW}使用 'git stash drop' 删除存储的更改${NC}"
            fi
        fi
        
        return 0
    else
        echo -e "${RED}获取失败。请检查您的网络连接和凭据。${NC}"
        return 1
    fi
}

# 查看状态和历史
view_status_history() {
    echo -e "${BLUE}===== Git状态和历史 =====${NC}"
    
    # 显示远程仓库
    echo -e "${YELLOW}远程仓库配置:${NC}"
    git remote -v
    echo
    
    # 显示状态
    echo -e "${YELLOW}Git状态:${NC}"
    git status
    echo
    
    # 显示最近的提交
    echo -e "${YELLOW}最近提交历史(最近10条):${NC}"
    git log -10 --oneline --graph --all --decorate
    echo
    
    # 显示分支信息
    echo -e "${YELLOW}本地分支信息:${NC}"
    git branch -vv
    echo
    
    # 显示远程分支信息
    echo -e "${YELLOW}远程分支信息:${NC}"
    git branch -r
    echo
    
    echo -e "${YELLOW}按任意键返回主菜单...${NC}"
    read -n 1
    return 0
}

# 远程仓库管理
remote_management() {
    while true; do
        clear
        echo -e "${BLUE}===== 远程仓库管理 =====${NC}"
        
        # 显示远程仓库配置
        echo -e "${YELLOW}当前远程仓库配置:${NC}"
        git remote -v
        echo
        
        # 显示菜单
        echo -e "${CYAN}请选择操作:${NC}"
        echo -e "${CYAN}1. 查看远程仓库详细信息${NC}"
        echo -e "${CYAN}2. 更新远程仓库URL${NC}"
        echo -e "${CYAN}3. 添加新的远程仓库${NC}"
        echo -e "${CYAN}4. 删除远程仓库${NC}"
        echo -e "${CYAN}5. 从远程仓库获取信息(fetch)${NC}"
        echo -e "${CYAN}6. 查看远程分支${NC}"
        echo -e "${CYAN}7. 清理远程跟踪分支${NC}"
        echo -e "${CYAN}0. 返回主菜单${NC}"
        echo -e "${YELLOW}请输入选项 [0-7]: ${NC}"
        read -n 1 remote_option
        echo
        
        case $remote_option in
            1)  # 查看远程仓库详细信息
                echo -e "${YELLOW}请输入远程仓库名称 (origin/upstream):${NC}"
                read remote_name
                if [ -z "$remote_name" ]; then
                    echo -e "${RED}远程仓库名不能为空${NC}"
                else
                    echo -e "${YELLOW}远程仓库 $remote_name 的详细信息:${NC}"
                    git remote show $remote_name
                fi
                ;;
                
            2)  # 更新远程仓库URL
                echo -e "${YELLOW}请输入远程仓库名称 (origin/upstream):${NC}"
                read remote_name
                if [ -z "$remote_name" ]; then
                    echo -e "${RED}远程仓库名不能为空${NC}"
                else
                    echo -e "${YELLOW}请输入新的URL:${NC}"
                    read new_url
                    if [ -z "$new_url" ]; then
                        echo -e "${RED}URL不能为空${NC}"
                    else
                        if git remote set-url $remote_name $new_url; then
                            echo -e "${GREEN}成功更新 $remote_name 的URL为: $new_url${NC}"
                        else
                            echo -e "${RED}更新失败${NC}"
                        fi
                    fi
                fi
                ;;
                
            3)  # 添加新的远程仓库
                echo -e "${YELLOW}请输入远程仓库名称:${NC}"
                read remote_name
                if [ -z "$remote_name" ]; then
                    echo -e "${RED}远程仓库名不能为空${NC}"
                else
                    echo -e "${YELLOW}请输入仓库URL:${NC}"
                    read remote_url
                    if [ -z "$remote_url" ]; then
                        echo -e "${RED}URL不能为空${NC}"
                    else
                        if git remote add $remote_name $remote_url; then
                            echo -e "${GREEN}成功添加远程仓库: $remote_name${NC}"
                        else
                            echo -e "${RED}添加失败，可能已存在同名远程仓库${NC}"
                        fi
                    fi
                fi
                ;;
                
            4)  # 删除远程仓库
                echo -e "${YELLOW}请输入要删除的远程仓库名称:${NC}"
                read remote_name
                if [ -z "$remote_name" ]; then
                    echo -e "${RED}远程仓库名不能为空${NC}"
                elif [ "$remote_name" = "origin" ] || [ "$remote_name" = "upstream" ]; then
                    echo -e "${RED}警告: 您正在尝试删除主要远程仓库${NC}"
                    echo -e "${YELLOW}确定要删除 $remote_name 吗? (y/N)${NC}"
                    read -n 1 confirm_delete
                    echo
                    if [ "$confirm_delete" = "y" ] || [ "$confirm_delete" = "Y" ]; then
                        if git remote remove $remote_name; then
                            echo -e "${GREEN}成功删除远程仓库: $remote_name${NC}"
                        else
                            echo -e "${RED}删除失败${NC}"
                        fi
                    else
                        echo -e "${YELLOW}已取消删除${NC}"
                    fi
                else
                    if git remote remove $remote_name; then
                        echo -e "${GREEN}成功删除远程仓库: $remote_name${NC}"
                    else
                        echo -e "${RED}删除失败${NC}"
                    fi
                fi
                ;;
                
            5)  # 从远程仓库获取信息
                echo -e "${YELLOW}请选择:${NC}"
                echo -e "${YELLOW}1. 获取所有远程仓库${NC}"
                echo -e "${YELLOW}2. 获取指定远程仓库${NC}"
                echo -e "${YELLOW}请选择 [1-2]: ${NC}"
                read -n 1 fetch_option
                echo
                
                if [ "$fetch_option" = "2" ]; then
                    echo -e "${YELLOW}请输入远程仓库名称:${NC}"
                    read remote_name
                    if [ -z "$remote_name" ]; then
                        echo -e "${RED}远程仓库名不能为空${NC}"
                    else
                        echo -e "${YELLOW}正在获取 $remote_name...${NC}"
                        if git fetch $remote_name; then
                            echo -e "${GREEN}成功获取 $remote_name${NC}"
                        else
                            echo -e "${RED}获取失败${NC}"
                        fi
                    fi
                else
                    echo -e "${YELLOW}正在获取所有远程仓库...${NC}"
                    if git fetch --all; then
                        echo -e "${GREEN}成功获取所有远程仓库${NC}"
                    else
                        echo -e "${RED}获取失败${NC}"
                    fi
                fi
                ;;
                
            6)  # 查看远程分支
                echo -e "${YELLOW}远程分支列表:${NC}"
                git branch -r -vv
                echo
                echo -e "${YELLOW}所有分支(包括本地和远程):${NC}"
                git branch -a -vv
                ;;
                
            7)  # 清理远程跟踪分支
                echo -e "${YELLOW}清理已删除的远程跟踪分支...${NC}"
                echo -e "${YELLOW}即将执行: git remote prune origin && git remote prune upstream${NC}"
                echo -e "${YELLOW}继续? (Y/n)${NC}"
                read -n 1 confirm_prune
                echo
                if [ "$confirm_prune" != "n" ] && [ "$confirm_prune" != "N" ]; then
                    git remote prune origin 2>/dev/null
                    git remote prune upstream 2>/dev/null
                    echo -e "${GREEN}清理完成${NC}"
                else
                    echo -e "${YELLOW}已取消${NC}"
                fi
                ;;
                
            0)  # 返回主菜单
                return 0
                ;;
                
            *)
                echo -e "${RED}无效选项${NC}"
                ;;
        esac
        
        echo
        echo -e "${YELLOW}按任意键继续...${NC}"
        read -n 1
    done
}

# 分支管理功能
branch_management() {
    while true; do
        clear
        echo -e "${BLUE}===== 分支管理 =====${NC}"
        
        # 显示当前分支
        current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
        echo -e "${GREEN}当前分支: ${YELLOW}$current_branch${NC}"
        echo
        
        # 显示本地分支列表
        echo -e "${YELLOW}本地分支:${NC}"
        git branch -v
        echo
        
        # 显示远程分支列表
        echo -e "${YELLOW}远程分支:${NC}"
        git branch -r
        echo
        
        # 分支管理菜单
        echo -e "${CYAN}请选择操作:${NC}"
        echo -e "${CYAN}1. 创建新分支${NC}"
        echo -e "${CYAN}2. 切换分支${NC}"
        echo -e "${CYAN}3. 合并分支${NC}"
        echo -e "${CYAN}4. 删除分支${NC}"
        echo -e "${CYAN}5. 重命名分支${NC}"
        echo -e "${CYAN}6. 基于远程分支创建本地分支${NC}"
        echo -e "${CYAN}0. 返回主菜单${NC}"
        echo -e "${YELLOW}请输入选项 [0-6]: ${NC}"
        read -n 1 branch_option
        echo
        
        case $branch_option in
            1)  # 创建新分支
                echo -e "${YELLOW}请输入新分支名称:${NC}"
                read new_branch_name
                if [ -z "$new_branch_name" ]; then
                    echo -e "${RED}分支名不能为空${NC}"
                else
                    echo -e "${YELLOW}是否切换到新分支? (Y/n)${NC}"
                    read -n 1 switch_option
                    echo
                    if [ "$switch_option" = "n" ] || [ "$switch_option" = "N" ]; then
                        # 创建但不切换
                        if git branch $new_branch_name; then
                            echo -e "${GREEN}成功创建分支: $new_branch_name${NC}"
                        else
                            echo -e "${RED}创建分支失败，可能已存在同名分支${NC}"
                        fi
                    else
                        # 创建并切换
                        if git checkout -b $new_branch_name; then
                            echo -e "${GREEN}成功创建并切换到分支: $new_branch_name${NC}"
                        else
                            echo -e "${RED}创建或切换分支失败${NC}"
                        fi
                    fi
                fi
                ;;
                
            2)  # 切换分支
                echo -e "${YELLOW}请输入要切换到的分支名称:${NC}"
                read target_branch
                if [ -z "$target_branch" ]; then
                    echo -e "${RED}分支名不能为空${NC}"
                else
                    # 检查是否有未提交的更改
                    if [ -n "$(git status --porcelain)" ]; then
                        echo -e "${YELLOW}您有未提交的更改，切换分支前需要处理这些更改${NC}"
                        echo -e "${YELLOW}1. 提交更改后切换${NC}"
                        echo -e "${YELLOW}2. 存储更改(stash)后切换${NC}"
                        echo -e "${YELLOW}3. 强制切换(可能丢失更改)${NC}"
                        echo -e "${YELLOW}0. 取消切换${NC}"
                        echo -e "${YELLOW}请选择 [0-3]: ${NC}"
                        read -n 1 switch_handling
                        echo
                        
                        case $switch_handling in
                            1)  # 提交更改
                                echo -e "${YELLOW}输入提交信息:${NC}"
                                read commit_msg
                                commit_msg="${commit_msg:-自动提交更改 - 切换分支前}"
                                git add .
                                git commit -m "$commit_msg"
                                ;;
                            2)  # 存储更改
                                git stash save "切换到分支 $target_branch 前的自动存储"
                                echo -e "${GREEN}更改已存储${NC}"
                                ;;
                            3)  # 强制切换
                                git reset --hard
                                echo -e "${GREEN}未提交的更改已丢弃${NC}"
                                ;;
                            *)  # 取消
                                echo -e "${YELLOW}切换分支已取消${NC}"
                                break
                                ;;
                        esac
                    fi
                    
                    # 执行分支切换
                    if git checkout $target_branch; then
                        echo -e "${GREEN}成功切换到分支: $target_branch${NC}"
                        
                        # 如果之前进行了stash，询问是否要应用
                        if [ "$switch_handling" = "2" ]; then
                            echo -e "${YELLOW}是否应用之前存储的更改? (y/N)${NC}"
                            read -n 1 apply_stash
                            echo
                            if [ "$apply_stash" = "y" ] || [ "$apply_stash" = "Y" ]; then
                                if git stash apply; then
                                    echo -e "${GREEN}存储的更改已成功应用${NC}"
                                    echo -e "${YELLOW}是否删除存储记录? (y/N)${NC}"
                                    read -n 1 drop_stash
                                    echo
                                    if [ "$drop_stash" = "y" ] || [ "$drop_stash" = "Y" ]; then
                                        git stash drop
                                        echo -e "${GREEN}存储记录已删除${NC}"
                                    fi
                                else
                                    echo -e "${RED}应用存储的更改时出现冲突，请手动解决${NC}"
                                fi
                            fi
                        fi
                    else
                        echo -e "${RED}切换分支失败，请检查分支名是否正确${NC}"
                    fi
                fi
                ;;
                
            3)  # 合并分支
                echo -e "${YELLOW}请输入要合并到当前分支的源分支名称:${NC}"
                read source_branch
                if [ -z "$source_branch" ]; then
                    echo -e "${RED}分支名不能为空${NC}"
                else
                    echo -e "${YELLOW}正在将 $source_branch 合并到 $current_branch...${NC}"
                    if git merge $source_branch; then
                        echo -e "${GREEN}合并成功${NC}"
                    else
                        echo -e "${RED}合并时出现冲突，请手动解决冲突${NC}"
                        echo -e "${YELLOW}解决冲突后，使用以下命令:${NC}"
                        echo -e "${YELLOW}  git add .${NC}"
                        echo -e "${YELLOW}  git commit -m \"解决合并冲突\"${NC}"
                        echo -e "${RED}或者中止合并:${NC}"
                        echo -e "${YELLOW}  git merge --abort${NC}"
                    fi
                fi
                ;;
                
            4)  # 删除分支
                echo -e "${YELLOW}请输入要删除的分支名称:${NC}"
                read branch_to_delete
                if [ -z "$branch_to_delete" ]; then
                    echo -e "${RED}分支名不能为空${NC}"
                elif [ "$branch_to_delete" = "$current_branch" ]; then
                    echo -e "${RED}无法删除当前分支，请先切换到其他分支${NC}"
                else
                    echo -e "${YELLOW}是否删除远程分支? (y/N)${NC}"
                    read -n 1 delete_remote
                    echo
                    
                    # 删除本地分支
                    echo -e "${YELLOW}删除本地分支 $branch_to_delete...${NC}"
                    if git branch -d $branch_to_delete; then
                        echo -e "${GREEN}成功删除本地分支${NC}"
                    else
                        echo -e "${RED}删除本地分支失败，该分支可能包含未合并的更改${NC}"
                        echo -e "${YELLOW}是否强制删除? (y/N)${NC}"
                        read -n 1 force_delete
                        echo
                        if [ "$force_delete" = "y" ] || [ "$force_delete" = "Y" ]; then
                            if git branch -D $branch_to_delete; then
                                echo -e "${GREEN}成功强制删除本地分支${NC}"
                            else
                                echo -e "${RED}强制删除本地分支失败${NC}"
                            fi
                        fi
                    fi
                    
                    # 删除远程分支
                    if [ "$delete_remote" = "y" ] || [ "$delete_remote" = "Y" ]; then
                        echo -e "${YELLOW}删除远程分支 $branch_to_delete...${NC}"
                        if git push origin --delete $branch_to_delete; then
                            echo -e "${GREEN}成功删除远程分支${NC}"
                        else
                            echo -e "${RED}删除远程分支失败${NC}"
                        fi
                    fi
                fi
                ;;
                
            5)  # 重命名分支
                if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
                    echo -e "${RED}警告: 您正在尝试重命名主分支，这可能会导致问题${NC}"
                    echo -e "${YELLOW}是否继续? (y/N)${NC}"
                    read -n 1 continue_rename
                    echo
                    if [ "$continue_rename" != "y" ] && [ "$continue_rename" != "Y" ]; then
                        echo -e "${YELLOW}已取消重命名操作${NC}"
                        break
                    fi
                fi
                
                echo -e "${YELLOW}请输入新的分支名称:${NC}"
                read new_branch_name
                if [ -z "$new_branch_name" ]; then
                    echo -e "${RED}新分支名不能为空${NC}"
                else
                    # 重命名本地分支
                    if git branch -m $new_branch_name; then
                        echo -e "${GREEN}成功重命名本地分支为: $new_branch_name${NC}"
                        
                        # 询问是否处理远程分支
                        echo -e "${YELLOW}是否更新远程分支? (y/N)${NC}"
                        read -n 1 update_remote
                        echo
                        if [ "$update_remote" = "y" ] || [ "$update_remote" = "Y" ]; then
                            # 删除旧的远程分支，推送新的分支
                            echo -e "${YELLOW}删除旧的远程分支并推送新分支...${NC}"
                            if git push origin :$current_branch && git push -u origin $new_branch_name; then
                                echo -e "${GREEN}成功更新远程分支${NC}"
                            else
                                echo -e "${RED}更新远程分支失败${NC}"
                                echo -e "${YELLOW}您可能需要手动执行:${NC}"
                                echo -e "${YELLOW}  git push origin :$current_branch${NC}"
                                echo -e "${YELLOW}  git push -u origin $new_branch_name${NC}"
                            fi
                        fi
                    else
                        echo -e "${RED}重命名分支失败${NC}"
                    fi
                fi
                ;;
                
            6)  # 基于远程分支创建本地分支
                echo -e "${YELLOW}获取远程分支信息...${NC}"
                git fetch
                
                echo -e "${YELLOW}可用的远程分支:${NC}"
                git branch -r
                echo
                
                echo -e "${YELLOW}请输入远程分支名称(不含origin/):${NC}"
                read remote_branch
                if [ -z "$remote_branch" ]; then
                    echo -e "${RED}分支名不能为空${NC}"
                else
                    echo -e "${YELLOW}请输入本地分支名称 (默认: $remote_branch):${NC}"
                    read local_branch
                    local_branch="${local_branch:-$remote_branch}"
                    
                    # 创建并切换到新的本地分支
                    if git checkout -b $local_branch origin/$remote_branch; then
                        echo -e "${GREEN}成功创建并切换到本地分支: $local_branch${NC}"
                    else
                        echo -e "${RED}创建本地分支失败，请检查远程分支名称是否正确${NC}"
                    fi
                fi
                ;;
                
            0)  # 返回主菜单
                return 0
                ;;
                
            *)
                echo -e "${RED}无效选项，请重新选择${NC}"
                ;;
        esac
        
        echo
        echo -e "${YELLOW}按任意键继续...${NC}"
        read -n 1
    done
}

# 主循环
while true; do
    show_menu
    option=$?
    
    case $option in
        1)
            pull_from_upstream
            ;;
        2)
            push_to_origin_repo
            ;;
        3)
            pull_from_origin
            ;;
        4)
            view_status_history
            ;;
        5)
            branch_management
            ;;
        6)
            remote_management
            ;;
        0)
            echo -e "${GREEN}感谢使用Git管理脚本，再见!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}无效选项，请重新选择${NC}"
            ;;
    esac
    
    echo
    echo -e "${YELLOW}按任意键继续...${NC}"
    read -n 1
    clear
done
