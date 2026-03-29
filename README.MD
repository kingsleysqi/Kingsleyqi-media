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
│   └── [id].html                       # 分享页面
└── functions/
    └── api/
        ├── list.js                     # 前台媒体列表接口（公开）
        ├── share/
        │   └── [id].js                 # 分享访问接口（公开）
        └── admin/
            ├── _auth_helper.js         # 鉴权工具（被其他接口引用）
            ├── auth.js                 # 登录 / Token 验证
            ├── upload-url.js           # 生成 R2 预签名上传 URL
            ├── files.js                # 文件列表（media/ + drive/）
            ├── delete.js               # 删除文件
            ├── rename.js               # 重命名 / 移动文件
            ├── external.js             # 外部直链管理
            ├── shares.js               # 分享链接管理
            └── categories.js           # 自定义分类管理
```

---

## R2 存储结构

```
你的 Bucket/
├── media/
│   ├── movies/
│   │   └── 作品名 (年份)/
│   │       ├── poster.jpg              # 封面（可选）
│   │       └── movie.mp4
│   ├── tvshows/
│   │   └── 剧名/
│   │       └── Season 01/
│   │           ├── S01E01.mp4
│   │           └── S01E02.mp4
│   ├── music/
│   │   └── 专辑名/
│   │       └── song.mp3
│   └── [自定义分类]/                   # 后台添加的自定义分类
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
| `TOKEN_SECRET` | Token 签名密钥（建议随机字符串） | ✅ |
| `CF_ACCOUNT_ID` | Cloudflare 账号 ID | ✅ |
| `R2_BUCKET_NAME` | R2 存储桶名称 | ✅ |
| `R2_ACCESS_KEY_ID` | R2 API Token Access Key | ✅ |
| `R2_SECRET_ACCESS_KEY` | R2 API Token Secret Key | ✅ |

### R2 绑定

Pages → Settings → Functions → R2 bucket bindings，添加：

| 变量名 | 存储桶 |
|--------|--------|
| `MEDIA_BUCKET` | 你的 R2 bucket 名称 |

### R2 API Token 生成

R2 的 Access Key 必须在 **R2 → Manage R2 API Tokens** 单独生成，不能使用 Cloudflare 全局 API Token。

1. 进入 Cloudflare Dashboard → R2
2. 点击右上角 **Manage R2 API Tokens**
3. 创建新 Token，权限选 **Object Read & Write**
4. 绑定到对应的 bucket
5. 保存生成的 Access Key ID 和 Secret Access Key

### R2 CORS 配置

R2 → 你的 bucket → Settings → CORS Policy：

```json
[
  {
    "AllowedOrigins": ["https://你的域名.com"],
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

- 自动加载所有媒体，支持按分类筛选和关键词搜索
- Hero 区域显示各分类作品数量，随分类动态变化
- 点击卡片在弹窗内播放，支持 HLS（.m3u8）和普通视频/音频格式
- 电视剧支持分集列表侧边栏
- 播放进度自动保存到 localStorage，下次打开从上次位置继续

### 后台（/admin）

密码登录，Token 24 小时有效，存储在 sessionStorage。

**上传文件**
- 选择媒体类型（内置或自定义分类）
- 填写作品名称，电视剧可填写季名
- 拖放或点击选择文件，支持多文件批量上传
- 路径预览实时显示文件将存储的位置
- 支持中文作品名（使用 encodeURIComponent 签名）

**外部直链**
- 添加任意 https:// 直链作为媒体内容
- 支持电影、电视剧（多集）、音乐
- 数据保存到 R2 的 `_admin/external.json`
- 前台与 R2 内容合并显示

**文件管理**
- 列出所有 `media/` 和 `drive/` 下的文件
- 支持搜索、重命名/移动、删除
- `_admin/` 配置文件不在列表中显示

**分类管理**
- 内置分类：电影 / 电视剧 / 音乐（不可删除）
- 可添加自定义分类，填写名称、Slug（英文）、图标 Emoji、颜色
- 自定义分类自动出现在上传选项、前台 Tab 和 Hero 统计中
- 数据保存到 R2 的 `_admin/categories.json`

**分享管理**
- 创建带密码、有效期、访问次数限制的分享链接
- 可包含 R2 文件路径或 https:// 外部直链
- 分享页面（/share/ID）自动生成 R2 预签名下载链接（1小时有效）
- 支持查看历史分享、复制链接、删除

**临时网盘**
- 上传任意文件到 `drive/` 目录
- 不在前台展示
- 可复制直链或一键添加到分享列表

### 分享页（/share/[id]）

- 自动验证有效期和访问次数
- 有密码时显示密码输入界面
- 文件列表支持单文件下载、复制链接、一键复制全部链接

---

## 支持的文件格式

| 类型 | 格式 |
|------|------|
| 视频 | mp4, mkv, avi, mov, webm, m4v, ts, m3u8 |
| 音频 | mp3, flac, aac, ogg, wav, m4a |
| 封面 | poster.jpg/jpeg/png/webp, cover.jpg/png |
| 网盘 | 不限格式 |

---

## 部署步骤

1. Fork 或克隆仓库到 GitHub
2. 在 Cloudflare Pages 连接仓库，框架选 **None**，构建命令留空
3. 配置所有环境变量（见上方表格）
4. 添加 R2 bucket binding（变量名 `MEDIA_BUCKET`）
5. 配置 R2 CORS Policy
6. 部署，访问 `/admin` 进行管理

---

## 常见问题

**上传中文作品名失败**
确认使用的是最新版 `upload-url.js`，旧版本存在中文路径签名不一致的 bug。

**上传最后一刻失败（进度到 100% 报错）**
检查 R2 CORS 配置，`AllowedOrigins` 必须包含你实际访问的域名。

**分类不显示在前台**
确认 `list.js` 和 `index.html` 都是最新版本，分类通过 `/api/list` 响应的 `categories` 字段传递给前台。

**网盘文件删除/重命名失败**
确认使用最新版 `delete.js` 和 `rename.js`，旧版本只允许操作 `media/` 前缀的文件。

**Token 失效 / 一直跳登录**
检查 `TOKEN_SECRET` 环境变量是否配置，未配置时降级使用 `ADMIN_PASSWORD` 作为密钥，重新部署后已登录的 Token 会失效需要重新登录。
