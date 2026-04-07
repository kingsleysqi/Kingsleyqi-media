/**
 * /api/list — Cloudflare Pages Function
 * 返回媒体列表 + 分类信息（前台通过此接口同时获取自定义分类）
 */

const SUPPORTED_VIDEO = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.ts', '.m3u8'];
const SUPPORTED_AUDIO = ['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a'];
const POSTER_FILES    = ['poster.jpg', 'poster.jpeg', 'poster.png', 'poster.webp', 'cover.jpg', 'cover.png'];
const MAX_KEYS        = 1000;
const BUILTIN_SLUGS   = ['movies', 'tvshows', 'music'];

export async function onRequestGet({ env, request }) {
  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Cache-Control': 'public, max-age=60',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const siteSettings = await loadSiteSettings(env);
    // 0. 可选的前台访问控制：开启后必须带 Bearer token
    if (siteSettings.requireLogin) {
      const token = getBearerToken(request);
      if (!token || !await verifyAnyToken(token, env)) {
        return new Response(JSON.stringify({ needLogin: true, error: 'Unauthorized' }), {
          status: 401,
          headers,
        });
      }
    }

    const url    = new URL(request.url);
    const filter = url.searchParams.get('type') || 'all';

    if (!env.MEDIA_BUCKET) {
      return new Response(JSON.stringify({
        items: [], stats: { tvshows: 0, movies: 0, music: 0 }, categories: []
      }), { status: 200, headers });
    }

    // 1. 读取自定义分类
    let customCats = [];
    try {
      const catObj = await env.MEDIA_BUCKET.get('_admin/categories.json');
      if (catObj) {
        const catData = await catObj.json();
        customCats = catData.categories || [];
      }
    } catch {}

    const customSlugs = customCats.map(c => c.slug).filter(Boolean);

    // 2. 确定扫描前缀
    let prefixesToScan = [];
    if (filter === 'all') {
      prefixesToScan = [...BUILTIN_SLUGS, ...customSlugs].map(s => `media/${s}/`);
    } else {
      prefixesToScan = [`media/${filter}/`];
    }

    const sources = siteSettings.sourcesEnabled || { r2: true, external: true, alist: true };

    // 3. 扫描 R2（可禁用）
    const r2Items = sources.r2 ? await scanPrefixes(env.MEDIA_BUCKET, prefixesToScan) : [];

    // 3.1 读取元数据覆盖表（用于显示名/年份/封面等，不改真实路径）
    const metaOverrides = await loadMetaOverrides(env);
    r2Items.forEach(item => applyMetaOverride(item, metaOverrides[item.id]));

    // 4. 读取外部直链（按来源开关过滤：external vs alist）
    let externalItems = [];
    if (sources.external || sources.alist) {
      try {
        const extObj = await env.MEDIA_BUCKET.get('_admin/external.json');
        if (extObj) {
          const extData = await extObj.json();
          externalItems = (extData.items || [])
            .filter(item => (filter === 'all' || item.type === filter))
            .filter(item => {
              const src = item.source || 'external';
              if (src === 'alist') return !!sources.alist;
              return !!sources.external;
            });
        }
      } catch {}
    }

    // 5. 合并
    const r2Ids = new Set(r2Items.map(i => i.id));
    const merged = [
      ...r2Items,
      ...externalItems.filter(i => !r2Ids.has(i.id)),
    ];

    const stats = {
      tvshows: merged.filter(i => i.type === 'tvshows').length,
      movies:  merged.filter(i => i.type === 'movies').length,
      music:   merged.filter(i => i.type === 'music').length,
    };

    // 6. 把自定义分类定义也一起返回给前台
    return new Response(JSON.stringify({
      items: merged,
      stats,
      categories: customCats,  // ← 前台直接用，不需要单独请求
    }), { status: 200, headers });

  } catch (err) {
    console.error('[api/list] Error:', err);
    return new Response(JSON.stringify({
      error: err.message,
      items: [],
      stats: { tvshows: 0, movies: 0, music: 0 },
      categories: [],
    }), { status: 500, headers });
  }
}

/* ── Meta overrides ── */
const META_KEY = '_admin/meta.json';
async function loadMetaOverrides(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(META_KEY);
    if (!obj) return {};
    const data = await obj.json();
    return data.meta && typeof data.meta === 'object' ? data.meta : {};
  } catch {
    return {};
  }
}

