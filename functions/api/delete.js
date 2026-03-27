/**
 * /api/admin/delete
 * POST { key } → 200
 */

import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { key } = await request.json().catch(() => ({}));
  if (!key) return json({ error: 'key required' }, 400);
  if (!key.startsWith('media/')) return json({ error: 'Invalid key' }, 400);

  await env.MEDIA_BUCKET.delete(key);
  return json({ ok: true });
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }
  });
}
