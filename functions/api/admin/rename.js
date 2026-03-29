/**
 * /api/admin/rename
 * POST { from, to } → 200
 * R2 不支持原生重命名，通过 复制+删除 实现
 *
 * 允许 media/ 和 drive/ 前缀
 */

import { verifyAuth } from './_auth_helper.js';

const ALLOWED = ['media/', 'drive/'];
const isAllowed = key => ALLOWED.some(p => key.startsWith(p));

export async function onRequestPost({ request, env }) {
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { from, to } = await request.json().catch(() => ({}));
  if (!from || !to) return json({ error: 'from and to required' }, 400);

  if (!isAllowed(from) || !isAllowed(to)) {
    return json({ error: 'Keys must start with media/ or drive/' }, 400);
  }

  if (from === to) return json({ ok: true });

  try {
    const obj = await env.MEDIA_BUCKET.get(from);
    if (!obj) return json({ error: 'Source file not found' }, 404);

    await env.MEDIA_BUCKET.put(to, obj.body, {
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
    });

    await env.MEDIA_BUCKET.delete(from);

    return json({ ok: true });
  } catch (err) {
    console.error('[rename]', err);
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
