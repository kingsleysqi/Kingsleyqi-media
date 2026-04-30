# Kingsley Media v2.1.2 Bug 修复

## 📢 版本概览

**版本号**: 2.1.2  
**发布日期**: 2026年4月30日  
**更新类型**: Bug 修复

---

## 🐛 修复的问题

### R2 视频无法播放

**问题描述**：
在 v2.1.1 版本中，为优化外部直链播放，为所有视频元素添加了 `crossorigin="anonymous"` 属性。但这导致存储在 R2 的同域视频无法正常播放。

**影响范围**：
- ❌ R2 存储的视频文件无法播放
- ❌ CDN 加速的视频无法加载
- ✅ 外部直链视频不受影响

**问题原因**：
```javascript
// v2.1.1 中的错误代码
videoEl.setAttribute('crossorigin', 'anonymous');
```

当视频与页面同域（都来自 `cdn.kingsleyqi.com`）时，添加 `crossorigin` 属性会导致浏览器要求服务端返回正确的 CORS 头，而 R2 的 CDN 配置可能不包含这些头，从而导致加载失败。

---

## ✅ 修复方案

### 优化 crossorigin 判断逻辑

**修复后的代码**：
```javascript
// 只对外部直链添加 crossorigin，R2 同域不需要
const isExternalUrl = url.startsWith('http') && 
                      !url.includes('cdn.kingsleyqi.com') && 
                      !url.includes(window.location.hostname);

if (isExternalUrl) {
  videoEl.setAttribute('crossorigin', 'anonymous');
  console.log('[Player] 检测到外部直链，添加 crossorigin');
} else {
  console.log('[Player] R2 同域视频，不添加 crossorigin');
}
```

### 判断规则

| URL 类型 | 示例 | crossorigin | 结果 |
|----------|------|-------------|------|
| R2 CDN | `https://cdn.kingsleyqi.com/media/...` | ❌ 不添加 | ✅ 正常播放 |
| 外部直链 | `https://other.com/video.mp4` | ✅ 添加 | ✅ 支持跨域 |
| API 代理 | `/api/alist/stream?...` | ❌ 不添加 | ✅ 同域代理 |
| 相对路径 | `media/movies/xxx.mp4` | ❌ 不添加 | ✅ 转换为CDN |

---

## 🔍 新增调试功能

### 详细的控制台日志

现在播放器会输出更详细的调试信息，方便排查问题：

```javascript
[Player] 准备播放: {
  url: "https://cdn.kingsleyqi.com/media/movies/xxx.mp4",
  progressKey: "movies/xxx",
  posterUrl: "https://cdn.kingsleyqi.com/media/movies/xxx/poster.jpg"
}
[Player] CDN_BASE: https://cdn.kingsleyqi.com
[Player] URL 类型: 完整URL
[Player] R2 同域视频，不添加 crossorigin
[Player] 媒体类型: { isM3u8: false, mimeType: "video/mp4" }
```

### 日志说明

| 日志项 | 说明 |
|--------|------|
| `准备播放` | 显示即将播放的 URL 和参数 |
| `CDN_BASE` | 当前配置的 CDN 域名 |
| `URL 类型` | 识别 URL 是完整URL、API路径还是相对路径 |
| `crossorigin` | 显示是否添加了跨域属性 |
| `媒体类型` | 识别的 MIME 类型 |

---

## 📖 新增文档

### 故障排查指南

创建了完整的 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 文档，包含：

- ✅ 常见问题与解决方案
- ✅ 完整排查清单
- ✅ 诊断工具脚本
- ✅ 调试技巧
- ✅ 网络请求检查方法

---

## 🔄 版本对比

### v2.1.1 vs v2.1.2

| 功能 | v2.1.1 | v2.1.2 | 改进 |
|------|--------|--------|------|
| R2 视频播放 | ❌ 失败 | ✅ 修复 | **已修复** |
| 外部直链 | ✅ 正常 | ✅ 正常 | - |
| crossorigin | 全部添加 | 智能判断 | **优化** |
| 调试日志 | 基础 | 详细 | **增强** |
| 故障排查文档 | 无 | 有 | **新增** |

---

## 🧪 测试验证

### 测试用例

#### 1. R2 视频播放

**步骤**：
1. 打开任意 R2 存储的视频
2. 查看控制台日志
3. 确认显示 `R2 同域视频，不添加 crossorigin`
4. 视频应该正常播放

**预期结果**：
- ✅ 视频加载成功
- ✅ 播放流畅
- ✅ 无 CORS 错误

