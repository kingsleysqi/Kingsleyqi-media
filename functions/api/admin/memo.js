/**
 * /api/admin/memo
 * GET  (Bearer token) → { memo: string }   获取memo
 * POST (Bearer token) { memo: string } → 200   保存memo
 */

export async function onRequest({ request, env }) {
  const token = getBearerToken(request);
  if (!token || !await verifyToken(token, env.TOKEN_SECRET || env.ADMIN_PASSWORD || 'default-secret')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!env.MEMO_KV) {
    return json({ error: 'MEMO_KV not configured' }, 500);
  }

  if (request.method === 'GET') {
    const memo = await env.MEMO_KV.get('admin_memo') || '';
    return json({ memo });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (typeof body.memo !== 'string') {
      return json({ error: 'Invalid memo' }, 400);
    }
    await env.MEMO_KV.put('admin_memo', body.memo);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

function getBearerToken(request) {
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

async function verifyToken(token, secret) {
  try {
    const [b64, sig] = token.split('.');
    const payload = atob(b64);
    const { ts } = JSON.parse(payload);
    if (Date.now() - ts > 86400 * 1000) return false; // 24h
    const expectedSig = await hmacSign(payload, secret);
    return sig === expectedSig;
  } catch {
    return false;
  }
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}