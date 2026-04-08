/**
 * /api/alist/stream
 * GET/HEAD ?configId=...&path=...
 * 公共同域流式代理：用服务端 token 获取 raw_url，再转发（支持 Range），解决跨域/CORS/Range 导致的无法播放
 */
const CONFIG_KEY = '_admin/alist-configs.json';
 
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
 
  const url = new URL(request.url);
  const configId = url.searchParams.get('configId') || '';
  const path = url.searchParams.get('path') || '';
  if (!configId || !path) return new Response('configId and path required', { status: 400 });
 
  const config = await getConfig(env, configId);
  if (!config) return new Response('Config not found', { status: 404 });
 
  // 1) 先从 Alist 获取 raw_url
  let rawUrl = '';
  try {
    const metaRes = await fetch(`${config.url}/api/fs/get`, {
      method: 'POST',
      headers: { 'Authorization': config.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    if (!metaRes.ok) return new Response(`Alist API error: ${metaRes.status}`, { status: metaRes.status });
    const meta = await metaRes.json().catch(() => ({}));
    const fileData = meta?.data || meta?.data?.data || meta?.data;
    rawUrl = fileData?.raw_url || fileData?.url || meta?.data?.raw_url || '';
  } catch (err) {
    return new Response('Unable to reach Alist: ' + err.message, { status: 502 });
  }
 
  if (!rawUrl) return new Response('Unable to get raw url', { status: 400 });

  // HLS 播放列表（m3u8）需要重写内部分片地址，否则播放器会跨域拉分片导致失败
  const isM3u8 = path.toLowerCase().endsWith('.m3u8');
 
  // 2) 转发 raw_url（带 Range）
  const upstreamHeaders = new Headers();
  // 某些网盘直链会校验 UA/Referer，否则返回 403/空内容
  try {
    const u = new URL(rawUrl);
    upstreamHeaders.set('User-Agent', 'Mozilla/5.0');
    upstreamHeaders.set('Referer', `${u.origin}/`);
    upstreamHeaders.set('Accept', '*/*');
  } catch {}
  const range = request.headers.get('Range');
  // m3u8 本身不需要 Range，避免上游返回奇怪的 206 文本切片
  if (range && !isM3u8) upstreamHeaders.set('Range', range);
  // 传递必要的 if-* 头，提升 seek/缓存命中
  const ifNoneMatch = request.headers.get('If-None-Match');
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  if (ifNoneMatch) upstreamHeaders.set('If-None-Match', ifNoneMatch);
  if (ifModifiedSince) upstreamHeaders.set('If-Modified-Since', ifModifiedSince);
 
  const upstreamRes = await fetch(rawUrl, {
    method: request.method,
    headers: upstreamHeaders,
    redirect: 'follow',
  });
 
  // 复制响应头，但补齐 CORS + 暴露 Range 相关 header
  const headers = new Headers(upstreamRes.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified');
  // 避免某些上游返回强制下载
  headers.delete('Content-Disposition');

  const upstreamType = (upstreamRes.headers.get('Content-Type') || '').toLowerCase();
  const isPlaylist = isM3u8 || upstreamType.includes('mpegurl') || upstreamType.includes('application/vnd.apple.mpegurl');

  if (isPlaylist && request.method !== 'HEAD') {
    const playlistText = await upstreamRes.text();
    const rewritten = await rewriteM3U8({
      playlistText,
      rawUrl,
      alistPath: path,
      configId,
      env,
    });
    headers.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    headers.delete('Content-Length');
    return new Response(rewritten, { status: upstreamRes.status, headers });
  }

  return new Response(request.method === 'HEAD' ? null : upstreamRes.body, { status: upstreamRes.status, headers });
}
 
async function getConfig(env, id) {
  try {
    const obj = await env.MEDIA_BUCKET.get(CONFIG_KEY);
    if (!obj) return null;
    const configs = await obj.json();
    return configs.find(c => c.id === id) || null;
  } catch { return null; }
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

async function rewriteM3U8({ playlistText, rawUrl, alistPath, configId, env }) {
  const baseDir = alistPath.includes('/') ? alistPath.slice(0, alistPath.lastIndexOf('/')) : '';
  const lines = playlistText.split(/\r?\n/);

  const exp = Date.now() + 60 * 60 * 1000; // 1h
  const secret = env.TOKEN_SECRET || env.ADMIN_PASSWORD || 'default-secret';

  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      out.push(line);
      continue;
    }

    // 绝对 URL：走带签名的 url-proxy
    if (/^https?:\/\//i.test(t)) {
      const sig = await hmacHex(`${t}|${exp}`, secret);
      out.push(`/api/alist/url-proxy?url=${encodeURIComponent(t)}&exp=${exp}&sig=${sig}`);
      continue;
    }

    // 相对路径：映射为同目录下的 Alist path
    // 兼容以 `/` 开头的“根路径”（站内绝对路径）
    // 例如：`/live/xxx.ts` 或 `/hls/seg-0001.ts`
    const joined = t.startsWith('/')
      ? t
      : (baseDir ? `${baseDir}/${t}` : t);
    out.push(`/api/alist/stream?configId=${encodeURIComponent(configId)}&path=${encodeURIComponent(joined)}`);
  }
  return out.join('\n');
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

