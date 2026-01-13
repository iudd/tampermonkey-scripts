#!/usr/bin/env node

/**
 * Digen.ai 自动化登录脚本 - 调试版本
 * 增加等待时间、截图功能、详细日志
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    browser: {
        executablePath: '/home/gan/browser-project/chrome-browser/chrome-linux64/chrome',
        headless: false, // 调试模式：显示浏览器
        timeout: 60000,  // 增加超时时间到60秒
    },
    
    launchArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--max_old_space_size=128',
        '--window-size=1280,720',
    ],
    
    page: {
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    
    urls: {
        login: 'https://digen.ai/signin',
        dashboard: 'https://digen.ai/dashboard',
    },
    
    selectors: {
        emailInput: '#form_item_email',
        passwordInput: '#form_item_password',
        loginButton: '.btnSubmit',
    },
    
    logFile: '/home/gan/browser-project/digen_login_debug.log',
    screenshotDir: '/home/gan/browser-project/screenshots',
};

// 创建截图目录
if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
}

// 日志函数
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
    
    // 写入文件
    try {
        const fileMessage = data 
            ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
            : `${logMessage}\n`;
        fs.appendFileSync(CONFIG.logFile, fileMessage, 'utf8');
    } catch (err) {
        console.error('写入日志失败:', err.message);
    }
}

// 截图函数
async function takeScreenshot(page, name) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${CONFIG.screenshotDir}/${name}_${timestamp}.png`;
        await page.screenshot({ path: filename, fullPage: true });
        log('INFO', `截图已保存: ${filename}`);
        return filename;
    } catch (err) {
        log('ERROR', '截图失败', { error: err.message });
        return null;
    }
}

// 主函数
async function main() {
    log('INFO', '========================================');
    log('INFO', 'Digen.ai 自动化登录 - 调试版本');
    log('INFO', '========================================');
    
    const email = process.env.DIGEN_EMAIL;
    const password = process.env.DIGEN_PASSWORD;
    
    if (!email || !password) {
        log('ERROR', '请设置环境变量 DIGEN_EMAIL 和 DIGEN_PASSWORD');
        process.exit(1);
    }
    
    log('INFO', '登录凭据', { email });
    
    let browser = null;
    let context = null;
    let page = null;
    
    try {
        // 启动浏览器
        log('INFO', '正在启动浏览器...');
        browser = await chromium.launch({
            executablePath: CONFIG.browser.executablePath,
            headless: CONFIG.browser.headless,
            args: CONFIG.launchArgs,
            timeout: CONFIG.browser.timeout,
        });
        
        log('INFO', '浏览器启动成功');
        
        // 创建上下文
        context = await browser.newContext({
            viewport: CONFIG.page.viewport,
            userAgent: CONFIG.page.userAgent,
        });
        
        // 创建页面
        page = await context.newPage();
        
        // 监听控制台消息
        page.on('console', msg => {
            log('DEBUG', '页面控制台', { text: msg.text(), type: msg.type() });
        });
        
        // 监听页面错误
        page.on('pageerror', err => {
            log('ERROR', '页面错误', { error: err.message });
        });
        
        // 访问登录页面
        log('INFO', '访问登录页面', { url: CONFIG.urls.login });
        await page.goto(CONFIG.urls.login, {
            waitUntil: 'networkidle',
            timeout: CONFIG.browser.timeout,
        });
        
        log('INFO', '等待页面加载...');
        await page.waitForTimeout(3000);
        
        // 截图：登录页面
        await takeScreenshot(page, '01_login_page');
        
        // 等待表单元素
        log('INFO', '等待表单元素...');
        await page.waitForSelector(CONFIG.selectors.emailInput, {
            timeout: CONFIG.browser.timeout,
        });
        await page.waitForSelector(CONFIG.selectors.passwordInput, {
            timeout: CONFIG.browser.timeout,
        });
        
        log('INFO', '表单元素已找到');
        
        // 截图：表单元素
        await takeScreenshot(page, '02_form_found');
        
        // 填写邮箱
        log('INFO', '填写邮箱', { email });
        await page.fill(CONFIG.selectors.emailInput, email);
        await page.waitForTimeout(1000);
        
        // 截图：邮箱已填写
        await takeScreenshot(page, '03_email_filled');
        
        // 填写密码
        log('INFO', '填写密码');
        await page.fill(CONFIG.selectors.passwordInput, password);
        await page.waitForTimeout(1000);
        
        // 截图：密码已填写
        await takeScreenshot(page, '04_password_filled');
        
        // 查找登录按钮
        log('INFO', '查找登录按钮...');
        const loginButton = await page.$(CONFIG.selectors.loginButton);
        
        if (!loginButton) {
            log('ERROR', '未找到登录按钮');
            await takeScreenshot(page, 'error_no_button');
            throw new Error('未找到登录按钮');
        }
        
        log('INFO', '登录按钮已找到');
        
        // 点击登录按钮
        log('INFO', '点击登录按钮...');
        await loginButton.click();
        
        // 截图：点击后
        await takeScreenshot(page, '05_button_clicked');
        
        // 等待登录完成
        log('INFO', '等待登录完成...');
        await page.waitForTimeout(5000);
        
        // 截图：等待后
        await takeScreenshot(page, '06_after_wait');
        
        // 检查当前URL
        const currentUrl = page.url();
        log('INFO', '当前URL', { url: currentUrl });
        
        // 检查是否还在登录页
        if (currentUrl.includes('signin')) {
            log('WARN', '仍在登录页面，检查错误信息');
            
            // 截图：仍在登录页
            await takeScreenshot(page, 'error_still_on_login');
            
            // 查找错误信息
            const errorSelectors = [
                '.ant-message-error',
                '.error-message',
                '.ant-form-item-explain-error',
                '[role="alert"]',
            ];
            
            for (const selector of errorSelectors) {
                const errorElement = await page.$(selector);
                if (errorElement) {
                    const errorText = await errorElement.textContent();
                    log('ERROR', '发现错误信息', { selector, text: errorText });
                }
            }
            
            // 获取页面HTML
            const pageContent = await page.content();
            log('DEBUG', '页面内容（前1000字符）', { content: pageContent.substring(0, 1000) });
            
            throw new Error('登录失败：仍在登录页面');
        }
        
        log('INFO', '登录成功！');
        
        // 截图：登录成功
        await takeScreenshot(page, '07_login_success');
        
        // 等待页面完全加载
        await page.waitForTimeout(3000);
        
        log('INFO', '========================================');
        log('INFO', '所有任务完成！');
        log('INFO', '========================================');
        
    } catch (err) {
        log('ERROR', '执行失败', { error: err.message, stack: err.stack });
        
        // 错误截图
        if (page) {
            await takeScreenshot(page, 'error_final');
        }
        
        process.exit(1);
    } finally {
        // 清理资源
        if (page) {
            await page.close().catch(err => {
                log('ERROR', '关闭页面失败', { error: err.message });
            });
        }
        
        if (context) {
            await context.close().catch(err => {
                log('ERROR', '关闭上下文失败', { error: err.message });
            });
        }
        
        if (browser) {
            await browser.close().catch(err => {
                log('ERROR', '关闭浏览器失败', { error: err.message });
            });
        }
        
        log('INFO', '资源清理完成');
        log('INFO', '========================================');
        log('INFO', '截图目录: ' + CONFIG.screenshotDir);
        log('INFO', '日志文件: ' + CONFIG.logFile);
        log('INFO', '========================================');
    }
}

// 运行
main().catch(err => {
    log('ERROR', '脚本异常', { error: err.message });
    process.exit(1);
});
