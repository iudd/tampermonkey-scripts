# Digen.ai 自动化登录脚本 - AlwaysData 版本

针对 AlwaysData PaaS 服务器优化的 Playwright 自动化登录和签到脚本。

## 📋 环境要求

- **Node.js**: v18.19.0+
- **内存**: 256MB（已优化）
- **权限**: 用户空间（无需root）
- **Chrome**: `/home/gan/browser-project/chrome-browser/chrome-linux64/chrome`

## 🚀 快速开始

### 1. 准备文件

将以下文件上传到服务器 `/home/gan/browser-project/` 目录：
- `digen_login_alwaysdata.js` - 主脚本
- `package_alwaysdata.json` - 依赖配置

### 2. 安装依赖

```bash
cd /home/gan/browser-project/
npm install
```

### 3. 设置环境变量

```bash
export DIGEN_EMAIL="your_email@example.com"
export DIGEN_PASSWORD="your_password"
```

### 4. 运行脚本

```bash
node digen_login_alwaysdata.js
```

## 📝 配置说明

### 内存优化参数

脚本已针对 256MB 内存限制进行优化，包含以下参数：

- `--single-process` - 单进程模式
- `--max_old_space_size=128` - 限制 Node.js 内存使用
- `--disable-dev-shm-usage` - 禁用 /dev/shm
- `--disable-gpu` - 禁用 GPU 加速
- `--disable-extensions` - 禁用扩展
- `--no-sandbox` - 无沙盒模式

### 选择器配置

基于提取的登录页面元素信息：

```javascript
selectors: {
    emailInput: '#form_item_email',      // 邮箱输入框
    passwordInput: '#form_item_password', // 密码输入框
    loginButton: '.btnSubmit',            // 登录按钮
    loginForm: '.customForm',             // 登录表单
}
```

## 🔧 功能特性

### 1. 自动登录
- 访问登录页面
- 填写邮箱和密码
- 点击登录按钮
- 验证登录状态

### 2. 会话管理
- 自动保存登录会话（cookies + localStorage）
- 会话有效期：24小时
- 自动检测会话有效性
- 无效会话自动重新登录

### 3. 自动签到
- 访问 Dashboard
- 查找签到按钮
- 执行签到操作
- 检查签到结果

### 4. 错误处理
- 完整的异常捕获
- 详细的错误日志
- 资源自动清理
- 信号处理（SIGINT/SIGTERM）

### 5. 日志系统
- 分级日志（debug/info/warn/error）
- 控制台输出
- 文件日志（`digen_login.log`）
- 结构化日志格式

## 📊 日志示例

```
[2026-01-13T02:58:00.000Z] [INFO] ============================================================
[2026-01-13T02:58:00.000Z] [INFO] Digen.ai 自动化登录和签到脚本启动
[2026-01-13T02:58:00.000Z] [INFO] ============================================================
[2026-01-13T02:58:00.100Z] [INFO] 环境变量读取成功 {"email":"your_email@example.com"}
[2026-01-13T02:58:00.200Z] [INFO] 正在初始化浏览器...
[2026-01-13T02:58:02.500Z] [INFO] 浏览器启动成功
[2026-01-13T02:58:02.600Z] [INFO] 浏览器上下文创建成功
[2026-01-13T02:58:02.700Z] [INFO] 页面创建成功
[2026-01-13T02:58:02.800Z] [INFO] 开始登录流程...
[2026-01-13T02:58:02.900Z] [INFO] 访问登录页面 {"url":"https://digen.ai/signin"}
[2026-01-13T02:58:05.000Z] [INFO] 填写登录信息 {"email":"your_email@example.com"}
[2026-01-13T02:58:06.000Z] [INFO] 点击登录按钮
[2026-01-13T02:58:09.000Z] [INFO] 登录成功！
[2026-01-13T02:58:09.100Z] [INFO] 会话已保存 {"path":"/home/gan/browser-project/digen_session.json"}
[2026-01-13T02:58:09.200Z] [INFO] 开始签到流程...
[2026-01-13T02:58:11.500Z] [INFO] 签到成功 {"message":"签到成功"}
[2026-01-13T02:58:11.600Z] [INFO] ============================================================
[2026-01-13T02:58:11.600Z] [INFO] 所有任务完成！
[2026-01-13T02:58:11.600Z] [INFO] ============================================================
[2026-01-13T02:58:11.700Z] [INFO] 开始清理资源...
[2026-01-13T02:58:12.000Z] [INFO] 资源清理完成
```

## 🔐 安全建议

1. **不要在代码中硬编码凭据**
   - 使用环境变量存储敏感信息
   - 不要将凭据提交到版本控制

2. **保护日志文件**
   ```bash
   chmod 600 /home/gan/browser-project/digen_login.log
   chmod 600 /home/gan/browser-project/digen_session.json
   ```

3. **定期更新凭据**
   - 建议定期更换密码
   - 使用强密码

## 📅 定时任务

使用 cron 设置定时任务：

```bash
# 编辑 crontab
crontab -e

# 每天早上8点执行
0 8 * * * cd /home/gan/browser-project && export DIGEN_EMAIL="your_email@example.com" && export DIGEN_PASSWORD="your_password" && node digen_login_alwaysdata.js >> cron.log 2>&1
```

## 🐛 故障排查

### 问题1：内存不足

**症状**: 脚本运行过程中被系统杀死

**解决方案**:
1. 检查内存使用：`free -m`
2. 确保没有其他进程占用内存
3. 减少并发任务

### 问题2：Chrome 启动失败

**症状**: `Browser not found` 或 `executable path not found`

**解决方案**:
1. 检查 Chrome 路径是否正确
2. 验证 Chrome 可执行权限：`ls -l /home/gan/browser-project/chrome-browser/chrome-linux64/chrome`

### 问题3：登录失败

**症状**: 提示"登录失败"

**解决方案**:
1. 检查凭据是否正确
2. 查看日志文件了解详细错误
3. 手动访问网站验证登录是否正常

### 问题4：找不到签到按钮

**症状**: "未找到签到按钮"

**解决方案**:
1. 检查页面结构是否变化
2. 使用浏览器开发者工具查找正确的选择器
3. 更新脚本中的 `checkInSelectors` 配置

## 📁 文件结构

```
/home/gan/browser-project/
├── digen_login_alwaysdata.js    # 主脚本
├── package_alwaysdata.json      # 依赖配置
├── digen_login.log              # 日志文件（自动生成）
├── digen_session.json           # 会话文件（自动生成）
├── login_success.png            # 成功截图（调试模式）
├── login_error.png              # 失败截图（调试模式）
└── node_modules/                # 依赖包
```

## 🔄 更新脚本

如果登录页面元素发生变化，需要更新选择器配置：

1. 使用油猴脚本提取新的元素信息
2. 更新 `CONFIG.selectors` 配置
3. 更新 `checkInSelectors` 签到按钮选择器

## 📞 支持

如有问题，请查看：
1. 日志文件：`/home/gan/browser-project/digen_login.log`
2. 会话文件：`/home/gan/browser-project/digen_session.json`

## 📄 许可证

MIT License
