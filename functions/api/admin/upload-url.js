/**
 * /api/admin/upload-url
 * POST { key, contentType, allowDrive? } → { url }
 * 完整可用，支持中文路径
 */
import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body = {};
  try { body = await request.json(); } catch {}

  const { key, contentType, allowDrive } = body;
  if (!key) return json({ error: 'key required' }, 400);
  if (key.includes('..') || key.includes('//')) return json({ error: 'Invalid key path' }, 400);

  const isMedia = key.startsWith('media/');
  const isDrive = !!allowDrive && key.startsWith('drive/');
  if (!isMedia && !isDrive) return json({ error: allowDrive ? 'Drive key must start with drive/' : 'Key must start with media/' }, 400);

  const { CF_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!CF_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return json({ error: 'R2 credentials not configured' }, 500);

  try {
    const url = await generatePresignedUrl({ CF_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY }, key, contentType || 'application/octet-stream');
    return json({ url });
  } catch (err) {
    console.error('[upload-url]', err);
    return json({ error: err.message }, 500);
  }
}

async function generatePresignedUrl(env, key, contentType) {
  const { CF_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;

  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';
  const region = 'auto';
  const expires = 3600;
  const scope = `${date}/${region}/s3/aws4_request`;
  const credential = `${R2_ACCESS_KEY_ID}/${scope}`;
  const signedHeaders = 'host';
  const canonicalHeaders = `host:${CF_ACCOUNT_ID}.r2.cloudflarestorage.com\n`;

  const qs = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(credential)}`,
    `X-Amz-Date=${datetime}`,
    `X-Amz-Expires=${expires}`,
    `X-Amz-SignedHeaders=${signedHeaders}`
  ].join('&');

  const encodedKey = key.split('/').map(encodeURIComponent).join('/');

  const canonicalReq = [
    'PUT',
    `/${R2_BUCKET_NAME}/${encodedKey}`,
    qs,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const strToSign = ['AWS4-HMAC-SHA256', datetime, scope, await sha256hex(canonicalReq)].join('\n');
  const signingKey = await getSigningKey(R2_SECRET_ACCESS_KEY, date, region);
  const signature = await hmacHex(signingKey, strToSign);

  return `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${encodedKey}?${qs}&X-Amz-Signature=${signature}`;
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacRaw(key, data) {
  const k = typeof key === 'string'
    ? await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    : await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
}
async function hmacHex(key, data) {
  return Array.from(await hmacRaw(key, data)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function getSigningKey(secretKey, date, region) {
  const kDate = await hmacRaw(`AWS4${secretKey}`, date);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, 's3');
  return await hmacRaw(kService, 'aws4_request');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}