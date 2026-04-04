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
    await scanDir(config, path, mode, results);
    return json({ ok: true, count: results.length, items: results });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function scanDir(config, path, mode, results, depth = 0) {
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
    const dirName = path.split('/').filter(Boolean).pop() || path;

    // 找封面图
    const posterFile = files.find(f => POSTER_NAMES.includes(f.name.toLowerCase()));
    let posterUrl = '';
    if (posterFile) {
      posterUrl = await getLink(config, posterFile.path);
      if (posterUrl) posterUrl = proxyImage(posterUrl);
    }

    // 判断分类
    let detectedType = mode;
    if (mode === 'auto') {
      const allAudio = mediaFiles.every(f => MEDIA_EXTS_AUDIO.includes(f.name.split('.').pop().toLowerCase()));
      detectedType = allAudio ? 'music' : mediaFiles.length > 1 ? 'tvshows' : 'movies';
    }

    if (detectedType === 'tvshows') {
      // 获取所有剧集直链
      const episodes = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const f = mediaFiles[i];
        const url = await getLink(config, f.path);
        if (!url) continue; // 跳过获取失败的
        episodes.push({
          key: `tvshows/${dirName}-ep${i}`,
          name: f.name.replace(/\.[^.]+$/, ''),
          season: 'Season 01',
          url,
        });
      }

      // 查找是否已有同名作品（合并季）
      const existing = results.find(r => r.type === 'tvshows' && r.name === dirName);
      if (existing) {
        existing.episodes.push(...episodes);
      } else {
        results.push({
          id: `tvshows/${dirName}`,
          type: 'tvshows',
          name: dirName,
          year: null,
          poster: posterUrl,
          url: null,
          episodes,
          season: 'Season 01',
          scanPath: path,
          _dirty: false,
        });
      }

    } else if (detectedType === 'music') {
      for (const f of mediaFiles) {
        const url = await getLink(config, f.path);
        if (!url) continue;
        results.push({
          id: `music/${f.name.replace(/\.[^.]+$/, '')}`,
          type: 'music',
          name: f.name.replace(/\.[^.]+$/, ''),
          year: null,
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
      const url = await getLink(config, mainFile.path);
      if (url) {
        results.push({
          id: `movies/${dirName}`,
          type: 'movies',
          name: dirName,
          year: null,
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
    await scanDir(config, folder.path, mode, results, depth + 1);
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

async function getLink(config, path) {
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
