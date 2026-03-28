/**
 * /api/list — Cloudflare Pages Function
 * 支持：R2 自动扫描 + 外部直链（从 R2 _admin/external.json 读取）
 */

const SUPPORTED_VIDEO = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.ts', '.m3u8'];
const SUPPORTED_AUDIO = ['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a'];
const POSTER_FILES    = ['poster.jpg', 'poster.jpeg', 'poster.png', 'poster.webp', 'cover.jpg', 'cover.png'];
const MAX_KEYS        = 1000;

export async function onRequestGet({ env, request }) {
  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Cache-Control': 'public, max-age=60',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const url    = new URL(request.url);
    const filter = url.searchParams.get('type') || 'all';

    // 1. 读取 R2 媒体文件
    let r2Items = [];
    if (env.MEDIA_BUCKET) {
      // 读取内置分类
      r2Items = await scanR2(env.MEDIA_BUCKET, filter);

      // 读取自定义分类（如有）
      try {
        const catObj = await env.MEDIA_BUCKET.get('_admin/categories.json');
        if (catObj) {
          const catData = await catObj.json();
          const customCats = (catData.categories || []).map(c => c.slug);
          if (customCats.length > 0) {
            const customItems = await scanR2Custom(env.MEDIA_BUCKET, filter, customCats);
            r2Items = [...r2Items, ...customItems];
          }
        }
      } catch {}
    }

    // 2. 读取外部直链（从 R2 存储）
    let externalItems = [];
    if (env.MEDIA_BUCKET) {
      try {
        const extObj = await env.MEDIA_BUCKET.get('_admin/external.json');
        if (extObj) {
          const extData = await extObj.json();
          externalItems = (extData.items || []).filter(item =>
            filter === 'all' || item.type === filter
          );
        }
      } catch {}
    }

    // 3. 合并，R2 优先，外部追加在后
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

    return new Response(JSON.stringify({ items: merged, stats }), { status: 200, headers });

  } catch (err) {
    console.error('[api/list] Error:', err);
    return new Response(JSON.stringify({
      error: err.message,
      items: [],
      stats: { tvshows: 0, movies: 0, music: 0 },
    }), { status: 500, headers });
  }
}

// 扫描内置分类（movies / tvshows / music）
async function scanR2(bucket, filter) {
  const prefixes = filter === 'all'
    ? ['media/tvshows/', 'media/movies/', 'media/music/']
    : [`media/${filter}/`];

  // 如果 filter 不是内置类型，内置扫描返回空
  const BUILTIN = ['all', 'tvshows', 'movies', 'music'];
  if (!BUILTIN.includes(filter)) return [];

  return scanPrefixes(bucket, prefixes);
}

// 扫描自定义分类
async function scanR2Custom(bucket, filter, slugs) {
  const targetSlugs = filter === 'all' ? slugs : slugs.filter(s => s === filter);
  if (!targetSlugs.length) return [];
  const prefixes = targetSlugs.map(s => `media/${s}/`);
  return scanPrefixes(bucket, prefixes);
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
  if (epMatch) return `S${epMatch[1].padStart(2, '0')}E${epMatch[2].padStart(2, '0')} ${base.replace(/^.*?[Ee]\d+\s*/, '').trim() || ''}`.trim();
  return base;
}
function naturalSort(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }
