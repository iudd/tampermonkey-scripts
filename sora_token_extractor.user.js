// ==UserScript==
// @name         Sora Token Extractor
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Extract Access Token and Refresh Token from sora.chatgpt.com cookies
// @author       iudd
// @match        https://sora.chatgpt.com/*
// @grant        none
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

    // 创建面板的函数
    function createPanel() {
        // 检查是否已存在面板
        if (document.getElementById('sora-token-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'sora-token-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
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
        const refreshToken = getCookie('__Secure-next-auth.refresh-token') || getCookie('__Secure-next-auth.session-token'); // 假设RT与AT相同或另有cookie

        // Access Token 区域
        const atSection = document.createElement('div');
        atSection.style.marginBottom = '10px';

        const atLabel = document.createElement('div');
        atLabel.textContent = 'Access Token (AT):';
        atLabel.style.marginBottom = '5px';
        atLabel.style.fontWeight = 'bold';

        const atContainer = document.createElement('div');
        atContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 5px;
        `;

        const atInput = document.createElement('input');
        atInput.type = 'text';
        atInput.value = accessToken || 'Not found';
        atInput.readOnly = true;
        atInput.style.cssText = `
            flex: 1;
            padding: 5px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            font-size: 11px;
        `;

        const atCopyBtn = document.createElement('button');
        atCopyBtn.textContent = '复制';
        atCopyBtn.style.cssText = `
            margin-left: 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        `;
        atCopyBtn.onclick = () => {
            navigator.clipboard.writeText(atInput.value).then(() => {
                atCopyBtn.textContent = '已复制';
                setTimeout(() => atCopyBtn.textContent = '复制', 2000);
            });
        };

        atContainer.appendChild(atInput);
        atContainer.appendChild(atCopyBtn);
        atSection.appendChild(atLabel);
        atSection.appendChild(atContainer);
        panel.appendChild(atSection);

        // Refresh Token 区域
        const rtSection = document.createElement('div');

        const rtLabel = document.createElement('div');
        rtLabel.textContent = 'Refresh Token (RT):';
        rtLabel.style.marginBottom = '5px';
        rtLabel.style.fontWeight = 'bold';

        const rtContainer = document.createElement('div');
        rtContainer.style.cssText = `
            display: flex;
            align-items: center;
        `;

        const rtInput = document.createElement('input');
        rtInput.type = 'text';
        rtInput.value = refreshToken || 'Not found';
        rtInput.readOnly = true;
        rtInput.style.cssText = `
            flex: 1;
            padding: 5px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            font-size: 11px;
        `;

        const rtCopyBtn = document.createElement('button');
        rtCopyBtn.textContent = '复制';
        rtCopyBtn.style.cssText = `
            margin-left: 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        `;
        rtCopyBtn.onclick = () => {
            navigator.clipboard.writeText(rtInput.value).then(() => {
                rtCopyBtn.textContent = '已复制';
                setTimeout(() => rtCopyBtn.textContent = '复制', 2000);
            });
        };

        rtContainer.appendChild(rtInput);
        rtContainer.appendChild(rtCopyBtn);
        rtSection.appendChild(rtLabel);
        rtSection.appendChild(rtContainer);
        panel.appendChild(rtSection);

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

    // 页面加载完成后创建面板
    window.addEventListener('load', createPanel);

    // 如果页面是动态加载的，额外检查
    setTimeout(createPanel, 2000);
})();