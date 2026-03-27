/**
 * /api/admin/files
 * GET → { files: [{ key, size, uploaded }] }
 */

import { verifyAuth } from './_auth_helper.js';

export async function onRequestGet({ request, env }) {
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!env.MEDIA_BUCKET) {
    return json({ error: 'MEDIA_BUCKET not bound' }, 500);
  }

  const files = [];
  let cursor;

  do {
    const opts = { prefix: 'media/', limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const listed = await env.MEDIA_BUCKET.list(opts);
    for (const obj of listed.objects) {
      files.push({
        key:      obj.key,
        size:     obj.size,
        uploaded: obj.uploaded,
      });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  files.sort((a, b) => a.key.localeCompare(b.key));
  return json({ files });
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }
  });
}
