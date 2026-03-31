/**
 * /api/alist/list?configId=xxx&path=/xxx
 * GET → { files: [...], folders: [...] }
 * 代理请求 Alist API，绕过 CORS 限制
 */
import { verifyAuth } from '../admin/_auth_helper.js';

const CONFIG_KEY = '_admin/alist-configs.json';

export async function onRequestGet({ request, env }) {
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);
  
  const url = new URL(request.url);
  const configId = url.searchParams.get('configId');
  const path = url.searchParams.get('path') || '/';
  
  if (!configId) return json({ error: 'configId required' }, 400);
  
  const config = await getConfig(env, configId);
  if (!config) return json({ error: 'Config not found' }, 404);
  
  try {
    const res = await fetch(`${config.url}/api/fs/list`, {
      method: 'POST',
      headers: { 'Authorization': config.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, page: 1, per_page: 200, refresh: false })
    });
    
    if (!res.ok) return json({ error: `Alist API error: ${res.status}` }, res.status);
    
    const data = await res.json();
    if (data.code !== 200) return json({ error: data.message || 'Alist error' }, 400);
    
    const content = data.data?.content || [];
    const files = content.filter(f => !f.is_dir).map(f => ({
      name: f.name,
      size: f.size,
      modified: f.modified,
      path: path.replace(/\/$/, '') + '/' + f.name,
      thumb: f.thumb || null,
    }));
    const folders = content.filter(f => f.is_dir).map(f => ({
      name: f.name,
      path: path.replace(/\/$/, '') + '/' + f.name,
    }));
    
    return json({ ok: true, path, files, folders, configId });
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
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}