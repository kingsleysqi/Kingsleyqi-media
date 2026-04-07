/**
 * /api/alist/scan
 * POST { configId, path, mode }
 * mode: 'movies' | 'tvshows' | 'music' | 'auto'
 * 递归遍历目录，识别媒体文件和封面图，返回结构化媒体列表
 */
import { verifyAuth } from '../admin/_auth_helper.js';

const CONFIG_KEY = '_admin/alist-configs.json';

const MEDIA_EXTS   = ['mp4','mkv','avi','mov','webm','mp3','flac','aac','wav','m4a','m3u8','ts'];
const VIDEO_EXTS   = ['mp4','mkv','avi','mov','webm','m3u8','ts'];
const AUDIO_EXTS   = ['mp3','flac','aac','wav','m4a'];
const POSTER_NAMES = ['poster.jpg','poster.jpeg','poster.png','poster.webp','cover.jpg','cover.jpeg','cover.png','folder.jpg','folder.jpeg','fanart.jpg'];

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body = {};
  try { body = await request.json(); } catch {}

  const { configId, path, mode = 'auto' } = body;
  if (!configId || !path) return json({ error: 'configId and path required' }, 400);

  const config = await getConfig(env, configId);
  if (!config) return json({ error: 'Config not found' }, 404);

  try {
    const results = [];
    await scanDir(configId, config, path, mode, results);
    return json({ ok: true, count: results.length, items: results });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function scanDir(configId, config, path, mode, results, depth = 0) {
  if (depth > 8) return;

  const listed = await listDir(config, path);
  if (!listed) return;

  const { folders, files } = listed;

  const MEDIA_EXTS_VIDEO = ['mp4','mkv','avi','mov','webm','m3u8','ts'];
  const MEDIA_EXTS_AUDIO = ['mp3','flac','aac','wav','m4a'];
  const MEDIA_EXTS_ALL = [...MEDIA_EXTS_VIDEO, ...MEDIA_EXTS_AUDIO];

  const mediaFiles = files.filter(f => MEDIA_EXTS_ALL.includes(f.name.split('.').pop().toLowerCase()));

  // 当前目录有媒体文件，以当前目录名为作品名（上一层目录名）
  if (mediaFiles.length > 0) {
    const parts = path.split('/').filter(Boolean);
    const dirName = parts[parts.length - 1] || path;

    // 找封面图
    const posterFile = files.find(f => POSTER_NAMES.includes(f.name.toLowerCase()));
    let posterUrl = '';
    if (posterFile) {
      // 封面不走 stream，直接用 image proxy 修正 Content-Type
      posterUrl = await getRawLink(config, posterFile.path);
      if (posterUrl) posterUrl = proxyImage(posterUrl);
    }

    // 判断分类
    let detectedType = mode;
    if (mode === 'auto') {
      const allAudio = mediaFiles.every(f => MEDIA_EXTS_AUDIO.includes(f.name.split('.').pop().toLowerCase()));
      detectedType = allAudio ? 'music' : mediaFiles.length > 1 ? 'tvshows' : 'movies';
    }

    if (detectedType === 'tvshows') {
      // 识别 Season 目录：Show/Season 01/xxx
      let showName = dirName;
      let seasonName = 'Season 01';
      let seasonNumber = 1;
      const seasonParsed = parseSeasonFolder(dirName);
      if (seasonParsed) {
        showName = parts[parts.length - 2] || dirName;
        seasonName = seasonParsed.seasonName;
        seasonNumber = seasonParsed.seasonNumber;
      }
      const parsedShow = parseTitleYear(showName);

      // 获取所有剧集直链
      const episodes = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const f = mediaFiles[i];
        const url = buildStreamUrl(configId, f.path);
        if (!url) continue; // 跳过获取失败的
        const epParsed = parseEpisodeFileName(f.name, seasonNumber);
        episodes.push({
          key: buildEpisodeKey(parsedShow.name, epParsed.seasonNumber, epParsed.episodeNumber, i),
          name: epParsed.displayName,
          season: seasonName,
          seasonNumber: epParsed.seasonNumber,
          episodeNumber: epParsed.episodeNumber,
          fileName: f.name,
          url,
        });
      }

      // 查找是否已有同名作品（合并季）
      const existing = results.find(r => r.type === 'tvshows' && r.name === parsedShow.name);
      if (existing) {
        existing.episodes.push(...episodes);
        existing.seasons = Array.from(new Set([...(existing.seasons || []), seasonName]));
        if (!existing.poster && posterUrl) existing.poster = posterUrl;
      } else {
        results.push({
          id: `tvshows/${parsedShow.name}`,
          type: 'tvshows',
          name: parsedShow.name,
          year: parsedShow.year,
          poster: posterUrl,
          url: null,
          episodes,
          seasons: [seasonName],
          season: seasonName, // 单季时用于 UI 快速编辑；多季时以 episodes[].season 为准
          scanPath: path,
          _dirty: false,
        });
      }
      // 严谨排序：按季/集排序，其次文件名
      const target = existing || results.find(r => r.type === 'tvshows' && r.name === parsedShow.name);
      if (target && Array.isArray(target.episodes)) {
        target.episodes.sort((a, b) => {
          const as = a.seasonNumber || 1, bs = b.seasonNumber || 1;
          if (as !== bs) return as - bs;
          const ae = a.episodeNumber ?? 9999, be = b.episodeNumber ?? 9999;
          if (ae !== be) return ae - be;
          return String(a.fileName || a.key).localeCompare(String(b.fileName || b.key), undefined, { numeric: true, sensitivity: 'base' });
        });
      }

    } else if (detectedType === 'music') {
      const parsedAlbum = parseTitleYear(dirName);
      for (const f of mediaFiles) {
        const url = buildStreamUrl(configId, f.path);
        if (!url) continue;
        const trackName = f.name.replace(/\.[^.]+$/, '');
        results.push({
          id: `music/${trackName}`,
          type: 'music',
          name: trackName,
          year: parsedAlbum.year,
          poster: posterUrl,
          url,
          episodes: [],
          scanPath: path,
          _dirty: false,
        });
      }

    } else {
      // 电影：每个目录一部
      const mainFile = mediaFiles[0];
      const url = buildStreamUrl(configId, mainFile.path);
      if (url) {
        // 优先用目录名刮削；若目录名太“泛”（如 Movies/Video），回退用文件名
        const parsed = parseTitleYear(isGenericContainerName(dirName) ? mainFile.name.replace(/\.[^.]+$/, '') : dirName);
        results.push({
          id: `movies/${parsed.name}`,
          type: 'movies',
          name: parsed.name,
          year: parsed.year,
          poster: posterUrl,
          url,
          episodes: [],
          scanPath: path,
          _dirty: false,
        });
      }
    }
  }

  // 递归子目录
  for (const folder of folders) {
    await scanDir(configId, config, folder.path, mode, results, depth + 1);
  }
}

