/**
 * /api/share/[id]
 * GET  ?password=xxx   → { share } 或 { needPassword: true } 或 404
 *
 * 公开接口，无需鉴权
 * 每次访问自动 +1 useCount，超过 maxUse 则返回 403
 */

export async function onRequestGet({ params, request, env }) {
  const id = params.id;
  if (!id) return json({ error: 'Not found' }, 404);

  const shareKey = `_admin/shares/${id}.json`;

  let share;
  try {
    const obj = await env.MEDIA_BUCKET.get(shareKey);
    if (!obj) return json({ error: 'Not found' }, 404);
    share = await obj.json();
  } catch {
    return json({ error: 'Not found' }, 404);
  }

  // 检查过期
  if (share.expires && share.expires < Date.now()) {
    return json({ error: 'This share has expired', expired: true }, 410);
  }

  // 检查访问次数
  if (share.maxUse > 0 && share.useCount >= share.maxUse) {
    return json({ error: 'Access limit reached', limitReached: true }, 403);
  }

  // 检查密码
  if (share.password) {
    const url = new URL(request.url);
    const pw = url.searchParams.get('password') || '';
    if (!pw) {
      return json({
        needPassword: true,
        id: share.id,
        title: share.title,
        desc: share.desc || '',
        fileCount: (share.files || []).length,
      });
    }
    if (pw !== share.password) {
      return json({ error: 'Wrong password', wrongPassword: true }, 401);
    }
  }

  // 递增访问次数（异步，不阻塞响应）
  incrementUseCount(env, shareKey, share).catch(console.error);

  // 解析文件列表
  const files = await Promise.all((share.files || []).map(async f => {
    if (f.startsWith('https://') || f.startsWith('http://')) {
      return { name: decodeURIComponent(f.split('/').pop()), url: f, type: 'external' };
    }
    try {
      const url = await generateDownloadUrl(env, f);
      return { name: f.split('/').pop(), key: f, url, type: 'r2' };
    } catch {
      return { name: f.split('/').pop(), key: f, url: null, type: 'r2', error: true };
    }
  }));

  return json({
    id: share.id,
    title: share.title,
    desc: share.desc || '',
    expires: share.expires,
    created: share.created,
    useCount: share.useCount,
    maxUse: share.maxUse,
    files,
  });
}

async function incrementUseCount(env, key, share) {
  share.useCount = (share.useCount || 0) + 1;
  await env.MEDIA_BUCKET.put(key, JSON.stringify(share), {
    httpMetadata: { contentType: 'application/json' }
  });
}

async function generateDownloadUrl(env, key) {
  const accountId  = env.CF_ACCOUNT_ID;
  const bucketName = env.R2_BUCKET_NAME;
  const accessKey  = env.R2_ACCESS_KEY_ID;
  const secretKey  = env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucketName || !accessKey || !secretKey) {
    throw new Error('R2 not configured');
  }

  const region  = 'auto';
  const expires = 3600;

  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';
  const scope    = `${date}/${region}/s3/aws4_request`;
  const credential = `${accessKey}/${scope}`;

  const headers = `host:${accountId}.r2.cloudflarestorage.com`;
  const signedHeaders = 'host';

  const qs = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(credential)}`,
    `X-Amz-Date=${datetime}`,
    `X-Amz-Expires=${expires}`,
    `X-Amz-SignedHeaders=${signedHeaders}`,
  ].join('&');

  const canonicalReq = [
    'GET',
    `/${bucketName}/${key}`,
    qs,
    headers + '\n',
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

  return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${encodeURIComponent(key).replace(/%2F/g, '/')}?${qs}&X-Amz-Signature=${signature}`;
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
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
