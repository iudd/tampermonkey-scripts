// ==UserScript==
// @name         AI图片生成器 - 精确提取器 v5.0
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  专门针对freeaiimage.net的精确API提取器，已测试确认可工作
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

    // 数据存储
    let extractedSessions = [];
    let currentTasks = new Map(); // 跟踪任务状态

    // UI样式
    const styles = `
        .ai-final-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 360px;
            max-height: 75vh;
            background: #0a0a0a;
            color: white;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
            z-index: 10000;
            font-family: 'SF Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 12px;
            overflow: hidden;
            border: 1px solid #333;
        }
        
        .ai-final-header {
            background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
            padding: 15px;
            border-bottom: 1px solid #444;
        }
        
        .ai-final-title {
            font-size: 14px;
            font-weight: 600;
            color: #00ff88;
            margin: 0;
        }
        
        .ai-final-subtitle {
            font-size: 11px;
            color: #888;
            margin: 2px 0 0 0;
        }
        
        .ai-final-content {
            padding: 15px;
            max-height: calc(75vh - 80px);
            overflow-y: auto;
        }
        
        .ai-final-section {
            margin-bottom: 15px;
            padding: 12px;
            background: #1a1a1a;
            border-radius: 8px;
            border-left: 3px solid #00ff88;
        }
        
        .ai-final-section.pending {
            border-left-color: #ffaa00;
            background: #2a1a1a;
        }
        
        .ai-final-section.success {
            border-left-color: #00ff88;
            background: #1a2a1a;
        }
        
        .ai-final-section-title {
            color: #00ff88;
            font-size: 12px;
            margin: 0 0 8px 0;
            font-weight: 600;
        }
        
        .ai-final-item {
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        
        .ai-final-label {
            color: #666;
            font-size: 11px;
            min-width: 50px;
        }
        
        .ai-final-value {
            color: #fff;
            text-align: right;
            word-break: break-all;
            max-width: 230px;
            font-size: 11px;
            line-height: 1.3;
        }
        
        .ai-final-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 12px;
        }
        
        .ai-final-btn {
            padding: 8px 12px;
            background: #00ff88;
            color: #000;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            transition: all 0.2s;
        }
        
        .ai-final-btn:hover {
            background: #00cc6a;
            transform: translateY(-1px);
        }
        
        .ai-final-btn.export {
            background: #ff6b6b;
            color: white;
        }
        
        .ai-final-btn.export:hover {
            background: #ff5252;
        }
        
        .ai-final-status {
            background: #1a1a1a;
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 12px;
            border-left: 3px solid #666;
        }
        
        .ai-final-status.active {
            border-left-color: #00ff88;
            background: #1a2a1a;
        }
        
        .ai-final-status.waiting {
            border-left-color: #ffaa00;
            background: #2a2a1a;
        }
        
        .ai-final-tasks {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .ai-final-task {
            padding: 8px;
            background: #222;
            border-radius: 4px;
            border-left: 2px solid #666;
        }
        
        .ai-final-task.completed {
            border-left-color: #00ff88;
        }
        
        .ai-final-task.processing {
            border-left-color: #ffaa00;
        }
        
        .ai-final-task.error {
            border-left-color: #ff6b6b;
        }
    `;

    // 初始化
    function init() {
        console.log('🚀 === AI图片精确提取器 v5.0 启动 ===');
        
        // 添加样式
        GM_addStyle(styles);
        
        // 创建UI
        createUI();
        
        // 设置API监控
        setupAPIMonitoring();
        
        // 显示启动通知
        setTimeout(() => {
            showNotification('🚀 精确提取器已启动', '正在监控AI图片生成API...');
        }, 500);
        
        console.log('✅ 提取器初始化完成');
    }

    // 创建UI
    function createUI() {
        const panel = document.createElement('div');
        panel.className = 'ai-final-panel';
        
        panel.innerHTML = `
            <div class="ai-final-header">
                <h3 class="ai-final-title">🎯 AI图片精确提取器 v5.0</h3>
                <p class="ai-final-subtitle">专为freeaiimage.net优化</p>
            </div>
            <div class="ai-final-content">
                <div class="ai-final-status waiting" id="final-status">
                    <span>⏳ 等待生成请求...</span>
                </div>
                
                <div class="ai-final-section" id="current-task">
                    <h4 class="ai-final-section-title">📋 当前任务</h4>
                    <div class="ai-final-item">
                        <span class="ai-final-label">状态:</span>
                        <span class="ai-final-value" id="current-status">等待中</span>
                    </div>
                    <div class="ai-final-item">
                        <span class="ai-final-label">提示词:</span>
                        <span class="ai-final-value" id="current-prompt">-</span>
                    </div>
                    <div class="ai-final-item">
                        <span class="ai-final-label">尺寸:</span>
                        <span class="ai-final-value" id="current-dimensions">-</span>
                    </div>
                    <div class="ai-final-item">
                        <span class="ai-final-label">图片:</span>
                        <span class="ai-final-value" id="current-images">0张</span>
                    </div>
                </div>
                
                <div class="ai-final-section">
                    <h4 class="ai-final-section-title">📊 统计</h4>
                    <div class="ai-final-item">
                        <span class="ai-final-label">总会话:</span>
                        <span class="ai-final-value" id="total-sessions">0</span>
                    </div>
                    <div class="ai-final-item">
                        <span class="ai-final-label">完成:</span>
                        <span class="ai-final-value" id="completed-sessions">0</span>
                    </div>
                    <div class="ai-final-item">
                        <span class="ai-final-label">图片总数:</span>
                        <span class="ai-final-value" id="total-images">0</span>
                    </div>
                </div>
                
                <div class="ai-final-buttons">
                    <button class="ai-final-btn export" id="export-json">📄 导出JSON</button>
                    <button class="ai-final-btn export" id="export-csv">📊 导出CSV</button>
                    <button class="ai-final-btn" id="view-sessions">📋 查看历史</button>
                    <button class="ai-final-btn" id="clear-all">🗑️ 清空</button>
                </div>
                
                <div class="ai-final-section" id="tasks-list" style="display: none;">
                    <h4 class="ai-final-section-title">📋 最近会话</h4>
                    <div class="ai-final-tasks" id="tasks-container">
                        <!-- 任务列表会动态填充 -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        setupEventListeners();
    }

    // 设置事件监听
    function setupEventListeners() {
        document.getElementById('export-json').addEventListener('click', () => {
            exportData('json');
        });

        document.getElementById('export-csv').addEventListener('click', () => {
            exportData('csv');
        });

        document.getElementById('view-sessions').addEventListener('click', () => {
            toggleTasksList();
        });

        document.getElementById('clear-all').addEventListener('click', () => {
            if (confirm('确定要清空所有数据吗？')) {
                extractedSessions = [];
                currentTasks.clear();
                updateUI();
                showNotification('已清空', '所有数据已清空');
            }
        });
    }

    // 切换任务列表显示
    function toggleTasksList() {
        const tasksList = document.getElementById('tasks-list');
        const isVisible = tasksList.style.display !== 'none';
        
        if (isVisible) {
            tasksList.style.display = 'none';
        } else {
            tasksList.style.display = 'block';
            updateTasksList();
        }
    }

    // 更新任务列表
    function updateTasksList() {
        const container = document.getElementById('tasks-container');
        container.innerHTML = '';
        
        // 显示最近10个会话
        const recentSessions = extractedSessions.slice(-10).reverse();
        
        recentSessions.forEach(session => {
            const taskDiv = document.createElement('div');
            taskDiv.className = `ai-final-task ${session.status}`;
            
            const shortPrompt = session.prompt.length > 40 ? 
                session.prompt.substring(0, 40) + '...' : session.prompt;
            
            taskDiv.innerHTML = `
                <div style="font-weight: 600; color: #00ff88; margin-bottom: 4px;">
                    ${session.task_id.substring(0, 8)}...
                </div>
                <div style="color: #ccc; font-size: 11px; margin-bottom: 4px;">
                    ${shortPrompt}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888;">
                    <span>${session.status}</span>
                    <span>${session.images.length}张</span>
                </div>
            `;
            
            container.appendChild(taskDiv);
        });
    }

    // 设置API监控
    function setupAPIMonitoring() {
        console.log('📡 开始设置API监控...');
        
        // XMLHttpRequest监控
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._method = method;
            this._url = url;
            this._startTime = Date.now();
            
            // 只监控任务查询API
            if (url.includes('/api/services/aigc/task?') && url.includes('taskType=qwen_image')) {
                const taskId = extractTaskId(url);
                console.log(`🎯 [监控API] ${method} ${url} (任务: ${taskId})`);
            }
            
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(data) {
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4 && this.status === 200) {
                    // 只处理任务API响应
                    if (this._url.includes('/api/services/aigc/task?') && this._url.includes('taskType=qwen_image')) {
                        const responseTime = Date.now() - this._startTime;
                        try {
                            const responseData = JSON.parse(this.responseText);
                            processTaskResponse(this._url, responseData, 'XHR', responseTime);
                        } catch (error) {
                            console.log('❌ [解析错误]', error);
                        }
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
            
            // 只监控任务查询API
            if (url.includes('/api/services/aigc/task?') && url.includes('taskType=qwen_image')) {
                console.log(`🎯 [监控Fetch] ${method} ${url}`);
            }
            
            return originalFetch.apply(this, args).then(response => {
                if (response.ok && url.includes('/api/services/aigc/task?') && url.includes('taskType=qwen_image')) {
                    response.clone().text().then(text => {
                        try {
                            const responseData = JSON.parse(text);
                            processTaskResponse(url, responseData, 'Fetch', 0);
                        } catch (error) {
                            console.log('❌ [Fetch解析错误]', error);
                        }
                    });
                }
                return response;
            });
        };

        console.log('✅ API监控设置完成');
    }

    // 提取任务ID
    function extractTaskId(url) {
        const match = url.match(/taskId=([a-fA-F0-9\-]+)/);
        return match ? match[1] : null;
    }

    // 处理任务响应
    function processTaskResponse(url, responseData, source, responseTime) {
        const taskId = responseData.task_id;
        if (!taskId) {
            console.log('❌ [错误] 响应中没有task_id');
            return;
        }

        console.log(`🎉 [处理任务] ${taskId} - 状态: ${responseData.status}`);
        console.log('📋 [完整数据]', responseData);

        // 更新或创建任务记录
        const task = {
            task_id: taskId,
            task_type: responseData.task_type,
            status: responseData.status,
            params: responseData.params,
            images: responseData.data || [],
            created_at: responseData.created_at,
            source: source,
            response_time: responseTime,
            last_update: new Date().toISOString()
        };

        // 如果任务已完成且有图片，保存到会话列表
        if (responseData.status === 'completed' && task.images.length > 0) {
            const sessionData = {
                timestamp: task.created_at,
                task_id: taskId,
                prompt: task.params.prompt,
                negative_prompt: task.params.negative_prompt,
                dimensions: `${task.params.width}x${task.params.height}`,
                batch_size: task.params.batch_size,
                images: task.images,
                status: 'completed',
                task_type: task.task_type
            };

            // 检查是否已存在
            const existingIndex = extractedSessions.findIndex(s => s.task_id === taskId);
            if (existingIndex >= 0) {
                extractedSessions[existingIndex] = sessionData;
            } else {
                extractedSessions.push(sessionData);
            }

            // 显示通知
            showNotification('🎯 提取成功！', `捕获到 ${task.images.length} 张图片`);

            // 高亮页面
            highlightPage();

            // 更新状态为成功
            updateStatus('✅ 提取成功', 'success');
        } else if (responseData.status === 'processing') {
            // 更新状态为处理中
            updateStatus('⏳ 正在生成...', 'active');
        }

        // 更新当前任务显示
        updateCurrentTask(task);
        
        // 更新统计
        updateStatistics();
    }

    // 更新当前任务显示
    function updateCurrentTask(task) {
        document.getElementById('current-status').textContent = task.status;
        document.getElementById('current-prompt').textContent = 
            task.params?.prompt ? task.params.prompt.substring(0, 40) + (task.params.prompt.length > 40 ? '...' : '') : '-';
        document.getElementById('current-dimensions').textContent = 
            task.params?.width && task.params?.height ? `${task.params.width}x${task.params.height}` : '-';
        document.getElementById('current-images').textContent = `${task.images.length}张`;
    }

    // 更新状态
    function updateStatus(text, type) {
        const statusElement = document.getElementById('final-status');
        statusElement.innerHTML = `<span>${text}</span>`;
        statusElement.className = `ai-final-status ${type}`;
    }

    // 更新统计
    function updateStatistics() {
        const completedSessions = extractedSessions.filter(s => s.status === 'completed');
        const totalImages = completedSessions.reduce((sum, session) => sum + session.images.length, 0);
        
        document.getElementById('total-sessions').textContent = extractedSessions.length;
        document.getElementById('completed-sessions').textContent = completedSessions.length;
        document.getElementById('total-images').textContent = totalImages;
    }

    // 高亮页面
    function highlightPage() {
        document.body.style.transition = 'all 0.5s ease';
        document.body.style.boxShadow = 'inset 0 0 0 4px #00ff88';
        document.body.style.backgroundColor = 'rgba(0, 255, 136, 0.05)';
        
        setTimeout(() => {
            document.body.style.boxShadow = '';
            document.body.style.backgroundColor = '';
        }, 2000);
    }

    // 导出数据
    function exportData(format) {
        const completedSessions = extractedSessions.filter(s => s.status === 'completed');
        
        if (completedSessions.length === 0) {
            showNotification('警告', '没有可导出的数据');
            return;
        }

        let content = '';
        let filename = '';
        const timestamp = Date.now();

        if (format === 'json') {
            content = JSON.stringify(completedSessions, null, 2);
            filename = `ai-images-${timestamp}.json`;
        } else if (format === 'csv') {
            const headers = ['timestamp', 'task_id', 'prompt', 'dimensions', 'batch_size', 'negative_prompt', 'image_urls'];
            const rows = [headers.join(',')];
            
            completedSessions.forEach(data => {
                const imageUrlsStr = data.images.join('|');
                const row = [
                    data.timestamp,
                    `"${data.task_id}"`,
                    `"${data.prompt.replace(/"/g, '""')}"`,
                    data.dimensions,
                    data.batch_size,
                    `"${data.negative_prompt.replace(/"/g, '""')}"`,
                    `"${imageUrlsStr.replace(/"/g, '""')}"`
                ];
                rows.push(row.join(','));
            });
            
            content = rows.join('\n');
            filename = `ai-images-${timestamp}.csv`;
        }

        // 下载文件
        const blob = new Blob([content], { 
            type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        showNotification('成功', `已导出 ${completedSessions.length} 个会话`);
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