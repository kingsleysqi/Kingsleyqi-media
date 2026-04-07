/**
 * /api/admin/folder
 * POST { action, path, newPath?, newName? }
 *
 * action:
 * - mkdir  : create marker under path (must end with / or will be normalized)
 * - rename : rename a folder prefix (path -> newPath)
 * - rmdir  : delete folder prefix recursively
 *
 * Notes:
 * - R2 没有真实目录，这里把“目录”视为 key 前缀。
 * - mkdir 会写入一个 marker：`${path}/.folder`
 * - rename/rmdir 会对整个前缀下的对象批量处理
 */
import { verifyAuth } from './_auth_helper.js';

const ALLOWED = ['media/', 'drive/'];
const MAX_BATCH = 250; // safety

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  let path = (body.path || '').trim();

  if (!action) return json({ error: 'action required' }, 400);
  if (!path) return json({ error: 'path required' }, 400);
  if (path.includes('..') || path.includes('//')) return json({ error: 'Invalid path' }, 400);
  if (!ALLOWED.some(p => path.startsWith(p))) return json({ error: 'Path must be under media/ or drive/' }, 403);

  if (!path.endsWith('/')) path += '/';

  if (action === 'mkdir') {
    const markerKey = `${path}.folder`;
    await env.MEDIA_BUCKET.put(markerKey, '', { httpMetadata: { contentType: 'application/x-directory' } });
    return json({ ok: true, path });
  }

  if (action === 'rmdir') {
    const deleted = await deletePrefix(env.MEDIA_BUCKET, path);
    return json({ ok: true, path, deleted });
  }

  if (action === 'rename') {
    let newPath = (body.newPath || '').trim();
    if (!newPath && body.newName) {
      const parent = path.replace(/\/$/, '').split('/').slice(0, -1).join('/');
      newPath = (parent ? parent + '/' : '') + String(body.newName).trim();
    }
    if (!newPath) return json({ error: 'newPath required' }, 400);
    if (newPath.includes('..') || newPath.includes('//')) return json({ error: 'Invalid newPath' }, 400);
    if (!ALLOWED.some(p => newPath.startsWith(p))) return json({ error: 'newPath must be under media/ or drive/' }, 403);
    if (!newPath.endsWith('/')) newPath += '/';
    if (newPath === path) return json({ ok: true, moved: 0 });

    const moved = await movePrefix(env.MEDIA_BUCKET, path, newPath);
    return json({ ok: true, from: path, to: newPath, moved });
  }

  return json({ error: 'Unknown action' }, 400);
}

async function deletePrefix(bucket, prefix) {
  let cursor;
  let deleted = 0;
  do {
    const listed = await bucket.list({ prefix, limit: 1000, cursor });
    const keys = listed.objects.map(o => o.key);
    // 分批删除
    for (let i = 0; i < keys.length; i += MAX_BATCH) {
      const batch = keys.slice(i, i + MAX_BATCH);
      await Promise.all(batch.map(k => bucket.delete(k)));
      deleted += batch.length;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return deleted;
}

async function movePrefix(bucket, fromPrefix, toPrefix) {
  let cursor;
  let moved = 0;
  do {
    const listed = await bucket.list({ prefix: fromPrefix, limit: 1000, cursor });
    for (const obj of listed.objects) {
      const oldKey = obj.key;
      const newKey = toPrefix + oldKey.slice(fromPrefix.length);
      const oldObj = await bucket.get(oldKey);
      if (!oldObj) continue;
      await bucket.put(newKey, oldObj.body, {
        httpMetadata: oldObj.httpMetadata,
        customMetadata: oldObj.customMetadata,
      });
      await bucket.delete(oldKey);
      moved++;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return moved;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

