/**
 * /api/admin/rename
 * POST { from, to } → { ok: true }
 * 兼容 { oldPath, newPath } 字段
 */
import { verifyAuth } from './_auth_helper.js';

const ALLOWED = ['media/', 'drive/'];
const ok = key => ALLOWED.some(p => key.startsWith(p));

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body = {};
  try { body = await request.json(); } catch {}

  // 兼容两种字段名
  const from = body.from || body.oldPath;
  const to   = body.to   || body.newPath;

  if (!from || !to) return json({ error: 'from and to required' }, 400);
  if (!ok(from) || !ok(to)) return json({ error: 'Keys must start with media/ or drive/' }, 400);
  if (from.includes('..') || to.includes('..')) return json({ error: 'Invalid path' }, 400);
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
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
