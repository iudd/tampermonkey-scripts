// ==UserScript==
// @name         Digen.ai 元素提取器
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  提取 Digen.ai 页面上的登录相关元素，专为手机浏览器优化
// @author       iudd
// @match        https://digen.ai/*
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 防止重复加载
    if (window.digenExtractorLoaded) {
        return;
    }
    window.digenExtractorLoaded = true;

    // 检测设备类型
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // 创建浮动按钮
    const floatBtn = document.createElement('button');
    floatBtn.id = 'digen-extractor-float-btn';
    floatBtn.textContent = '📋';
    floatBtn.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        width: 60px !important;
        height: 60px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        border: none !important;
        font-size: 24px !important;
        cursor: pointer !important;
        z-index: 2147483646 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        transition: transform 0.2s !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    `;
    document.body.appendChild(floatBtn);

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'digen-extractor-overlay';
    overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background-color: rgba(0, 0, 0, 0.8) !important;
        z-index: 2147483647 !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        padding: 20px !important;
        box-sizing: border-box !important;
    `;

    // 创建操作面板
    const panel = document.createElement('div');
    panel.id = 'digen-extractor-panel';
    panel.style.cssText = `
        background-color: #ffffff !important;
        width: 90% !important;
        max-width: 600px !important;
        max-height: 85vh !important;
        overflow-y: auto !important;
        border-radius: 20px !important;
        padding: 30px !important;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4) !important;
        -webkit-overflow-scrolling: touch !important;
    `;

    // 标题
    const title = document.createElement('h1');
    title.textContent = 'Digen.ai元素提取器';
    title.style.cssText = `
        font-size: 28px !important;
        font-weight: bold !important;
        text-align: center !important;
        margin: 0 0 30px 0 !important;
        color: #333 !important;
        line-height: 1.3 !important;
    `;

    // 按钮容器
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = `
        display: flex !important;
        flex-direction: column !important;
        gap: 16px !important;
        margin-bottom: 20px !important;
    `;

    // 开始提取按钮
    const startBtn = document.createElement('button');
    startBtn.textContent = '🚀 开始提取';
    startBtn.style.cssText = `
        width: 100% !important;
        height: 56px !important;
        background: linear-gradient(135deg, #007bff 0%, #0056b3 100%) !important;
        color: white !important;
        border: none !important;
        border-radius: 12px !important;
        font-size: 22px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        transition: all 0.3s !important;
        box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
    `;

    // 快速扫描按钮
    const scanBtn = document.createElement('button');
    scanBtn.textContent = '🔍 快速扫描';
    scanBtn.style.cssText = `
        width: 100% !important;
        height: 50px !important;
        background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%) !important;
        color: white !important;
        border: none !important;
        border-radius: 12px !important;
        font-size: 20px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        transition: all 0.3s !important;
        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
    `;

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ 关闭';
    closeBtn.style.cssText = `
        width: 100% !important;
        height: 50px !important;
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%) !important;
        color: white !important;
        border: none !important;
        border-radius: 12px !important;
        font-size: 20px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        transition: all 0.3s !important;
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
    `;

    // 添加按钮到容器
    btnContainer.appendChild(startBtn);
    btnContainer.appendChild(scanBtn);
    btnContainer.appendChild(closeBtn);

    // 结果区域（初始隐藏）
    const resultContainer = document.createElement('div');
    resultContainer.id = 'digen-result-container';
    resultContainer.style.cssText = `
        display: none !important;
        margin-top: 24px !important;
    `;

    // 结果标题
    const resultTitle = document.createElement('h2');
    resultTitle.textContent = '提取结果';
    resultTitle.style.cssText = `
        font-size: 22px !important;
        font-weight: bold !important;
        margin: 0 0 16px 0 !important;
        color: #333 !important;
    `;

    // 结果文本区域
    const resultArea = document.createElement('pre');
    resultArea.id = 'digen-result-area';
    resultArea.style.cssText = `
        background-color: #f8f9fa !important;
        border: 2px solid #dee2e6 !important;
        border-radius: 12px !important;
        padding: 16px !important;
        font-size: 14px !important;
        line-height: 1.6 !important;
        color: #333 !important;
        overflow-x: auto !important;
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        max-height: 300px !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
    `;

    // 复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 复制结果';
    copyBtn.style.cssText = `
        width: 100% !important;
        height: 50px !important;
        background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%) !important;
        color: #333 !important;
        border: none !important;
        border-radius: 12px !important;
        font-size: 20px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        transition: all 0.3s !important;
        margin-top: 16px !important;
        box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
    `;

    // 组装结果区域
    resultContainer.appendChild(resultTitle);
    resultContainer.appendChild(resultArea);
    resultContainer.appendChild(copyBtn);

    // 组装面板
    panel.appendChild(title);
    panel.appendChild(btnContainer);
    panel.appendChild(resultContainer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // 显示/隐藏遮罩
    function toggleOverlay() {
        const display = overlay.style.display;
        if (display === 'none' || !display) {
            overlay.style.display = 'flex';
            // 隐藏浮动按钮
            floatBtn.style.display = 'none';
        } else {
            overlay.style.display = 'none';
            // 显示浮动按钮
            floatBtn.style.display = 'flex';
        }
    }

    // 浮动按钮点击事件
    floatBtn.addEventListener('click', toggleOverlay);

    // 关闭按钮点击事件
    closeBtn.addEventListener('click', toggleOverlay);

    // 点击遮罩背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            toggleOverlay();
        }
    });

    // 快速扫描
    scanBtn.addEventListener('click', function() {
        const buttons = document.querySelectorAll('button');
        const inputs = document.querySelectorAll('input');
        const forms = document.querySelectorAll('form');

        const visibleButtons = Array.from(buttons).filter(btn => {
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });

        const visibleInputs = Array.from(inputs).filter(input => {
            const rect = input.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });

        alert(`📊 快速扫描完成\n\n🔘 可见按钮: ${visibleButtons.length} 个\n📝 可见输入框: ${visibleInputs.length} 个\n📋 表单: ${forms.length} 个`);
    });

    // 提取页面元素
    function extractElements() {
        // 提取可见按钮
        const allButtons = document.querySelectorAll('button');
        const visibleButtons = Array.from(allButtons).filter(btn => {
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(btn).display !== 'none';
        }).map((btn, index) => ({
            index: index + 1,
            text: btn.textContent.trim().substring(0, 50) || '(无文本)',
            type: btn.type || 'button',
            id: btn.id || '(无ID)',
            className: btn.className || '(无类名)'
        }));

        // 提取可见输入框
        const allInputs = document.querySelectorAll('input');
        const visibleInputs = Array.from(allInputs).filter(input => {
            const rect = input.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(input).display !== 'none';
        }).map((input, index) => ({
            index: index + 1,
            type: input.type || 'text',
            placeholder: input.placeholder || '(无占位符)',
            id: input.id || '(无ID)',
            name: input.name || '(无名称)',
            className: input.className || '(无类名)'
        }));

        // 提取表单
        const forms = Array.from(document.querySelectorAll('form')).map((form, index) => ({
            index: index + 1,
            action: form.action || '(无action)',
            method: form.method || '(无method)',
            id: form.id || '(无ID)',
            className: form.className || '(无类名)'
        }));

        // 提取链接
        const links = Array.from(document.querySelectorAll('a[href]')).filter(link => {
            const rect = link.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        }).slice(0, 20).map((link, index) => ({
            index: index + 1,
            text: link.textContent.trim().substring(0, 30) || '(无文本)',
            href: link.href.substring(0, 100)
        }));

        return {
            pageInfo: {
                title: document.title,
                url: window.location.href,
                timestamp: new Date().toISOString()
            },
            summary: {
                visibleButtons: visibleButtons.length,
                visibleInputs: visibleInputs.length,
                forms: forms.length,
                links: links.length
            },
            buttons: visibleButtons,
            inputs: visibleInputs,
            forms: forms,
            links: links
        };
    }

    // 开始提取
    startBtn.addEventListener('click', function() {
        const result = extractElements();
        const jsonStr = JSON.stringify(result, null, 2);

        // 显示结果
        resultArea.textContent = jsonStr;
        resultContainer.style.display = 'block';

        // 滚动到结果区域
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // 通知
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                text: '✅ 提取完成！',
                title: 'Digen.ai 元素提取器',
                timeout: 3000
            });
        }
    });

    // 复制结果
    copyBtn.addEventListener('click', function() {
        const text = resultArea.textContent;
        
        try {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(text);
                copyBtn.textContent = '✅ 已复制！';
                setTimeout(() => {
                    copyBtn.textContent = '📋 复制结果';
                }, 2000);
            } else {
                // 备用复制方法
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.cssText = 'position: fixed !important; opacity: 0 !important;';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                
                copyBtn.textContent = '✅ 已复制！';
                setTimeout(() => {
                    copyBtn.textContent = '📋 复制结果';
                }, 2000);
            }
        } catch (err) {
            alert('复制失败，请手动复制');
        }
    });

    // 页面加载完成后自动显示面板
    function showPanel() {
        setTimeout(() => {
            toggleOverlay();
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showPanel);
    } else {
        showPanel();
    }

    console.log('✅ Digen.ai 元素提取器已加载');
})();
