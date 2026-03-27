/**
 * /api/admin/rename
 * POST { from, to } → 200
 * R2 不支持原生重命名，通过 复制+删除 实现
 */

import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { from, to } = await request.json().catch(() => ({}));
  if (!from || !to) return json({ error: 'from and to required' }, 400);
  if (!from.startsWith('media/') || !to.startsWith('media/')) {
    return json({ error: 'Keys must start with media/' }, 400);
  }
  if (from === to) return json({ ok: true });

  try {
    // 1. 读取原文件
    const obj = await env.MEDIA_BUCKET.get(from);
    if (!obj) return json({ error: 'Source file not found' }, 404);

    // 2. 写入新位置
    await env.MEDIA_BUCKET.put(to, obj.body, {
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
    });

    // 3. 删除原文件
    await env.MEDIA_BUCKET.delete(from);

    return json({ ok: true });
  } catch (err) {
    console.error('[rename]', err);
    return json({ error: err.message }, 500);
  }
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }
  });
}
