/**
 * /api/admin/upload-url
 * POST { key, contentType, allowDrive? } → { url }
 * 生成 R2 预签名上传 URL
 *
 * 允许前缀：
 *   media/  — 媒体文件（始终允许）
 *   drive/  — 网盘文件（需传 allowDrive: true）
 */

import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body = {};
  try { body = await request.json(); } catch {}

  const { key, contentType, allowDrive } = body;

  if (!key) return json({ error: 'key required' }, 400);

  // 防止路径穿越
  if (key.includes('..') || key.includes('//')) {
    return json({ error: 'Invalid key path' }, 400);
  }

  const isMedia = key.startsWith('media/');
  const isDrive = !!allowDrive && key.startsWith('drive/');

  if (!isMedia && !isDrive) {
    return json({ error: allowDrive
      ? 'Drive key must start with drive/'
      : 'Key must start with media/' }, 400);
  }

  // 检查 R2 凭据是否齐全，提前报错给前端
  if (!env.CF_ACCOUNT_ID || !env.R2_BUCKET_NAME || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return json({ error: 'R2 credentials not configured on server (CF_ACCOUNT_ID / R2_BUCKET_NAME / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)' }, 500);
  }

  try {
    const url = await generatePresignedUrl(env, key, contentType || 'application/octet-stream');
    return json({ url });
  } catch (err) {
    console.error('[upload-url]', err);
    return json({ error: err.message }, 500);
  }
}

async function generatePresignedUrl(env, key, contentType) {
  const accountId  = env.CF_ACCOUNT_ID;
  const bucketName = env.R2_BUCKET_NAME;
  const accessKey  = env.R2_ACCESS_KEY_ID;
  const secretKey  = env.R2_SECRET_ACCESS_KEY;

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const region   = 'auto';
  const expires  = 3600;

  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';

  const scope      = `${date}/${region}/s3/aws4_request`;
  const credential = `${accessKey}/${scope}`;

  const signedHeaders = 'host';
  const canonicalHeaders = `host:${accountId}.r2.cloudflarestorage.com\n`;

  const qs = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(credential)}`,
    `X-Amz-Date=${datetime}`,
    `X-Amz-Expires=${expires}`,
    `X-Amz-SignedHeaders=${signedHeaders}`,
  ].join('&');

  const canonicalReq = [
    'PUT',
    `/${bucketName}/${key}`,
    qs,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const strToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    scope,
    await sha256hex(canonicalReq),
  ].join('\n');

  const signingKey = await getSigningKey(secretKey, date, region);
  const signature  = await hmacHex(signingKey, strToSign);

  // key 中的斜杠不编码，其余字符编码
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${endpoint}/${bucketName}/${encodedKey}?${qs}&X-Amz-Signature=${signature}`;
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
  const kDate    = await hmacRaw(`AWS4${secretKey}`, date);
  const kRegion  = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, 's3');
  return await hmacRaw(kService, 'aws4_request');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
