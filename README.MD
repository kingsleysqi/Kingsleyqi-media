# Kingsley · Media Library

私有媒体库，基于 **Cloudflare Pages + R2**，零服务器，全球 CDN 加速。

---

## 项目结构

```
my-media-library/
├── index.html                # 主页面（电影院风格暗色 UI）
├── functions/
│   └── api/
│       └── list.js           # Pages Function：动态读取 R2 文件列表
├── public/
│   └── README.md             # 存放 favicon 等静态资源
├── wrangler.jsonc            # Wrangler 配置（可选）
├── package.json
└── .gitignore
```

---

## R2 Bucket 路径约定

上传文件时请遵循以下路径结构，API 会自动解析：

```
media/tvshows/<剧名>/Season 01/S01E01.mp4
media/tvshows/<剧名>/poster.jpg         ← 可选封面
media/movies/<电影名 (年份)>/<文件>.mp4
media/movies/<电影名 (年份)>/poster.jpg
media/music/<专辑名>/<曲目>.mp3
media/music/<专辑名>/cover.jpg
```

**支持的视频格式**：mp4, mkv, avi, mov, webm, m4v, ts, m3u8  
**支持的音频格式**：mp3, flac, aac, ogg, wav, m4a  
**支持的封面图**：poster.jpg/jpeg/png/webp, cover.jpg/png

---

## 部署步骤

### 1. 准备 GitHub 仓库

```bash
git init
git add .
git commit -m "init: media library"
git remote add origin https://github.com/your-username/my-media-library.git
git push -u origin main
```

### 2. Cloudflare Pages 配置

在 [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → Create Project：

| 设置项 | 值 |
|--------|-----|
| Build command | *(留空)* |
| Build output directory | *(留空 或 `.`)* |
| Root directory | *(留空)* |

### 3. 添加 R2 Binding

Pages 项目 → **Settings → Functions → R2 bucket bindings** → Add binding：

| Variable name | R2 bucket |
|--------------|-----------|
| `MEDIA_BUCKET` | 选择你的 bucket |

### 4. 自定义域名

Pages 项目 → **Custom domains** → 添加 `media.kingsleyqi.com`

---

## 本地开发

```bash
npm install
# 需要先创建本地 R2 bucket（或用远程）
npx wrangler pages dev . --r2=MEDIA_BUCKET
```

访问 http://localhost:8788

---

## 功能特性

- 🎬 **自动扫描** R2 bucket，无需手动配置文件列表
- 📺 **剧集支持**：按季/集组织，侧边栏选集
- 🔍 **实时搜索**：按名称过滤
- 💾 **播放进度记忆**：localStorage 持久化
- 📱 **响应式设计**：手机/平板/桌面自适应
- 🎞️ **HLS 支持**：通过 hls.js 播放 .m3u8 流媒体
- 🖼️ **自动封面**：识别 poster.jpg / cover.jpg

---

## API

### `GET /api/list`

返回完整媒体列表。

**可选参数**：`?type=tvshows|movies|music`

**响应示例**：
```json
{
  "items": [
    {
      "id": "tvshows/生活大爆炸",
      "type": "tvshows",
      "name": "生活大爆炸",
      "poster": "media/tvshows/生活大爆炸/poster.jpg",
      "year": null,
      "episodes": [
        { "key": "media/tvshows/生活大爆炸/Season 01/S01E01.mp4", "name": "S01E01", "season": "Season 01", "url": "media/..." }
      ]
    }
  ],
  "stats": { "tvshows": 3, "movies": 12, "music": 5 }
}
```

