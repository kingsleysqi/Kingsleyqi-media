/**
 * /api/list — Cloudflare Pages Function
 * 动态读取 R2 Bucket 中的媒体文件列表
 *
 * R2 路径约定：
 *   media/tvshows/<剧名>/Season XX/<文件>.mp4
 *   media/tvshows/<剧名>/poster.jpg         ← 可选海报
 *   media/movies/<电影名>/<文件>.mp4
 *   media/movies/<电影名>/poster.jpg
 *   media/music/<专辑名>/<文件>.mp3
 *   media/music/<专辑名>/cover.jpg
 *
 * 绑定名称：MEDIA_BUCKET（在 Cloudflare Pages → Settings → Functions → Bindings 中配置）
 */

const SUPPORTED_VIDEO = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.ts', '.m3u8'];
const SUPPORTED_AUDIO = ['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a'];
const POSTER_FILES    = ['poster.jpg', 'poster.jpeg', 'poster.png', 'poster.webp', 'cover.jpg', 'cover.png'];
const MAX_KEYS        = 1000; // R2 单次最大列举数

export async function onRequestGet({ env, request }) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Cache-Control': 'public, max-age=60',
    'Access-Control-Allow-Origin': '*',
  };

  // 检查 R2 绑定
  if (!env.MEDIA_BUCKET) {
    return new Response(JSON.stringify({
      error: 'R2 binding MEDIA_BUCKET not configured.',
      items: [],
      stats: { tvshows: 0, movies: 0, music: 0 },
    }), { status: 500, headers });
  }

  try {
    // 读取 URL 参数（可选过滤）
    const url    = new URL(request.url);
    const filter = url.searchParams.get('type') || 'all'; // all | tvshows | movies | music

    // ── 列举所有 media/ 前缀下的对象 ──
    const prefixes = filter === 'all'
      ? ['media/tvshows/', 'media/movies/', 'media/music/']
      : [`media/${filter}/`];

    const allObjects = [];
    for (const prefix of prefixes) {
      let cursor;
      do {
        const opts = { prefix, limit: MAX_KEYS, delimiter: undefined };
        if (cursor) opts.cursor = cursor;
        const listed = await env.MEDIA_BUCKET.list(opts);
        allObjects.push(...listed.objects);
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    }

    // ── 解析文件结构，构建媒体 items ──
    const itemMap = new Map(); // key: "type/name"

    for (const obj of allObjects) {
      const key  = obj.key; // e.g. "media/tvshows/生活大爆炸/Season 01/S01E01.mp4"
      const parts = key.split('/');
      // parts: ['media', 'tvshows', '生活大爆炸', 'Season 01', 'S01E01.mp4']

      if (parts.length < 3) continue;

      const mediaType  = parts[1]; // tvshows | movies | music
      const folderName = parts[2]; // 剧名 / 电影名 / 专辑名
      const itemId     = `${mediaType}/${folderName}`;
      const fileName   = parts[parts.length - 1];

      // 跳过纯目录条目（末尾为空或无扩展名的路径段）
      if (!fileName || !fileName.includes('.')) continue;

      if (!itemMap.has(itemId)) {
        itemMap.set(itemId, {
          id:       itemId,
          type:     mediaType,
          name:     folderName,
          poster:   null,
          url:      null,       // 直接播放 URL（电影/音乐）
          episodes: [],         // 剧集列表（电视剧）
          year:     extractYear(folderName),
          _posterSet: false,
        });
      }

      const item = itemMap.get(itemId);

      // 检测海报
      if (!item._posterSet && isPosterFile(fileName)) {
        item.poster = key;
        item._posterSet = true;
        continue;
      }

      // 检测视频 / 音频
      const isVideo = SUPPORTED_VIDEO.some(ext => fileName.toLowerCase().endsWith(ext));
      const isAudio = SUPPORTED_AUDIO.some(ext => fileName.toLowerCase().endsWith(ext));

      if (!isVideo && !isAudio) continue;

      if (mediaType === 'tvshows') {
        // 剧集：取倒数第二级作为 season（支持任意深度）
        const season = parts.length >= 5 ? parts[parts.length - 2] : '剧集';
        const epName = buildEpName(fileName, season);
        item.episodes.push({
          key:    key,
          name:   epName,
          season: season,
          url:    key,
        });
      } else {
        // 电影 / 音乐：取第一个找到的媒体文件
        if (!item.url) {
          item.url = key;
        }
      }
    }

    // ── 整理 episodes 排序 ──
    const items = Array.from(itemMap.values()).map(item => {
      delete item._posterSet;
      if (item.episodes.length > 0) {
        item.episodes.sort((a, b) => naturalSort(a.key, b.key));
      }
      return item;
    });

    // 统计
    const stats = {
      tvshows: items.filter(i => i.type === 'tvshows').length,
      movies:  items.filter(i => i.type === 'movies').length,
      music:   items.filter(i => i.type === 'music').length,
    };

    return new Response(JSON.stringify({ items, stats }), { status: 200, headers });

  } catch (err) {
    console.error('[api/list] Error:', err);
    return new Response(JSON.stringify({
      error: err.message,
      items: [],
      stats: { tvshows: 0, movies: 0, music: 0 },
    }), { status: 500, headers });
  }
}

/* ── Helpers ── */

function isPosterFile(name) {
  return POSTER_FILES.some(p => name.toLowerCase() === p);
}

function extractYear(name) {
  const m = name.match(/\((\d{4})\)/);
  return m ? m[1] : null;
}

function buildEpName(fileName, season) {
  // 去掉扩展名，美化集名
  const base = fileName.replace(/\.[^.]+$/, '');
  // 如果文件名已有 S01E01 格式，直接用
  const epMatch = base.match(/[Ss](\d+)[Ee](\d+)/);
  if (epMatch) return `S${epMatch[1].padStart(2,'0')}E${epMatch[2].padStart(2,'0')} ${base.replace(/^.*?[Ee]\d+\s*/,'').trim() || ''}`.trim();
  return base;
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
