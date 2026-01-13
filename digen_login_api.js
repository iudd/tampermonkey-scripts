#!/usr/bin/env node

/**
 * Digen.ai 自动化登录脚本 - API 版本（无需浏览器）
 * 使用 HTTP 请求直接登录，内存占用极低
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

// 配置
const CONFIG = {
    baseUrl: 'https://digen.ai',
    loginUrl: 'https://digen.ai/signin',
    logFile: '/home/gan/browser-project/digen_login_api.log',
    sessionFile: '/home/gan/browser-project/digen_session.json',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// 日志函数
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
    try {
        const fileMessage = data 
            ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
            : `${logMessage}\n`;
        fs.appendFileSync(CONFIG.logFile, fileMessage, 'utf8');
    } catch (err) {}
}

// HTTP 请求函数
function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': CONFIG.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                ...options.headers,
            },
        };

        if (options.body) {
            requestOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
        }

        const req = protocol.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    cookies: res.headers['set-cookie'] || [],
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// 解析 cookies
function parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.trim().split('=');
            if (parts.length === 2) {
                cookies[parts[0]] = parts[1];
            }
        });
    }
    return cookies;
}

// 格式化 cookies
function formatCookies(cookies) {
    return Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

// 主函数
async function main() {
    log('INFO', '========================================');
    log('INFO', 'Digen.ai 自动化登录 - API 版本');
    log('INFO', '========================================');
    
    const email = process.env.DIGEN_EMAIL;
    const password = process.env.DIGEN_PASSWORD;
    
    if (!email || !password) {
        log('ERROR', '请设置环境变量 DIGEN_EMAIL 和 DIGEN_PASSWORD');
        process.exit(1);
    }
    
    log('INFO', `邮箱: ${email}`);
    
    try {
        // 第一步：访问登录页面，获取 cookies 和 CSRF token
        log('INFO', '访问登录页面...');
        const loginPageResponse = await request(CONFIG.loginUrl);
        
        log('INFO', `登录页面状态码: ${loginPageResponse.statusCode}`);
        
        // 解析 cookies
        const cookies = parseCookies(
            loginPageResponse.cookies.map(c => c.split(';')[0]).join('; ')
        );
        
        log('INFO', `获取到 ${Object.keys(cookies).length} 个 cookies`);
        
        // 从页面中提取 CSRF token（如果有的话）
        const body = loginPageResponse.body;
        const csrfMatch = body.match(/name="csrf_token" value="([^"]+)"/) ||
                         body.match(/name="_token" value="([^"]+)"/) ||
                         body.match(/name="authenticity_token" value="([^"]+)"/);
        
        const csrfToken = csrfMatch ? csrfMatch[1] : null;
        if (csrfToken) {
            log('INFO', `找到 CSRF token: ${csrfToken.substring(0, 20)}...`);
        } else {
            log('WARN', '未找到 CSRF token');
        }
        
        // 第二步：发送登录请求
        log('INFO', '发送登录请求...');
        
        // 构建登录数据
        const loginData = {
            email: email,
            password: password,
        };
        
        // 如果有 CSRF token，添加到数据中
        if (csrfToken) {
            loginData.csrf_token = csrfToken;
            loginData._token = csrfToken;
            loginData.authenticity_token = csrfToken;
        }
        
        // 将数据编码为表单格式
        const formData = Object.entries(loginData)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        
        log('DEBUG', '登录数据', { data: formData });
        
        // 发送 POST 请求
        const loginResponse = await request(CONFIG.loginUrl, {
            method: 'POST',
            headers: {
                'Cookie': formatCookies(cookies),
                'Referer': CONFIG.loginUrl,
                'Origin': CONFIG.baseUrl,
            },
            body: formData,
        });
        
        log('INFO', `登录响应状态码: ${loginResponse.statusCode}`);
        log('INFO', `登录响应头:`, {
            location: loginResponse.headers.location,
            'set-cookie': loginResponse.cookies,
        });
        
        // 检查是否登录成功
        if (loginResponse.statusCode === 302 || loginResponse.statusCode === 301) {
            // 重定向，说明登录成功
            const redirectUrl = loginResponse.headers.location;
            log('INFO', `登录成功！重定向到: ${redirectUrl}`);
            
            // 更新 cookies
            const newCookies = parseCookies(
                loginResponse.cookies.map(c => c.split(';')[0]).join('; ')
            );
            Object.assign(cookies, newCookies);
            
            // 保存会话
            const session = {
                cookies,
                savedAt: new Date().toISOString(),
                redirectUrl,
            };
            
            fs.writeFileSync(CONFIG.sessionFile, JSON.stringify(session, null, 2));
            log('INFO', '会话已保存');
            
            log('INFO', '========================================');
            log('INFO', '登录成功！');
            log('INFO', '========================================');
            
        } else if (loginResponse.statusCode === 200) {
            // 仍然返回 200，检查页面内容
            const body = loginResponse.body;
            
            if (body.includes('登录') || body.includes('Sign in') || body.includes('密码错误')) {
                log('ERROR', '登录失败：用户名或密码错误');
                
                // 提取错误信息
                const errorMatch = body.match(/<[^>]*error[^>]*>([^<]+)<\/[^>]*>/i);
                if (errorMatch) {
                    log('ERROR', `错误信息: ${errorMatch[1]}`);
                }
                
                process.exit(1);
            } else {
                log('INFO', '登录可能成功（页面未重定向）');
                
                // 保存会话
                const session = {
                    cookies,
                    savedAt: new Date().toISOString(),
                };
                
                fs.writeFileSync(CONFIG.sessionFile, JSON.stringify(session, null, 2));
                log('INFO', '会话已保存');
                
                log('INFO', '========================================');
                log('INFO', '登录成功！');
                log('INFO', '========================================');
            }
        } else {
            log('ERROR', `登录失败：意外的状态码 ${loginResponse.statusCode}`);
            log('DEBUG', '响应体:', { body: loginResponse.body.substring(0, 500) });
            process.exit(1);
        }
        
    } catch (err) {
        log('ERROR', `执行失败: ${err.message}`);
        log('DEBUG', '错误堆栈:', { stack: err.stack });
        process.exit(1);
    }
}

// 运行
main().catch(err => {
    log('ERROR', `脚本异常: ${err.message}`);
    process.exit(1);
});
