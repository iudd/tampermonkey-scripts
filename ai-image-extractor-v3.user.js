// ==UserScript==
// @name         AI Image Generator - freeaiimage.net 专用提取器 v3.1
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  专门针对freeaiimage.net网站，精准提取AI图片生成API数据和图片URL
// @author       AI助手
// @match        https://freeaiimage.net/zh/*
// @match        https://freeaiimage.net/*
// @match        https://freeaiimage.net/zh
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // 配置
    const CONFIG = {
        debugMode: true,  // 开启调试模式
        autoExport: false,
        exportFormat: 'json'
    };

    // 数据存储
    let extractedData = [];
    let interceptedRequests = [];

    // UI样式
    const styles = `
        .ai-extractor-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            max-height: 70vh;
            background: #1a202c;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            overflow: hidden;
        }
        
        .ai-extractor-header {
            background: #2d3748;
            padding: 10px 15px;
            border-bottom: 1px solid #4a5568;
        }
        
        .ai-extractor-title {
            font-size: 14px;
            font-weight: bold;
            color: #e2e8f0;
            margin: 0;
        }
        
        .ai-extractor-content {
            padding: 15px;
            max-height: calc(70vh - 60px);
            overflow-y: auto;
        }
        
        .ai-extractor-section {
            margin-bottom: 12px;
            padding: 10px;
            background: #2d3748;
            border-radius: 6px;
        }
        
        .ai-extractor-section-title {
            color: #fbbf24;
            font-size: 12px;
            margin: 0 0 8px 0;
            font-weight: bold;
        }
        
        .ai-extractor-item {
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        
        .ai-extractor-label {
            color: #9ca3af;
            min-width: 60px;
            font-size: 11px;
        }
        
        .ai-extractor-value {
            color: #e2e8f0;
            text-align: right;
            word-break: break-all;
            max-width: 220px;
            font-size: 11px;
        }
        
        .ai-extractor-buttons {
            display: flex;
            gap: 8px;
            margin-top: 10px;
        }
        
        .ai-extractor-btn {
            padding: 6px 10px;
            background: #059669;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            flex: 1;
        }
        
        .ai-extractor-btn:hover {
            background: #047857;
        }
        
        .ai-extractor-btn.export {
            background: #dc2626;
        }
        
        .ai-extractor-btn.export:hover {
            background: #b91c1c;
        }
        
        .ai-extractor-status {
            background: #374151;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
            border-left: 3px solid #6b7280;
        }
        
        .ai-extractor-status.success {
            border-left-color: #10b981;
        }
        
        .ai-extractor-status.error {
            border-left-color: #ef4444;
        }
        
        .ai-extractor-status.pending {
            border-left-color: #f59e0b;
        }
    `;

    // 立即初始化（不需要等待DOM）
    function init() {
        log('🚀 开始初始化freeaiimage.net提取器...');
        log(`当前页面: ${window.location.href}`);
        GM_addStyle(styles);
        createUI();
        startAPIMonitoring();
        log('✅ 提取器初始化完成，正在监听...');
        
        // 显示启动通知
        setTimeout(() => {
            showNotification('已启动', 'AI图片提取器v3.1已就绪');
        }, 1000);
    }

    // 创建用户界面
    function createUI() {
        const panel = document.createElement('div');
        panel.className = 'ai-extractor-panel';
        panel.id = 'ai-extractor-panel';
        
        panel.innerHTML = `
            <div class="ai-extractor-header">
                <h3 class="ai-extractor-title">📊 AI图片提取器 v3.1</h3>
            </div>
            <div class="ai-extractor-content">
                <div class="ai-extractor-status" id="extractor-status">
                    <span>🔍 监听API请求中...</span>
                </div>
                
                <div class="ai-extractor-section">
                    <h4 class="ai-extractor-section-title">📋 最新会话</h4>
                    <div class="ai-extractor-item">
                        <span class="ai-extractor-label">任务ID:</span>
                        <span class="ai-extractor-value" id="task-id">-</span>
                    </div>
                    <div class="ai-extractor-item">
                        <span class="ai-extractor-label">提示词:</span>
                        <span class="ai-extractor-value" id="prompt">-</span>
                    </div>
                    <div class="ai-extractor-item">
                        <span class="ai-extractor-label">尺寸:</span>
                        <span class="ai-extractor-value" id="dimensions">-</span>
                    </div>
                    <div class="ai-extractor-item">
                        <span class="ai-extractor-label">数量:</span>
                        <span class="ai-extractor-value" id="batch-size">-</span>
                    </div>
                    <div class="ai-extractor-item">
                        <span class="ai-extractor-label">状态:</span>
                        <span class="ai-extractor-value" id="status">-</span>
                    </div>
                </div>
                
                <div class="ai-extractor-section">
                    <h4 class="ai-extractor-section-title">🖼️ 图片链接</h4>
                    <div class="ai-extractor-item">
                        <span class="ai-extractor-label">图片数量:</span>
                        <span class="ai-extractor-value" id="image-count">0</span>
                    </div>
                    <div class="ai-extractor-buttons">
                        <button class="ai-extractor-btn export" id="export-json">导出JSON</button>
                        <button class="ai-extractor-btn export" id="export-csv">导出CSV</button>
                        <button class="ai-extractor-btn" id="clear-data">清空</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        setupEventListeners();
    }

    // 设置事件监听器
    function setupEventListeners() {
        document.getElementById('export-json').addEventListener('click', () => {
            exportData('json');
        });

        document.getElementById('export-csv').addEventListener('click', () => {
            exportData('csv');
        });

        document.getElementById('clear-data').addEventListener('click', () => {
            if (confirm('确定要清空所有数据吗？')) {
                extractedData = [];
                updateUI();
                log('数据已清空');
            }
        });
    }

    // 启动API监控（立即开始）
    function startAPIMonitoring() {
        log('🔧 开始设置API监控...');

        // 拦截 XMLHttpRequest (主要方法)
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._method = method;
            this._url = url;
            this._startTime = Date.now();
            
            log(`📤 检测到XHR请求: ${method} ${url}`);
            
            return originalXHROpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(data) {
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4) {
                    const responseTime = Date.now() - (this._startTime || Date.now());
                    log(`📥 XHR响应: ${this._method} ${this._url} (${responseTime}ms) Status: ${this.status}`);
                    handleXHRResponse(this._method, this._url, data, this.responseText, this.status);
                }
            });
            
            this.addEventListener('loadend', function() {
                if (this.status >= 200 && this.status < 300) {
                    const responseTime = Date.now() - (this._startTime || Date.now());
                    log(`📥 XHR成功响应: ${this._method} ${this._url} (${responseTime}ms)`);
                    handleXHRResponse(this._method, this._url, data, this.responseText, this.status);
                }
            });

            return originalXHRSend.apply(this, arguments);
        };

        // 拦截 fetch 请求
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options] = args;
            log(`📤 检测到Fetch请求: ${options?.method || 'GET'} ${url}`);
            
            return originalFetch.apply(this, args).then(response => {
                if (response.ok) {
                    const startTime = Date.now();
                    response.clone().text().then(text => {
                        const responseTime = Date.now() - startTime;
                        log(`📥 Fetch响应: ${options?.method || 'GET'} ${url} (${responseTime}ms) Status: ${response.status}`);
                        handleFetchResponse(url, options, text);
                    });
                }
                return response;
            }).catch(error => {
                log(`❌ Fetch错误: ${error.message}`);
                throw error;
            });
        };

        log('✅ API监控设置完成');
    }

    // 处理XMLHttpRequest响应
    function handleXHRResponse(method, url, requestData, responseText, status) {
        log(`🔍 检查XHR响应: ${method} ${url}`);
        
        if (!isValidTaskURL(url)) {
            log(`❌ 不是有效的任务URL: ${url}`);
            return;
        }
        
        log(`✅ 匹配到有效任务URL: ${url}`);
        
        try {
            const responseData = JSON.parse(responseText);
            log(`📄 解析JSON响应数据:`, responseData);
            processAPIData(method, url, requestData, responseData, status);
        } catch (error) {
            log(`❌ 解析响应数据失败: ${error.message}`);
        }
    }

    // 处理fetch响应
    function handleFetchResponse(url, options, responseText) {
        log(`🔍 检查Fetch响应: ${options?.method || 'GET'} ${url}`);
        
        if (!isValidTaskURL(url)) {
            log(`❌ 不是有效的任务URL: ${url}`);
            return;
        }
        
        log(`✅ 匹配到有效任务URL: ${url}`);
        
        try {
            const responseData = JSON.parse(responseText);
            log(`📄 解析JSON响应数据:`, responseData);
            const method = options?.method || 'GET';
            processAPIData(method, url, options?.body, responseData, 200);
        } catch (error) {
            log(`❌ 解析fetch响应失败: ${error.message}`);
        }
    }

    // 检查是否为有效的任务URL (修复参数名)
    function isValidTaskURL(url) {
        return url && (url.includes('taskld=') || url.includes('task_id='));
    }

    // 处理API数据
    function processAPIData(method, url, requestData, responseData, status) {
        const taskId = extractTaskId(url);
        if (!taskId) {
            log(`❌ 无法提取任务ID从URL: ${url}`);
            return;
        }

        log(`📋 处理API数据 - 任务ID: ${taskId}`);

        const apiData = {
            task_id: taskId,
            task_type: responseData.task_type || 'unknown',
            status: responseData.status || 'unknown',
            url: url,
            method: method,
            timestamp: new Date().toISOString(),
            params: {
                width: responseData.params?.width || responseData.width,
                height: responseData.params?.height || responseData.height,
                prompt: responseData.params?.prompt || responseData.prompt,
                batch_size: responseData.params?.batch_size || responseData.batch_size,
                negative_prompt: responseData.params?.negative_prompt || responseData.negative_prompt
            },
            image_urls: responseData.data || [],
            request_data: requestData,
            response_status: status
        };

        log(`📊 提取的数据:`, apiData);

        // 合并或添加新的API数据
        const existingIndex = interceptedRequests.findIndex(item => item.task_id === taskId);
        if (existingIndex >= 0) {
            interceptedRequests[existingIndex] = { ...interceptedRequests[existingIndex], ...apiData };
            log(`🔄 更新现有请求数据: ${taskId}`);
        } else {
            interceptedRequests.push(apiData);
            log(`➕ 添加新的请求数据: ${taskId}`);
        }

        // 如果是完成的请求，添加到提取数据中
        if (apiData.status === 'completed' && apiData.image_urls.length > 0) {
            const sessionData = {
                timestamp: new Date().toISOString(),
                task_id: taskId,
                prompt: apiData.params.prompt,
                dimensions: `${apiData.params.width}x${apiData.params.height}`,
                batch_size: apiData.params.batch_size,
                negative_prompt: apiData.params.negative_prompt,
                image_urls: apiData.image_urls,
                api_call_count: interceptedRequests.filter(item => item.task_id === taskId).length
            };

            const sessionExists = extractedData.find(item => item.task_id === taskId);
            if (!sessionExists) {
                extractedData.push(sessionData);
                log(`🎉 捕获到完成的任务: ${taskId}, 图片数量: ${apiData.image_urls.length}`);
                showNotification('成功', `捕获到新的图片生成: ${apiData.params.prompt}`);
            }
        }

        updateUI();
    }

    // 提取任务ID (修复参数名)
    function extractTaskId(url) {
        log(`🔍 提取任务ID从URL: ${url}`);
        
        // 尝试匹配 taskld= 参数
        let match = url.match(/[?&]taskld=([a-fA-F0-9\-]+)/);
        if (match) {
            log(`✅ 从taskld参数提取到任务ID: ${match[1]}`);
            return match[1];
        }
        
        // 尝试匹配 task_id= 参数
        match = url.match(/[?&]task_id=([a-fA-F0-9\-]+)/);
        if (match) {
            log(`✅ 从task_id参数提取到任务ID: ${match[1]}`);
            return match[1];
        }
        
        // 尝试匹配32位十六进制ID
        match = url.match(/([a-fA-F0-9]{32})/);
        if (match) {
            log(`✅ 从URL中提取到32位ID: ${match[1]}`);
            return match[1];
        }
        
        log(`❌ 未能从URL中提取到任务ID`);
        return null;
    }

    // 更新UI
    function updateUI() {
        if (interceptedRequests.length === 0) {
            document.getElementById('extractor-status').innerHTML = 
                '<span>🔍 监听API请求中...</span>';
            document.getElementById('extractor-status').className = 'ai-extractor-status';
            return;
        }

        const latestRequest = interceptedRequests[interceptedRequests.length - 1];
        
        // 更新状态
        const statusElement = document.getElementById('extractor-status');
        let statusText = '';
        let statusClass = '';
        
        if (latestRequest.status === 'completed') {
            statusText = `✅ 生成完成 (${interceptedRequests.length}个请求)`;
            statusClass = 'ai-extractor-status success';
        } else if (latestRequest.status === 'processing') {
            statusText = '⏳ 生成中...';
            statusClass = 'ai-extractor-status pending';
        } else {
            statusText = `⚠️ 状态: ${latestRequest.status}`;
            statusClass = 'ai-extractor-status';
        }
        
        statusElement.innerHTML = `<span>${statusText}</span>`;
        statusElement.className = statusClass;

        // 更新基本信息
        document.getElementById('task-id').textContent = latestRequest.task_id || '-';
        document.getElementById('prompt').textContent = 
            (latestRequest.params?.prompt || '-').substring(0, 30) + 
            (latestRequest.params?.prompt?.length > 30 ? '...' : '');
        document.getElementById('dimensions').textContent = 
            latestRequest.params?.width && latestRequest.params?.height ? 
            `${latestRequest.params.width}x${latestRequest.params.height}` : '-';
        document.getElementById('batch-size').textContent = latestRequest.params?.batch_size || '-';
        document.getElementById('status').textContent = latestRequest.status || '-';
        document.getElementById('image-count').textContent = latestRequest.image_urls?.length || 0;
    }

    // 导出数据
    function exportData(format) {
        if (extractedData.length === 0) {
            showNotification('警告', '没有可导出的数据');
            return;
        }

        let content = '';
        let filename = '';
        const timestamp = Date.now();

        if (format === 'json') {
            content = JSON.stringify(extractedData, null, 2);
            filename = `ai-image-data-${timestamp}.json`;
        } else if (format === 'csv') {
            const headers = ['timestamp', 'task_id', 'prompt', 'dimensions', 'batch_size', 'image_urls'];
            const rows = [headers.join(',')];
            
            extractedData.forEach(data => {
                const imageUrlsStr = data.image_urls.join('|');
                const row = [
                    data.timestamp,
                    `"${data.task_id}"`,
                    `"${data.prompt.replace(/"/g, '""')}"`,
                    data.dimensions,
                    data.batch_size,
                    `"${imageUrlsStr.replace(/"/g, '""')}"`
                ];
                rows.push(row.join(','));
            });
            
            content = rows.join('\n');
            filename = `ai-image-data-${timestamp}.csv`;
        }

        // 下载文件
        const blob = new Blob([content], { 
            type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('成功', `数据已导出为 ${filename}`);
        log(`数据导出: ${filename}`);
    }

    // 显示通知
    function showNotification(title, message) {
        GM_notification({
            title: title,
            message: message,
            timeout: 3000
        });
    }

    // 日志记录
    function log(...args) {
        console.log('[AI Extractor v3.1]', ...args);
    }

    // 立即启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();