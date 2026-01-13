// ==UserScript==
// @name         Digen.ai 元素提取器
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  提取 Digen.ai 页面上的登录相关元素，专为手机浏览器优化
// @author       iudd
// @match        https://digen.ai/*
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    if (window.digenExtractorLoaded) return;
    window.digenExtractorLoaded = true;

    var floatBtn = document.createElement('button');
    floatBtn.id = 'digen-extractor-float-btn';
    floatBtn.textContent = '📋';
    Object.assign(floatBtn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        zIndex: '2147483646',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    });
    document.body.appendChild(floatBtn);

    var overlay = document.createElement('div');
    overlay.id = 'digen-extractor-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: '2147483647',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px'
    });

    var panel = document.createElement('div');
    panel.id = 'digen-extractor-panel';
    Object.assign(panel.style, {
        backgroundColor: '#ffffff',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '85vh',
        overflowY: 'auto',
        borderRadius: '20px',
        padding: '30px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)'
    });

    var title = document.createElement('h1');
    title.textContent = 'Digen.ai元素提取器';
    Object.assign(title.style, {
        fontSize: '28px',
        fontWeight: 'bold',
        textAlign: 'center',
        margin: '0 0 30px 0',
        color: '#333',
        lineHeight: '1.3'
    });

    var btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginBottom: '20px'
    });

    var startBtn = document.createElement('button');
    startBtn.textContent = '🚀 开始提取';
    Object.assign(startBtn.style, {
        width: '100%',
        height: '56px',
        background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '22px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)'
    });

    var scanBtn = document.createElement('button');
    scanBtn.textContent = '🔍 快速扫描';
    Object.assign(scanBtn.style, {
        width: '100%',
        height: '50px',
        background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '20px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
    });

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ 关闭';
    Object.assign(closeBtn.style, {
        width: '100%',
        height: '50px',
        background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '20px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
    });

    btnContainer.appendChild(startBtn);
    btnContainer.appendChild(scanBtn);
    btnContainer.appendChild(closeBtn);

    var resultContainer = document.createElement('div');
    resultContainer.id = 'digen-result-container';
    Object.assign(resultContainer.style, {
        display: 'none',
        marginTop: '24px'
    });

    var resultTitle = document.createElement('h2');
    resultTitle.textContent = '提取结果';
    Object.assign(resultTitle.style, {
        fontSize: '22px',
        fontWeight: 'bold',
        margin: '0 0 16px 0',
        color: '#333'
    });

    var resultArea = document.createElement('pre');
    resultArea.id = 'digen-result-area';
    Object.assign(resultArea.style, {
        backgroundColor: '#f8f9fa',
        border: '2px solid #dee2e6',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '14px',
        lineHeight: '1.6',
        color: '#333',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        maxHeight: '300px',
        overflowY: 'auto'
    });

    var copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 复制结果';
    Object.assign(copyBtn.style, {
        width: '100%',
        height: '50px',
        background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
        color: '#333',
        border: 'none',
        borderRadius: '12px',
        fontSize: '20px',
        fontWeight: 'bold',
        cursor: 'pointer',
        marginTop: '16px',
        boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)'
    });

    resultContainer.appendChild(resultTitle);
    resultContainer.appendChild(resultArea);
    resultContainer.appendChild(copyBtn);

    panel.appendChild(title);
    panel.appendChild(btnContainer);
    panel.appendChild(resultContainer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function toggleOverlay() {
        var display = overlay.style.display;
        if (display === 'none' || !display) {
            overlay.style.display = 'flex';
            floatBtn.style.display = 'none';
        } else {
            overlay.style.display = 'none';
            floatBtn.style.display = 'block';
        }
    }

    floatBtn.addEventListener('click', toggleOverlay);
    closeBtn.addEventListener('click', toggleOverlay);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            toggleOverlay();
        }
    });

    scanBtn.addEventListener('click', function() {
        var buttons = document.querySelectorAll('button');
        var inputs = document.querySelectorAll('input');
        var forms = document.querySelectorAll('form');

        var visibleButtons = Array.from(buttons).filter(function(btn) {
            var rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });

        var visibleInputs = Array.from(inputs).filter(function(input) {
            var rect = input.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });

        alert('快速扫描完成\n\n可见按钮: ' + visibleButtons.length + ' 个\n可见输入框: ' + visibleInputs.length + ' 个\n表单: ' + forms.length + ' 个');
    });

    function extractElements() {
        var allButtons = document.querySelectorAll('button');
        var visibleButtons = Array.from(allButtons).filter(function(btn) {
            var rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(btn).display !== 'none';
        }).map(function(btn, index) {
            return {
                index: index + 1,
                text: (btn.textContent.trim().substring(0, 50)) || '(无文本)',
                type: btn.type || 'button',
                id: btn.id || '(无ID)',
                className: btn.className || '(无类名)'
            };
        });

        var allInputs = document.querySelectorAll('input');
        var visibleInputs = Array.from(allInputs).filter(function(input) {
            var rect = input.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(input).display !== 'none';
        }).map(function(input, index) {
            return {
                index: index + 1,
                type: input.type || 'text',
                placeholder: input.placeholder || '(无占位符)',
                id: input.id || '(无ID)',
                name: input.name || '(无名称)',
                className: input.className || '(无类名)'
            };
        });

        var forms = Array.from(document.querySelectorAll('form')).map(function(form, index) {
            return {
                index: index + 1,
                action: form.action || '(无action)',
                method: form.method || '(无method)',
                id: form.id || '(无ID)',
                className: form.className || '(无类名)'
            };
        });

        var links = Array.from(document.querySelectorAll('a[href]')).filter(function(link) {
            var rect = link.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        }).slice(0, 20).map(function(link, index) {
            return {
                index: index + 1,
                text: (link.textContent.trim().substring(0, 30)) || '(无文本)',
                href: link.href.substring(0, 100)
            };
        });

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

    startBtn.addEventListener('click', function() {
        var result = extractElements();
        var jsonStr = JSON.stringify(result, null, 2);

        resultArea.textContent = jsonStr;
        resultContainer.style.display = 'block';

        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                text: '提取完成！',
                title: 'Digen.ai 元素提取器',
                timeout: 3000
            });
        }
    });

    copyBtn.addEventListener('click', function() {
        var text = resultArea.textContent;
        
        try {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(text);
                copyBtn.textContent = '✅ 已复制！';
                setTimeout(function() {
                    copyBtn.textContent = '📋 复制结果';
                }, 2000);
            } else {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                Object.assign(textarea.style, {
                    position: 'fixed',
                    opacity: '0'
                });
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                
                copyBtn.textContent = '✅ 已复制！';
                setTimeout(function() {
                    copyBtn.textContent = '📋 复制结果';
                }, 2000);
            }
        } catch (err) {
            alert('复制失败，请手动复制');
        }
    });

    function showPanel() {
        setTimeout(function() {
            toggleOverlay();
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showPanel);
    } else {
        showPanel();
    }

    console.log('Digen.ai 元素提取器已加载');
})();
