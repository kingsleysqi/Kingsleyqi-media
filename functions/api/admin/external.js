/**
 * /api/admin/external
 * GET  → { items: [...] }   读取外部直链列表
 * POST { items } → 200      保存外部直链列表
 *
 * 数据存储在 R2 的 _admin/external.json
 */

import { verifyAuth } from './_auth_helper.js';

const STORE_KEY = '_admin/external.json';

export async function onRequest({ request, env }) {
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET') {
    try {
      const obj = await env.MEDIA_BUCKET.get(STORE_KEY);
      if (!obj) return json({ items: [] });
      const data = await obj.json();
      return json(data);
    } catch {
      return json({ items: [] });
    }
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    await env.MEDIA_BUCKET.put(STORE_KEY, JSON.stringify({ items }), {
      httpMetadata: { contentType: 'application/json' }
    });
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
