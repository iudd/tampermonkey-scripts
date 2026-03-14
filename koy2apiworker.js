/**
 * =================================================================================
 * 项目: Koy Nano Pro - 2API (Gemini 3 Pro 标准化模型列表版)
 * 更新: 
 * 1. 增加 /v1/models 接口，对外输出 11 种动态分辨率模型组合，完美适配各类客户端。
 * 2. 增强后端路由解析系统。
 * =================================================================================
 */

const CONFIG = {
    PROJECT_NAME: "🍌 Nano Pro - Gemini 3 Pro 控制台",
    PROJECT_VERSION: "4.1-ModelsList",
    API_MASTER_KEY: "1", // 你的密码

    ORIGIN: "https://koy.xx.kg",
    GEN_URL: "https://koy.xx.kg/_internal/generate",
    
    COOKIE: "__dtsu=4C301773477094AAA621DA87EAAB05B8; _pubcid=8d2375ce-4fd0-4c00-b7bb-738ed58247a5; _cc_id=bf9240954d47a800fb3eef08f0630de8; panoramaId_expiry=1774081910576; panoramaId=754e1c6169d619573859b56d3192185ca02c7435cfadb7242224f5ba0573c252; panoramaIdType=panoDevice",
    UA: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0"
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') return handleCORS();
        
        // 核心接口路由
        if (url.pathname === '/v1/models') return handleModels(request);
        if (url.pathname === '/v1/chat/completions') return handleAPI(request);
        
        return handleUI(request);
    }
};

/**
 * 接口：输出 11 种模型列表 (适配标准 OpenAI 客户端调用)
 */
async function handleModels(request) {
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${CONFIG.API_MASTER_KEY}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const modelsList = [
        "gemini3pro-1K-1:1",
        "gemini3pro-1K-3:4",
        "gemini3pro-1K-9:16",
        "gemini3pro-1K-16:9",
        "gemini3pro-1K-21:9",
        "gemini3pro-2K-1:1",
        "gemini3pro-2K-9:16",
        "gemini3pro-2K-16:9",
        "gemini3pro-4K-1:1",
        "gemini3pro-4K-9:16",
        "gemini3pro-4K-16:9"
    ];

    const data = modelsList.map(id => ({
        id: id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "koy-nano-pro"
    }));

    return new Response(JSON.stringify({ object: "list", data: data }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() }
    });
}

/**
 * 后端核心逻辑：智能模型解析与 Payload 构建
 */
