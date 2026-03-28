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

    // 3. 扫描 R2
    const r2Items = await scanPrefixes(env.MEDIA_BUCKET, prefixesToScan);

    // 4. 读取外部直链
    let externalItems = [];
    try {
      const extObj = await env.MEDIA_BUCKET.get('_admin/external.json');
      if (extObj) {
        const extData = await extObj.json();
        externalItems = (extData.items || []).filter(item =>
          filter === 'all' || item.type === filter
        );
      }
    } catch {}

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
