// ==UserScript==
// @name         AI图片生成器 - 智能分析器 v4.0
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  智能分析freeaiimage.net，自动检测网站结构和API调用方式
// @author       AI助手
// @match        https://freeaiimage.net/*
// @match        https://freeaiimage.net/zh/*
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // 全局状态
    let analysisResults = [];
    let detectedPatterns = {
        promptInputs: [],
        generateButtons: [],
        apiEndpoints: [],
        successPatterns: []
    };
    let isAnalyzing = false;

    // UI样式
    const styles = `
        .ai-analyzer-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 380px;
            max-height: 80vh;
            background: #0f172a;
            color: white;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            overflow: hidden;
            border: 1px solid #334155;
        }
        
        .ai-analyzer-header {
            background: #1e293b;
            padding: 12px 15px;
            border-bottom: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .ai-analyzer-title {
            font-size: 13px;
            font-weight: bold;
            color: #f8fafc;
            margin: 0;
        }
        
        .ai-analyzer-content {
            padding: 15px;
            max-height: calc(80vh - 60px);
            overflow-y: auto;
        }
        
        .ai-analyzer-section {
            margin-bottom: 12px;
            padding: 10px;
            background: #1e293b;
            border-radius: 6px;
            border-left: 3px solid #475569;
        }
        
        .ai-analyzer-section.active {
            border-left-color: #22c55e;
            background: #1e3a2e;
        }
        
        .ai-analyzer-section.error {
            border-left-color: #ef4444;
            background: #3a1e1e;
        }
        
        .ai-analyzer-section.warning {
            border-left-color: #f59e0b;
            background: #3a2e1e;
        }
        
        .ai-analyzer-section-title {
            color: #fbbf24;
            font-size: 12px;
            margin: 0 0 8px 0;
            font-weight: bold;
        }
        
        .ai-analyzer-item {
            margin: 4px 0;
            padding: 4px 0;
            border-bottom: 1px solid #374151;
        }
        
        .ai-analyzer-item:last-child {
            border-bottom: none;
        }
        
        .ai-analyzer-label {
            color: #9ca3af;
            font-size: 10px;
            display: inline-block;
            min-width: 60px;
        }
        
        .ai-analyzer-value {
            color: #e2e8f0;
            font-size: 10px;
            word-break: break-all;
        }
        
        .ai-analyzer-buttons {
            display: flex;
            gap: 6px;
            margin-top: 10px;
            flex-wrap: wrap;
        }
        
        .ai-analyzer-btn {
            padding: 6px 10px;
            background: #059669;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            flex: 1;
            min-width: 60px;
        }
        
        .ai-analyzer-btn:hover {
            background: #047857;
        }
        
        .ai-analyzer-btn.secondary {
            background: #6366f1;
        }
        
        .ai-analyzer-btn.secondary:hover {
            background: #5b21b6;
        }
        
        .ai-analyzer-btn.danger {
            background: #dc2626;
        }
        
        .ai-analyzer-btn.danger:hover {
            background: #b91c1c;
        }
        
        .ai-analyzer-status {
            background: #1e293b;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
            border-left: 3px solid #6366f1;
        }
        
        .ai-analyzer-status.analyzing {
            border-left-color: #f59e0b;
        }
        
        .ai-analyzer-status.success {
            border-left-color: #22c55e;
        }
        
        .ai-analyzer-status.error {
            border-left-color: #ef4444;
        }
        
        .ai-analyzer-log {
            background: #0f1419;
            color: #94a3b8;
            padding: 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 9px;
            max-height: 100px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        
        .ai-analyzer-highlight {
            background: #fbbf24;
            color: #000;
            padding: 2px 4px;
            border-radius: 2px;
        }
    `;

    // 启动分析器
    function init() {
        console.log('🚀 === AI图片智能分析器 v4.0 启动 ===');
        
        // 添加样式
        GM_addStyle(styles);
        
        // 创建UI
        createUI();
        
        // 立即开始分析
        startAnalysis();
        
        // 显示启动通知
        setTimeout(() => {
            showNotification('🚀 分析器已启动', '正在智能分析网站结构...');
        }, 500);
    }

    // 创建UI
    function createUI() {
        const panel = document.createElement('div');
        panel.className = 'ai-analyzer-panel';
        panel.id = 'ai-analyzer-panel';
        
        panel.innerHTML = `
            <div class="ai-analyzer-header">
                <h3 class="ai-analyzer-title">🤖 AI图片智能分析器 v4.0</h3>
                <span id="analyzer-status-indicator">🔄</span>
            </div>
            <div class="ai-analyzer-content">
                <div class="ai-analyzer-status analyzing" id="analyzer-status">
                    <span>🔄 正在分析网站结构...</span>
                </div>
                
                <div class="ai-analyzer-section" id="site-analysis">
                    <h4 class="ai-analyzer-section-title">📊 网站结构分析</h4>
                    <div class="ai-analyzer-item">
                        <span class="ai-analyzer-label">URL:</span>
                        <span class="ai-analyzer-value" id="current-url">-</span>
                    </div>
                    <div class="ai-analyzer-item">
                        <span class="ai-analyzer-label">提示词输入框:</span>
                        <span class="ai-analyzer-value" id="prompt-inputs">0个</span>
                    </div>
                    <div class="ai-analyzer-item">
                        <span class="ai-analyzer-label">生成按钮:</span>
                        <span class="ai-analyzer-value" id="generate-buttons">0个</span>
                    </div>
                </div>
                
                <div class="ai-analyzer-section" id="network-analysis">
                    <h4 class="ai-analyzer-section-title">🌐 网络请求分析</h4>
                    <div class="ai-analyzer-item">
                        <span class="ai-analyzer-label">API端点:</span>
                        <span class="ai-analyzer-value" id="api-endpoints">0个</span>
                    </div>
                    <div class="ai-analyzer-item">
                        <span class="ai-analyzer-label">捕获数据:</span>
                        <span class="ai-analyzer-value" id="captured-data">0条</span>
                    </div>
                </div>
                
                <div class="ai-analyzer-section" id="extraction-results">
                    <h4 class="ai-analyzer-section-title">📤 数据提取结果</h4>
                    <div class="ai-analyzer-item">
                        <span class="ai-analyzer-label">最新提取:</span>
                        <span class="ai-analyzer-value" id="latest-extraction">暂无</span>
                    </div>
                </div>
                
                <div class="ai-analyzer-buttons">
                    <button class="ai-analyzer-btn secondary" id="force-analyze">🔍 重新分析</button>
                    <button class="ai-analyzer-btn" id="export-data">📤 导出数据</button>
                    <button class="ai-analyzer-btn danger" id="clear-data">🗑️ 清空</button>
                </div>
                
                <div class="ai-analyzer-section">
                    <h4 class="ai-analyzer-section-title">📋 操作日志</h4>
                    <div class="ai-analyzer-log" id="analyzer-log">等待分析结果...</div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        setupEventListeners();
    }

    // 设置事件监听
    function setupEventListeners() {
        document.getElementById('force-analyze').addEventListener('click', () => {
            log('🔄 用户要求重新分析...');
            startAnalysis();
        });

        document.getElementById('export-data').addEventListener('click', () => {
            exportAnalysisResults();
        });

        document.getElementById('clear-data').addEventListener('click', () => {
            if (confirm('确定要清空所有数据吗？')) {
                analysisResults = [];
                detectedPatterns = {
                    promptInputs: [],
                    generateButtons: [],
                    apiEndpoints: [],
                    successPatterns: []
                };
                updateUI();
                log('🗑️ 数据已清空');
            }
        });
    }

    // 开始智能分析
    function startAnalysis() {
        if (isAnalyzing) {
            log('⏳ 分析正在进行中...');
            return;
        }

        isAnalyzing = true;
        updateStatus('正在分析网站结构...', 'analyzing');
        log('🚀 开始智能分析...');

        // 分析页面结构
        analyzePageStructure();
        
        // 设置网络监控
        setupNetworkMonitoring();
        
        // 监控用户交互
        setupUserInteractionMonitoring();
        
        // 定时更新UI
        setInterval(updateUI, 1000);
        
        setTimeout(() => {
            isAnalyzing = false;
            updateStatus('分析完成，等待数据...', 'success');
        }, 3000);
    }

    // 分析页面结构
    function analyzePageStructure() {
        log('📊 开始分析页面结构...');
        
        // 查找提示词输入框
        const promptSelectors = [
            'input[name*="prompt"]',
            'textarea[placeholder*="提示"]',
            'textarea[placeholder*="prompt"]',
            'input[placeholder*="描述"]',
            'input[placeholder*="描述"]',
            '.prompt-input',
            '#prompt',
            '[contenteditable="true"]'
        ];

        detectedPatterns.promptInputs = [];
        promptSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
                detectedPatterns.promptInputs.push({
                    selector: selector,
                    element: element,
                    type: element.tagName.toLowerCase(),
                    placeholder: element.placeholder || element.getAttribute('placeholder') || '',
                    value: element.value || ''
                });
                log(`🎯 找到提示词输入框 [${selector}]:`, element);
            });
        });

        // 查找生成按钮
        detectedPatterns.generateButtons = [];
        document.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(button => {
            const text = button.textContent.toLowerCase().trim();
            if (text.includes('生成') || text.includes('generate') || text.includes('创建') || text.includes('create')) {
                detectedPatterns.generateButtons.push({
                    element: button,
                    text: button.textContent.trim(),
                    type: button.type || 'button',
                    disabled: button.disabled
                });
                log(`🎯 找到生成按钮 "${text}":`, button);
            }
        });

        // 分析页面URL
        document.getElementById('current-url').textContent = window.location.href;
        
        log(`✅ 页面结构分析完成: ${detectedPatterns.promptInputs.length}个输入框, ${detectedPatterns.generateButtons.length}个按钮`);
    }

    // 设置网络监控
    function setupNetworkMonitoring() {
        log('🌐 开始设置网络监控...');
        
        // XMLHttpRequest监控
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._method = method;
            this._url = url;
            this._startTime = Date.now();
            
            if (method !== 'GET' || url.includes('api') || url.includes('task') || url.includes('generate')) {
                log(`📤 [XHR] ${method} ${url}`);
            }
            
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(data) {
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4) {
                    const responseTime = Date.now() - this._startTime;
                    
                    if (this.status >= 200 && this.status < 300) {
                        log(`📥 [XHR响应] ${this._method} ${this._url} (${responseTime}ms) - ${this.status}`);
                        
                        // 尝试解析JSON
                        if (this.responseText && this.responseText.trim()) {
                            try {
                                const responseData = JSON.parse(this.responseText);
                                processAPIResponse(this._url, responseData, 'XHR', responseTime);
                            } catch (e) {
                                log(`⚠️ [XHR] 响应不是JSON: ${this.responseText.substring(0, 100)}...`);
                            }
                        }
                    } else {
                        log(`❌ [XHR错误] ${this._method} ${this._url} - ${this.status} ${this.statusText}`);
                    }
                }
            });

            return originalSend.apply(this, arguments);
        };

        // Fetch监控
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options] = args;
            const method = options?.method || 'GET';
            
            if (method !== 'GET' || url.includes('api') || url.includes('task') || url.includes('generate')) {
                log(`📤 [Fetch] ${method} ${url}`);
            }
            
            const startTime = Date.now();
            return originalFetch.apply(this, args)
                .then(response => {
                    const responseTime = Date.now() - startTime;
                    
                    if (response.ok) {
                        log(`📥 [Fetch响应] ${method} ${url} (${responseTime}ms) - ${response.status}`);
                        response.clone().text().then(text => {
                            if (text && text.trim()) {
                                try {
                                    const responseData = JSON.parse(text);
                                    processAPIResponse(url, responseData, 'Fetch', responseTime);
                                } catch (e) {
                                    log(`⚠️ [Fetch] 响应不是JSON: ${text.substring(0, 100)}...`);
                                }
                            }
                        });
                    } else {
                        log(`❌ [Fetch错误] ${method} ${url} - ${response.status} ${response.statusText}`);
                    }
                    
                    return response;
                })
                .catch(error => {
                    log(`❌ [Fetch异常] ${error.message}`);
                });
        };

        log('✅ 网络监控设置完成');
    }

    // 设置用户交互监控
    function setupUserInteractionMonitoring() {
        log('👤 开始设置用户交互监控...');
        
        // 监控提示词输入变化
        detectedPatterns.promptInputs.forEach(input => {
            input.element.addEventListener('input', function() {
                log(`✏️ [用户输入] 提示词: "${this.value.substring(0, 50)}${this.value.length > 50 ? '...' : ''}"`);
            });
        });

        // 监控生成按钮点击
        detectedPatterns.generateButtons.forEach(button => {
            button.element.addEventListener('click', function() {
                log(`🖱️ [按钮点击] "${this.textContent}"`);
                
                // 查找当前提示词
                let currentPrompt = '';
                detectedPatterns.promptInputs.forEach(input => {
                    if (input.value && input.value.trim()) {
                        currentPrompt = input.value.trim();
                    }
                });
                
                log(`📝 [当前提示词] ${currentPrompt}`);
                
                // 标记生成开始
                updateStatus('检测到生成请求...', 'analyzing');
            });
        });

        log('✅ 用户交互监控设置完成');
    }

    // 处理API响应
    function processAPIResponse(url, responseData, source, responseTime) {
        log(`🎯 [API处理] 来源: ${source}, URL: ${url}`);
        log('📋 [响应数据]', JSON.stringify(responseData, null, 2));
        
        // 智能检测是否有用的数据
        const hasImageData = responseData.data && Array.isArray(responseData.data) && 
                            responseData.data.length > 0;
        const hasTaskId = responseData.task_id || responseData.taskid || responseData.id;
        const hasStatus = responseData.status && (responseData.status === 'completed' || responseData.status === 'success');
        const hasPrompt = responseData.prompt || responseData.params?.prompt;
        const hasImages = responseData.images && Array.isArray(responseData.images);
        
        if (hasImageData || hasTaskId || (hasStatus && hasPrompt) || hasImages) {
            log('🎉 [成功] 检测到有用数据！');
            
            // 提取并保存数据
            const extractedData = extractUsefulData(url, responseData, source, responseTime);
            analysisResults.push(extractedData);
            
            // 更新UI
            updateLatestExtraction(extractedData);
            updateStatus('✅ 检测到有用数据！', 'success');
            
            // 通知
            showNotification('🎯 检测到数据！', `来源: ${source}, 提示词: ${extractedData.prompt.substring(0, 20)}...`);
            
            // 高亮页面
            highlightPage();
        } else {
            log('⚠️ [跳过] 未检测到有用数据');
        }
    }

    // 提取有用数据
    function extractUsefulData(url, responseData, source, responseTime) {
        return {
            timestamp: new Date().toISOString(),
            source: source,
            url: url,
            responseTime: responseTime,
            prompt: responseData.params?.prompt || responseData.prompt || '未知',
            task_id: responseData.task_id || responseData.taskid || responseData.id,
            status: responseData.status,
            width: responseData.params?.width || responseData.width,
            height: responseData.params?.height || responseData.height,
            batch_size: responseData.params?.batch_size || responseData.batch_size,
            images: responseData.data || responseData.images || [],
            raw_response: responseData
        };
    }

    // 高亮页面
    function highlightPage() {
        document.body.style.transition = 'background-color 0.5s ease';
        document.body.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
        
        setTimeout(() => {
            document.body.style.backgroundColor = '';
        }, 2000);
    }

    // 更新状态
    function updateStatus(text, type) {
        const statusElement = document.getElementById('analyzer-status');
        const indicator = document.getElementById('analyzer-status-indicator');
        
        statusElement.innerHTML = `<span>${text}</span>`;
        statusElement.className = `ai-analyzer-status ${type}`;
        
        const indicators = {
            analyzing: '🔄',
            success: '✅',
            error: '❌'
        };
        
        indicator.textContent = indicators[type] || '🔄';
    }

    // 更新最新提取
    function updateLatestExtraction(data) {
        const element = document.getElementById('latest-extraction');
        const truncatedPrompt = data.prompt.length > 30 ? 
            data.prompt.substring(0, 30) + '...' : data.prompt;
        
        element.innerHTML = `<span class="ai-analyzer-highlight">${truncatedPrompt}</span> (${data.images.length}张图片)`;
    }

    // 更新UI
    function updateUI() {
        // 更新统计信息
        document.getElementById('prompt-inputs').textContent = `${detectedPatterns.promptInputs.length}个`;
        document.getElementById('generate-buttons').textContent = `${detectedPatterns.generateButtons.length}个`;
        document.getElementById('api-endpoints').textContent = `${analysisResults.length}个`;
        document.getElementById('captured-data').textContent = `${analysisResults.length}条`;
    }

    // 导出分析结果
    function exportAnalysisResults() {
        if (analysisResults.length === 0) {
            showNotification('警告', '没有可导出的数据');
            return;
        }

        const filename = `ai-analysis-${Date.now()}.json`;
        const content = JSON.stringify({
            analysis_results: analysisResults,
            detected_patterns: {
                prompt_inputs: detectedPatterns.promptInputs.map(item => ({
                    selector: item.selector,
                    type: item.type,
                    placeholder: item.placeholder
                })),
                generate_buttons: detectedPatterns.generateButtons.map(item => ({
                    text: item.text,
                    type: item.type
                }))
            },
            export_time: new Date().toISOString()
        }, null, 2);

        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        showNotification('成功', `分析结果已导出: ${filename}`);
        log(`📤 导出分析结果: ${filename}`);
    }

    // 日志记录
    function log(...args) {
        console.log('[AI Analyzer]', ...args);
        
        const logElement = document.getElementById('analyzer-log');
        if (logElement) {
            const timestamp = new Date().toLocaleTimeString();
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            
            logElement.textContent = `[${timestamp}] ${message}\n` + logElement.textContent;
            
            // 限制日志长度
            if (logElement.textContent.split('\n').length > 50) {
                logElement.textContent = logElement.textContent.split('\n').slice(0, 50).join('\n');
            }
        }
    }

    // 显示通知
    function showNotification(title, message) {
        GM_notification({
            title: title,
            message: message,
            timeout: 3000
        });
    }

    // 立即启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();