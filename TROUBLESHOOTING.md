# R2 视频播放问题排查指南

## 🔍 问题现象

更新到 v2.1.1 后，R2 存储的视频无法播放。

---

## ✅ 已修复的问题

### crossorigin 属性问题

**问题原因**：
在 v2.1.1 版本中，为所有视频添加了 `crossorigin="anonymous"` 属性，但这会导致同域 R2 视频播放失败。

**修复方案**：
现在只对真正的外部直链添加 crossorigin，R2 同域视频不再添加。

```javascript
// 修复前（错误）
videoEl.setAttribute('crossorigin', 'anonymous');

// 修复后（正确）
const isExternalUrl = url.startsWith('http') && 
                      !url.includes('cdn.kingsleyqi.com') && 
                      !url.includes(window.location.hostname);
if (isExternalUrl) {
  videoEl.setAttribute('crossorigin', 'anonymous');
}
```

---

## 🛠️ 排查步骤

### 步骤1：打开浏览器控制台

1. 按 `F12` 打开开发者工具
2. 切换到 **Console（控制台）** 标签
3. 尝试播放 R2 视频

### 步骤2：查看调试日志

现在播放器会输出详细的调试信息：

```javascript
[Player] 准备播放: {
  url: "https://cdn.kingsleyqi.com/media/movies/xxx/video.mp4",
  progressKey: "movies/xxx",
  posterUrl: "..."
}
[Player] CDN_BASE: https://cdn.kingsleyqi.com
[Player] URL 类型: 完整URL
[Player] R2 同域视频，不添加 crossorigin
[Player] 媒体类型: { isM3u8: false, mimeType: "video/mp4" }
```

### 步骤3：检查关键信息

#### ✅ 正常情况应该看到：

```
[Player] URL 类型: 完整URL  (或 相对路径)
[Player] R2 同域视频，不添加 crossorigin
```

#### ❌ 如果看到：

```
[Player] URL 类型: API路径
```
这说明 URL 处理有问题，应该以 `http` 开头或相对路径

---

## 🔧 常见问题与解决方案

### 问题1：视频加载失败（404）

**症状**：
- 控制台显示 404 错误
- 视频无法加载

**原因**：
- R2 文件路径错误
- CDN 配置问题
- 文件已被删除

**解决方案**：
1. 检查 R2 存储桶中文件是否存在
2. 验证 CDN 域名配置正确
3. 在浏览器直接访问视频 URL 测试

**测试方法**：
```
https://cdn.kingsleyqi.com/media/movies/测试/video.mp4
```

---

### 问题2：CORS 错误

**症状**：
- 控制台显示 CORS 相关错误
- `Access-Control-Allow-Origin` 问题

**原因**：
- R2 CORS 配置不正确
- 域名不匹配

**解决方案**：

检查 R2 CORS 配置：

```json
[
  {
    "AllowedOrigins": [
      "https://media.kingsleyqi.com",
      "https://your-domain.com"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3000
  }
]
```

**更新 CORS 配置**：
1. 登录 Cloudflare Dashboard
2. 进入 R2 存储桶
3. Settings → CORS Policy
4. 添加您的域名

---

### 问题3：视频格式不支持

**症状**：
- 控制台显示格式错误
- 播放器报错

**支持的格式**：

✅ **完美支持**：
- MP4 (H.264/AAC)
- HLS (M3U8)
- WebM

⚠️ **部分支持**：
- MKV（很多浏览器不支持）
- AVI（需要转码）
- MOV

**解决方案**：
- 将视频转码为 MP4 (H.264 + AAC)
- 或使用 HLS 格式

**转码命令示例**：
```bash
ffmpeg -i input.mkv -c:v libx264 -c:a aac output.mp4
```

---

### 问题4：URL 处理错误

**症状**：
- 控制台显示 URL 为空
- URL 格式不正确

**检查 URL 处理逻辑**：

```javascript
function getPlayableUrl(u) {
  if (!u) return null;
  // 已经是完整 URL
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  // API 代理路径
  if (u.startsWith('/api/')) return u;
  // CDN 路径
  return `${CDN_BASE}/${u}`;
}
```

**测试不同情况**：

| 输入 | 输出 | 状态 |
|------|------|------|
| `https://example.com/video.mp4` | `https://example.com/video.mp4` | ✅ |
| `/api/alist/stream?...` | `/api/alist/stream?...` | ✅ |
| `media/movies/xxx.mp4` | `https://cdn.kingsleyqi.com/media/movies/xxx.mp4` | ✅ |
| 空值 | `null` | ❌ |

---

### 问题5：CDN 配置问题

**症状**：
- CDN 域名无法访问
- 返回错误页面

**检查项**：

1. **CDN 域名绑定**
   - 确认 `cdn.kingsleyqi.com` 已正确绑定到 R2
   - 检查 DNS 解析

