// ==UserScript==
// @name         AI Image Generator - freeaiimage.net 调试版本
// @namespace    http://tampermonkey.net/
// @version      3.2-debug
// @description  专门用于调试freeaiimage.net的API调用，支持所有域名
// @author       AI助手
// @match        https://freeaiimage.net/*
// @match        https://freeaiimage.net/zh/*
// @grant        GM_notification
// @grant        GM_log
// ==/UserScript==

(function() {
    'use strict';

    // 立即开始调试
    function startDebug() {
        console.log('🔧 === AI图片生成器调试版本启动 ===');
        console.log('🚀 开始设置监控...');
        console.log(`📱 当前页面: ${window.location.href}`);
        console.log(`🕒 启动时间: ${new Date().toLocaleString()}`);
        
        // 设置页面标题提示
        document.title = '🔍 [调试中] ' + document.title;
        
        // 立即显示通知
        setTimeout(() => {
            GM_notification({
                title: '🔧 调试版本已启动',
                message: '请打开浏览器控制台查看详细信息',
                timeout: 5000
            });
        }, 500);
    }

    // 启动所有监控
    function setupMonitors() {
        // 监控XMLHttpRequest
        setupXHRMonitoring();
        
        // 监控fetch请求
        setupFetchMonitoring();
        
        // 监控页面元素变化
        setupElementMonitoring();
        
        console.log('✅ 所有监控已设置完成');
    }

    // XMLHttpRequest监控
    function setupXHRMonitoring() {
        console.log('📡 设置XMLHttpRequest监控...');
        
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._startTime = Date.now();
            this._method = method;
            this._url = url;
            this._requestHeaders = {};
            
            console.log(`📤 [XHR请求] ${method} ${url}`);
            
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            this._requestHeaders[name] = value;
            return originalSetRequestHeader.apply(this, arguments);
        };

        // 添加setRequestHeader到原型
        if (!XMLHttpRequest.prototype.setRequestHeader) {
            XMLHttpRequest.prototype.setRequestHeader = function() {};
        }

        XMLHttpRequest.prototype.send = function(data) {
            // 显示请求数据
            if (data) {
                try {
                    if (typeof data === 'string') {
                        console.log(`📤 [XHR载荷] ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
                    }
                } catch (e) {
                    console.log(`📤 [XHR载荷] ${typeof data}`);
                }
            }

            // 监听响应
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4) {
                    const responseTime = Date.now() - this._startTime;
                    console.log(`📥 [XHR响应] ${this._method} ${this._url} (${responseTime}ms) Status: ${this.status}`);
                    
                    if (this.status >= 200 && this.status < 300) {
                        console.log(`✅ [XHR成功] 正在解析响应...`);
                        try {
                            const responseData = JSON.parse(this.responseText);
                            console.log('📋 [XHR响应数据]', responseData);
                            
                            // 检查是否为任务相关响应
                            if (isTaskResponse(responseData)) {
                                console.log('🎯 [匹配] 检测到任务相关响应！');
                                handleTaskData(this._url, responseData, 'XHR');
                            }
                        } catch (e) {
                            console.log(`⚠️ [XHR] 响应不是JSON格式`);
                        }
                    } else {
                        console.log(`❌ [XHR错误] ${this.status} ${this.statusText}`);
                    }
                }
            });

            return originalSend.apply(this, arguments);
        };

        console.log('✅ XMLHttpRequest监控设置完成');
    }

    // Fetch监控
    function setupFetchMonitoring() {
        console.log('📡 设置Fetch监控...');
        
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options] = args;
            const method = options?.method || 'GET';
            
            console.log(`📤 [Fetch请求] ${method} ${url}`);
            
            if (options?.body) {
                console.log(`📤 [Fetch载荷] ${options.body.substring(0, 200)}${options.body.length > 200 ? '...' : ''}`);
            }
            
            const startTime = Date.now();
            return originalFetch.apply(this, args)
                .then(response => {
                    const responseTime = Date.now() - startTime;
                    console.log(`📥 [Fetch响应] ${method} ${url} (${responseTime}ms) Status: ${response.status}`);
                    
                    if (response.ok) {
                        console.log(`✅ [Fetch成功] 正在解析响应...`);
                        response.clone().text().then(text => {
                            try {
                                const responseData = JSON.parse(text);
                                console.log('📋 [Fetch响应数据]', responseData);
                                
                                // 检查是否为任务相关响应
                                if (isTaskResponse(responseData)) {
                                    console.log('🎯 [匹配] 检测到任务相关响应！');
                                    handleTaskData(url, responseData, 'Fetch');
                                }
                            } catch (e) {
                                console.log(`⚠️ [Fetch] 响应不是JSON格式`);
                            }
                        });
                    } else {
                        console.log(`❌ [Fetch错误] ${response.status} ${response.statusText}`);
                    }
                    
                    return response;
                })
                .catch(error => {
                    console.log(`❌ [Fetch异常] ${error.message}`);
                    throw error;
                });
        };

        console.log('✅ Fetch监控设置完成');
    }

    // 页面元素监控
    function setupElementMonitoring() {
        console.log('📡 设置页面元素监控...');
        
        let promptInputs = [];
        let generationButtons = [];
        
        function findElements() {
            // 查找提示词输入框
            const selectors = [
                'input[name*="prompt"]',
                'textarea[placeholder*="提示"]',
                'textarea[placeholder*="prompt"]',
                'input[placeholder*="描述"]',
                '.prompt-input',
                '#prompt'
            ];
            
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (!promptInputs.includes(el)) {
                        promptInputs.push(el);
                        console.log(`🎯 [找到提示词输入框] ${selector}:`, el);
                        
                        // 监听输入变化
                        el.addEventListener('input', function() {
                            console.log(`✏️ [用户输入] ${this.value.substring(0, 50)}${this.value.length > 50 ? '...' : ''}`);
                        });
                    }
                });
            });
            
            // 查找生成按钮
            const buttonSelectors = [
                'button:contains("生成")',
                'button:contains("生成")',
                '.generate-btn',
                '#generate'
            ];
            
            document.querySelectorAll('button').forEach(button => {
                const text = button.textContent.toLowerCase();
                if ((text.includes('生成') || text.includes('generate')) && !generationButtons.includes(button)) {
                    generationButtons.push(button);
                    console.log(`🎯 [找到生成按钮] "${button.textContent}":`, button);
                    
                    // 监听点击
                    button.addEventListener('click', function() {
                        console.log(`🖱️ [生成按钮点击] "${this.textContent}"`);
                        
                        // 查找当前输入的提示词
                        let prompt = '';
                        promptInputs.forEach(input => {
                            if (input.value.trim()) {
                                prompt = input.value.trim();
                            }
                        });
                        
                        console.log(`📝 [当前提示词] ${prompt}`);
                    });
                }
            });
        }
        
        // 立即检查
        findElements();
        
        // 监听DOM变化
        const observer = new MutationObserver(function(mutations) {
            console.log('🔄 [页面变化] DOM元素已更新，重新查找...');
            findElements();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });
        
        // 定期检查
        setInterval(findElements, 2000);
        
        console.log('✅ 页面元素监控设置完成');
    }

    // 检查是否为任务相关响应
    function isTaskResponse(responseData) {
        if (!responseData || typeof responseData !== 'object') {
            return false;
        }
        
        // 检查是否有任务相关字段
        const hasTaskId = responseData.task_id || responseData.taskid || 
                         (responseData.params && responseData.params.task_id);
        
        const hasTaskType = responseData.task_type || responseData.tasktype || 
                           (responseData.params && responseData.params.task_type);
        
        const hasStatus = responseData.status;
        
        const hasImages = responseData.data && Array.isArray(responseData.data) && 
                         responseData.data.length > 0;
        
        console.log(`🔍 [分析响应] taskId: ${!!hasTaskId}, taskType: ${!!hasTaskType}, status: ${!!hasStatus}, images: ${!!hasImages}`);
        
        return hasTaskId || (hasTaskType && hasStatus) || hasImages;
    }

    // 处理任务数据
    function handleTaskData(url, responseData, source) {
        console.log(`🎉 [成功捕获] 来源: ${source}, URL: ${url}`);
        console.log('📊 [完整数据]', JSON.stringify(responseData, null, 2));
        
        // 显示成功通知
        GM_notification({
            title: `🎯 检测到API数据！`,
            message: `来源: ${source}`,
            timeout: 3000
        });
        
        // 高亮显示页面
        document.body.style.boxShadow = '0 0 20px 5px #4ade80 inset';
        setTimeout(() => {
            document.body.style.boxShadow = '';
        }, 3000);
    }

    // 辅助函数: 检查元素内容
    function addContainsSupport() {
        // 为document.querySelector添加:contains支持
        if (!document.querySelectorAll(':contains').length) {
            document.querySelectorAll = (function(originalQuerySelectorAll) {
                return function(selector) {
                    if (selector.includes(':contains')) {
                        const match = selector.match(/(.*):contains\("([^"]+)"\)/);
                        if (match) {
                            const baseSelector = match[1];
                            const text = match[2];
                            const elements = originalQuerySelectorAll.call(this, baseSelector);
                            return Array.prototype.filter.call(elements, function(el) {
                                return el.textContent.includes(text);
                            });
                        }
                    }
                    return originalQuerySelectorAll.call(this, selector);
                };
            })(document.querySelectorAll);
        }
    }

    // 启动
    function init() {
        console.log('🚀 === 开始初始化调试器 ===');
        
        // 添加contains支持
        addContainsSupport();
        
        // 立即开始调试
        startDebug();
        
        // 延迟设置监控
        setTimeout(() => {
            setupMonitors();
        }, 100);
        
        // 提示用户下一步操作
        setTimeout(() => {
            console.log('');
            console.log('📋 === 使用说明 ===');
            console.log('1. 请在网站中输入提示词并点击生成');
            console.log('2. 所有网络请求都会在控制台显示');
            console.log('3. 如果检测到任务相关数据，会高亮页面');
            console.log('4. 检查是否有 "🎯 [匹配] 检测到任务相关响应！" 消息');
            console.log('====================');
        }, 2000);
    }

    // 立即启动
    init();
})();