#### 2. 外部直链播放

**步骤**：
1. 添加外部直链媒体
2. 播放该媒体
3. 查看控制台日志
4. 确认显示 `检测到外部直链，添加 crossorigin`

**预期结果**：
- ✅ 视频加载成功
- ✅ 支持跨域播放
- ✅ 无 CORS 错误

#### 3. Alist 代理播放

**步骤**：
1. 播放 Alist 云盘中的视频
2. 查看控制台日志
3. 确认 URL 类型为 `API路径`

**预期结果**：
- ✅ 视频通过代理正常播放
- ✅ 不添加 crossorigin

---

## 📋 更新清单

### 修改的文件

1. **[index.html](./index.html)**
   - 修复 crossorigin 逻辑
   - 增强调试日志输出
   - 优化 URL 类型判断

2. **[package.json](./package.json)**
   - 版本号：2.1.1 → 2.1.2

3. **[version.js](./version.js)**
   - 前端版本号：2.1.1 → 2.1.2

4. **[README.MD](./README.MD)**
   - 版本徽章更新
   - 添加 v2.1.2 更新日志

5. **[CHANGELOG-v2.1.2.md](./CHANGELOG-v2.1.2.md)** ✨ 新建
   - 详细的更新说明文档

6. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** ✨ 新建
   - 故障排查完整指南

---

## 🚀 升级说明

### 从 v2.1.1 升级

- **影响**：仅修复 Bug，无破坏性变更
- **数据迁移**：不需要
- **配置变更**：不需要
- **升级步骤**：
  1. 拉取最新代码
  2. 部署到 Cloudflare Pages
  3. 完成！

### 从更早版本升级

建议直接升级到最新版本（v2.1.2），包含所有新功能和修复。

---

## 💡 使用建议

### 调试播放问题

1. **打开浏览器控制台**（F12）
2. **切换到 Console 标签**
3. **尝试播放视频**
4. **查看 `[Player]` 开头的日志**

### 快速诊断

在控制台运行以下代码：

```javascript
// 快速诊断 R2 视频播放
(function() {
  console.log('=== Kingsley Media v2.1.2 诊断 ===\n');
  
  // 检查版本号
  console.log('版本:', window.APP_VERSION || '未知');
  
  // 检查 CDN 配置
  console.log('CDN_BASE:', typeof CDN_BASE !== 'undefined' ? CDN_BASE : '未定义');
  
  // 检查视频元素
  const video = document.querySelector('video');
  if (video) {
    console.log('视频元素:', {
      src: video.src.substring(0, 50) + '...',
      crossorigin: video.crossOrigin || '无',
      error: video.error || '无'
    });
  } else {
    console.log('视频元素: 未找到（请先播放视频）');
  }
  
  console.log('\n=== 诊断完成 ===');
})();
```

---

## ⚠️ 注意事项

### crossorigin 属性说明

**何时需要 crossorigin**：
- ✅ 播放跨域视频（不同域名）
- ✅ 需要访问视频纹理（Canvas 操作）
- ✅ 需要获取视频截图

**何时不需要 crossorigin**：
- ✅ 同域视频（R2 CDN）
- ✅ 简单播放场景
- ✅ API 代理的视频

### 最佳实践

1. **R2 视频**：不添加 crossorigin（性能更好）
2. **外部直链**：添加 crossorigin（支持跨域）
3. **Alist 代理**：不添加 crossorigin（同域代理）

---

## 📞 问题反馈

如果升级后仍有问题：

1. **收集信息**：
   - 浏览器控制台完整日志
   - Network 标签中的请求详情
   - 诊断工具输出

2. **查看文档**：
   - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 完整排查指南
   - [PLAYER-GUIDE.md](./PLAYER-GUIDE.md) - 播放器使用说明

3. **联系支持**：
   - 提供上述信息
   - 描述具体问题现象
   - 说明复现步骤

---

## 🎯 总结

v2.1.2 是一个重要的 Bug 修复版本，解决了 v2.1.1 中引入的 R2 视频播放问题。

**核心改进**：
- ✅ 修复 R2 同域视频无法播放的问题
- ✅ 智能判断何时添加 crossorigin
- ✅ 增强调试日志输出
- ✅ 新增完整故障排查文档

**建议所有用户升级到 v2.1.2**，特别是遇到 R2 视频播放问题的用户。

---

**Kingsley Media v2.1.2** - 稳定可靠的播放体验  
*让每一次观看都顺畅无阻* 🎬✨
