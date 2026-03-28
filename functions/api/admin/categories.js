/**
 * /api/admin/categories
 * GET              → { categories }        读取自定义分类列表
 * POST { categories } → { ok }            保存自定义分类列表
 *
 * 内置分类（movies / tvshows / music）由前端维护，不存储在此
 * 自定义分类存储在 R2 的 _admin/categories.json
 */

import { verifyAuth } from './_auth_helper.js';

const STORAGE_KEY = '_admin/categories.json';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return cors();

  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET') return handleGet(env);
  if (request.method === 'POST') return handlePost(request, env);

  return json({ error: 'Method not allowed' }, 405);
}

async function handleGet(env) {
  try {
    const obj = await env.MEDIA_BUCKET.get(STORAGE_KEY);
    if (!obj) return json({ categories: [] });
    const data = await obj.json();
    return json({ categories: data.categories || [] });
  } catch (err) {
    console.error('[categories] GET error:', err);
    return json({ categories: [] });
  }
}

async function handlePost(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const categories = Array.isArray(body.categories) ? body.categories : [];

    // 校验：不允许覆盖内置分类 slug
    const BUILTIN = ['movies', 'tvshows', 'music'];
    for (const cat of categories) {
      if (!cat.name || !cat.slug) {
        return json({ error: 'Each category must have name and slug' }, 400);
      }
      if (BUILTIN.includes(cat.slug)) {
        return json({ error: `Slug "${cat.slug}" is reserved` }, 400);
      }
      // slug 只允许英文、数字、连字符、下划线
      if (!/^[a-z0-9_-]+$/.test(cat.slug)) {
        return json({ error: `Invalid slug: ${cat.slug}` }, 400);
      }
    }

    await env.MEDIA_BUCKET.put(
      STORAGE_KEY,
      JSON.stringify({ categories, updatedAt: Date.now() }),
      { httpMetadata: { contentType: 'application/json' } }
    );

    return json({ ok: true, count: categories.length });
  } catch (err) {
    console.error('[categories] POST error:', err);
    return json({ error: err.message }, 500);
  }
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