async function handleAPI(request) {
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${CONFIG.API_MASTER_KEY}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const body = await request.json();
        const prompt = body.messages ? body.messages[body.messages.length - 1].content : body.prompt;

        // ==========================================
        // 智能模型路由解析 (匹配 11 种模型格式)
        // ==========================================
        const reqModel = (body.model || "").toLowerCase();
        let sizeBase = 1024; // 默认 1K
        if (reqModel.includes("4k")) sizeBase = 4320;
        else if (reqModel.includes("2k")) sizeBase = 2048;

        let ratio = "1:1"; // 默认比例
        if (reqModel.includes("3:4")) ratio = "3:4";
        else if (reqModel.includes("9:16")) ratio = "9:16";
        else if (reqModel.includes("16:9")) ratio = "16:9";
        else if (reqModel.includes("21:9")) ratio = "21:9";

        // 真实宽高计算引擎
        let calcW = sizeBase;
        let calcH = sizeBase;
        switch(ratio) {
            case "1:1": calcW = sizeBase; calcH = sizeBase; break;
            case "3:4": calcW = Math.floor(sizeBase * 0.75); calcH = sizeBase; break;
            case "9:16": 
                calcW = sizeBase === 4320 ? 4320 : Math.floor(sizeBase * 0.5625);
                calcH = sizeBase === 4320 ? 7680 : sizeBase;
                break;
            case "16:9": 
                calcW = sizeBase === 4320 ? 7680 : sizeBase;
                calcH = sizeBase === 4320 ? 4320 : Math.floor(sizeBase * 0.5625);
                break;
            case "21:9": calcW = sizeBase; calcH = Math.floor(sizeBase * (9/21)); break;
        }

        // 构建发给 Koy 的 Payload
        const payload = {
            "prompt": prompt,
            "negative_prompt": body.negative_prompt || "nsfw, ugly, text, watermark, low quality, bad anatomy",
            "provider": body.provider || "nonpon", // 优先使用不超时的 nonpon 通道
            "model": "gemini-3.1-flash-image-preview", // Koy 服务器需要的硬编码模型
            "width": body.width || calcW,
            "height": body.height || calcH,
            "style": body.style || "none",
            "seed": body.seed !== undefined ? body.seed : -1,
            "steps": body.steps || 30,
            "guidance": body.guidance !== undefined ? body.guidance : 7.5,
            "quality_mode": body.quality_mode || "ultra",
            "n": 1,
            "nologo": body.nologo !== undefined ? body.nologo : true,
            "auto_optimize": true,
            "auto_hd": true,
            "language": "zh"
        };

        const headers = {
            "accept": "*/*",
            "content-type": "application/json",
            "cookie": CONFIG.COOKIE,
            "origin": CONFIG.ORIGIN,
            "referer": `${CONFIG.ORIGIN}/nano`,
            "sec-ch-ua": '"Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "user-agent": CONFIG.UA,
            "x-source": "nano-page"
        };

        const response = await fetch(CONFIG.GEN_URL, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });

        // 拦截解析 PNG 二进制流
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("image/")) {
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Image = btoa(binary);
            const dataUrl = `data:${contentType};base64,${base64Image}`;

            return new Response(JSON.stringify({
                id: `chatcmpl-${Date.now()}`,
                object: "chat.completion",
                choices: [{ message: { role: "assistant", content: `![Generated Image](${dataUrl})` }, finish_reason: "stop" }]
            }), { headers: { "Content-Type": "application/json", ...corsHeaders() } });
        }

        // 拦截解析 JSON
        const data = await response.text();
        try {
            const jsonData = JSON.parse(data);
            if (jsonData.error) throw new Error(JSON.stringify(jsonData.error));
            const imageUrl = jsonData.url || (jsonData.images && jsonData.images[0]);
            
            return new Response(JSON.stringify({
                id: `chatcmpl-${Date.now()}`,
                object: "chat.completion",
                choices: [{ message: { role: "assistant", content: `![Generated Image](${imageUrl})` }, finish_reason: "stop" }]
            }), { headers: { "Content-Type": "application/json", ...corsHeaders() } });
        } catch (e) {
            throw new Error(`上游返回异常: ${data.substring(0, 100)}`);
        }

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders() });
    }
}

/**
 * 全参数驾驶舱 UI (含虚拟模型触发逻辑)
 */
