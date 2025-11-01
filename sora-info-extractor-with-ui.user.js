// ==UserScript==
// @name         Sora Info Extractor with UI v2
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Extract useful information from https://sora.chatgpt.com/ with improved movable UI
// @author       iudd
// @match        https://sora.chatgpt.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // 创建可移动UI面板 - 改进样式
    const panel = document.createElement('div');
    panel.id = 'info-extractor-panel';
    panel.style.position = 'fixed';
    panel.style.top = '20px';
    panel.style.right = '20px';
    panel.style.width = '450px';
    panel.style.height = '550px';
    panel.style.backgroundColor = '#ffffff';
    panel.style.border = '2px solid #333';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
    panel.style.zIndex = '10000';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.overflow = 'hidden';
    panel.style.cursor = 'move';
    panel.style.color = '#000';
    document.body.appendChild(panel);

    // 面板标题栏 - 添加关闭按钮
    const titleBar = document.createElement('div');
    titleBar.style.backgroundColor = '#007bff';
    titleBar.style.color = '#fff';
    titleBar.style.padding = '10px';
    titleBar.style.fontWeight = 'bold';
    titleBar.style.cursor = 'move';
    titleBar.style.userSelect = 'none';
    titleBar.style.display = 'flex';
    titleBar.style.justifyContent = 'space-between';
    titleBar.style.alignItems = 'center';
    panel.appendChild(titleBar);

    const titleText = document.createElement('span');
    titleText.textContent = 'Sora信息提取器 v2.1';
    titleBar.appendChild(titleText);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.addEventListener('click', () => panel.remove());
    titleBar.appendChild(closeBtn);

    // 内容区域
    const content = document.createElement('div');
    content.style.height = '420px';
    content.style.overflowY = 'auto';
    content.style.padding = '15px';
    content.style.fontSize = '13px';
    content.style.lineHeight = '1.4';
    content.style.backgroundColor = '#f9f9f9';
    panel.appendChild(content);

    // 按钮区域
    const buttonBar = document.createElement('div');
    buttonBar.style.padding = '15px';
    buttonBar.style.borderTop = '1px solid #ccc';
    buttonBar.style.display = 'flex';
    buttonBar.style.justifyContent = 'space-between';
    buttonBar.style.gap = '10px';
    panel.appendChild(buttonBar);

    const viewScriptsBtn = document.createElement('button');
    viewScriptsBtn.textContent = '查看脚本库';
    viewScriptsBtn.style.padding = '8px 12px';
    viewScriptsBtn.style.cursor = 'pointer';
    viewScriptsBtn.style.backgroundColor = '#28a745';
    viewScriptsBtn.style.color = '#fff';
    viewScriptsBtn.style.border = 'none';
    viewScriptsBtn.style.borderRadius = '5px';
    buttonBar.appendChild(viewScriptsBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '下载信息';
    downloadBtn.style.padding = '8px 12px';
    downloadBtn.style.cursor = 'pointer';
    downloadBtn.style.backgroundColor = '#dc3545';
    downloadBtn.style.color = '#fff';
    downloadBtn.style.border = 'none';
    downloadBtn.style.borderRadius = '5px';
    buttonBar.appendChild(downloadBtn);

    // 拖拽功能
    let isDragging = false;
    let offsetX, offsetY;

    [titleBar, panel].forEach(el => {
        el.addEventListener('mousedown', (e) => {
            if (e.target === closeBtn) return; // 不拖拽关闭按钮
            isDragging = true;
            offsetX = e.clientX - panel.offsetLeft;
            offsetY = e.clientY - panel.offsetTop;
            e.preventDefault();
        });
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
            panel.style.right = 'auto';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // 页面加载后提取信息
    window.addEventListener('load', function() {
        content.textContent = '正在提取信息，请稍候...';
        try {
            extractAndDisplayInfo();
        } catch (error) {
            content.textContent = '错误：' + error.message;
        }
    });

    function extractAndDisplayInfo() {
        const info = {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            pageTitle: document.title,
            userAgent: navigator.userAgent,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            metaTags: extractMetaTags(),
            textContent: extractTextContent(),
            links: extractLinks(),
            buttons: extractButtons(),
            forms: extractForms(),
            images: extractImages(),
            scripts: extractScripts(),
            networkRequests: [],
            otherElements: extractOtherElements(),
            localStorage: extractStorage(localStorage),
            sessionStorage: extractStorage(sessionStorage),
            cookies: document.cookie
        };

        monitorNetworkRequests(info.networkRequests);

        setTimeout(() => {
            displayInfo(info);
        }, 8000); // 增加延迟到8秒，确保捕获更多
    }

    function extractStorage(storage) {
        const data = {};
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            data[key] = storage.getItem(key);
        }
        return data;
    }

    // 提取函数（优化）
    function extractMetaTags() {
        const metas = {};
        document.querySelectorAll('meta').forEach(meta => {
            const name = meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv');
            const content = meta.getAttribute('content');
            if (name && content) metas[name] = content;
        });
        return metas;
    }

    function extractTextContent() {
        const bodyClone = document.body.cloneNode(true);
        bodyClone.querySelectorAll('script, style, noscript, nav, footer, aside').forEach(el => el.remove());
        return bodyClone.textContent.trim().substring(0, 10000);
    }

    function extractLinks() {
        return Array.from(document.querySelectorAll('a')).slice(0, 50).map(a => ({
            href: a.href,
            text: a.textContent.trim(),
            title: a.title,
            rel: a.rel
        }));
    }

    function extractButtons() {
        return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')).slice(0, 30).map(btn => ({
            type: btn.tagName.toLowerCase(),
            text: btn.textContent.trim() || btn.value,
            className: btn.className,
            id: btn.id,
            ariaLabel: btn.getAttribute('aria-label')
        }));
    }

    function extractForms() {
        return Array.from(document.querySelectorAll('form')).slice(0, 10).map(form => ({
            action: form.action,
            method: form.method,
            inputs: Array.from(form.querySelectorAll('input, textarea, select')).slice(0, 20).map(input => ({
                name: input.name,
                type: input.type,
                value: input.value,
                placeholder: input.placeholder
            }))
        }));
    }

    function extractImages() {
        return Array.from(document.querySelectorAll('img')).slice(0, 20).map(img => ({
            src: img.src,
            alt: img.alt,
            title: img.title,
            width: img.width,
            height: img.height
        }));
    }

    function extractScripts() {
        return Array.from(document.querySelectorAll('script')).slice(0, 10).map(script => ({
            src: script.src,
            type: script.type,
            content: script.textContent.substring(0, 1000)
        }));
    }

    function extractOtherElements() {
        const selectors = ['div[role]', 'span', '[data-testid]', '[aria-label]', '[data-cy]', 'input[name]', 'textarea[name]'];
        const elements = [];
        selectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    elements.push({
                        tag: el.tagName.toLowerCase(),
                        className: el.className,
                        id: el.id,
                        text: el.textContent.trim().substring(0, 300),
                        attributes: Array.from(el.attributes).slice(0, 10).map(attr => ({ name: attr.name, value: attr.value }))
                    });
                });
            } catch (e) {
                console.warn('Invalid selector:', selector, e);
            }
        });
        return elements.slice(0, 100);
    }

    function monitorNetworkRequests(requests) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            const method = args[1]?.method || 'GET';
            const headers = args[1]?.headers || {};
            const body = args[1]?.body;
            requests.push({ url, method, headers, body: body ? body.substring(0, 500) : null, timestamp: new Date().toISOString() });
            return originalFetch.apply(this, args);
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            requests.push({ url, method, timestamp: new Date().toISOString() });
            return originalOpen.apply(this, arguments);
        };
    }

    function displayInfo(info) {
        content.innerHTML = '<pre style="white-space: pre-wrap; word-wrap: break-word;">' + JSON.stringify(info, null, 2) + '</pre>';
    }

    // 查看脚本库按钮
    viewScriptsBtn.addEventListener('click', () => {
        content.textContent = '正在获取脚本库...';
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://api.github.com/repos/iudd/tampermonkey-scripts/contents',
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            },
            onload: function(response) {
                try {
                    const files = JSON.parse(response.responseText);
                    const fileList = files.map(file => `${file.name} (${file.type}) - ${file.size} bytes`).join('\n');
                    content.innerHTML = '<h3>脚本库文件：</h3><pre>' + fileList + '</pre>';
                } catch (error) {
                    content.textContent = '获取脚本库失败：' + error.message;
                }
            },
            onerror: function() {
                content.textContent = '网络错误，无法获取脚本库。';
            }
        });
    });

    // 下载按钮 - 改进
    downloadBtn.addEventListener('click', () => {
        const pre = content.querySelector('pre');
        if (!pre) {
            alert('信息尚未提取完成，请稍后再试。');
            return;
        }
        const jsonString = pre.textContent;
        if (!jsonString.trim()) {
            alert('没有可下载的内容。');
            return;
        }
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sora-info-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('下载已开始。');
    });
})();