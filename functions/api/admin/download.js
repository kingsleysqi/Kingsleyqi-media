/**
 * /api/admin/download
 * GET ?key=... → 以 attachment 方式下载 R2 对象（同域，避免 download 属性在跨域失效）
 */
import { verifyAuth } from './_auth_helper.js';
 
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return new Response('Unauthorized', { status: 401 });
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
 
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  if (!key) return new Response('key required', { status: 400 });
  if (key.includes('..') || key.includes('//')) return new Response('Invalid key', { status: 400 });
 
  const obj = await env.MEDIA_BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
 
  const filename = key.split('/').pop() || 'download';
  const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';
 
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Disposition', contentDisposition(filename));
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
 
  if (obj.size != null) headers.set('Content-Length', String(obj.size));
 
  // HEAD 请求只返回 headers
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
 
  return new Response(obj.body, { status: 200, headers });
}
 
function contentDisposition(filename) {
  // 同时给 filename 和 RFC5987 filename*，兼容中文/空格
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