function handleUI(request) {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${CONFIG.PROJECT_NAME}</title>
    <style>
        :root {
            --bg: #0D0D0D; --panel: #161616; --border: #262626; --text: #E5E5E5;
            --primary: #F5A623; --success: #4ADE80; --error: #F87171;
        }
        body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; height: 100vh; display: flex; overflow: hidden; }
        .sidebar { width: 440px; background: var(--panel); border-right: 1px solid var(--border); padding: 24px; display: flex; flex-direction: column; overflow-y: auto; }
        .main { flex: 1; display: flex; flex-direction: column; padding: 24px; background: #000; position: relative; }
        
        .card { background: #1F1F1F; padding: 16px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 16px; }
        .label { font-size: 11px; color: #737373; margin-bottom: 8px; display: block; font-weight: bold; text-transform: uppercase; }
        
        input, select, textarea { width: 100%; background: #262626; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 6px; margin-bottom: 10px; box-sizing: border-box; font-family: inherit; font-size: 13px; }
        select:disabled { opacity: 0.5; cursor: not-allowed; }
        textarea:focus, input:focus, select:focus { border-color: var(--primary); outline: none; }
        button { width: 100%; padding: 12px; background: var(--primary); color: #000; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 14px; margin-top: 10px; }
        button:hover { filter: brightness(1.1); box-shadow: 0 0 10px rgba(245, 166, 35, 0.4); }
        button:disabled { background: #444; color: #888; cursor: not-allowed; box-shadow: none; }

        .row { display: flex; gap: 10px; }
        .row > div { flex: 1; }
        .checkbox-group { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 10px; color: #aaa; }
        .checkbox-group input { width: auto; margin: 0; }

        .terminal { flex: 1; background: #050505; border: 1px solid var(--border); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; position: relative; }
        .terminal-header { background: #1A1A1A; padding: 10px 20px; border-bottom: 1px solid var(--border); font-size: 12px; display: flex; justify-content: space-between; color: var(--primary); font-weight: bold; }
        .output { flex: 1; padding: 20px; overflow-y: auto; font-family: monospace; font-size: 13px; line-height: 1.6; }
        .log-item { margin-bottom: 6px; border-left: 2px solid #333; padding-left: 10px; }
        .log-DEBUG { color: #888; }
        .log-INFO { color: #00FF41; }
        .log-ERROR { color: var(--error); }
        
        .preview-container { padding: 20px; text-align: center; background: #0A0A0A; border-top: 1px solid var(--border); display: none; }
        .result-img { max-width: 100%; max-height: 55vh; border-radius: 8px; border: 1px solid var(--primary); box-shadow: 0 0 20px rgba(245, 166, 35, 0.15); }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2 style="color:var(--primary); margin-top:0; font-size: 20px;">🍌 Nano Pro <br><small style="color:#888; font-size:12px;">Gemini 3.1 API Router</small></h2>
        
        <div class="card">
            <span class="label">API 通道与基础配置</span>
            <select id="provider">
                <option value="nonpon" selected>🐢 Nonpon API (推荐防超时)</option>
                <option value="supabase">🚀 Supabase API (画质好但易超时)</option>
            </select>
            <div class="row">
                <div>
                    <span class="label">尺寸质量</span>
                    <select id="size">
                        <option value="1024">1K (快速)</option>
                        <option value="2048">2K (超清)</option>
                        <option value="4320">4K (原画)</option>
                    </select>
                </div>
                <div>
                    <span class="label">画面比例</span>
                    <select id="aspect_ratio">
                        <option value="1:1">1:1 (头像/方图)</option>
                        <option value="3:4">3:4 (仅1K可用)</option>
                        <option value="9:16">9:16 (手机壁纸)</option>
                        <option value="16:9">16:9 (电脑横屏)</option>
                        <option value="21:9">21:9 (仅1K可用)</option>
                    </select>
                </div>
            </div>
            <div class="row">
                <div>
                    <span class="label">生成模式</span>
                    <select id="quality">
                        <option value="economy">Economy (经济)</option>
                        <option value="standard">Standard (标准)</option>
                        <option value="ultra" selected>Ultra (极致)</option>
                    </select>
                </div>
                <div>
                    <span class="label">画面风格</span>
                    <select id="style">
                        <option value="none" selected>无风格 (None)</option>
                        <option value="cinematic">电影质感 (Cinematic)</option>
                        <option value="anime">二次元 (Anime)</option>
                        <option value="manga">漫画 (Manga)</option>
                        <option value="photographic">真实摄影 (Photo)</option>
                        <option value="cyberpunk">赛博朋克 (Cyberpunk)</option>
                        <option value="pixel_art">像素风 (Pixel Art)</option>
                        <option value="watercolor">水彩 (Watercolor)</option>
                        <option value="sketch">素描 (Sketch)</option>
                        <option value="3d-render">3D渲染 (3D Render)</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="card">
            <span class="label">高级参数 (Advanced)</span>
            <div class="row">
                <div>
                    <span class="label" title="迭代步数">Steps</span>
                    <input type="number" id="steps" value="30" min="1" max="50">
                </div>
                <div>
                    <span class="label" title="提示词引导系数">Guidance</span>
                    <input type="number" id="guidance" value="7.5" step="0.1" min="1" max="20">
                </div>
                <div>
                    <span class="label" title="随机种子">Seed (-1为随机)</span>
                    <input type="number" id="seed" value="-1">
                </div>
            </div>
            <div class="checkbox-group">
                <input type="checkbox" id="nologo" checked> <label for="nologo">去除水印 (No Logo)</label>
            </div>
            <span class="label">反向提示词 (Negative Prompt)</span>
            <textarea id="negative_prompt" rows="2">nsfw, ugly, text, watermark, low quality, bad anatomy</textarea>
        </div>

        <div class="card" style="border-color: var(--primary);">
            <span class="label" style="color: var(--primary);">PROMPT 提示词</span>
            <textarea id="prompt" rows="3" placeholder="例如：大熊猫女神在竹林中喝茶，漫画风格，8k..."></textarea>
            <button id="genBtn">⚡ 立即生成 (EXECUTE)</button>
        </div>
    </div>

    <div class="main">
        <div class="terminal">
            <div class="terminal-header">
                <span>SYSTEM TERMINAL</span>
                <span id="status">IDLE</span>
            </div>
            <div class="output" id="output">
                <div style="color:#555">>>> 🍌 Nano Pro 系统已就绪...<br>>> 已开放 /v1/models 接口输出 11 种标准模型。<br>>> 支持第三方软件下拉选择尺寸画幅。</div>
            </div>
            <div class="preview-container" id="preview-box"></div>
        </div>
    </div>

    <script>
        const API_KEY = "${CONFIG.API_MASTER_KEY}";

        // UI 联动逻辑：2K/4K 禁用 3:4 和 21:9
        document.getElementById('size').addEventListener('change', function() {
            const size = this.value;
            const ratioSelect = document.getElementById('aspect_ratio');
            const isHighRes = size === '2048' || size === '4320';
            
            for(let opt of ratioSelect.options) {
                if(opt.value === '3:4' || opt.value === '21:9') {
                    opt.disabled = isHighRes;
                    if(isHighRes && ratioSelect.value === opt.value) {
                        ratioSelect.value = '1:1'; 
                    }
                }
            }
        });

        function addLog(tag, msg) {
            const out = document.getElementById('output');
            const div = document.createElement('div');
            div.className = 'log-item log-' + tag;
            div.innerHTML = \`[\${new Date().toLocaleTimeString()}] [\${tag}] \${msg}\`;
            out.appendChild(div);
            out.scrollTop = out.scrollHeight;
        }

        document.getElementById('genBtn').onclick = async () => {
            const btn = document.getElementById('genBtn');
            const status = document.getElementById('status');
            const previewBox = document.getElementById('preview-box');
            
            const prompt = document.getElementById('prompt').value;
            if (!prompt) return alert("请输入提示词！");

            // 获取 UI 参数
            const provider = document.getElementById('provider').value;
            const ratio = document.getElementById('aspect_ratio').value;
            const sizeBase = document.getElementById('size').value;
            const styleValue = document.getElementById('style').value;
            
            // 构建匹配 /v1/models 的标准虚拟模型名称
            const sizeLabel = sizeBase === '1024' ? '1K' : sizeBase === '2048' ? '2K' : '4K';
            const fakeModelName = \`gemini3pro-\${sizeLabel}-\${ratio}\`;

            const reqBody = {
                model: fakeModelName, // 传入后，Worker 自动将其拦截解包为 Width 和 Height
                messages: [{ role: 'user', content: prompt }],
                provider: provider,
                quality_mode: document.getElementById('quality').value,
                style: styleValue,
                steps: parseInt(document.getElementById('steps').value),
                guidance: parseFloat(document.getElementById('guidance').value),
                seed: parseInt(document.getElementById('seed').value),
                nologo: document.getElementById('nologo').checked,
                negative_prompt: document.getElementById('negative_prompt').value
            };

            btn.disabled = true;
            status.innerText = 'GENERATING...';
            previewBox.style.display = 'none';
            addLog("INFO", \`[任务启动] 路由通道: \${provider.toUpperCase()}\`);
            addLog("DEBUG", \`构建模型指令: \${fakeModelName} | 风格: \${styleValue}\`);

            try {
                const res = await fetch('/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
                    body: JSON.stringify(reqBody)
                });

                const data = await res.json();

                if (data.error) throw new Error(data.error);

                if (data.choices && data.choices[0].message) {
                    const content = data.choices[0].message.content;
                    const urlMatch = content.match(/\\((.*?)\\)/);
                    if (urlMatch && urlMatch[1]) {
                        const imgData = urlMatch[1];
                        addLog("SUCCESS", "流数据接收完毕！图片解析成功。");
                        previewBox.innerHTML = \`<img src="\${imgData}" class="result-img"><br>
                        <a href="\${imgData}" download="nano-\${sizeLabel}-\${ratio.replace(':', 'x')}.png" style="color:var(--primary); font-size: 13px; text-decoration: none; margin-top:15px; display:inline-block; font-weight:bold;">⬇️ 保存高清原图到本地</a>\`;
                        previewBox.style.display = 'block';
                        status.innerText = 'SUCCESS';
                    } else {
                        throw new Error("未能从返回值中提取到图片。");
                    }
                }
            } catch (e) {
                addLog("ERROR", e.message);
                status.innerText = 'FAILED';
            } finally {
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

function handleCORS() { return new Response(null, { headers: corsHeaders() }); }
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*" }; }
