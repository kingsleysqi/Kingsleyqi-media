/**
 * /api/alist/stream
 * GET/HEAD ?configId=...&path=...
 * 公共同域流式代理：用服务端 token 获取 raw_url，再转发（支持 Range），解决跨域/CORS/Range 导致的无法播放
 */
const CONFIG_KEY = '_admin/alist-configs.json';
const META_TIMEOUT_MS = 8000;
const UPSTREAM_TIMEOUT_MS = 12000;
 
export async function onRequest({ request, env }) {
  try {
    if (request.method === 'OPTIONS') return cors();
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  
    const url = new URL(request.url);
    const configId = url.searchParams.get('configId') || '';
    const path = url.searchParams.get('path') || '';
    const debug = url.searchParams.get('debug') === '1';
    const metaOnly = url.searchParams.get('metaOnly') === '1';
    const ping = url.searchParams.get('ping') === '1';

    // 快速自检：确认 Function 路由与部署是否生效
    if (debug && ping) {
      return json({ ok: true, step: 'ping', now: Date.now() }, 200);
    }
    if (!configId || !path) return new Response('configId and path required', { status: 400 });
  
    const config = await getConfig(env, configId);
    if (!config) return new Response('Config not found', { status: 404 });
  
    // 1) 先从 Alist 获取 raw_url
    let rawUrl = '';
    let metaStatus = 0;
    let metaSnippet = null;
    try {
      const metaRes = await fetchWithTimeout(`${config.url}/api/fs/get`, {
        method: 'POST',
        headers: { 'Authorization': config.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      }, META_TIMEOUT_MS);
      metaStatus = metaRes.status;
      if (!metaRes.ok) {
        const txt = await metaRes.text().catch(() => '');
        metaSnippet = txt.slice(0, 400);
        return new Response(`Alist API error: ${metaRes.status}\n---\n${metaSnippet || ''}`, { status: 502 });
      }
      const metaText = await metaRes.text();
      metaSnippet = metaText.slice(0, 400);
      const meta = JSON.parse(metaText || '{}');
      const fileData = meta?.data || meta?.data?.data || meta?.data;
      rawUrl = fileData?.raw_url || fileData?.url || meta?.data?.raw_url || '';
    } catch (err) {
      const msg = (err?.name === 'AbortError')
        ? `Alist API timeout after ${META_TIMEOUT_MS}ms`
        : ('Unable to reach Alist: ' + (err?.message || String(err)));
      return new Response(msg, { status: 502 });
    }
  
    if (!rawUrl) {
      if (debug) {
        return json({
          ok: false,
          step: 'meta',
          metaStatus,
          metaSnippet,
          configId,
          path,
          hint: 'Alist fs/get 没返回 raw_url（可能是目录/权限/网盘插件限制）',
        }, 200);
      }
      return new Response('Unable to get raw url', { status: 400 });
    }
  
    if (debug || metaOnly) {
      return json({
        ok: true,
        step: 'meta',
        metaStatus,
        configId,
        path,
        rawUrl,
        timeouts: { meta: META_TIMEOUT_MS, upstream: UPSTREAM_TIMEOUT_MS },
      }, 200);
    }

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
 
    let upstreamRes;
    try {
      upstreamRes = await fetchWithTimeout(rawUrl, {
        method: request.method,
        headers: upstreamHeaders,
        redirect: 'follow',
      }, UPSTREAM_TIMEOUT_MS);
    } catch (err) {
      const msg = (err?.name === 'AbortError')
        ? `Upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms`
        : ('Upstream fetch failed: ' + (err?.message || String(err)));
      // 对部分网盘（尤其百度）Cloudflare 侧请求经常被限流/超时，
      // 这时让浏览器直接去拉 rawUrl（302）成功率更高，也避免跑中转流量。
      if (!isM3u8 && shouldRedirectToUpstream(rawUrl)) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': rawUrl,
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
      return new Response(
        `${msg}\nurl=${rawUrl}`,
        { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } }
      );
    }
 
  // 复制响应头，但补齐 CORS + 暴露 Range 相关 header
  const headers = new Headers(upstreamRes.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified');
  headers.set('Cache-Control', 'no-store');
  // 方便前端/Network 快速定位到底上游回了什么
  headers.set('X-Upstream-Status', String(upstreamRes.status));
  // 避免某些上游返回强制下载
  headers.delete('Content-Disposition');

  const upstreamType = (upstreamRes.headers.get('Content-Type') || '').toLowerCase();
  const isPlaylist = isM3u8 || upstreamType.includes('mpegurl') || upstreamType.includes('application/vnd.apple.mpegurl');

  // 若上游返回的是错误页（常见：403/404/签名过期导致 HTML/JSON），播放器只会显示“无法加载媒体”
  // 这里把错误显性化，便于你从 Network 直接看到原因
  if (!upstreamRes.ok && request.method !== 'HEAD') {
    let snippet = '';
    try { snippet = (await upstreamRes.text()).slice(0, 400); } catch {}
    if (!isM3u8 && shouldRedirectToUpstream(rawUrl)) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': rawUrl,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
    return new Response(
      `Upstream failed\nstatus=${upstreamRes.status}\ncontent-type=${upstreamType || '(none)'}\nurl=${rawUrl}\n---\n${snippet}`,
      { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // 某些上游会返回 200 + text/html（反代拦截页），对视频来说等价于失败
  if (request.method !== 'HEAD' && upstreamRes.ok && upstreamType && (upstreamType.includes('text/html') || upstreamType.includes('application/json'))) {
    const lower = path.toLowerCase();
    const looksMedia = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.ts', '.m3u8', '.mp3', '.flac', '.aac', '.wav', '.m4a'].some(ext => lower.endsWith(ext));
    if (looksMedia && !isPlaylist) {
      let snippet = '';
      try { snippet = (await upstreamRes.text()).slice(0, 400); } catch {}
      if (shouldRedirectToUpstream(rawUrl)) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': rawUrl,
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
      return new Response(
        `Upstream returned non-media content\nstatus=${upstreamRes.status}\ncontent-type=${upstreamType}\nurl=${rawUrl}\n---\n${snippet}`,
        { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  }

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
  } catch (err) {
    return new Response(
      `stream handler error\n${err?.stack || err?.message || String(err)}`,
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    }
  });
}

function shouldRedirectToUpstream(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = (u.hostname || '').toLowerCase();
    // 百度直链常见：*.baidupcs.com
    if (host.endsWith('.baidupcs.com') || host.includes('baidupcs.com')) return true;
    // 其他可按需加入白名单
    return false;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(input, init, timeoutMs) {
  const controller = new AbortController();
  // Cloudflare Workers 环境下 AbortController.abort(reason) 兼容性不一致；
  // 这里始终使用无参 abort，避免定时器回调抛异常导致 502（Bad gateway）。
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...(init || {}), signal: controller.signal });
  } finally {
    clearTimeout(t);
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

