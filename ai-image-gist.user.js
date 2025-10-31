// ==UserScript==
// @name         AI Image Gist - 油猴脚本自动生成
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  从https://freeaiimage.net/zh/捕获图片生成参数并保存到GitHub Gist
// @author        You
// @match         https://freeaiimage.net/zh/*
// @grant         GM_notification
// @grant         GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // 捕获的参数数据
    let capturedPrompt = '';
    
    // 显示通知
    function showNotification(title, message, timeout = 5000) {
        GM_notification({
            title: title,
            message: message,
            timeout: timeout
        });
    }

    // 创建图形界面按钮
    function createSaveButton() {
        const button = document.createElement('button');
        button.textContent = '保存到Gist';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;
        
        button.addEventListener('click', saveToGist);
        document.body.appendChild(button);
        
        return button;
    }

    // 保存到Gist
    async function saveToGist() {
        try {
            const promptInput = document.querySelector('input[name="prompt"], textarea, [placeholder*="提示"], [placeholder*="prompt"]');
            const prompt = promptInput ? promptInput.value : '';
            
            if (!prompt) {
                showNotification('提示', '请先输入提示词');
                return;
            }

            const gistData = {
                description: `AI图片生成 - ${prompt.substring(0, 50)}...`,
                public: true,
                files: {
                    'image-prompt.txt': {
                        content: `提示词: ${prompt}\n生成时间: ${new Date().toISOString()}\n来源: https://freeaiimage.net/zh/`
                    }
                }
            };

            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://api.github.com/gists',
                    headers: {
                        'Authorization': 'token YOUR_GITHUB_TOKEN_HERE',
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify(gistData),
                    onload: resolve,
                    onerror: reject
                });
            });

            const gist = JSON.parse(response.responseText);
            showNotification('成功', `已保存到Gist: ${gist.html_url}`);
            
        } catch (error) {
            showNotification('错误', '保存失败: ' + error.message);
            console.error('Error:', error);
        }
    }

    // 初始化
    function init() {
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createSaveButton);
        } else {
            createSaveButton();
        }
        
        // 监听提示词输入变化
        const observer = new MutationObserver(() => {
            const promptInput = document.querySelector('input[name="prompt"], textarea, [placeholder*="提示"], [placeholder*="prompt"]');
            if (promptInput && !capturedPrompt) {
                promptInput.addEventListener('input', () => {
                    capturedPrompt = promptInput.value;
                });
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    init();
})();