async function listDir(config, path) {
  try {
    const res = await fetch(`${config.url}/api/fs/list`, {
      method: 'POST',
      headers: { 'Authorization': config.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, page: 1, per_page: 500, refresh: false })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 200) return null;
    const content = data.data?.content || [];
    return {
      files: content.filter(f => !f.is_dir).map(f => ({
        name: f.name,
        size: f.size,
        path: path.replace(/\/$/, '') + '/' + f.name,
      })),
      folders: content.filter(f => f.is_dir).map(f => ({
        name: f.name,
        path: path.replace(/\/$/, '') + '/' + f.name,
      })),
    };
  } catch { return null; }
}

async function getRawLink(config, path) {
  try {
    const res = await fetch(`${config.url}/api/fs/get`, {
      method: 'POST',
      headers: { 'Authorization': config.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.data?.raw_url || data.data?.url || '';
  } catch { return ''; }
}

function proxyImage(url) {
  if (!url) return '';
  if (url.includes('/p/') || url.includes('alist')) {
    return `/api/alist/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function getConfig(env, id) {
  try {
    const obj = await env.MEDIA_BUCKET.get(CONFIG_KEY);
    if (!obj) return null;
    const configs = await obj.json();
    return configs.find(c => c.id === id) || null;
  } catch { return null; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
function cors() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }});
}

function buildStreamUrl(configId, path) {
  // 让前台始终走同域 stream（避免 CORS/Range）
  return `/api/alist/stream?configId=${encodeURIComponent(configId)}&path=${encodeURIComponent(path)}`;
}

function parseTitleYear(raw) {
  const s = String(raw || '').trim();
  // Title (2024)
  let m = s.match(/^(.*?)[\s._-]*\((\d{4})\)\s*$/);
  if (m) return { name: cleanTitle(m[1]), year: m[2] };
  // Title 2024
  m = s.match(/^(.*?)[\s._-]+(19\d{2}|20\d{2})\s*$/);
  if (m) return { name: cleanTitle(m[1]), year: m[2] };
  return { name: cleanTitle(s), year: null };
}

function cleanTitle(s) {
  return String(s || '')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEpisodeName(fileName) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '');
  const m = base.match(/(S\d{1,2}E\d{1,2})/i);
  if (m) {
    const tag = m[1].toUpperCase().replace(/^S(\d)E(\d)$/, 'S0$1E0$2');
    const rest = base.replace(m[0], '').replace(/^[\s._-]+/, '').trim();
    return rest ? `${tag} ${rest}` : tag;
  }
  return base;
}

function parseSeasonFolder(name) {
  const s = String(name || '').trim();
  let m = s.match(/^season\s*(\d{1,2})$/i);
  if (m) return { seasonName: `Season ${String(parseInt(m[1], 10)).padStart(2, '0')}`, seasonNumber: parseInt(m[1], 10) };
  m = s.match(/^s(\d{1,2})$/i);
  if (m) return { seasonName: `Season ${String(parseInt(m[1], 10)).padStart(2, '0')}`, seasonNumber: parseInt(m[1], 10) };
  return null;
}

function parseEpisodeFileName(fileName, fallbackSeasonNumber = 1) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '');
  // S01E02 / s1e2
  let m = base.match(/[Ss](\d{1,2})[ ._-]*[Ee](\d{1,3})/);
  if (m) {
    const sn = parseInt(m[1], 10);
    const en = parseInt(m[2], 10);
    const rest = cleanTitle(base.replace(m[0], ''));
    return { seasonNumber: sn, episodeNumber: en, displayName: buildEpDisplay(sn, en, rest), rawBase: base };
  }
  // E02 / EP02
  m = base.match(/(?:^|[\s._-])(?:e|ep)\s*(\d{1,3})(?:$|[\s._-])/i);
  if (m) {
    const en = parseInt(m[1], 10);
    const rest = cleanTitle(base.replace(m[0], ''));
    return { seasonNumber: fallbackSeasonNumber, episodeNumber: en, displayName: buildEpDisplay(fallbackSeasonNumber, en, rest), rawBase: base };
  }
  // leading number "01 - title"
  m = base.match(/^\s*(\d{1,3})[\s._-]+(.+?)\s*$/);
  if (m) {
    const en = parseInt(m[1], 10);
    const rest = cleanTitle(m[2]);
    return { seasonNumber: fallbackSeasonNumber, episodeNumber: en, displayName: buildEpDisplay(fallbackSeasonNumber, en, rest), rawBase: base };
  }
  // no match
  return { seasonNumber: fallbackSeasonNumber, episodeNumber: null, displayName: cleanTitle(base), rawBase: base };
}

function buildEpDisplay(seasonNumber, episodeNumber, title) {
  const tag = `S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`;
  return title ? `${tag} ${title}` : tag;
}

function buildEpisodeKey(showName, seasonNumber, episodeNumber, fallbackIndex) {
  const showId = `tvshows/${cleanTitle(showName)}`;
  const sn = seasonNumber || 1;
  const en = episodeNumber != null ? episodeNumber : (fallbackIndex + 1);
  return `${showId}-s${String(sn).padStart(2, '0')}e${String(en).padStart(2, '0')}`;
}

function isGenericContainerName(name) {
  const s = String(name || '').toLowerCase();
  return ['movies', 'movie', 'video', 'videos', 'media', 'root'].includes(s);
}
