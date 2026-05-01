# Kingsley Media v2.1.5

## 新功能
- **文本记忆面板跨平台支持**：后台管理界面的文本记忆面板现在支持跨平台同步，所有登录的管理员可以共享和同步文本内容，不再因刷新页面而丢失。
- **播放器UI优化**：改进进度条自动隐藏逻辑，修复全屏状态下进度条显示问题。
- **手势控制**：新增类似Bilibili的手势操作功能，支持左右滑动调节进度、上下滑动调节音量/亮度。
- **音乐合辑管理**：支持在批量添加音乐直链时创建音乐合辑，包含确认环节和合集信息管理。
- **播放模式**：视频列表和音乐列表新增顺序播放和随机播放功能。

## 技术改进
- 添加了KV存储支持，用于持久化文本记忆。
- 新增 `/api/admin/memo` API端点，用于获取和保存文本记忆。
- 增强了播放器控制逻辑，支持手势操作和播放模式切换。
- 改进了后台管理界面，支持音乐合辑的创建和管理。
- 增强了错误处理和用户反馈。

## 部署说明
1. 创建KV namespace：
   ```bash
   npx wrangler kv:namespace create MEMO_KV
   ```
   记录输出的namespace ID。

2. 在 Cloudflare Pages Dashboard 中绑定KV：
   - 进入 Pages 项目 → Settings → Functions → KV namespace bindings
   - 添加绑定：变量名 `MEMO_KV`，选择 `MEMO_KV` namespace

3. 部署：
   ```bash
   npx wrangler pages deploy .
   ```

## 故障排除
- 如果文本记忆无法保存或加载，检查浏览器控制台是否有错误信息。
- 确保KV namespace已正确创建并在Pages中绑定。
- 确认环境变量 `TOKEN_SECRET` 或 `ADMIN_PASSWORD` 已设置。

## 兼容性
- 需要Cloudflare Workers KV支持。
- 向后兼容，不影响现有功能。