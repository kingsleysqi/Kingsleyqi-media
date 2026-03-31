/**
 * /api/admin/alist-config
 * GET  → { configs }          读取所有 Alist 配置
 * POST { ...data } → { ok }   保存/更新配置
 * DELETE { id } → { ok }      删除配置
 */
import { verifyAuth } from './_auth_helper.js';

const CONFIG_KEY = '_admin/alist-configs.json';

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
    const configs = await getConfigs(env);
    // token 不返回给前端，只返回 masked 版本
    const safe = configs.map(c => ({ ...c, token: c.token ? '••••••' + c.token.slice(-4) : '' }));
    return json({ configs: safe });
  } catch (err) { return json({ error: err.message }, 500); }
}

async function handlePost(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, name, url, token } = body;
    if (!name || !url || !token) return json({ error: 'name, url, token required' }, 400);

    const configs = await getConfigs(env);
    const newId = id || generateId();
    const existing = configs.findIndex(c => c.id === newId);
    const cfg = { id: newId, name, url: url.replace(/\/$/, ''), token, created: Date.now() };

    if (existing >= 0) {
      // 如果 token 是 masked，保留原来的
      if (body.token && body.token.startsWith('••••••')) {
        cfg.token = configs[existing].token;
      }
      configs[existing] = cfg;
    } else {
      configs.push(cfg);
    }

    await saveConfigs(env, configs);
    return json({ ok: true, id: newId });
  } catch (err) { return json({ error: err.message }, 500); }
}

async function handleDelete(request, env) {
  try {
    const { id } = await request.json().catch(() => ({}));
    if (!id) return json({ error: 'id required' }, 400);
    const configs = await getConfigs(env);
    await saveConfigs(env, configs.filter(c => c.id !== id));
    return json({ ok: true });
  } catch (err) { return json({ error: err.message }, 500); }
}

async function getConfigs(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(CONFIG_KEY);
    return obj ? await obj.json() : [];
  } catch { return []; }
}

async function saveConfigs(env, configs) {
  await env.MEDIA_BUCKET.put(CONFIG_KEY, JSON.stringify(configs), {
    httpMetadata: { contentType: 'application/json' }
  });
}

function generateId() {
  const b = new Uint8Array(6); crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
function cors() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}
