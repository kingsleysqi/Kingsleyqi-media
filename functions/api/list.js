/**
 * /api/list — Cloudflare Pages Function
 * 支持：R2 自动扫描 + 外部直链资源（手动维护）
 */

/* ══════════════════════════════════════════════════
   外部资源列表（手动维护）
   url 填完整 https:// 直链即可，来源不限
   电视剧填 episodes 数组，电影/音乐填 url 字段
   poster 可填直链图片地址，或留 null
══════════════════════════════════════════════════ */
const EXTERNAL_ITEMS = [

  // ── 电影示例（取消注释并填入直链即可）──
  // {
  //   id:       'movies/星际穿越',
  //   type:     'movies',
  //   name:     '星际穿越',
  //   year:     '2014',
  //   poster:   'https://example.com/poster.jpg',
  //   url:      'https://example.com/interstellar.mp4',
  //   episodes: [],
  // },

  // ── 电视剧示例 ──
  // {
  //   id:     'tvshows/权力的游戏',
  //   type:   'tvshows',
  //   name:   '权力的游戏',
  //   year:   '2011',
  //   poster: null,
  //   url:    null,
  //   episodes: [
  //     { key: 'got-s01e01', name: 'S01E01', season: 'Season 01', url: 'https://直链1.mp4' },
  //     { key: 'got-s01e02', name: 'S01E02', season: 'Season 01', url: 'https://直链2.mp4' },
  //   ],
  // },

  // ── 音乐示例 ──
  // {
  //   id:       'music/周杰伦精选',
  //   type:     'music',
  //   name:     '周杰伦精选',
  //   year:     '2024',
  //   poster:   null,
  //   url:      'https://example.com/jay.mp3',
  //   episodes: [],
  // },

];

/* ══════════════════════════════════════════════════
   以下无需修改
══════════════════════════════════════════════════ */

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

    // 1. 读取 R2（如果已绑定）
    let r2Items = [];
    if (env.MEDIA_BUCKET) {
      r2Items = await scanR2(env.MEDIA_BUCKET, filter);
    }

    // 2. 过滤外部资源
    const externalItems = EXTERNAL_ITEMS.filter(item =>
      filter === 'all' || item.type === filter
    );

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
      items: EXTERNAL_ITEMS,
      stats: {
        tvshows: EXTERNAL_ITEMS.filter(i=>i.type==='tvshows').length,
        movies:  EXTERNAL_ITEMS.filter(i=>i.type==='movies').length,
        music:   EXTERNAL_ITEMS.filter(i=>i.type==='music').length,
      },
    }), { status: 500, headers });
  }
}

async function scanR2(bucket, filter) {
  const prefixes = filter === 'all'
    ? ['media/tvshows/', 'media/movies/', 'media/music/']
    : [`media/${filter}/`];

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
    if (item.episodes.length > 0) item.episodes.sort((a,b) => naturalSort(a.key, b.key));
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
