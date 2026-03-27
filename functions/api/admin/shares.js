/**
 * /api/admin/shares
 * GET    → { shares: [...] }         列出所有分享
 * POST   { title, password, expires, maxUse, desc, files } → { id }  创建分享
 * DELETE { id } → 200                删除分享
 *
 * 数据存储在 R2 的 _admin/shares.json
 */

import { verifyAuth } from './_auth_helper.js';

const STORE_KEY = '_admin/shares.json';

export async function onRequest({ request, env }) {
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET') {
    const shares = await loadShares(env);
    return json({ shares });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const shares = await loadShares(env);
    const id = generateId();
    const newShare = {
      id,
      title:    body.title || '未命名分享',
      password: body.password || null,
      expires:  body.expires || 0,       // 0 = 永久
      maxUse:   body.maxUse || 0,        // 0 = 不限
      useCount: 0,
      desc:     body.desc || '',
      files:    Array.isArray(body.files) ? body.files : [],
      created:  Date.now(),
    };
    shares.push(newShare);
    await saveShares(env, shares);
    return json({ id, ok: true });
  }

  if (request.method === 'DELETE') {
    const body = await request.json().catch(() => ({}));
    const shares = await loadShares(env);
    const filtered = shares.filter(s => s.id !== body.id);
    await saveShares(env, filtered);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function loadShares(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(STORE_KEY);
    if (!obj) return [];
    const data = await obj.json();
    return Array.isArray(data.shares) ? data.shares : [];
  } catch { return []; }
}

async function saveShares(env, shares) {
  await env.MEDIA_BUCKET.put(STORE_KEY, JSON.stringify({ shares }), {
    httpMetadata: { contentType: 'application/json' }
  });
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
