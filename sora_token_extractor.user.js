// ==UserScript==
// @name         Sora Token Extractor
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Extract and copy Access Token from sora.chatgpt.com cookies with improved detection
// @author       iudd
// @match        https://sora.chatgpt.com/*
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 获取Cookie值的函数
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // 复制Token的函数
    function copySecureNextAuthToken(token) {
        if (token) {
            // 复制到剪贴板
            GM_setClipboard(token, 'text');

            // 显示Tampermonkey通知
            GM_notification({
                text: 'Token 已复制到剪贴板！\n前50个字符：' + token.substring(0, 50) + '...',
                title: '复制成功',
                timeout: 3000
            });

            // 在页面右上角显示提示
            showNotification('__Secure-next-auth.session-token 已复制到剪贴板！');

            console.log('Token 值：', token);
        } else {
            GM_notification({
                text: '未找到 __Secure-next-auth.session-token Cookie',
                title: '复制失败',
                timeout: 3000
            });
            showNotification('未找到 Cookie，请确保已登录');
            console.log('所有Cookie:', document.cookie);
        }
    }

    // 检查Cookie的函数
    function checkCookie() {
        const token = getCookie('__Secure-next-auth.session-token');
        if (token) {
            copySecureNextAuthToken(token);
            return true; // 找到，停止检查
        }
        return false;
    }

    // 在页面右上角显示通知
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10001;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease;
        `;

        // 添加动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        notification.textContent = message;
        document.body.appendChild(notification);

        // 5秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // 在页面上添加一个复制按钮以便手动复制
    function addCopyButton() {
        const button = document.createElement('button');
        button.textContent = '复制 Token';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            z-index: 10000;
            font-size: 12px;
        `;
        button.addEventListener('click', function() {
            const token = getCookie('__Secure-next-auth.session-token');
            copySecureNextAuthToken(token);
        });
        document.body.appendChild(button);
    }

    // 创建面板的函数（可选，用于显示Token）
    function createPanel() {
        // 检查是否已存在面板
        if (document.getElementById('sora-token-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'sora-token-panel';
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 350px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            border-radius: 8px;
            padding: 15px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            cursor: move;
            user-select: none;
        `;

        // 标题栏
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            cursor: move;
        `;

        const title = document.createElement('div');
        title.textContent = 'Sora Token Extractor';
        title.style.fontWeight = 'bold';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onclick = () => panel.remove();

        header.appendChild(title);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // 获取Token
        const accessToken = getCookie('__Secure-next-auth.session-token');

        // Token 显示区域
        const tokenSection = document.createElement('div');

        const label = document.createElement('div');
        label.textContent = 'Access Token (AT):';
        label.style.marginBottom = '5px';
        label.style.fontWeight = 'bold';

        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 5px;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = accessToken || 'Not found';
        input.readOnly = true;
        input.style.cssText = `
            flex: 1;
            padding: 5px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            font-size: 11px;
        `;

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            margin-left: 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        `;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(input.value).then(() => {
                copyBtn.textContent = '已复制';
                setTimeout(() => copyBtn.textContent = '复制', 2000);
            });
        };

        container.appendChild(input);
        container.appendChild(copyBtn);
        tokenSection.appendChild(label);
        tokenSection.appendChild(container);
        panel.appendChild(tokenSection);

        // 拖拽功能
        let isDragging = false;
        let dragStartX, dragStartY, panelStartX, panelStartY;

        header.onmousedown = (e) => {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            panelStartX = panel.offsetLeft;
            panelStartY = panel.offsetTop;
            document.body.style.userSelect = 'none';
        };

        document.onmousemove = (e) => {
            if (isDragging) {
                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;
                panel.style.left = (panelStartX + dx) + 'px';
                panel.style.top = (panelStartY + dy) + 'px';
                panel.style.right = 'auto';
            }
        };

        document.onmouseup = () => {
            isDragging = false;
            document.body.style.userSelect = '';
        };

        // 添加到页面
        document.body.appendChild(panel);
    }

    // 页面加载完成后执行
    window.addEventListener('load', function() {
        // 延迟5秒开始检查
        setTimeout(function() {
            // 循环检查cookie，每1秒检查一次，最多10次
            let attempts = 0;
            const maxAttempts = 10;
            const interval = setInterval(() => {
                attempts++;
                console.log(`检查Cookie尝试 ${attempts}/${maxAttempts}`);
                if (checkCookie() || attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (attempts >= maxAttempts && !getCookie('__Secure-next-auth.session-token')) {
                        console.log('所有Cookie:', document.cookie);
                        GM_notification({
                            text: '多次尝试后仍未找到Cookie，请检查登录状态',
                            title: '检测失败',
                            timeout: 5000
                        });
                    }
                }
            }, 1000);

            // 添加手动复制按钮
            addCopyButton();
            // 创建面板（可选）
            createPanel();
        }, 5000); // 等待5秒确保Cookie已设置
    });
})();