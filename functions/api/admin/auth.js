/**
 * /api/admin/auth
 * POST { password } → { token }   登录
 * GET  (Bearer token) → 200/401   验证
 */

const TOKEN_TTL = 86400 * 1000; // 24小时

export async function onRequest({ request, env }) {
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  const TOKEN_SECRET   = env.TOKEN_SECRET || env.ADMIN_PASSWORD || 'default-secret';

  if (!ADMIN_PASSWORD) {
    return json({ error: 'ADMIN_PASSWORD not configured' }, 500);
  }

  if (request.method === 'POST') {
    // 登录
    const body = await request.json().catch(() => ({}));
    if (body.password !== ADMIN_PASSWORD) {
      return json({ error: 'Invalid password' }, 401);
    }
    const token = await makeToken(TOKEN_SECRET);
    return json({ token });
  }

  if (request.method === 'GET') {
    // 验证
    const token = getBearerToken(request);
    if (!token || !await verifyToken(token, TOKEN_SECRET)) {
      return json({ error: 'Unauthorized' }, 401);
    }
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

/* ── Simple HMAC token ── */
async function makeToken(secret) {
  const payload = JSON.stringify({ ts: Date.now() });
  const sig = await hmacSign(payload, secret);
  return btoa(payload) + '.' + sig;
}

async function verifyToken(token, secret) {
  try {
    const [b64, sig] = token.split('.');
    const payload = atob(b64);
    const { ts } = JSON.parse(payload);
    if (Date.now() - ts > TOKEN_TTL) return false;
    const expected = await hmacSign(payload, secret);
    return sig === expected;
  } catch { return false; }
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
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
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
