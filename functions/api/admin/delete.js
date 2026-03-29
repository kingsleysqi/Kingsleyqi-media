/**
 * /api/admin/delete
 * POST { key } → { ok: true }
 * 兼容 { path } 字段（旧版管理页）
 */
import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return cors();

  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body = {};
  try { body = await request.json(); } catch {}

  // 兼容 key 和 path 两种字段名
  const target = body.key || body.path;
  if (!target) return json({ error: 'key required' }, 400);

  if (!target.startsWith('media/') && !target.startsWith('drive/')) {
    return json({ error: 'Invalid key' }, 400);
  }
  if (target.includes('..')) return json({ error: 'Invalid path' }, 400);

  await env.MEDIA_BUCKET.delete(target);
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
