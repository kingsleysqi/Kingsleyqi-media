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
    const safe = configs
      .map(c => ({
        ...c,
        enabled: c.enabled !== false,
        order: typeof c.order === 'number' ? c.order : 0,
        note: typeof c.note === 'string' ? c.note : '',
        token: c.token ? '••••••' + c.token.slice(-4) : '',
      }))
      .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
    return json({ configs: safe });
  } catch (err) { return json({ error: err.message }, 500); }
}

async function handlePost(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, name, url } = body;
    let { token } = body;
    const enabled = body.enabled !== false;
    const order = typeof body.order === 'number' ? body.order : parseInt(body.order, 10) || 0;
    const note = typeof body.note === 'string' ? body.note : '';
    if (!name || !url) return json({ error: 'name and url required' }, 400);

    const configs = await getConfigs(env);
    const newId = id || generateId();
    const existing = configs.findIndex(c => c.id === newId);
    const created = existing >= 0 ? (configs[existing].created || Date.now()) : Date.now();
    const prevToken = existing >= 0 ? configs[existing].token : '';

    // token 允许留空以保留原 token（编辑场景）
    if (typeof token !== 'string') token = '';
    token = token.trim();
    if (!token) token = prevToken;
    if (!token) return json({ error: 'token required' }, 400); // 新建必须给 token

    if (existing >= 0) {
      // 如果 token 是 masked，保留原来的
      if (body.token && String(body.token).startsWith('••••••')) {
        token = prevToken;
      }
      configs[existing] = { ...configs[existing], id: newId, name, url: url.replace(/\/$/, ''), token, enabled, order, note, created };
    } else {
      configs.push({ id: newId, name, url: url.replace(/\/$/, ''), token, enabled, order, note, created });
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
