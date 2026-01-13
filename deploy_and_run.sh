#!/bin/bash

# ========================================
# Digen.ai 自动化登录脚本 - 智能部署
# 功能：跳过已下载文件、设置账号密码、一键执行
# ========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目目录
PROJECT_DIR="/home/gan/browser-project"
SCRIPT_FILE="$PROJECT_DIR/digen_login_alwaysdata.js"
LOG_FILE="$PROJECT_DIR/digen_login.log"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Digen.ai 自动化登录 - 智能部署${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 检查并创建目录
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}📁 创建项目目录...${NC}"
    mkdir -p "$PROJECT_DIR"
fi

cd "$PROJECT_DIR" || exit 1

# 2. 检查文件是否存在，不存在则下载
FILES_TO_DOWNLOAD=(
    "digen_login_alwaysdata.js"
    "package_alwaysdata.json"
    "start_digen.sh"
    ".env.example"
)

DOWNLOAD_NEEDED=0
for file in "${FILES_TO_DOWNLOAD[@]}"; do
    if [ ! -f "$file" ]; then
        DOWNLOAD_NEEDED=1
        break
    fi
done

if [ $DOWNLOAD_NEEDED -eq 1 ]; then
    echo -e "${YELLOW}📥 检测到文件缺失，正在下载...${NC}"
    
    wget -q --show-progress \
        https://raw.githubusercontent.com/iudd/tampermonkey-scripts/main/digen_login_alwaysdata.js \
        -O digen_login_alwaysdata.js
    
    wget -q --show-progress \
        https://raw.githubusercontent.com/iudd/tampermonkey-scripts/main/package_alwaysdata.json \
        -O package.json
    
    wget -q --show-progress \
        https://raw.githubusercontent.com/iudd/tampermonkey-scripts/main/start_digen.sh \
        -O start_digen.sh
    
    wget -q --show-progress \
        https://raw.githubusercontent.com/iudd/tampermonkey-scripts/main/.env.example \
        -O .env
    
    chmod +x start_digen.sh
    
    echo -e "${GREEN}✓ 文件下载完成${NC}"
else
    echo -e "${GREEN}✓ 所有文件已存在，跳过下载${NC}"
fi

# 3. 检查依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 正在安装依赖...${NC}"
    npm install --production --no-package-lock
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ 依赖已安装，跳过安装${NC}"
fi

# 4. 设置账号密码
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  设置登录凭据${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 .env 文件
if [ -f ".env" ]; then
    echo -e "${YELLOW}检测到 .env 文件${NC}"
    echo ""
    echo "当前 .env 内容："
    echo "----------------------------------------"
    cat .env
    echo "----------------------------------------"
    echo ""
    
    read -p "是否使用现有 .env 文件？(y/n): " use_existing
    
    if [ "$use_existing" = "y" ] || [ "$use_existing" = "Y" ]; then
        echo -e "${GREEN}✓ 使用现有 .env 文件${NC}"
        source .env
    else
        echo -e "${YELLOW}请输入新的登录信息：${NC}"
        read -p "邮箱: " input_email
        read -sp "密码: " input_password
        echo ""
        
        export DIGEN_EMAIL="$input_email"
        export DIGEN_PASSWORD="$input_password"
        
        # 更新 .env 文件
        echo "DIGEN_EMAIL=$input_email" > .env
        echo "DIGEN_PASSWORD=$input_password" >> .env
        echo -e "${GREEN}✓ 已更新 .env 文件${NC}"
    fi
else
    echo -e "${YELLOW}请输入登录信息：${NC}"
    read -p "邮箱: " input_email
    read -sp "密码: " input_password
    echo ""
    
    export DIGEN_EMAIL="$input_email"
    export DIGEN_PASSWORD="$input_password"
    
    # 创建 .env 文件
    echo "DIGEN_EMAIL=$input_email" > .env
    echo "DIGEN_PASSWORD=$input_password" >> .env
    echo -e "${GREEN}✓ 已创建 .env 文件${NC}"
fi

# 5. 验证凭据
echo ""
if [ -z "$DIGEN_EMAIL" ] || [ -z "$DIGEN_PASSWORD" ]; then
    echo -e "${RED}✗ 错误：邮箱或密码为空${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 凭据设置完成${NC}"
echo "  邮箱: $DIGEN_EMAIL"
echo ""

# 6. 运行脚本
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  开始执行登录脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 运行并捕获退出码
node digen_login_alwaysdata.js
EXIT_CODE=$?

echo ""
echo -e "${BLUE}========================================${NC}"
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ 脚本执行成功！${NC}"
else
    echo -e "${RED}✗ 脚本执行失败 (退出码: $EXIT_CODE)${NC}"
fi
echo -e "${BLUE}========================================${NC}"
echo ""

# 7. 显示日志位置
echo -e "${YELLOW}📝 查看完整日志:${NC}"
echo "  tail -f $LOG_FILE"
echo ""
echo -e "${YELLOW}📝 查看最近50行:${NC}"
echo "  tail -n 50 $LOG_FILE"
echo ""

exit $EXIT_CODE