function applyMetaOverride(item, meta) {
  if (!meta || typeof meta !== 'object') return;
  if (typeof meta.name === 'string' && meta.name.trim()) item.name = meta.name.trim();
  if (typeof meta.year === 'string' && meta.year.trim()) item.year = meta.year.trim();
  if (meta.year === null || meta.year === '') item.year = null;
  if (typeof meta.poster === 'string' && meta.poster.trim()) item.poster = meta.poster.trim();
  // 允许覆盖分类（用于自定义分类迁移：不改 R2 路径也能改变前台分类）
  if (typeof meta.type === 'string' && meta.type.trim()) item.type = meta.type.trim();
}

/* ── Viewer access control helpers ── */
const SETTINGS_KEY = '_admin/site-settings.json';
const TOKEN_TTL = 86400 * 1000; // 24h

async function loadSiteSettings(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(SETTINGS_KEY);
    if (!obj) return { requireLogin: false };
    const j = await obj.json();
    const sourcesEnabled = (j.sourcesEnabled && typeof j.sourcesEnabled === 'object')
      ? { r2: j.sourcesEnabled.r2 !== false, external: j.sourcesEnabled.external !== false, alist: j.sourcesEnabled.alist !== false }
      : { r2: true, external: true, alist: true };
    return { requireLogin: !!j.requireLogin, sourcesEnabled };
  } catch {
    return { requireLogin: false, sourcesEnabled: { r2: true, external: true, alist: true } };
  }
}

function getBearerToken(req) {
  const auth = req.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function verifyAnyToken(token, env) {
  const secret = env.TOKEN_SECRET || env.ADMIN_PASSWORD || 'default-secret';
  try {
    const [b64, sig] = token.split('.');
    const payload = atob(b64);
    const { ts } = JSON.parse(payload);
    if (Date.now() - ts > TOKEN_TTL) return false;
    const expected = await hmacB64(payload, secret);
    return sig === expected;
  } catch {
    return false;
  }
}

async function hmacB64(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function scanPrefixes(bucket, prefixes) {
  const allObjects = [];
  for (const prefix of prefixes) {
    let cursor;
    do {
      const opts = { prefix, limit: MAX_KEYS };
      if (cursor) opts.cursor = cursor;
      const listed = await bucket.list(opts);
      allObjects.push(...listed.objects);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }

  const itemMap = new Map();

  for (const obj of allObjects) {
    const key   = obj.key;
    const parts = key.split('/');
    if (parts.length < 3) continue;

    const mediaType  = parts[1];
    const folderName = parts[2];
    const itemId     = `${mediaType}/${folderName}`;
    const fileName   = parts[parts.length - 1];

    if (!fileName || !fileName.includes('.')) continue;

    if (!itemMap.has(itemId)) {
      itemMap.set(itemId, {
        id: itemId, type: mediaType, name: folderName,
        poster: null, url: null, episodes: [],
        year: extractYear(folderName), _posterSet: false,
      });
    }

    const item = itemMap.get(itemId);

    if (!item._posterSet && isPosterFile(fileName)) {
      item.poster = key; item._posterSet = true; continue;
    }

    const isVideo = SUPPORTED_VIDEO.some(ext => fileName.toLowerCase().endsWith(ext));
    const isAudio = SUPPORTED_AUDIO.some(ext => fileName.toLowerCase().endsWith(ext));
    if (!isVideo && !isAudio) continue;

    if (mediaType === 'tvshows') {
      const season = parts.length >= 5 ? parts[parts.length - 2] : '剧集';
      item.episodes.push({ key, name: buildEpName(fileName, season), season, url: key });
    } else {
      if (!item.url) item.url = key;
    }
  }

  return Array.from(itemMap.values()).map(item => {
    delete item._posterSet;
    if (item.episodes.length > 0) item.episodes.sort((a, b) => naturalSort(a.key, b.key));
    return item;
  });
}

function isPosterFile(name) { return POSTER_FILES.some(p => name.toLowerCase() === p); }
function extractYear(name) { const m = name.match(/\((\d{4})\)/); return m ? m[1] : null; }
function buildEpName(fileName, season) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const epMatch = base.match(/[Ss](\d+)[Ee](\d+)/);
  if (epMatch) return `S${epMatch[1].padStart(2,'0')}E${epMatch[2].padStart(2,'0')} ${base.replace(/^.*?[Ee]\d+\s*/,'').trim() || ''}`.trim();
  return base;
}
function naturalSort(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }
