// ==UserScript==
// @name         AI Image Generator - 完整信息提取器
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  完整提取freeaiimage.net的AI图片生成信息，为转API程序提供数据
// @author       Your Name
// @match        https://freeaiimage.net/zh/*
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // 配置
    const CONFIG = {
        debugMode: false,
        autoExport: false,
        exportFormat: 'json',
        saveHistory: true
    };

    // 数据存储
    let extractedData = [];
    let currentSession = null;
    let apiInterceptions = [];

    // 样式
    const styles = `
        .extractor-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            max-height: 80vh;
            background: #2d3748;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            overflow: hidden;
        }
        
        .extractor-header {
            background: #4a5568;
            padding: 10px 15px;
            cursor: move;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .extractor-content {
            padding: 15px;
            max-height: calc(80vh - 60px);
            overflow-y: auto;
        }
        
        .extractor-section {
            margin-bottom: 15px;
            padding: 10px;
            background: #374151;
            border-radius: 6px;
        }
        
        .extractor-section h4 {
            margin: 0 0 8px 0;
            color: #fbbf24;
            font-size: 13px;
        }
        
        .extractor-item {
            margin: 5px 0;
            display: flex;
            justify-content: space-between;
        }
        
        .extractor-label {
            color: #9ca3af;
            min-width: 80px;
        }
        
        .extractor-value {
            color: white;
            text-align: right;
            word-break: break-all;
            max-width: 200px;
        }
        
        .extractor-controls {
            display: flex;
            gap: 5px;
            margin-top: 10px;
        }
        
        .extractor-btn {
            padding: 6px 12px;
            background: #059669;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            flex: 1;
        }
        
        .extractor-btn:hover {
            background: #047857;
        }
        
        .extractor-btn.export {
            background: #dc2626;
        }
        
        .extractor-btn.export:hover {
            background: #b91c1c;
        }
        
        .extractor-status {
            background: #1f2937;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
        }
        
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 5px;
        }
        
        .status-success { background: #10b981; }
        .status-error { background: #ef4444; }
        .status-pending { background: #f59e0b; }
    `;

    // 初始化
    function init() {
        GM_addStyle(styles);
        createUI();
        startMonitoring();
        interceptNetworkRequests();
        log('Extractor initialized');
    }

    // 创建用户界面
    function createUI() {
        const panel = document.createElement('div');
        panel.className = 'extractor-panel';
        panel.id = 'extractor-panel';
        
        panel.innerHTML = `
            <div class="extractor-header" id="extractor-drag-handle">
                <span>📊 AI图片提取器 v2.0</span>
                <span>⏱️ <span id="extractor-timer">00:00</span></span>
            </div>
            <div class="extractor-content">
                <div class="extractor-status">
                    <span class="status-indicator status-success"></span>
                    <span id="status-text">等待输入...</span>
                </div>
                
                <div class="extractor-section">
                    <h4>📝 当前会话</h4>
                    <div class="extractor-item">
                        <span class="extractor-label">提示词:</span>
                        <span class="extractor-value" id="current-prompt">-</span>
                    </div>
                    <div class="extractor-item">
                        <span class="extractor-label">参数:</span>
                        <span class="extractor-value" id="current-params">-</span>
                    </div>
                    <div class="extractor-item">
                        <span class="extractor-label">状态:</span>
                        <span class="extractor-value" id="current-status">等待开始</span>
                    </div>
                </div>
                
                <div class="extractor-section">
                    <h4>🔍 网络监控</h4>
                    <div class="extractor-item">
                        <span class="extractor-label">API调用:</span>
                        <span class="extractor-value" id="api-count">0</span>
                    </div>
                    <div class="extractor-item">
                        <span class="extractor-label">响应时间:</span>
                        <span class="extractor-value" id="response-time">-</span>
                    </div>
                </div>
                
                <div class="extractor-section">
                    <h4>📤 导出选项</h4>
                    <div class="extractor-controls">
                        <button class="extractor-btn export" id="export-json">JSON</button>
                        <button class="extractor-btn export" id="export-csv">CSV</button>
                        <button class="extractor-btn" id="clear-data">清空</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        setupEventListeners();
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 拖拽功能
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        document.getElementById('extractor-drag-handle').addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = document.getElementById('extractor-panel').getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const panel = document.getElementById('extractor-panel');
                panel.style.left = (e.clientX - dragOffset.x) + 'px';
                panel.style.top = (e.clientY - dragOffset.y) + 'px';
                panel.style.right = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // 导出按钮
        document.getElementById('export-json').addEventListener('click', () => {
            exportData('json');
        });

        document.getElementById('export-csv').addEventListener('click', () => {
            exportData('csv');
        });

        document.getElementById('clear-data').addEventListener('click', () => {
            if (confirm('确定要清空所有数据吗？')) {
                extractedData = [];
                apiInterceptions = [];
                updateUI();
                log('Data cleared');
            }
        });
    }

    // 启动监控
    function startMonitoring() {
        // 监控页面元素变化
        const observer = new MutationObserver((mutations) => {
            checkForNewElements(mutations);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['value', 'src', 'href']
        });

        // 定时检查
        setInterval(checkPageElements, 1000);
        
        // 启动计时器
        startTimer();
    }

    // 检查页面元素
    function checkPageElements() {
        checkPromptInputs();
        checkGenerationStatus();
        checkGeneratedImages();
        checkParameters();
    }

    // 检查提示词输入
    function checkPromptInputs() {
        const promptSelectors = [
            'input[name*="prompt"]',
            'textarea[placeholder*="提示"]',
            'textarea[placeholder*="prompt"]',
            'input[placeholder*="描述"]',
            'input[placeholder*="description"]',
            '.prompt-input',
            '#prompt'
        ];

        for (const selector of promptSelectors) {
            const element = document.querySelector(selector);
            if (element && element.value.trim()) {
                const prompt = element.value.trim();
                if (!currentSession || currentSession.prompt !== prompt) {
                    startNewSession(prompt);
                }
                return;
            }
        }
    }

    // 检查生成状态
    function checkGenerationStatus() {
        const statusSelectors = [
            'button[disabled*="disabled"]',
            'button[class*="loading"]',
            '.loading',
            '.generating',
            '.status:contains("生成中")',
            '.status:contains("loading")'
        ];

        let isGenerating = false;
        for (const selector of statusSelectors) {
            if (document.querySelector(selector)) {
                isGenerating = true;
                break;
            }
        }

        if (currentSession) {
            currentSession.status = isGenerating ? 'generating' : currentSession.status;
            if (!isGenerating && currentSession.status === 'generating') {
                currentSession.status = 'completed';
                completeSession();
            }
            updateUI();
        }
    }

    // 检查生成的图片
    function checkGeneratedImages() {
        const imgSelectors = [
            'img[src*="blob:"]',
            'img[src*="data:image"]',
            '.result img',
            '.generated-image',
            '.result-image'
        ];

        for (const selector of imgSelectors) {
            const image = document.querySelector(selector);
            if (image && image.src && image.src !== 'data:') {
                if (!currentSession || !currentSession.imageUrl) {
                    if (currentSession) {
                        currentSession.imageUrl = image.src;
                        currentSession.status = 'completed';
                        completeSession();
                    }
                }
                return;
            }
        }
    }

    // 检查参数设置
    function checkParameters() {
        const params = {};

        // 检查尺寸选择
        const sizeSelectors = [
            'select[name*="size"]',
            '.size-selector option:checked',
            'input[name="width"]',
            'input[name="height"]'
        ];

        for (const selector of sizeSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                if (element.tagName === 'SELECT' || element.tagName === 'OPTION') {
                    params.size = element.value;
                } else if (element.name === 'width' || element.name === 'height') {
                    params[element.name] = element.value;
                }
            }
        }

        // 检查模型选择
        const modelSelectors = [
            'select[name*="model"]',
            '.model-selector option:checked',
            'select[name*="engine"]'
        ];

        for (const selector of modelSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                params.model = element.value;
                break;
            }
        }

        if (Object.keys(params).length > 0 && currentSession) {
            currentSession.parameters = { ...currentSession.parameters, ...params };
        }
    }

    // 开始新会话
    function startNewSession(prompt) {
        currentSession = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            prompt: prompt,
            parameters: {},
            status: 'waiting',
            imageUrl: null,
            apiCalls: [],
            responseTime: null
        };

        updateUI();
        log(`New session started: ${prompt}`);
    }

    // 完成会话
    function completeSession() {
        if (currentSession) {
            currentSession.apiCalls = [...apiInterceptions];
            extractedData.push(currentSession);
            log(`Session completed: ${currentSession.prompt}`);
            showNotification('完成', '会话数据已记录');
        }
    }

    // 拦截网络请求
    function interceptNetworkRequests() {
        const originalFetch = window.fetch;
        const originalXMLHttpRequest = window.XMLHttpRequest;

        // 拦截 fetch
        window.fetch = function(...args) {
            const [url, options] = args;
            const startTime = Date.now();

            return originalFetch.apply(this, args).then(response => {
                const endTime = Date.now();
                const responseTime = endTime - startTime;

                // 记录API调用
                const apiCall = {
                    url: url,
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    requestBody: options.body,
                    responseTime: responseTime,
                    status: response.status,
                    timestamp: new Date().toISOString()
                };

                apiInterceptions.push(apiCall);
                updateUI();

                return response;
            });
        };

        // 拦截 XMLHttpRequest
        window.XMLHttpRequest = function() {
            const xhr = new originalXMLHttpRequest();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;

            let requestInfo = {};

            xhr.open = function(method, url) {
                requestInfo.method = method;
                requestInfo.url = url;
                requestInfo.startTime = Date.now();
                return originalOpen.apply(this, arguments);
            };

            xhr.send = function(data) {
                requestInfo.data = data;
                requestInfo.headers = {};
                
                const response = originalSend.apply(this, arguments);
                
                xhr.addEventListener('loadend', function() {
                    const endTime = Date.now();
                    const responseTime = endTime - requestInfo.startTime;
                    
                    const apiCall = {
                        url: requestInfo.url,
                        method: requestInfo.method,
                        headers: requestInfo.headers,
                        requestBody: requestInfo.data,
                        responseTime: responseTime,
                        status: xhr.status,
                        timestamp: new Date().toISOString()
                    };

                    apiInterceptions.push(apiCall);
                    updateUI();
                });

                return response;
            };

            return xhr;
        };
    }

    // 更新UI
    function updateUI() {
        if (!currentSession) return;

        // 更新当前会话信息
        document.getElementById('current-prompt').textContent = 
            currentSession.prompt.substring(0, 50) + (currentSession.prompt.length > 50 ? '...' : '');
        
        document.getElementById('current-params').textContent = 
            Object.keys(currentSession.parameters).length > 0 ? 
            JSON.stringify(currentSession.parameters).substring(0, 30) + '...' : '-';
        
        document.getElementById('current-status').textContent = getStatusText(currentSession.status);
        
        // 更新网络监控
        document.getElementById('api-count').textContent = apiInterceptions.length;
        
        if (apiInterceptions.length > 0) {
            const avgResponseTime = apiInterceptions.reduce((sum, call) => sum + call.responseTime, 0) / apiInterceptions.length;
            document.getElementById('response-time').textContent = Math.round(avgResponseTime) + 'ms';
        }

        // 更新状态指示器
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.getElementById('status-text');
        
        statusIndicator.className = 'status-indicator ' + getStatusClass(currentSession.status);
        statusText.textContent = getStatusText(currentSession.status);
    }

    // 获取状态文本
    function getStatusText(status) {
        const statusMap = {
            'waiting': '等待开始',
            'generating': '生成中...',
            'completed': '已完成',
            'error': '发生错误'
        };
        return statusMap[status] || '未知状态';
    }

    // 获取状态样式类
    function getStatusClass(status) {
        const classMap = {
            'waiting': 'status-pending',
            'generating': 'status-pending',
            'completed': 'status-success',
            'error': 'status-error'
        };
        return classMap[status] || 'status-pending';
    }

    // 导出数据
    function exportData(format) {
        if (extractedData.length === 0) {
            showNotification('警告', '没有可导出的数据');
            return;
        }

        let content = '';
        let filename = '';

        if (format === 'json') {
            content = JSON.stringify(extractedData, null, 2);
            filename = `ai-image-data-${Date.now()}.json`;
        } else if (format === 'csv') {
            const headers = ['timestamp', 'prompt', 'status', 'image_url', 'model', 'size'];
            const rows = [headers.join(',')];
            
            extractedData.forEach(data => {
                const row = [
                    data.timestamp,
                    `"${data.prompt.replace(/"/g, '""')}"`,
                    data.status,
                    data.imageUrl || '',
                    data.parameters.model || '',
                    data.parameters.size || ''
                ];
                rows.push(row.join(','));
            });
            
            content = rows.join('\n');
            filename = `ai-image-data-${Date.now()}.csv`;
        }

        // 创建下载链接
        const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        showNotification('成功', `数据已导出为 ${filename}`);
        log(`Data exported: ${filename}`);
    }

    // 启动计时器
    function startTimer() {
        let seconds = 0;
        setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            document.getElementById('extractor-timer').textContent = 
                `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
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
    function log(message) {
        if (CONFIG.debugMode) {
            console.log('[AI Extractor]', message);
        }
    }

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();