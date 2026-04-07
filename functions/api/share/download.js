/**
 * /api/share/download
 * GET ?id=...&key=...&password=...
 * 从分享里校验权限后，以 attachment 方式下载对应 R2 对象（同域，避免跨域 download 失效）
 */
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
 
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  const key = (url.searchParams.get('key') || '').trim();
  const password = url.searchParams.get('password') || '';
 
  if (!id || !key) return new Response('id and key required', { status: 400 });
  if (key.includes('..') || key.includes('//')) return new Response('Invalid key', { status: 400 });
 
  const shareKey = `_admin/shares/${id}.json`;
  const shareObj = await env.MEDIA_BUCKET.get(shareKey);
  if (!shareObj) return json({ error: 'Not found' }, 404);
 
  let share;
  try { share = await shareObj.json(); } catch { return json({ error: 'Not found' }, 404); }
 
  if (share.expires && share.expires < Date.now()) return json({ error: 'This share has expired', expired: true }, 410);
  if (share.maxUse > 0 && share.useCount >= share.maxUse) return json({ error: 'Access limit reached', limitReached: true }, 403);
 
  if (share.password) {
    if (!password) return json({ needPassword: true }, 401);
    if (password !== share.password) return json({ error: 'Wrong password', wrongPassword: true }, 401);
  }
 
  const files = Array.isArray(share.files) ? share.files : [];
  if (!files.includes(key)) return json({ error: 'File not in this share' }, 403);
  if (key.startsWith('http://') || key.startsWith('https://')) return json({ error: 'External link is not downloadable via this endpoint' }, 400);
 
  const obj = await env.MEDIA_BUCKET.get(key);
  if (!obj) return json({ error: 'File not found' }, 404);
 
  const filename = key.split('/').pop() || 'download';
  const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';
 
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Disposition', contentDisposition(filename));
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
  if (obj.size != null) headers.set('Content-Length', String(obj.size));
 
  // 访问次数仍然 +1（异步，不阻塞下载）
  incrementUseCount(env, shareKey, share).catch(console.error);
 
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(obj.body, { status: 200, headers });
}
 
async function incrementUseCount(env, key, share) {
  share.useCount = (share.useCount || 0) + 1;
  await env.MEDIA_BUCKET.put(key, JSON.stringify(share), {
    httpMetadata: { contentType: 'application/json' }
  });
}
 
function contentDisposition(filename) {
  const fallback = filename.replace(/[\r\n"]/g, '_');
  const encoded = encodeRFC5987ValueChars(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
 
function encodeRFC5987ValueChars(str) {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')
    .replace(/%(7C|60|5E)/g, (m) => m.toLowerCase());
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
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