2. **自定义域名配置**
   - Cloudflare Pages → Custom Domains
   - R2 → Custom Domains

3. **SSL 证书**
   - 确保证书有效
   - HTTPS 正常工作

**测试 CDN**：
```bash
curl -I https://cdn.kingsleyqi.com/media/movies/测试/video.mp4
```

应该返回：
```
HTTP/2 200
content-type: video/mp4
```

---

## 📋 完整排查清单

### 前端检查

- [ ] 浏览器控制台无报错
- [ ] 看到 `[Player] 准备播放` 日志
- [ ] URL 类型正确（完整URL 或 相对路径）
- [ ] 显示 `R2 同域视频，不添加 crossorigin`
- [ ] MIME 类型正确（如 `video/mp4`）

### R2 检查

- [ ] 文件存在于 R2 存储桶
- [ ] 文件路径正确
- [ ] CORS 配置包含您的域名
- [ ] 文件 Content-Type 正确

### CDN 检查

- [ ] CDN 域名可访问
- [ ] DNS 解析正确
- [ ] SSL 证书有效
- [ ] 直接访问视频 URL 返回 200

### 网络检查

- [ ] 网络连接正常
- [ ] 无防火墙阻止
- [ ] 无代理干扰

---

## 🎯 快速诊断脚本

在浏览器控制台运行以下代码：

```javascript
// 诊断 R2 视频播放问题
(function diagnose() {
  console.log('=== Kingsley Media 诊断工具 ===\n');
  
  // 1. 检查 CDN_BASE
  console.log('1. CDN_BASE:', CDN_BASE);
  
  // 2. 测试 CDN 连接
  fetch(CDN_BASE + '/favicon.ico', { method: 'HEAD' })
    .then(r => console.log('2. CDN 连接:', r.ok ? '✅ 正常' : '❌ 失败'))
    .catch(e => console.log('2. CDN 连接: ❌', e));
  
  // 3. 检查视频元素
  const video = document.querySelector('video');
  if (video) {
    console.log('3. 视频元素: ✅ 存在');
    console.log('   - src:', video.src);
    console.log('   - crossorigin:', video.crossOrigin);
    console.log('   - error:', video.error);
    console.log('   - networkState:', video.networkState);
    console.log('   - readyState:', video.readyState);
  } else {
    console.log('3. 视频元素: ❌ 不存在');
  }
  
  // 4. 检查播放器
  if (typeof currentVideoJsPlayer !== 'undefined' && currentVideoJsPlayer) {
    console.log('4. Video.js 播放器: ✅ 已初始化');
  } else {
    console.log('4. Video.js 播放器: ❌ 未初始化');
  }
  
  console.log('\n=== 诊断完成 ===');
})();
```

---

## 💡 调试技巧

### 1. 查看网络请求

1. 打开开发者工具（F12）
2. 切换到 **Network（网络）** 标签
3. 尝试播放视频
4. 查看视频文件的请求状态

**正常情况**：
- 状态码：200 或 206
- 类型：video/mp4 或其他视频类型
- 大小：正常加载

**异常情况**：
- 404：文件不存在
- 403：权限问题
- CORS 错误：跨域问题

### 2. 直接测试 URL

在浏览器新标签页直接访问视频 URL：

```
https://cdn.kingsleyqi.com/media/movies/测试/video.mp4
```

**结果判断**：
- ✅ 开始下载/播放 → URL 正确
- ❌ 404 → 文件不存在或路径错误
- ❌ 403 → 权限问题
- ❌ CORS 错误 → 配置问题

### 3. 检查视频元素属性

在控制台运行：

```javascript
const video = document.querySelector('video');
if (video) {
  console.log('视频属性:', {
    src: video.src,
    crossorigin: video.crossOrigin,
    error: video.error,
    networkState: video.networkState,
    readyState: video.readyState,
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    ended: video.ended
  });
}
```

**关键指标**：
- `networkState === 1` → 已加载
- `readyState >= 2` → 可以播放
- `error === null` → 无错误

---

## 📞 获取帮助

如果以上步骤都无法解决问题：

1. **收集信息**：
   - 浏览器控制台完整错误信息
   - Network 标签中的请求详情
   - 诊断工具输出结果

2. **检查环境**：
   - 浏览器版本
   - 操作系统
   - 网络环境

3. **联系支持**：
   - 提供上述信息
   - 描述具体问题现象
   - 说明复现步骤

---

## 🔖 相关文档

- [播放器功能说明](./PLAYER-GUIDE.md)
- [v2.1.1 更新日志](./CHANGELOG-v2.1.1.md)
- [项目 README](./README.MD)

---

**提示**：v2.1.1 已修复 crossorigin 问题，如果仍有问题，请按上述步骤排查。
