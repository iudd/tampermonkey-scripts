// ==UserScript==
// @name         Sora Info Extractor with UI
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Extract useful information from https://sora.chatgpt.com/ with movable UI
// @author       iudd
// @match        https://sora.chatgpt.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // 创建可移动UI面板
    const panel = document.createElement('div');
    panel.id = 'info-extractor-panel';
    panel.style.position = 'fixed';
    panel.style.top = '20px';
    panel.style.right = '20px';
    panel.style.width = '400px';
    panel.style.height = '500px';
    panel.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    panel.style.border = '1px solid #ccc';
    panel.style.borderRadius = '8px';
    panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    panel.style.zIndex = '9999';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.overflow = 'hidden';
    panel.style.cursor = 'move';
    document.body.appendChild(panel);

    // 面板标题栏
    const titleBar = document.createElement('div');
    titleBar.textContent = 'Sora信息提取器';
    titleBar.style.backgroundColor = '#f0f0f0';
    titleBar.style.padding = '10px';
    titleBar.style.fontWeight = 'bold';
    titleBar.style.cursor = 'move';
    titleBar.style.userSelect = 'none';
    panel.appendChild(titleBar);

    // 内容区域
    const content = document.createElement('div');
    content.style.height = '400px';
    content.style.overflowY = 'auto';
    content.style.padding = '10px';
    content.style.fontSize = '12px';
    panel.appendChild(content);

    // 按钮区域
    const buttonBar = document.createElement('div');
    buttonBar.style.padding = '10px';
    buttonBar.style.borderTop = '1px solid #ccc';
    buttonBar.style.display = 'flex';
    buttonBar.style.justifyContent = 'space-between';
    panel.appendChild(buttonBar);

    const viewScriptsBtn = document.createElement('button');
    viewScriptsBtn.textContent = '查看脚本库';
    viewScriptsBtn.style.padding = '5px 10px';
    viewScriptsBtn.style.cursor = 'pointer';
    buttonBar.appendChild(viewScriptsBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '下载信息';
    downloadBtn.style.padding = '5px 10px';
    downloadBtn.style.cursor = 'pointer';
    buttonBar.appendChild(downloadBtn);

    // 拖拽功能
    let isDragging = false;
    let offsetX, offsetY;

    [titleBar, panel].forEach(el => {
        el.addEventListener('mousedown', (e) => {
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
            metaTags: extractMetaTags(),
            textContent: extractTextContent(),
            links: extractLinks(),
            buttons: extractButtons(),
            forms: extractForms(),
            images: extractImages(),
            scripts: extractScripts(),
            networkRequests: [],
            otherElements: extractOtherElements()
        };

        monitorNetworkRequests(info.networkRequests);

        setTimeout(() => {
            displayInfo(info);
        }, 5000);
    }

    // 提取函数（保持不变）
    function extractMetaTags() {
        const metas = {};
        document.querySelectorAll('meta').forEach(meta => {
            const name = meta.getAttribute('name') || meta.getAttribute('property');
            const content = meta.getAttribute('content');
            if (name && content) metas[name] = content;
        });
        return metas;
    }

    function extractTextContent() {
        const bodyClone = document.body.cloneNode(true);
        bodyClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
        return bodyClone.textContent.trim().substring(0, 5000);
    }

    function extractLinks() {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            href: a.href,
            text: a.textContent.trim(),
            title: a.title
        }));
    }

    function extractButtons() {
        return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
            type: btn.tagName.toLowerCase(),
            text: btn.textContent.trim() || btn.value,
            className: btn.className,
            id: btn.id
        }));
    }

    function extractForms() {
        return Array.from(document.querySelectorAll('form')).map(form => ({
            action: form.action,
            method: form.method,
            inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
                name: input.name,
                type: input.type,
                value: input.value
            }))
        }));
    }

    function extractImages() {
        return Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src,
            alt: img.alt,
            title: img.title
        }));
    }

    function extractScripts() {
        return Array.from(document.querySelectorAll('script')).map(script => ({
            src: script.src,
            type: script.type,
            content: script.textContent.substring(0, 500)
        }));
    }

    function extractOtherElements() {
        const selectors = ['div[role]', 'span[data-*]', '[data-testid]', '[aria-label]'];
        const elements = [];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                elements.push({
                    tag: el.tagName.toLowerCase(),
                    className: el.className,
                    id: el.id,
                    text: el.textContent.trim().substring(0, 200),
                    attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value }))
                });
            });
        });
        return elements.slice(0, 50);
    }

    function monitorNetworkRequests(requests) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            const method = args[1]?.method || 'GET';
            requests.push({ url, method, timestamp: new Date().toISOString() });
            return originalFetch.apply(this, args);
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            requests.push({ url, method, timestamp: new Date().toISOString() });
            return originalOpen.apply(this, arguments);
        };
    }

    function displayInfo(info) {
        content.innerHTML = '<pre>' + JSON.stringify(info, null, 2) + '</pre>';
    }

    // 查看脚本库按钮
    viewScriptsBtn.addEventListener('click', () => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://api.github.com/repos/iudd/tampermonkey-scripts/contents',
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            },
            onload: function(response) {
                try {
                    const files = JSON.parse(response.responseText);
                    const fileList = files.map(file => `${file.name} (${file.type})`).join('\n');
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

    // 下载按钮
    downloadBtn.addEventListener('click', () => {
        const jsonString = content.querySelector('pre') ? content.querySelector('pre').textContent : '';
        if (jsonString) {
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sora-info-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    });
})();