/**
 * /api/alist/url-proxy
 * GET/HEAD ?url=...&exp=...&sig=...
 *
 * 仅用于 HLS 播放列表内的绝对 URL 分片转发。
 * 通过 HMAC( TOKEN_SECRET ) 校验，避免变成任意代理。
 */
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

  const u = new URL(request.url);
  const target = u.searchParams.get('url') || '';
  const expStr = u.searchParams.get('exp') || '';
  const sig = u.searchParams.get('sig') || '';

  let exp = 0;
  try { exp = parseInt(expStr, 10); } catch {}
  if (!target || !exp || !sig) return new Response('Missing params', { status: 400 });
  if (Date.now() > exp) return new Response('Expired', { status: 403 });

  let targetUrl;
  try { targetUrl = new URL(target); } catch { return new Response('Invalid url', { status: 400 }); }
  if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') return new Response('Invalid url', { status: 400 });

  const secret = env.TOKEN_SECRET || env.ADMIN_PASSWORD || 'default-secret';
  const expected = await hmacHex(`${target}|${exp}`, secret);
  if (sig !== expected) return new Response('Bad signature', { status: 403 });

  const upstreamHeaders = new Headers();
  const range = request.headers.get('Range');
  if (range) upstreamHeaders.set('Range', range);
  const ifNoneMatch = request.headers.get('If-None-Match');
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  if (ifNoneMatch) upstreamHeaders.set('If-None-Match', ifNoneMatch);
  if (ifModifiedSince) upstreamHeaders.set('If-Modified-Since', ifModifiedSince);

  const upstreamRes = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    redirect: 'follow',
  });

  const headers = new Headers(upstreamRes.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified');
  headers.delete('Content-Disposition');

  return new Response(request.method === 'HEAD' ? null : upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  });
}

async function hmacHex(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, If-None-Match, If-Modified-Since, Content-Type',
    }
  });
}

