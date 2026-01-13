#!/bin/bash

# Digen.ai 自动化登录启动脚本
# 用于 AlwaysData PaaS 服务器

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目目录
PROJECT_DIR="/home/gan/browser-project"
SCRIPT_FILE="$PROJECT_DIR/digen_login_alwaysdata.js"
LOG_FILE="$PROJECT_DIR/digen_login.log"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Digen.ai 自动化登录脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查环境变量
if [ -z "$DIGEN_EMAIL" ] || [ -z "$DIGEN_PASSWORD" ]; then
    echo -e "${YELLOW}警告: 未设置环境变量${NC}"
    echo -e "${YELLOW}请先设置以下环境变量:${NC}"
    echo "  export DIGEN_EMAIL=\"your_email@example.com\""
    echo "  export DIGEN_PASSWORD=\"your_password\""
    echo ""
    echo -e "${YELLOW}或者创建 .env 文件:${NC}"
    echo '  echo "DIGEN_EMAIL=your_email@example.com" > .env'
    echo '  echo "DIGEN_PASSWORD=your_password" >> .env'
    echo ""
    exit 1
fi

# 检查脚本文件
if [ ! -f "$SCRIPT_FILE" ]; then
    echo -e "${RED}错误: 脚本文件不存在${NC}"
    echo "路径: $SCRIPT_FILE"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: Node.js 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 环境检查通过${NC}"
echo ""

# 显示配置信息
echo -e "${GREEN}配置信息:${NC}"
echo "  邮箱: $DIGEN_EMAIL"
echo "  项目目录: $PROJECT_DIR"
echo "  日志文件: $LOG_FILE"
echo ""

# 运行脚本
echo -e "${GREEN}开始执行...${NC}"
echo ""

cd "$PROJECT_DIR" || exit 1

# 运行并捕获退出码
node "$SCRIPT_FILE"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ 脚本执行成功${NC}"
else
    echo -e "${RED}✗ 脚本执行失败 (退出码: $EXIT_CODE)${NC}"
    echo ""
    echo -e "${YELLOW}查看日志:${NC}"
    echo "  tail -n 50 $LOG_FILE"
fi

exit $EXIT_CODE
