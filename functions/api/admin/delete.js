/**
 * /api/admin/delete
 * POST { key } → 200
 *
 * 允许删除 media/ 和 drive/ 前缀的文件
 */

import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { key } = await request.json().catch(() => ({}));
  if (!key) return json({ error: 'key required' }, 400);

  // 允许 media/ 和 drive/，禁止 _admin/（保护配置文件）
  if (!key.startsWith('media/') && !key.startsWith('drive/')) {
    return json({ error: 'Invalid key' }, 400);
  }

  await env.MEDIA_BUCKET.delete(key);
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
