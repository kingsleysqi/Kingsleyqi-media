/**
 * /api/viewer/auth
 * POST { password } → { token }
 * GET  (Bearer token) → { ok: true }
 *
 * 前台访问鉴权：使用后台可配置的 viewerPasswordHash。
 */
const SETTINGS_KEY = '_admin/site-settings.json';
const TOKEN_TTL = 86400 * 1000; // 24h

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();

  const settings = await loadSettings(env);
  const secret = env.TOKEN_SECRET || env.ADMIN_PASSWORD || 'default-secret';

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const pw = (body.password || '').trim();

    if (!settings.viewerPasswordHash) {
      return json({ error: 'Viewer password not set' }, 400);
    }
    if (!pw) return json({ error: 'Password required' }, 400);

    const hash = await sha256hex(pw);
    if (hash !== settings.viewerPasswordHash) return json({ error: 'Invalid password' }, 401);

    const token = await makeToken(secret, 'viewer');
    return json({ token });
  }

  if (request.method === 'GET') {
    const token = getBearerToken(request);
    if (!token || !await verifyToken(token, secret)) return json({ error: 'Unauthorized' }, 401);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function loadSettings(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(SETTINGS_KEY);
    if (!obj) return { requireLogin: false, viewerPasswordHash: '' };
    const j = await obj.json();
    return {
      requireLogin: !!j.requireLogin,
      viewerPasswordHash: typeof j.viewerPasswordHash === 'string' ? j.viewerPasswordHash : '',
    };
  } catch {
    return { requireLogin: false, viewerPasswordHash: '' };
  }
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function makeToken(secret, scope) {
  const payload = JSON.stringify({ ts: Date.now(), scope });
  const sig = await hmacB64(payload, secret);
  return btoa(payload) + '.' + sig;
}

async function verifyToken(token, secret) {
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

function getBearerToken(req) {
  const auth = req.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
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

