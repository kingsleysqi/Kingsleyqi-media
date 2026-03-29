import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return cors();
  if (!await verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body = {};
  try { 
    body = await request.json(); 
  } catch (e) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { key, contentType, allowDrive } = body;

  if (!key || typeof key !== 'string') {
    return json({ error: 'key 参数不能为空' }, 400);
  }

  // 安全检查
  if (key.includes('..') || key.includes('//')) {
    return json({ error: 'Invalid key path' }, 400);
  }

  const isMedia = key.startsWith('media/');
  const isDrive = !!allowDrive && key.startsWith('drive/');

  if (!isMedia && !isDrive) {
    return json({ 
      error: allowDrive 
        ? '临时网盘文件必须以 drive/ 开头' 
        : '普通媒体文件必须以 media/ 开头' 
    }, 400);
  }

  if (!env.CF_ACCOUNT_ID || !env.R2_BUCKET_NAME || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return json({ error: 'R2 配置未完成' }, 500);
  }

  try {
    const url = await generatePresignedUrl(env, key, contentType || 'application/octet-stream');
    return json({ url });
  } catch (err) {
    console.error('[upload-url] 生成预签名URL失败:', err);
    return json({ error: '生成上传链接失败: ' + err.message }, 500);
  }
}

async function generatePresignedUrl(env, key, contentType) {
  const accountId  = env.CF_ACCOUNT_ID;
  const bucketName = env.R2_BUCKET_NAME;
  const accessKey  = env.R2_ACCESS_KEY_ID;
  const secretKey  = env.R2_SECRET_ACCESS_KEY;

  const region  = 'auto';
  const expires = 3600;           // 1小时有效
  const now     = new Date();
  const date    = now.toISOString().slice(0,10).replace(/-/g,'');
  const datetime = now.toISOString().replace(/[:-]/g,'').slice(0,15) + 'Z';
  const scope   = `\( {date}/ \){region}/s3/aws4_request`;
  const credential = `\( {accessKey}/ \){scope}`;

  const signedHeaders = 'host';
  const canonicalHeaders = `host:${accountId}.r2.cloudflarestorage.com\n`;

  const qs = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(credential)}`,
    `X-Amz-Date=${datetime}`,
    `X-Amz-Expires=${expires}`,
    `X-Amz-SignedHeaders=${signedHeaders}`,
  ].join('&');

  // 中文路径关键处理：每一段都单独 encode
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/');

  const canonicalReq = [
    'PUT',
    `/\( {bucketName}/ \){encodedKey}`,
    qs,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const strToSign = ['AWS4-HMAC-SHA256', datetime, scope, await sha256hex(canonicalReq)].join('\n');
  const signingKey = await getSigningKey(secretKey, date, region);
  const signature  = await hmacHex(signingKey, strToSign);

  return `https://\( {accountId}.r2.cloudflarestorage.com/ \){bucketName}/\( {encodedKey}? \){qs}&X-Amz-Signature=${signature}`;
}

// 以下辅助函数保持不变
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacRaw(key, data) {
  const k = typeof key === 'string'
    ? await crypto.subtle.importKey('raw', new TextEncoder().encode(key), {name:'HMAC', hash:'SHA-256'}, false, ['sign'])
    : key;
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
      'Access-Control-Allow-Origin': '*' 
    }
  });
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}