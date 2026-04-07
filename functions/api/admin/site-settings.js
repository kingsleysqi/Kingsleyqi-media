/**
 * /api/admin/site-settings
 * GET  → { requireLogin, viewerPasswordSet, sourcesEnabled }
 * POST → { ok }  body: { requireLogin, viewerPassword?, sourcesEnabled? }
 *
 * 用于管理“前台是否需要登录”以及前台访问密码（hash 存储）。
 */
import { verifyAuth } from './_auth_helper.js';

const KEY = '_admin/site-settings.json';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  if (request.method === 'GET') {
    const s = await loadSettings(env);
    return json({
      requireLogin: !!s.requireLogin,
      viewerPasswordSet: !!s.viewerPasswordHash,
      sourcesEnabled: s.sourcesEnabled || defaultSources(),
    });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const current = await loadSettings(env);

    const requireLogin = body.requireLogin === true;
    let viewerPasswordHash = current.viewerPasswordHash || '';

    if (typeof body.viewerPassword === 'string') {
      const pw = body.viewerPassword.trim();
      if (pw) viewerPasswordHash = await sha256hex(pw);
      else viewerPasswordHash = ''; // 允许清空
    }

    const sourcesEnabled = normalizeSources(body.sourcesEnabled ?? current.sourcesEnabled);
    const next = { requireLogin, viewerPasswordHash, sourcesEnabled, updatedAt: Date.now() };
    await env.MEDIA_BUCKET.put(KEY, JSON.stringify(next), {
      httpMetadata: { contentType: 'application/json' }
    });

    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function loadSettings(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(KEY);
    if (!obj) return { requireLogin: false, viewerPasswordHash: '', sourcesEnabled: defaultSources() };
    const j = await obj.json();
    return {
      requireLogin: !!j.requireLogin,
      viewerPasswordHash: typeof j.viewerPasswordHash === 'string' ? j.viewerPasswordHash : '',
      sourcesEnabled: normalizeSources(j.sourcesEnabled),
    };
  } catch {
    return { requireLogin: false, viewerPasswordHash: '', sourcesEnabled: defaultSources() };
  }
}

function defaultSources() {
  return { r2: true, external: true, alist: true };
}

function normalizeSources(s) {
  const d = defaultSources();
  if (!s || typeof s !== 'object') return d;
  return {
    r2: s.r2 !== false,
    external: s.external !== false,
    alist: s.alist !== false,
  };
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

