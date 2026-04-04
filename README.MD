# Kingsley Media


![version](https://img.shields.io/badge/version-1.2.0-c9a84c?style=flat-square)

私人媒体库系统，基于 Cloudflare Pages + R2 构建。支持视频流媒体播放、音乐、多分类管理、外部直链、文件分享、临时网盘、时效上传令牌和 Alist 云盘挂载。

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
        ├── alist/
        │   ├── list.js                 # 代理 Alist 目录列表
        │   ├── link.js                 # 代理获取 Alist 文件直链
        │   ├── upload.js               # 代理上传文件到 Alist
        │   ├── image.js                # 代理 Alist 图片（修正 Content-Type）
        │   └── manage.js               # 代理 Alist 文件管理（重命名/删除/新建/删除文件夹）
        └── admin/
            ├── _auth_helper.js         # HMAC Token 验证工具
            ├── auth.js                 # 登录 / Token 验证
            ├── upload-url.js           # 生成 R2 预签名上传 URL
            ├── download-url.js         # 生成 R2 预签名下载 URL
            ├── files.js                # 文件列表（media/ + drive/）
            ├── delete.js               # 删除文件
            ├── rename.js               # 重命名 / 移动文件
            ├── external.js             # 外部直链管理
            ├── shares.js               # 分享链接管理
            ├── categories.js           # 自定义分类管理
            ├── upload-tokens.js        # 上传令牌管理
            └── alist-config.js         # Alist 云盘配置管理
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
│   │           └── S01E01.mp4
│   ├── music/
│   │   └── 专辑名/
│   │       └── song.mp3
│   └── [自定义分类]/
│       └── 作品名/
│           └── file.mp4
├── drive/
│   ├── 直接上传的文件
│   └── [令牌名]/                       # 上传令牌对应目录
│       └── 访客上传的文件
└── _admin/
    ├── external.json
    ├── categories.json
    ├── alist-configs.json
    ├── shares/
    │   ├── _index.json
    │   └── {id}.json
    └── upload-tokens/
        ├── _index.json
        └── {id}.json
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

**R2 绑定**（Pages → Settings → Functions → R2 bucket bindings）：

| 变量名 | 存储桶 |
|--------|--------|
| `MEDIA_BUCKET` | kingsleyqi-media |

**R2 CORS 配置**（R2 → 存储桶 → Settings → CORS Policy）：

```json
[
  {
    "AllowedOrigins": ["https://media.kingsleyqi.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 后台管理功能详解

后台入口：`/admin`，密码登录，Token 24 小时有效存储在 sessionStorage。页面底部中央有低调管理入口（`· · ·`）可从前台直接进入。

---

### ⬆ 上传文件

将媒体文件直传到 R2，不经过服务器中转。

**操作流程：**

1. 选择媒体类型（内置：电影/电视剧/音乐；自定义分类动态同步）
2. 填写作品名称，电视剧需额外填写季名（如 Season 01）
3. 路径预览实时显示文件将存储的 R2 路径
4. 可选：点击「选择封面图」选择本地图片，支持预览，上传时自动命名为 `poster.jpg` 存入同目录
5. 拖放或点击上传区域添加媒体文件（支持 mp4/mkv/mp3/flac 等格式）
6. 点击「▶ 开始上传」，封面图优先入队，依次上传所有文件并显示实时进度

**路径规则：**
- 电影：`media/movies/作品名/`
- 电视剧：`media/tvshows/剧名/Season 01/`
- 音乐：`media/music/专辑名/`
- 自定义分类：`media/[slug]/作品名/`

**注意：** 支持中文路径，签名时自动处理编码。

---

### 🔗 外部直链

将任意 https:// 直链作为媒体内容添加到媒体库，与 R2 内容合并在前台显示，无需上传文件到 R2。

**支持的内容类型：**
- **电影/音乐**：填写一条视频或音频直链
- **电视剧**：按行填写剧集列表，格式为 `集名 | 直链`

**字段说明：**
- 媒体类型：选择分类（内置或自定义，下拉选项动态更新）
- 作品名称：前台显示的标题
- 年份：可选，显示在卡片信息中
- 封面图直链：可选，填写任意图片 https:// 地址

**数据存储：** 保存到 R2 的 `_admin/external.json`，前台 `/api/list` 自动合并读取。

---

### 📁 文件管理

列出 R2 中 `media/` 和 `drive/` 下的所有文件。`_admin/` 配置文件不在列表中显示。

**功能：**
- **搜索**：按文件路径关键词实时过滤
- **重命名/移动**：弹窗输入新路径，支持跨目录移动（实质为复制+删除）
- **删除**：确认后直接从 R2 删除

**文件类型徽章：** 自动识别 movies / tvshows / music / drive / other。

---

### 🏷 分类管理

管理前台的媒体分类 Tab。

**内置分类（不可删除）：**
- 🎬 电影（slug: movies）
- 📺 电视剧（slug: tvshows）
- 🎵 音乐（slug: music）

**自定义分类：**
- 填写名称、Slug（英文小写，作为 R2 路径前缀）、图标 Emoji、颜色（Hex）
- 保存后立即同步到：前台 Tab 列表、上传文件的类型选择、外部直链的类型选择、Hero 统计数字
- 数据存储在 R2 的 `_admin/categories.json`

---

### 📤 分享管理

生成带限制条件的文件分享链接，供他人下载。

**创建分享：**
- 分享标题：显示在分享页面的标题
- 有效期：1天 / 7天 / 30天 / 永久
- 访问密码：可选，访问时需输入
- 最大访问次数：0 为不限
- 描述：可选说明文字
- 文件列表：每行一个，支持 R2 路径（如 `media/movies/xxx/movie.mp4`）或 https:// 外部直链

**分享页面（`/share/[id]`）：**
- 自动验证有效期和访问次数，超限显示对应错误页
- 有密码时显示密码输入界面
- R2 文件自动生成预签名下载链接（1小时有效）
- 支持单文件下载、复制链接、一键复制全部链接

---

### 💾 临时网盘

上传任意文件到 R2 的 `drive/` 目录，不在前台展示，用于临时存储和分发文件。

**上传：** 拖放或点击选择文件，支持多文件批量上传，实时进度显示。

**文件列表操作：**
- **⬇ 下载**：获取预签名直链后直接触发浏览器下载（链接 1 小时有效）
- **分享**：一键将文件路径添加到分享管理的文件列表
- **删除**：确认后从 R2 删除

---

### 🔑 上传令牌

生成带时效的上传链接，发给他人后可在有效期内上传文件到指定目录，无需账号。

**令牌配置：**
- 令牌名称：同时作为 R2 存储目录名（文件存入 `drive/[令牌名]/`）
- 开始时间：留空则立即生效
- 结束时间：必填，超时后链接失效
- 最大文件数：0 为不限
- 单文件大小限制（MB）：0 为不限，超限文件在上传页面自动跳过
- 访问密码：可选

**创建后：** 链接自动复制到剪贴板，格式为 `/upload/[id]`。

**访客上传页面（`/upload/[token]`）：**
- 自动验证时间段、文件数量上限、密码
- 显示截止时间倒计时状态（颜色提示：正常/黄色警告/红色紧急）
- 超限文件自动跳过并给出提示
- 上传进度实时显示

---

### ☁️ 云盘（Alist 挂载）

挂载 Alist 或兼容 Alist API 的网盘服务，在后台直接浏览和管理云盘内容，并将文件一键添加到媒体库。所有操作通过 Cloudflare Function 代理，无跨域问题，支持任意位置部署的 Alist。

#### 配置云盘

填写以下信息：
- **名称**：显示标签，自定义即可
- **Alist 地址**：如 `https://alist.example.com`（不含末尾斜杠）
- **Token**：在 Alist 后台 → 设置 → 其他 → 令牌 中复制内置 Token

点击「🔌 测试连接」验证 Token 是否有效，成功后显示账号用户名。保存后配置存入 R2 的 `_admin/alist-configs.json`，Token 仅在服务端使用，不暴露给前端。

支持配置多个云盘，可随时编辑或删除。

#### 浏览文件

点击「浏览」进入目录浏览界面：

- 顶部面包屑显示当前路径
- 点击文件夹进入下一级，点击「← 返回上级」退回，退到根目录后收起浏览器
- 文件显示图标、文件名、大小

**文件夹操作：**
- **重命名**：修改文件夹名称
- **删除**：删除文件夹及其内部所有内容（不可恢复）

**文件操作：**
- **⬇ 下载**：获取直链后直接触发浏览器下载
- **＋ 媒体库**（仅媒体格式文件显示）：获取文件直链，同时自动搜索同目录的封面图（`poster.jpg` / `cover.jpg` / `folder.jpg` 等），填入添加弹窗后确认即可将该文件作为外部直链添加到媒体库
- **重命名**：修改文件名
- **删除**：删除单个文件

#### 上传文件

点击「⬆ 上传文件」选择本地文件，上传到**当前浏览的目录**，支持多文件批量上传，实时进度条显示。上传完成后自动刷新目录。

#### 新建文件夹

点击「📁 新建文件夹」输入名称，在当前目录创建新文件夹。

#### 封面图代理

Alist 返回的图片直链有时会触发强制下载而非直接显示，系统通过 `/api/alist/image` 代理接口修正 `Content-Type`，确保封面图在前台和后台都能正常渲染。

---

## 前台功能说明

- 动态加载所有媒体（R2 + 外部直链合并），按分类筛选，关键词搜索
- Hero 区域显示各分类作品数量，跟随自定义分类动态变化
- 点击卡片弹窗播放，支持 HLS（.m3u8）和普通视频/音频
- 电视剧支持分集列表侧边栏
- 播放进度自动保存到 localStorage，下次从上次位置继续
- 页面底部中央低调管理入口（`· · ·`）

---

## 版本更新日志
- V1.0.1 增加PWA支持
- v1.1.0 增加云盘目录递归扫描，支持一键批量添加媒体直链
- v1.2.0 该版本进行了较大的功能增加，增加了硬件转码外挂、list 深度集成、端到端工作流等，外加修复了电视剧侧边栏与后台按钮移位等问题


## 常见问题

**文件列表空白 / 所有接口 401**
`_auth_helper.js` 必须是 HMAC-SHA256 版本，简化版（直接比对 `env.ADMIN_TOKEN`）会导致所有鉴权接口返回 401。

**上传中文路径失败**
`upload-url.js` 中 canonical request 和实际 URL 必须使用相同的编码路径（`key.split('/').map(encodeURIComponent).join('/')`）。

**上传到 R2 失败（CORS 错误）**
检查 R2 CORS Policy，`AllowedOrigins` 必须包含实际访问的域名。

**分享链接 Error 1000**
`functions/share/[id].js` 不能 `fetch` 自己的域名，HTML 必须内联在 Function 里返回。

**云盘封面图不显示**
封面图链接需经过 `/api/alist/image?url=` 代理。`openAlistAddModal` 函数中调用 `proxyAlistImage()` 处理封面 URL。

**登录后 Token 失效**
修改 `TOKEN_SECRET` 或重新部署后旧 Token 失效，退出重新登录即可。

**网盘复制链接打开返回主页**
R2 不对外开放直接访问，必须通过 `/api/admin/download-url` 生成预签名链接。

**部署后改动不生效**
检查 Cloudflare Pages 部署列表，确认最新 commit 已被设为生产版本（Promote to Production）。

---

## 版权与开源

Copyright © 2026 Kingsley Qi. All rights reserved.

本项目为个人私有项目，源码仅供学习参考，未经授权不得用于商业用途。

### 使用的开源组件

| 组件 | 用途 | 协议 |
|------|------|------|
| [Cloudflare Pages](https://pages.cloudflare.com) | 前端托管 & Edge Functions | 商业服务 |
| [Cloudflare R2](https://developers.cloudflare.com/r2) | 对象存储 | 商业服务 |
| [HLS.js](https://github.com/video-dev/hls.js) | HLS 视频流播放 | Apache-2.0 |
| [IBM Plex Mono / Sans](https://github.com/IBM/plex) | 字体 | SIL OFL 1.1 |
| [Cormorant Garamond](https://github.com/CatharsisFonts/Cormorant) | 字体 | SIL OFL 1.1 |
| [DM Mono](https://github.com/googlefonts/dm-mono) | 字体 | SIL OFL 1.1 |
| [Alist](https://github.com/alist-org/alist) | 云盘挂载服务 | AGPL-3.0 |

### 致谢

- [Cloudflare](https://cloudflare.com) — 提供免费的全球边缘网络
- [Alist](https://alist.nn.ci) — 优秀的多存储聚合网盘程序
- 
