/**
 * /api/admin/meta
 * GET  → { meta }
 * POST → { ok } body: { meta }
 *
 * 用于覆盖 R2 扫描出来的媒体元信息（标题/年份/封面等），不改对象真实路径。
 */
import { verifyAuth } from './_auth_helper.js';

const KEY = '_admin/meta.json';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  if (request.method === 'GET') {
    const meta = await loadMeta(env);
    return json({ meta });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
    await env.MEDIA_BUCKET.put(KEY, JSON.stringify({ meta, updatedAt: Date.now() }), {
      httpMetadata: { contentType: 'application/json' }
    });
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function loadMeta(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(KEY);
    if (!obj) return {};
    const data = await obj.json();
    return data.meta && typeof data.meta === 'object' ? data.meta : {};
  } catch {
    return {};
  }
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

