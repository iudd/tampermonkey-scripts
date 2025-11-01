# AI图片生成器信息提取器 v2.0

## 🎯 脚本功能

这是一个专为 `https://freeaiimage.net/zh/` 网站设计的油猴脚本，用于完整提取AI图片生成过程中的所有有用信息，为开发转API程序提供数据支持。

## ✨ 核心功能

### 📊 实时数据提取
- ✅ **提示词监控**：实时捕获用户输入的提示词
- ✅ **参数提取**：自动识别图片尺寸、模型、风格等参数
- ✅ **状态监控**：跟踪生成过程状态（等待/生成中/已完成/错误）
- ✅ **图片捕获**：获取生成的图片URL和相关信息

### 🔍 网络请求分析
- ✅ **API拦截**：监控所有网络请求，包括fetch和XMLHttpRequest
- ✅ **响应时间**：记录API调用响应时间
- ✅ **请求详情**：保存完整的请求URL、headers、payload
- ✅ **状态码**：记录HTTP响应状态码

### 📤 数据导出
- ✅ **JSON格式**：导出完整的结构化数据
- ✅ **CSV格式**：导出表格化数据，便于Excel分析
- ✅ **历史记录**：保存所有生成会话的完整记录

### 🎨 用户界面
- ✅ **可视化面板**：实时显示提取的数据
- ✅ **可拖拽**：面板支持拖拽移动位置
- ✅ **状态指示器**：直观的颜色编码状态显示
- ✅ **实时计时器**：显示运行时间

## 📋 提取的数据结构

```json
{
  "timestamp": "2025-11-01T04:34:37Z",
  "prompt": "用户输入的提示词文本",
  "parameters": {
    "model": "dalle-3",
    "size": "512x512",
    "quality": "standard",
    "style": "photorealistic"
  },
  "status": "completed",
  "imageUrl": "生成的图片链接",
  "apiCalls": [
    {
      "url": "实际的API端点URL",
      "method": "POST",
      "headers": {},
      "requestBody": {},
      "responseTime": 2500,
      "status": 200,
      "timestamp": "2025-11-01T04:34:40Z"
    }
  ],
  "responseTime": 2500
}
```

## 🔧 使用方法

### 1. 安装脚本
访问以下链接直接安装脚本：
- **Raw链接**：`https://raw.githubusercontent.com/iudd/tampermonkey-scripts/main/ai-image-extractor.user.js`

### 2. 访问网站
打开 `https://freeaiimage.net/zh/` 并登录您的账户

### 3. 开始使用
脚本会自动在右上角显示提取面板，无需额外操作

### 4. 提取数据
- 在网站中输入提示词并生成图片
- 面板会实时显示提取的数据
- 生成完成后点击"JSON"或"CSV"导出数据

## 📊 提取的数据类型

### 📝 用户输入
- 提示词文本（prompt）
- 输入时间戳
- 参数设置（如果有）

### 🛠️ 技术参数
- 图片尺寸（width x height）
- 生成模型（如：DALL-E, Midjourney, Stable Diffusion）
- 质量设置（标准/高清）
- 风格设置（写实/卡通/艺术等）

### 🌐 网络请求
- API端点URL
- HTTP方法（GET/POST）
- 请求头信息
- 请求负载数据
- 响应时间
- HTTP状态码

### 📈 结果信息
- 生成状态（等待/生成中/已完成/错误）
- 图片URL
- 错误信息（如果有）

## 🎯 适用于API开发

这个脚本特别适合开发转API程序，因为它提供了：

1. **完整的API调用流程**：可以分析真实的API请求结构
2. **参数映射关系**：明确每个参数对应哪个字段
3. **响应格式分析**：了解成功/失败的响应结构
4. **错误处理**：记录错误信息和状态码
5. **性能数据**：响应时间统计

## 📤 导出文件说明

### JSON格式
```json
[
  {
    "timestamp": "2025-11-01T04:34:37Z",
    "prompt": "一只可爱的小猫",
    "status": "completed",
    "parameters": {...},
    "apiCalls": [...]
  }
]
```

### CSV格式
| timestamp | prompt | status | image_url | model | size |
|-----------|--------|--------|-----------|-------|------|
| 2025-11-01T04:34:37Z | 一只可爱的小猫 | completed | https://... | dalle-3 | 512x512 |

## ⚙️ 脚本配置

脚本支持以下配置选项（在代码顶部修改）：
- `debugMode`: 是否启用调试模式
- `autoExport`: 是否自动导出数据
- `exportFormat`: 导出格式（json/csv）
- `saveHistory`: 是否保存历史记录

## 🔒 隐私说明

- 所有数据处理都在浏览器本地完成
- 不会上传任何数据到外部服务器
- 支持导出本地数据文件

## 📞 技术支持

如有问题或建议，请通过GitHub Issues联系。

---

**版本**: v2.0  
**更新时间**: 2025-11-01  
**作者**: AI助手  
**许可证**: MIT