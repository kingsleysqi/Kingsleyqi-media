/**
 * /api/alist/link
 * POST { configId, path } → { url, name }
 * 代理获取 Alist 文件直链
 */
import { verifyAuth } from '../admin/_auth_helper.js';

const CONFIG_KEY = '_admin/alist-configs.json';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body = {};
  try { body = await request.json(); } catch {}

  const { configId, path } = body;
  if (!configId || !path) return json({ error: 'configId and path required' }, 400);

  const config = await getConfig(env, configId);
  if (!config) return json({ error: 'Config not found' }, 404);

  try {
    const res = await fetch(`${config.url}/api/fs/get`, {
      method: 'POST',
      headers: { 'Authorization': config.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });

    if (!res.ok) return json({ error: `Alist API error: ${res.status}` }, res.status);

    const data = await res.json();
    if (data.code !== 200) return json({ error: data.message || 'Alist error' }, 400);

    const fileData = data.data;
    const rawUrl = fileData?.raw_url || fileData?.url || '';
    const name = fileData?.name || path.split('/').pop();

    if (!rawUrl) return json({ error: '无法获取直链，请检查 Alist 存储配置' }, 400);

    return json({ ok: true, url: rawUrl, name, size: fileData?.size, thumb: fileData?.thumb });
  } catch (err) {
    return json({ error: '无法连接 Alist：' + err.message }, 500);
  }
}

async function getConfig(env, id) {
  try {
    const obj = await env.MEDIA_BUCKET.get(CONFIG_KEY);
    if (!obj) return null;
    const configs = await obj.json();
    return configs.find(c => c.id === id) || null;
  } catch { return null; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
function cors() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}
