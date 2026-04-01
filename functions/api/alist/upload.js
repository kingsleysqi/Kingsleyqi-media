/**
 * /api/alist/upload
 * POST (multipart) configId + path + file → { ok }
 * 代理上传文件到 Alist 当前目录
 */
import { verifyAuth } from '../admin/_auth_helper.js';

const CONFIG_KEY = '_admin/alist-configs.json';

export async function onRequestPost({ request, env }) {
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  try {
    const formData = await request.formData();
    const configId = formData.get('configId');
    const dirPath  = formData.get('path') || '/';
    const file     = formData.get('file');

    if (!configId || !file) return json({ error: 'configId and file required' }, 400);

    const config = await getConfig(env, configId);
    if (!config) return json({ error: 'Config not found' }, 404);

    const fileName = file.name;
    const uploadPath = dirPath.replace(/\/$/, '') + '/' + fileName;

    const res = await fetch(`${config.url}/api/fs/put`, {
      method: 'PUT',
      headers: {
        'Authorization': config.token,
        'File-Path': encodeURIComponent(uploadPath),
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Length': file.size,
      },
      body: file.stream(),
      duplex: 'half',
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return json({ error: `Alist upload failed: ${res.status} ${txt}` }, res.status);
    }

    const data = await res.json().catch(() => ({}));
    if (data.code && data.code !== 200) return json({ error: data.message || 'Upload failed' }, 400);

    return json({ ok: true, path: uploadPath, name: fileName });
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
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
