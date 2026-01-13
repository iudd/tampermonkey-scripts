#!/usr/bin/env node

/**
 * Digen.ai 自动化登录和签到脚本
 * 针对 AlwaysData PaaS 服务器优化（256MB内存限制）
 * 
 * 环境要求：
 * - Node.js v18.19.0+
 * - Playwright 已安装
 * - Chrome 浏览器路径: /home/gan/browser-project/chrome-browser/chrome-linux64/chrome
 * 
 * 使用方法：
 * 1. 设置环境变量：
 *    export DIGEN_EMAIL="your_email@example.com"
 *    export DIGEN_PASSWORD="your_password"
 * 2. 运行脚本：
 *    node digen_login_alwaysdata.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ==================== 配置部分 ====================

const CONFIG = {
    // 浏览器配置
    browser: {
        executablePath: '/home/gan/browser-project/chrome-browser/chrome-linux64/chrome',
        headless: true,
        timeout: 30000,
    },
    
    // 内存优化参数（针对256MB限制）
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
        '--max_old_space_size=128',
        '--memory-pressure-off',
        '--no-zygote',
        '--disable-logging',
        '--log-level=3',
        '--disable-permissions-api',
        '--disable-notifications',
        '--disable-infobars',
        '--window-size=1280,720',
    ],
    
    // 页面配置
    page: {
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
    },
    
    // 登录URL
    urls: {
        login: 'https://digen.ai/signin',
        dashboard: 'https://digen.ai/dashboard',
    },
    
    // 选择器配置（基于提取的元素信息）
    selectors: {
        emailInput: '#form_item_email',
        passwordInput: '#form_item_password',
        loginButton: '.btnSubmit',
        loginForm: '.customForm',
    },
    
    // 日志配置
    log: {
        level: 'info', // debug, info, warn, error
        file: '/home/gan/browser-project/digen_login.log',
    },
    
    // 会话保存路径
    sessionPath: '/home/gan/browser-project/digen_session.json',
};

// ==================== 日志工具 ====================

class Logger {
    constructor(config) {
        this.level = config.level;
        this.file = config.file;
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
    }
    
    log(level, message, data = null) {
        if (this.levels[level] < this.levels[this.level]) return;
        
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
            fs.appendFileSync(this.file, fileMessage, 'utf8');
        } catch (err) {
            console.error('写入日志文件失败:', err.message);
        }
    }
    
    debug(message, data) { this.log('debug', message, data); }
    info(message, data) { this.log('info', message, data); }
    warn(message, data) { this.log('warn', message, data); }
    error(message, data) { this.log('error', message, data); }
}

const logger = new Logger(CONFIG.log);

// ==================== 资源管理 ====================

class ResourceManager {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }
    
    setBrowser(browser) { this.browser = browser; }
    setContext(context) { this.context = context; }
    setPage(page) { this.page = page; }
    
    async cleanup() {
        logger.info('开始清理资源...');
        
        try {
            if (this.page) {
                await this.page.close().catch(err => {
                    logger.error('关闭页面失败', { error: err.message });
                });
                this.page = null;
            }
            
            if (this.context) {
                await this.context.close().catch(err => {
                    logger.error('关闭上下文失败', { error: err.message });
                });
                this.context = null;
            }
            
            if (this.browser) {
                await this.browser.close().catch(err => {
                    logger.error('关闭浏览器失败', { error: err.message });
                });
                this.browser = null;
            }
            
            logger.info('资源清理完成');
        } catch (err) {
            logger.error('资源清理异常', { error: err.message });
        }
    }
}

const resourceManager = new ResourceManager();

// ==================== 会话管理 ====================

class SessionManager {
    constructor(sessionPath) {
        this.sessionPath = sessionPath;
    }
    
    save(cookies, storage) {
        try {
            const session = {
                cookies,
                storage,
                savedAt: new Date().toISOString(),
            };
            fs.writeFileSync(this.sessionPath, JSON.stringify(session, null, 2), 'utf8');
            logger.info('会话已保存', { path: this.sessionPath });
        } catch (err) {
            logger.error('保存会话失败', { error: err.message });
        }
    }
    
    load() {
        try {
            if (!fs.existsSync(this.sessionPath)) {
                return null;
            }
            const data = fs.readFileSync(this.sessionPath, 'utf8');
            const session = JSON.parse(data);
            logger.info('会话已加载', { path: this.sessionPath });
            return session;
        } catch (err) {
            logger.error('加载会话失败', { error: err.message });
            return null;
        }
    }
    
    isValid() {
        const session = this.load();
        if (!session) return false;
        
        // 检查会话是否过期（24小时）
        const savedAt = new Date(session.savedAt);
        const now = new Date();
        const hoursDiff = (now - savedAt) / (1000 * 60 * 60);
        
        return hoursDiff < 24;
    }
}

const sessionManager = new SessionManager(CONFIG.sessionPath);

// ==================== 浏览器初始化 ====================

async function initBrowser() {
    logger.info('正在初始化浏览器...');
    
    try {
        const browser = await chromium.launch({
            executablePath: CONFIG.browser.executablePath,
            headless: CONFIG.browser.headless,
            args: CONFIG.launchArgs,
            timeout: CONFIG.browser.timeout,
        });
        
        resourceManager.setBrowser(browser);
        logger.info('浏览器启动成功');
        
        // 创建上下文
        const context = await browser.newContext({
            viewport: CONFIG.page.viewport,
            userAgent: CONFIG.page.userAgent,
            locale: CONFIG.page.locale,
            timezoneId: CONFIG.page.timezoneId,
            // 禁用不必要的功能以节省内存
            permissions: [],
            javaScriptEnabled: true,
            ignoreHTTPSErrors: true,
        });
        
        resourceManager.setContext(context);
        logger.info('浏览器上下文创建成功');
        
        // 创建页面
        const page = await context.newPage();
        
        // 监听页面错误
        page.on('pageerror', (err) => {
            logger.error('页面错误', { error: err.message });
        });
        
        // 监听请求失败
        page.on('requestfailed', (request) => {
            logger.debug('请求失败', { url: request.url(), failure: request.failure() });
        });
        
        resourceManager.setPage(page);
        logger.info('页面创建成功');
        
        return page;
    } catch (err) {
        logger.error('浏览器初始化失败', { error: err.message });
        throw err;
    }
}

// ==================== 登录功能 ====================

async function login(page, email, password) {
    logger.info('开始登录流程...');
    
    try {
        // 访问登录页面
        logger.info('访问登录页面', { url: CONFIG.urls.login });
        await page.goto(CONFIG.urls.login, {
            waitUntil: 'networkidle',
            timeout: CONFIG.browser.timeout,
        });
        
        logger.debug('等待登录表单加载...');
        
        // 等待表单元素出现
        await page.waitForSelector(CONFIG.selectors.emailInput, {
            timeout: CONFIG.browser.timeout,
        });
        await page.waitForSelector(CONFIG.selectors.passwordInput, {
            timeout: CONFIG.browser.timeout,
        });
        
        logger.info('填写登录信息', { email });
        
        // 填写邮箱
        await page.fill(CONFIG.selectors.emailInput, email);
        await page.waitForTimeout(500); // 模拟人类操作延迟
        
        // 填写密码
        await page.fill(CONFIG.selectors.passwordInput, password);
        await page.waitForTimeout(500);
        
        logger.info('点击登录按钮');
        
        // 点击登录按钮
        await page.click(CONFIG.selectors.loginButton);
        
        logger.info('等待登录完成...');
        
        // 等待登录完成
        await page.waitForTimeout(3000);
        
        // 检查登录结果
        const currentUrl = page.url();
        logger.info('当前URL', { url: currentUrl });
        
        if (currentUrl.includes('signin')) {
            // 检查是否有错误提示
            const errorElement = await page.$('.ant-message-error, .error-message');
            if (errorElement) {
                const errorText = await errorElement.textContent();
                throw new Error(`登录失败: ${errorText}`);
            }
            throw new Error('登录失败：仍在登录页面');
        }
        
        logger.info('登录成功！');
        
        // 保存会话
        const cookies = await page.context().cookies();
        const storage = await page.evaluate(() => {
            const result = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                result[key] = localStorage.getItem(key);
            }
            return result;
        });
        
        sessionManager.save(cookies, storage);
        
        return true;
    } catch (err) {
        logger.error('登录失败', { error: err.message });
        throw err;
    }
}

// ==================== 签到功能 ====================

async function checkIn(page) {
    logger.info('开始签到流程...');
    
    try {
        // 访问dashboard
        logger.info('访问Dashboard', { url: CONFIG.urls.dashboard });
        await page.goto(CONFIG.urls.dashboard, {
            waitUntil: 'networkidle',
            timeout: CONFIG.browser.timeout,
        });
        
        logger.debug('等待页面加载...');
        await page.waitForTimeout(2000);
        
        // 查找签到按钮（根据实际情况调整选择器）
        const checkInSelectors = [
            'button:has-text("签到")',
            'button:has-text("Check in")',
            'button:has-text("每日签到")',
            'button:has-text("Daily check")',
            '.check-in-btn',
            '.daily-check-btn',
            '[data-testid="check-in"]',
        ];
        
        let checkInButton = null;
        for (const selector of checkInSelectors) {
            try {
                checkInButton = await page.$(selector);
                if (checkInButton) {
                    logger.info('找到签到按钮', { selector });
                    break;
                }
            } catch (err) {
                // 继续尝试下一个选择器
            }
        }
        
        if (checkInButton) {
            await checkInButton.click();
            logger.info('已点击签到按钮');
            await page.waitForTimeout(2000);
            
            // 检查签到结果
            const successSelectors = [
                'text=签到成功',
                'text=Check in successful',
                'text=已签到',
                'text=Already checked',
            ];
            
            for (const selector of successSelectors) {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    logger.info('签到成功', { message: text });
                    return true;
                }
            }
            
            logger.warn('签到状态不明，请检查');
        } else {
            logger.warn('未找到签到按钮，可能已签到或页面结构变化');
        }
        
        return false;
    } catch (err) {
        logger.error('签到失败', { error: err.message });
        throw err;
    }
}

// ==================== 主流程 ====================

async function main() {
    logger.info('=' .repeat(60));
    logger.info('Digen.ai 自动化登录和签到脚本启动');
    logger.info('=' .repeat(60));
    
    // 读取环境变量
    const email = process.env.DIGEN_EMAIL;
    const password = process.env.DIGEN_PASSWORD;
    
    if (!email || !password) {
        logger.error('请设置环境变量 DIGEN_EMAIL 和 DIGEN_PASSWORD');
        process.exit(1);
    }
    
    logger.info('环境变量读取成功', { email });
    
    let page = null;
    
    try {
        // 初始化浏览器
        page = await initBrowser();
        
        // 尝试使用已有会话
        if (sessionManager.isValid()) {
            logger.info('检测到有效会话，尝试使用...');
            const session = sessionManager.load();
            
            // 添加cookies
            await page.context().addCookies(session.cookies);
            
            // 设置localStorage
            await page.evaluate((storage) => {
                for (const [key, value] of Object.entries(storage)) {
                    localStorage.setItem(key, value);
                }
            }, session.storage);
            
            // 访问dashboard验证会话
            await page.goto(CONFIG.urls.dashboard, {
                waitUntil: 'networkidle',
                timeout: CONFIG.browser.timeout,
            });
            
            const currentUrl = page.url();
            if (currentUrl.includes('signin')) {
                logger.warn('会话已失效，重新登录...');
                await login(page, email, password);
            } else {
                logger.info('会话有效，跳过登录');
            }
        } else {
            logger.info('无有效会话，执行登录...');
            await login(page, email, password);
        }
        
        // 执行签到
        await checkIn(page);
        
        logger.info('=' .repeat(60));
        logger.info('所有任务完成！');
        logger.info('=' .repeat(60));
        
    } catch (err) {
        logger.error('主流程异常', { error: err.message, stack: err.stack });
        process.exit(1);
    } finally {
        // 清理资源
        await resourceManager.cleanup();
    }
}

// ==================== 信号处理 ====================

process.on('SIGINT', async () => {
    logger.info('收到中断信号，正在清理...');
    await resourceManager.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('收到终止信号，正在清理...');
    await resourceManager.cleanup();
    process.exit(0);
});

// ==================== 启动 ====================

if (require.main === module) {
    main().catch(err => {
        logger.error('脚本执行失败', { error: err.message });
        process.exit(1);
    });
}

module.exports = { main, CONFIG };
