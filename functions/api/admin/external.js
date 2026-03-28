/**
 * /api/admin/external
 * GET              → { items }         读取外部直链列表
 * POST { items }   → { ok }            保存外部直链列表
 *
 * 数据存储在 R2 的 _admin/external.json
 * /api/list 读取同一份文件以合并显示
 */

import { verifyAuth } from './_auth_helper.js';

const STORAGE_KEY = '_admin/external.json';

export async function onRequest({ request, env }) {
  // CORS preflight
  if (request.method === 'OPTIONS') return cors();

  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET') {
    return handleGet(env);
  }

  if (request.method === 'POST') {
    return handlePost(request, env);
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function handleGet(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(STORAGE_KEY);
    if (!obj) return json({ items: [] });
    const data = await obj.json();
    return json({ items: data.items || [] });
  } catch (err) {
    console.error('[external] GET error:', err);
    return json({ items: [] });
  }
}

async function handlePost(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];

    // 基本校验：每个 item 必须有 type / name / id
    for (const item of items) {
      if (!item.type || !item.name) {
        return json({ error: 'Each item must have type and name' }, 400);
      }
      // 确保 id 存在
      if (!item.id) item.id = `${item.type}/${item.name}`;
    }

    const payload = JSON.stringify({ items, updatedAt: Date.now() });
    await env.MEDIA_BUCKET.put(STORAGE_KEY, payload, {
      httpMetadata: { contentType: 'application/json' }
    });

    return json({ ok: true, count: items.length });
  } catch (err) {
    console.error('[external] POST error:', err);
    return json({ error: err.message }, 500);
  }
}

/* ── helpers ── */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
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
