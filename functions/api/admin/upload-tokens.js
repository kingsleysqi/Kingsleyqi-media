/**
 * /api/admin/upload-tokens
 * GET              → { tokens }
 * POST { ...data } → { id }
 * DELETE { id }    → { ok }
 */
import { verifyAuth } from './_auth_helper.js';

const INDEX_KEY = '_admin/upload-tokens/_index.json';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);
  if (request.method === 'GET') return handleGet(env);
  if (request.method === 'POST') return handlePost(request, env);
  if (request.method === 'DELETE') return handleDelete(request, env);
  return json({ error: 'Method not allowed' }, 405);
}

async function handleGet(env) {
  try {
    const index = await getIndex(env);
    const tokens = await Promise.all(index.map(id => getToken(env, id)));
    return json({ tokens: tokens.filter(Boolean) });
  } catch (err) { return json({ error: err.message }, 500); }
}

async function handlePost(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, startTime, endTime, maxFiles, maxFileSize, password } = body;
    if (!name) return json({ error: 'name required' }, 400);
    if (!endTime) return json({ error: 'endTime required' }, 400);
    const id = generateId();
    const token = {
      id, name,
      startTime: startTime || Date.now(),
      endTime,
      maxFiles: maxFiles || 0,
      maxFileSize: maxFileSize || 0,
      password: password || null,
      uploadCount: 0,
      created: Date.now(),
    };
    await env.MEDIA_BUCKET.put(`_admin/upload-tokens/${id}.json`, JSON.stringify(token), {
      httpMetadata: { contentType: 'application/json' }
    });
    const index = await getIndex(env);
    index.unshift(id);
    await saveIndex(env, index);
    return json({ id, ok: true });
  } catch (err) { return json({ error: err.message }, 500); }
}

async function handleDelete(request, env) {
  try {
    const { id } = await request.json().catch(() => ({}));
    if (!id) return json({ error: 'id required' }, 400);
    await env.MEDIA_BUCKET.delete(`_admin/upload-tokens/${id}.json`);
    const index = await getIndex(env);
    await saveIndex(env, index.filter(i => i !== id));
    return json({ ok: true });
  } catch (err) { return json({ error: err.message }, 500); }
}

async function getIndex(env) {
  try { const o = await env.MEDIA_BUCKET.get(INDEX_KEY); return o ? await o.json() : []; } catch { return []; }
}
async function saveIndex(env, index) {
  await env.MEDIA_BUCKET.put(INDEX_KEY, JSON.stringify(index), { httpMetadata: { contentType: 'application/json' } });
}
async function getToken(env, id) {
  try { const o = await env.MEDIA_BUCKET.get(`_admin/upload-tokens/${id}.json`); return o ? await o.json() : null; } catch { return null; }
}
function generateId() {
  const b = new Uint8Array(9); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
function cors() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}
