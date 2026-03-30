# Kingsley Media

私人媒体库系统，基于 Cloudflare Pages + R2 构建。支持视频流媒体播放、音乐、多分类管理、外部直链、文件分享和临时网盘。

---

## 技术栈

- **前端托管**：Cloudflare Pages
- **后端接口**：Cloudflare Pages Functions（Edge 运行）
- **文件存储**：Cloudflare R2
- **鉴权方式**：HMAC-SHA256 自签名 Token（24小时有效）
- **上传方式**：R2 S3 兼容 API 预签名 URL（直传，不经过 Functions）

---

## 目录结构    

```
/
├── index.html                          # 前台主页
├── admin.html                          # 后台管理页
├── share/
│   └── index.html                      # 分享静态页（由 Function 提供服务）
└── functions/
    └── api/
        ├── list.js                     # 前台媒体列表接口（公开）
        ├── share/
        │   └── [id].js                 # 分享访问接口（公开）
        └── admin/
            ├── _auth_helper.js         # HMAC Token 验证工具
            ├── auth.js                 # 登录 / Token 验证
            ├── upload-url.js           # 生成 R2 预签名上传 URL
            ├── files.js                # 文件列表（media/ + drive/）
            ├── delete.js               # 删除文件
            ├── rename.js               # 重命名 / 移动文件
            ├── external.js             # 外部直链管理
            ├── shares.js               # 分享链接管理
            └── categories.js           # 自定义分类管理
    └── share/
        └── [id].js                     # 分享页面路由（内联 HTML）
```

---

## R2 存储结构

```
kingsleyqi-media/
├── media/
│   ├── movies/
│   │   └── 作品名 (年份)/
│   │       ├── poster.jpg
│   │       └── movie.mp4
│   ├── tvshows/
│   │   └── 剧名/
│   │       └── Season 01/
│   │           ├── S01E01.mp4
│   │           └── S01E02.mp4
│   ├── music/
│   │   └── 专辑名/
│   │       └── song.mp3
│   └── [自定义分类]/
│       └── 作品名/
│           └── file.mp4
├── drive/                              # 临时网盘（不在前台显示）
│   └── 任意文件
└── _admin/                             # 系统配置（不对外暴露）
    ├── external.json                   # 外部直链数据
    ├── categories.json                 # 自定义分类数据
    └── shares/
        ├── _index.json                 # 分享索引
        └── {id}.json                   # 各分享详情
```

---

## 环境变量配置

在 Cloudflare Pages → Settings → Environment variables 中配置：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `ADMIN_PASSWORD` | 后台登录密码 | ✅ |
| `TOKEN_SECRET` | Token 签名密钥（随机字符串） | ✅ |
| `CF_ACCOUNT_ID` | Cloudflare 账号 ID | ✅ |
| `R2_BUCKET_NAME` | R2 存储桶名称 | ✅ |
| `R2_ACCESS_KEY_ID` | R2 API Token Access Key | ✅ |
| `R2_SECRET_ACCESS_KEY` | R2 API Token Secret Key | ✅ |

### R2 绑定

Pages → Settings → Functions → R2 bucket bindings：

| 变量名 | 存储桶 |
|--------|--------|
| `MEDIA_BUCKET` | kingsleyqi-media |

### R2 API Token 生成

必须在 **R2 → Manage R2 API Tokens** 单独生成，不能使用 Cloudflare 全局 API Token。权限选 **Object Read & Write**，绑定到对应 bucket。

### R2 CORS 配置

R2 → 存储桶 → Settings → CORS Policy：

```json
[
  {
    "AllowedOrigins": ["https://media.kingsleyqi.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "x-amz-request-id"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 功能说明

### 前台（/）

- 动态加载所有媒体，支持按分类筛选和关键词搜索
- Hero 区域显示各分类作品数量，随分类动态变化
- 点击卡片在弹窗内播放，支持 HLS（.m3u8）和普通视频/音频
- 电视剧支持分集列表侧边栏
- 播放进度自动保存到 localStorage

### 后台（/admin）

密码登录，Token 24 小时有效。

**上传文件** — 选择分类和作品名，拖放上传，支持中文路径，直传 R2 不经过服务器

**外部直链** — 添加任意 https:// 直链，数据存 R2，前台自动合并显示

**文件管理** — 列出 media/ 和 drive/ 下所有文件，支持搜索、重命名、删除

**分类管理** — 内置电影/电视剧/音乐，可添加自定义分类，前台 Tab 动态同步

**分享管理** — 生成带密码/有效期/次数限制的分享链接

**临时网盘** — 上传任意文件到 drive/ 目录，不在前台展示

### 分享页（/share/[id]）

自动验证有效期和访问次数，有密码时显示输入界面，R2 文件生成预签名下载链接（1小时有效）

---

## 支持的文件格式

| 类型 | 格式 |
|------|------|
| 视频 | mp4, mkv, avi, mov, webm, m4v, ts, m3u8 |
| 音频 | mp3, flac, aac, ogg, wav, m4a |
| 封面 | poster.jpg/jpeg/png/webp, cover.jpg/png |
| 网盘 | 不限格式 |

---

## 常见问题

**上传中文作品名失败** — 确认使用最新版 upload-url.js，旧版存在中文路径签名不一致的 bug。

**上传最后一刻失败** — 检查 R2 CORS 配置，AllowedOrigins 必须包含实际访问的域名。

**文件列表空白/401** — 检查 _auth_helper.js 是否为 HMAC 版本，简化版会导致所有鉴权接口返回 401。

**分享链接 Error 1000** — functions/share/[id].js 不能 fetch 自己的域名，需将 HTML 内联在 Function 里返回。

**Token 失效** — 确认 TOKEN_SECRET 环境变量已配置，修改后需退出重新登录。

**部署不更新** — 检查 Cloudflare Pages 部署列表，确认最新 commit 已被设为生产版本。
