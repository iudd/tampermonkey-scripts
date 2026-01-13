#!/usr/bin/env node

/**
 * Digen.ai 自动化登录脚本 - 极简版本（最小内存占用）
 * 针对 AlwaysData 256MB 内存限制优化
 */

const { chromium } = require('playwright');
const fs = require('fs');

// 配置
const CONFIG = {
    browser: {
        executablePath: '/home/gan/browser-project/chrome-browser/chrome-linux64/chrome',
        headless: true,
        timeout: 30000,
    },
    
    // 极简启动参数（最小内存占用）
    launchArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-features=site-per-process',
        '--disable-site-isolation-trials',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--single-process',
        '--max_old_space_size=64',
        '--memory-pressure-off',
        '--no-zygote',
        '--disable-logging',
        '--log-level=3',
        '--disable-permissions-api',
        '--disable-notifications',
        '--disable-infobars',
        '--disable-blink-features=AutomationControlled',
        '--disable-background-networking',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=VizDisplayCompositor',
        '--disable-features=IsolateOrigins',
        '--disable-features=site-per-process',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-features=MediaRouter',
        '--disable-features=OutOfBlinkCors',
        '--window-size=1024,768',
    ],
    
    page: {
        viewport: { width: 1024, height: 768 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    
    selectors: {
        emailInput: '#form_item_email',
        passwordInput: '#form_item_password',
        loginButton: '.btnSubmit',
    },
    
    logFile: '/home/gan/browser-project/digen_login_minimal.log',
};

// 简单日志函数
function log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    try {
        fs.appendFileSync(CONFIG.logFile, logMessage + '\n', 'utf8');
    } catch (err) {}
}

// 主函数
async function main() {
    log('INFO', '========================================');
    log('INFO', 'Digen.ai 自动化登录 - 极简版本');
    log('INFO', '========================================');
    
    const email = process.env.DIGEN_EMAIL;
    const password = process.env.DIGEN_PASSWORD;
    
    if (!email || !password) {
        log('ERROR', '请设置环境变量 DIGEN_EMAIL 和 DIGEN_PASSWORD');
        process.exit(1);
    }
    
    log('INFO', `邮箱: ${email}`);
    
    let browser = null;
    let context = null;
    let page = null;
    
    try {
        // 启动浏览器
        log('INFO', '启动浏览器...');
        browser = await chromium.launch({
            executablePath: CONFIG.browser.executablePath,
            headless: CONFIG.browser.headless,
            args: CONFIG.launchArgs,
            timeout: CONFIG.browser.timeout,
        });
        
        log('INFO', '浏览器启动成功');
        
        // 创建上下文（禁用所有不必要的功能）
        context = await browser.newContext({
            viewport: CONFIG.page.viewport,
            userAgent: CONFIG.page.userAgent,
            permissions: [],
            javaScriptEnabled: true,
            ignoreHTTPSErrors: true,
            serviceWorkers: 'block',
        });
        
        // 创建页面
        page = await context.newPage();
        
        // 禁用图片加载（节省内存）
        await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico}', route => route.abort());
        
        // 禁用字体加载
        await page.route('**/*.{woff,woff2,ttf,eot}', route => route.abort());
        
        log('INFO', '访问登录页面...');
        await page.goto('https://digen.ai/signin', {
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.browser.timeout,
        });
        
        log('INFO', '等待表单元素...');
        
        // 等待元素
        await page.waitForSelector(CONFIG.selectors.emailInput, { timeout: 10000 });
        await page.waitForSelector(CONFIG.selectors.passwordInput, { timeout: 10000 });
        
        log('INFO', '填写表单...');
        
        // 快速填写
        await page.fill(CONFIG.selectors.emailInput, email);
        await page.waitForTimeout(500);
        
        await page.fill(CONFIG.selectors.passwordInput, password);
        await page.waitForTimeout(500);
        
        log('INFO', '点击登录按钮...');
        
        // 点击登录
        await page.click(CONFIG.selectors.loginButton);
        
        log('INFO', '等待登录...');
        await page.waitForTimeout(3000);
        
        // 检查结果
        const currentUrl = page.url();
        log('INFO', `当前URL: ${currentUrl}`);
        
        if (currentUrl.includes('signin')) {
            log('ERROR', '登录失败：仍在登录页面');
            
            // 检查错误信息
            try {
                const errorText = await page.evaluate(() => {
                    const errorEl = document.querySelector('.ant-message-error, .error-message');
                    return errorEl ? errorEl.textContent : '未找到错误信息';
                });
                log('ERROR', `错误信息: ${errorText}`);
            } catch (err) {
                log('ERROR', '无法获取错误信息');
            }
            
            throw new Error('登录失败');
        }
        
        log('INFO', '========================================');
        log('INFO', '登录成功！');
        log('INFO', '========================================');
        
        // 保存会话
        const cookies = await context.cookies();
        const storage = await page.evaluate(() => {
            const result = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                result[key] = localStorage.getItem(key);
            }
            return result;
        });
        
        const session = { cookies, storage, savedAt: new Date().toISOString() };
        fs.writeFileSync('/home/gan/browser-project/digen_session.json', JSON.stringify(session, null, 2));
        log('INFO', '会话已保存');
        
    } catch (err) {
        log('ERROR', `执行失败: ${err.message}`);
        process.exit(1);
    } finally {
        // 快速清理
        try {
            if (page) await page.close();
            if (context) await context.close();
            if (browser) await browser.close();
            log('INFO', '资源清理完成');
        } catch (err) {
            log('ERROR', `清理失败: ${err.message}`);
        }
    }
}

// 运行
main().catch(err => {
    log('ERROR', `脚本异常: ${err.message}`);
    process.exit(1);
});
