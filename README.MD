# Kingsley Media

私人媒体库系统，基于 Cloudflare Pages + R2 构建。支持视频流媒体播放、音乐、多分类管理、外部直链、文件分享、临时网盘和时效上传令牌。

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
│   └── index.html                      # 分享静态页
└── functions/
    ├── share/
    │   └── [id].js                     # 分享页面路由（内联 HTML）
    ├── upload/
    │   └── [token].js                  # 上传页面路由（内联 HTML）
    └── api/
        ├── list.js                     # 前台媒体列表接口（公开）
        ├── share/
        │   └── [id].js                 # 分享访问接口（公开）
        ├── upload/
        │   └── [token].js              # 上传令牌接口（公开）
        └── admin/
            ├── _auth_helper.js         # HMAC Token 验证工具
            ├── auth.js                 # 登录 / Token 验证
            ├── upload-url.js           # 生成 R2 预签名上传 URL
            ├── files.js                # 文件列表（media/ + drive/）
            ├── delete.js               # 删除文件
            ├── rename.js               # 重命名 / 移动文件
            ├── external.js             # 外部直链管理
            ├── shares.js               # 分享链接管理
            ├── categories.js           # 自定义分类管理
            └── upload-tokens.js        # 上传令牌管理
```

---

## R2 存储结构

```
kingsleyqi-media/
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
│   ├── 直接上传的文件
│   └── [令牌名]/                       # 上传令牌对应目录
│       └── 访客上传的文件
└── _admin/                             # 系统配置（不对外暴露）
    ├── external.json                   # 外部直链数据
    ├── categories.json                 # 自定义分类数据
    ├── shares/
    │   ├── _index.json                 # 分享索引
    │   └── {id}.json                   # 各分享详情
    └── upload-tokens/
        ├── _index.json                 # 令牌索引
        └── {id}.json                   # 各令牌详情
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
- 播放进度自动保存到 localStorage，下次从上次位置继续
- 页面底部中央有低调管理入口（`· · ·`），点击进入后台

### 后台（/admin）

密码登录，Token 24 小时有效，存储在 sessionStorage。

**上传文件**
选择分类（内置或自定义），填写作品名称，电视剧可填写季名，路径实时预览。拖放或点击选择文件，支持批量上传，直传 R2，支持中文路径。

**外部直链**
添加任意 https:// 直链作为媒体内容，支持电影、电视剧（多集）、音乐。数据保存到 `_admin/external.json`，前台自动合并显示，分类选项跟随自定义分类动态更新。

**文件管理**
列出所有 `media/` 和 `drive/` 下的文件，支持关键词搜索、重命名/移动、删除。`_admin/` 配置文件不在列表中显示。

**分类管理**
内置分类（电影/电视剧/音乐）不可删除。可添加自定义分类，填写名称、Slug（英文）、图标 Emoji、颜色，自动同步到上传选项、前台 Tab 和 Hero 统计。

**分享管理**
创建带密码、有效期、访问次数限制的分享链接，可包含 R2 文件路径或 https:// 外部直链。分享页面自动生成 R2 预签名下载链接（1小时有效）。

**临时网盘**
上传任意文件到 `drive/` 目录，不在前台展示。可复制直链或一键添加到分享列表。访客通过上传令牌上传的文件也存储在此。

**上传令牌**
创建带时效的上传链接，发给对方后可在有效期内上传文件。可设置开始时间、结束时间、最大文件数量、单文件大小限制、访问密码。文件存储到 `drive/[令牌名]/` 目录，创建后链接自动复制到剪贴板。

### 分享页（/share/[id]）

自动验证有效期和访问次数，有密码时显示密码输入界面，支持单文件下载、复制链接、一键复制全部链接。

### 上传页（/upload/[token]）

自动验证令牌有效性、时间段、文件数量上限，有密码时显示密码输入界面，超过大小限制的文件自动跳过并提示，支持拖放批量上传，实时进度显示。

---

## 支持的文件格式

| 类型 | 格式 |
|------|------|
| 视频 | mp4, mkv, avi, mov, webm, m4v, ts, m3u8 |
| 音频 | mp3, flac, aac, ogg, wav, m4a |
| 封面 | poster.jpg/jpeg/png/webp, cover.jpg/png |
| 网盘 / 令牌上传 | 不限格式 |

---

## 部署步骤

1. Fork 仓库到 GitHub
2. Cloudflare Pages → Create project → 连接 GitHub 仓库
3. 框架预设选 **None**，构建命令留空，构建输出目录填 `/`
4. 配置所有环境变量
5. 添加 R2 bucket binding（变量名 `MEDIA_BUCKET`）
6. 配置 R2 CORS Policy
7. 部署完成后访问 `/admin` 进行管理

---

## 常见问题

**上传中文作品名失败**
`upload-url.js` 中 canonical request 和实际 URL 必须使用相同的编码路径，旧版本存在不一致的 bug 导致 R2 验签失败。

**上传最后一刻失败**
检查 R2 CORS 配置，`AllowedOrigins` 必须包含实际访问的域名。

**文件列表空白 / 所有接口返回 401**
检查 `_auth_helper.js` 是否为 HMAC 版本。简化版（直接比对 `env.ADMIN_TOKEN`）会导致所有鉴权接口返回 401，正确版本使用 HMAC-SHA256 验证 Token 签名。

**分享链接 Error 1000**
`functions/share/[id].js` 不能用 `fetch` 请求自己的域名，会产生循环请求。需将 HTML 内容直接内联在 Function 里返回。

**登录后 Token 失效**
修改 `TOKEN_SECRET` 或重新部署后，旧 Token 会失效，需退出重新登录。

**部署不更新**
检查 Cloudflare Pages 部署列表，确认最新 commit 已被设为生产版本（Promote to Production）。
