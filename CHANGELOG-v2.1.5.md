# Kingsley Media v2.1.5

## 新功能
- **文本记忆面板跨平台支持**：后台管理界面的文本记忆面板现在支持跨平台同步，所有登录的管理员可以共享和同步文本内容，不再因刷新页面而丢失。

## 技术改进
- 添加了KV存储支持，用于持久化文本记忆。
- 新增 `/api/admin/memo` API端点，用于获取和保存文本记忆。
- 增强了错误处理和用户反馈。

## 部署说明
1. 创建KV namespace：
   ```bash
   npx wrangler kv:namespace create MEMO_KV
   ```
   记录输出的namespace ID。

2. 更新 `wrangler.toml` 中的 `id` 为实际的namespace ID：
   ```toml
   [[kv_namespaces]]
   binding = "MEMO_KV"
   id = "实际的namespace-id"
   ```

3. 部署：
   ```bash
   npx wrangler deploy
   ```

## 故障排除
- 如果文本记忆无法保存或加载，检查浏览器控制台是否有错误信息。
- 确保KV namespace已正确创建并绑定。
- 确认环境变量 `TOKEN_SECRET` 或 `ADMIN_PASSWORD` 已设置。

## 兼容性
- 需要Cloudflare Workers KV支持。
- 向后兼容，不影响现有功能。