/**
 * /api/alist/manage
 * POST { configId, action, path, name?, newName? } → { ok }
 * action: 'rename' | 'delete'
 * 代理 Alist 文件管理操作，绕过 CORS
 */
import { verifyAuth } from '../admin/_auth_helper.js';

const CONFIG_KEY = '_admin/alist-configs.json';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body = {};
  try { body = await request.json(); } catch {}

  const { configId, action, path, name, newName } = body;
  if (!configId || !action || !path) return json({ error: 'configId, action, path required' }, 400);

  const config = await getConfig(env, configId);
  if (!config) return json({ error: 'Config not found' }, 404);

  try {
    if (action === 'rename') {
      if (!newName) return json({ error: 'newName required' }, 400);
      const res = await fetch(`${config.url}/api/fs/rename`, {
        method: 'POST',
        headers: { 'Authorization': config.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, name: newName })
      });
      const data = await res.json();
      if (data.code !== 200) return json({ error: data.message || 'Rename failed' }, 400);
      return json({ ok: true });
    }

    if (action === 'delete') {
      const dir = path.substring(0, path.lastIndexOf('/')) || '/';
      const fileName = name || path.split('/').pop();
      const res = await fetch(`${config.url}/api/fs/remove`, {
        method: 'POST',
        headers: { 'Authorization': config.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir, names: [fileName] })
      });
      const data = await res.json();
      if (data.code !== 200) return json({ error: data.message || 'Delete failed' }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
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
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }});
}