/**
 * 共享认证验证工具
 * 被 upload-url.js / delete.js / files.js / rename.js 共用
 */

const TOKEN_TTL = 86400 * 1000;

export async function verifyAuth(request, env) {
  const token  = getBearerToken(request);
  const secret = env.TOKEN_SECRET || env.ADMIN_PASSWORD || 'default-secret';
  if (!token) return false;
  return verifyToken(token, secret);
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
