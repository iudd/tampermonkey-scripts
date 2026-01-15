// ==UserScript==
// @name         DuckDuckGo Chat API 监控器
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  监控 DuckDuckGo 聊天功能的所有 API 调用，提取完整的接口、token、session 等信息
// @author       iudd
// @match        https://duckduckgo.com/*
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    if (window.ddgChatMonitorLoaded) return;
    window.ddgChatMonitorLoaded = true;

    var apiList = [];
    var isMonitoring = false;

    // 创建浮动按钮
    var floatBtn = document.createElement('button');
    floatBtn.id = 'ddg-chat-monitor-float-btn';
    floatBtn.textContent = '🦆';
    Object.assign(floatBtn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #de5833 0%, #ff6b35 100%)',
        color: 'white',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        zIndex: '2147483646',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    });
    document.body.appendChild(floatBtn);

    // 创建遮罩层
    var overlay = document.createElement('div');
    overlay.id = 'ddg-chat-monitor-overlay';
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

    // 创建操作面板
    var panel = document.createElement('div');
    panel.id = 'ddg-chat-monitor-panel';
    Object.assign(panel.style, {
        backgroundColor: '#ffffff',
        width: '90%',
        maxWidth: '900px',
        maxHeight: '85vh',
        overflowY: 'auto',
        borderRadius: '20px',
        padding: '30px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)'
    });

    // 标题
    var title = document.createElement('h1');
    title.textContent = 'DuckDuckGo Chat API 监控器';
    Object.assign(title.style, {
        fontSize: '28px',
        fontWeight: 'bold',
        textAlign: 'center',
        margin: '0 0 30px 0',
        color: '#333',
        lineHeight: '1.3'
    });

    // 按钮容器
    var btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginBottom: '20px'
    });

    // 开始监控按钮
    var startBtn = document.createElement('button');
    startBtn.textContent = '🚀 开始监控';
    Object.assign(startBtn.style, {
        width: '100%',
        height: '56px',
        background: 'linear-gradient(135deg, #de5833 0%, #ff6b35 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '22px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(222, 88, 51, 0.3)'
    });

    // 停止监控按钮
    var stopBtn = document.createElement('button');
    stopBtn.textContent = '🛑 停止监控';
    Object.assign(stopBtn.style, {
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

    // 复制所有按钮
    var copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 复制所有 API';
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
        boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)'
    });

    // 清空按钮
    var clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑️ 清空列表';
    Object.assign(clearBtn.style, {
        width: '100%',
        height: '50px',
        background: 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '20px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(108, 117, 125, 0.3)'
    });

    // 关闭按钮
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ 关闭';
    Object.assign(closeBtn.style, {
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

    // 添加按钮到容器
    btnContainer.appendChild(startBtn);
    btnContainer.appendChild(stopBtn);
    btnContainer.appendChild(copyBtn);
    btnContainer.appendChild(clearBtn);
    btnContainer.appendChild(closeBtn);

    // 统计信息
    var statsDiv = document.createElement('div');
    Object.assign(statsDiv.style, {
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        fontSize: '18px'
    });
    statsDiv.innerHTML = '<span>📊 总数: <strong id="total-count">0</strong></span>' +
                        '<span>✅ 成功: <strong id="success-count">0</strong></span>' +
                        '<span>❌ 失败: <strong id="fail-count">0</strong></span>';

    // API 列表区域
    var listContainer = document.createElement('div');
    listContainer.id = 'api-list-container';
    Object.assign(listContainer.style, {
        maxHeight: '400px',
        overflowY: 'auto',
        border: '2px solid #dee2e6',
        borderRadius: '12px',
        padding: '15px',
        backgroundColor: '#f8f9fa'
    });

    // 组装面板
    panel.appendChild(title);
    panel.appendChild(btnContainer);
    panel.appendChild(statsDiv);
    panel.appendChild(listContainer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // 显示/隐藏遮罩
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

    // 更新统计
    function updateStats() {
        document.getElementById('total-count').textContent = apiList.length;
        var successCount = apiList.filter(function(api) {
            return api.response && api.response.status >= 200 && api.response.status < 300;
        }).length;
        var failCount = apiList.length - successCount;
        document.getElementById('success-count').textContent = successCount;
        document.getElementById('fail-count').textContent = failCount;
    }

    // 提取所有 headers
    function extractAllHeaders() {
        var headers = {};
        
        // 从 document.cookie 提取
        if (document.cookie) {
            headers['Cookie'] = document.cookie;
        }
        
        // 从 localStorage 提取
        var localStorageData = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            localStorageData[key] = localStorage.getItem(key);
        }
        if (Object.keys(localStorageData).length > 0) {
            headers['LocalStorage'] = localStorageData;
        }
        
        // 从 sessionStorage 提取
        var sessionStorageData = {};
        for (var j = 0; j < sessionStorage.length; j++) {
            var key = sessionStorage.key(j);
            sessionStorageData[key] = sessionStorage.getItem(key);
        }
        if (Object.keys(sessionStorageData).length > 0) {
            headers['SessionStorage'] = sessionStorageData;
        }
        
        return headers;
    }

    // 添加 API 到列表
    function addApiToList(api) {
        var apiDiv = document.createElement('div');
        Object.assign(apiDiv.style, {
            marginBottom: '15px',
            padding: '15px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            fontSize: '14px'
        });

        var methodColor = api.method === 'GET' ? '#28a745' : '#007bff';
        var statusColor = (api.response && api.response.status >= 200 && api.response.status < 300) ? '#28a745' : '#dc3545';

        apiDiv.innerHTML = '<div style="margin-bottom: 8px;"><strong>' +
                          '<span style="color: ' + methodColor + '; background: #f8f9fa; padding: 2px 8px; border-radius: 4px;">' + api.method + '</span> ' +
                          '<span style="color: #333;">' + api.url + '</span></strong></div>' +
                          '<div style="color: #666; font-size: 12px;">' +
                          '状态: <span style="color: ' + statusColor + ';">' + (api.response ? api.response.status : 'pending') + '</span> | ' +
                          '时间: ' + new Date(api.timestamp).toLocaleTimeString() +
                          '</div>';

        // 显示 Headers
        if (api.headers && Object.keys(api.headers).length > 0) {
            var headersDiv = document.createElement('div');
            Object.assign(headersDiv.style, {
                marginTop: '8px',
                padding: '8px',
                backgroundColor: '#fff3cd',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#856404',
                overflow: 'auto',
                maxHeight: '80px'
            });
            headersDiv.innerHTML = '<strong>📋 Headers:</strong><br>' + 
                                  JSON.stringify(api.headers, null, 2).substring(0, 300) + '...';
            apiDiv.appendChild(headersDiv);
        }

        // 显示 Body
        if (api.body) {
            var bodyPreview = document.createElement('div');
            Object.assign(bodyPreview.style, {
                marginTop: '8px',
                padding: '8px',
                backgroundColor: '#d1ecf1',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#0c5460',
                overflow: 'auto',
                maxHeight: '100px'
            });
            bodyPreview.innerHTML = '<strong>📦 Body:</strong><br>' + 
                                   JSON.stringify(api.body, null, 2).substring(0, 300) + '...';
            apiDiv.appendChild(bodyPreview);
        }

        listContainer.insertBefore(apiDiv, listContainer.firstChild);
    }

    // 分类 API
    function categorizeApi(api) {
        var url = api.url.toLowerCase();
        var body = JSON.stringify(api.body || {}).toLowerCase();

        if (url.includes('chat') || url.includes('message') || url.includes('conversation') || 
            url.includes('duckduckgo.com/duckchat') || url.includes('vqd') || 
            body.includes('message') || body.includes('prompt')) {
            return '聊天';
        } else if (url.includes('model') || url.includes('models')) {
            return '模型';
        } else if (url.includes('auth') || url.includes('token') || url.includes('session')) {
            return '认证';
        } else {
            return '其他';
        }
    }

    // 拦截 fetch
    var originalFetch = window.fetch;
    window.fetch = function() {
        var url = arguments[0];
        var options = arguments[1] || {};
        var startTime = Date.now();

        return originalFetch.apply(this, arguments).then(function(response) {
            if (!isMonitoring) return response;

            var api = {
                timestamp: new Date().toISOString(),
                url: typeof url === 'string' ? url : url.url,
                method: (options.method || 'GET').toUpperCase(),
                headers: extractAllHeaders(),
                requestHeaders: options.headers || {},
                body: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : null,
                response: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                },
                category: '',
                duration: Date.now() - startTime
            };

            // 尝试读取响应体
            var clonedResponse = response.clone();
            clonedResponse.text().then(function(text) {
                try {
                    api.response.body = JSON.parse(text);
                } catch (e) {
                    api.response.body = text.substring(0, 500);
                }
                api.category = categorizeApi(api);
                apiList.push(api);
                addApiToList(api);
                updateStats();
            }).catch(function() {
                api.category = categorizeApi(api);
                apiList.push(api);
                addApiToList(api);
                updateStats();
            });

            return response;
        });
    };

    // 拦截 XMLHttpRequest
    var originalOpen = XMLHttpRequest.prototype.open;
    var originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._method = method;
        this._url = url;
        this._startTime = Date.now();
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        var xhr = this;
        
        try {
            xhr._body = body ? (typeof body === 'string' ? JSON.parse(body) : body) : null;
        } catch (e) {
            xhr._body = body;
        }

        xhr.addEventListener('load', function() {
            if (!isMonitoring) return;

            var api = {
                timestamp: new Date().toISOString(),
                url: xhr._url,
                method: xhr._method.toUpperCase(),
                headers: extractAllHeaders(),
                requestHeaders: {},
                body: xhr._body,
                response: {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    body: xhr.responseText ? JSON.parse(xhr.responseText) : null
                },
                category: '',
                duration: Date.now() - xhr._startTime
            };

            api.category = categorizeApi(api);
            apiList.push(api);
            addApiToList(api);
            updateStats();
        });

        return originalSend.apply(this, arguments);
    };

    // 开始监控
    startBtn.addEventListener('click', function() {
        isMonitoring = true;
        startBtn.textContent = '🚀 监控中...';
        startBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
        
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                text: '已开始监控 API',
                title: 'DuckDuckGo Chat API 监控器',
                timeout: 3000
            });
        }
    });

    // 停止监控
    stopBtn.addEventListener('click', function() {
        isMonitoring = false;
        startBtn.textContent = '🚀 开始监控';
        startBtn.style.background = 'linear-gradient(135deg, #de5833 0%, #ff6b35 100%)';
        
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                text: '已停止监控',
                title: 'DuckDuckGo Chat API 监控器',
                timeout: 3000
            });
        }
    });

    // 复制所有
    copyBtn.addEventListener('click', function() {
        // 准备完整的 JSON 数据
        var exportData = {
            metadata: {
                exportTime: new Date().toISOString(),
                totalApis: apiList.length,
                baseUrl: window.location.href,
                userAgent: navigator.userAgent
            },
            sessionInfo: {
                cookies: document.cookie,
                localStorage: {},
                sessionStorage: {}
            },
            apis: apiList
        };

        // 提取 localStorage
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            exportData.sessionInfo.localStorage[key] = localStorage.getItem(key);
        }

        // 提取 sessionStorage
        for (var j = 0; j < sessionStorage.length; j++) {
            var key = sessionStorage.key(j);
            exportData.sessionInfo.sessionStorage[key] = sessionStorage.getItem(key);
        }

        var jsonStr = JSON.stringify(exportData, null, 2);
        
        try {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(jsonStr);
                copyBtn.textContent = '✅ 已复制！';
                setTimeout(function() {
                    copyBtn.textContent = '📋 复制所有 API';
                }, 2000);
            } else {
                var textarea = document.createElement('textarea');
                textarea.value = jsonStr;
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
                    copyBtn.textContent = '📋 复制所有 API';
                }, 2000);
            }
        } catch (err) {
            alert('复制失败，请手动复制');
        }
    });

    // 清空列表
    clearBtn.addEventListener('click', function() {
        apiList = [];
        listContainer.innerHTML = '';
        updateStats();
        
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                text: '已清空列表',
                title: 'DuckDuckGo Chat API 监控器',
                timeout: 3000
            });
        }
    });

    // 自动显示面板
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

    console.log('DuckDuckGo Chat API 监控器已加载');
})();
