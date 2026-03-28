/**
 * /api/admin/shares
 * GET                    → { shares }           读取所有分享
 * POST { ...shareData }  → { id }               创建分享
 * DELETE { id }          → { ok }               删除分享
 *
 * 每条分享存储在 R2 的 _admin/shares/{id}.json
 * 索引存储在 _admin/shares/_index.json
 */

import { verifyAuth } from './_auth_helper.js';

const INDEX_KEY = '_admin/shares/_index.json';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();

  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET') return handleGet(env);
  if (request.method === 'POST') return handlePost(request, env);
  if (request.method === 'DELETE') return handleDelete(request, env);

  return json({ error: 'Method not allowed' }, 405);
}

/* ── GET: 返回所有分享（含详情） ── */
async function handleGet(env) {
  try {
    const index = await getIndex(env);
    // 并发读取每个分享的详情
    const shares = await Promise.all(
      index.map(id => getShare(env, id))
    );
    return json({ shares: shares.filter(Boolean) });
  } catch (err) {
    console.error('[shares] GET error:', err);
    return json({ error: err.message }, 500);
  }
}

/* ── POST: 创建新分享 ── */
async function handlePost(request, env) {
  try {
    const body = await request.json().catch(() => ({}));

    const { title, password, expires, maxUse, desc, files } = body;
    if (!title) return json({ error: 'title required' }, 400);

    const id = generateId();
    const share = {
      id,
      title,
      password: password || null,
      expires: expires || 0,          // 0 = 永久
      maxUse: maxUse || 0,            // 0 = 不限
      useCount: 0,
      desc: desc || '',
      files: Array.isArray(files) ? files : [],
      created: Date.now(),
    };

    // 保存分享详情
    await env.MEDIA_BUCKET.put(
      `_admin/shares/${id}.json`,
      JSON.stringify(share),
      { httpMetadata: { contentType: 'application/json' } }
    );

    // 更新索引
    const index = await getIndex(env);
    index.unshift(id);
    await saveIndex(env, index);

    return json({ id, ok: true });
  } catch (err) {
    console.error('[shares] POST error:', err);
    return json({ error: err.message }, 500);
  }
}

/* ── DELETE: 删除分享 ── */
async function handleDelete(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id } = body;
    if (!id) return json({ error: 'id required' }, 400);

    // 删除详情文件
    await env.MEDIA_BUCKET.delete(`_admin/shares/${id}.json`);

    // 更新索引
    const index = await getIndex(env);
    await saveIndex(env, index.filter(i => i !== id));

    return json({ ok: true });
  } catch (err) {
    console.error('[shares] DELETE error:', err);
    return json({ error: err.message }, 500);
  }
}

/* ── index helpers ── */
async function getIndex(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(INDEX_KEY);
    if (!obj) return [];
    return await obj.json();
  } catch { return []; }
}

async function saveIndex(env, index) {
  await env.MEDIA_BUCKET.put(INDEX_KEY, JSON.stringify(index), {
    httpMetadata: { contentType: 'application/json' }
  });
}

async function getShare(env, id) {
  try {
    const obj = await env.MEDIA_BUCKET.get(`_admin/shares/${id}.json`);
    if (!obj) return null;
    return await obj.json();
  } catch { return null; }
}

/* ── ID generator ── */
function generateId() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
