// functions/api/admin/rename.js
import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }

    // 验证认证
    if (!await verifyAuth(request, env)) {
        return json({ error: 'Unauthorized' }, 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { from, to } = body;

        if (!from || !to) {
            return json({ error: 'Missing parameters: from and to are required' }, 400);
        }

        // 安全检查：只允许操作 media/ 和 drive/ 下的文件
        if ((!from.startsWith('media/') && !from.startsWith('drive/')) ||
            (!to.startsWith('media/') && !to.startsWith('drive/'))) {
            return json({ error: 'Files must be under media/ or drive/' }, 403);
        }

        // 安全检查：防止路径遍历
        if (from.includes('..') || to.includes('..')) {
            return json({ error: 'Invalid path' }, 400);
        }

        if (from === to) {
            return json({ ok: true, message: 'Same path, no action needed' });
        }

        // 检查目标文件是否已存在
        try {
            const existing = await env.MEDIA_BUCKET.get(to);
            if (existing) {
                return json({ error: 'Target file already exists' }, 409);
            }
        } catch (err) {
            // 目标不存在，可以继续
        }

        // 获取源文件
        const sourceObj = await env.MEDIA_BUCKET.get(from);
        if (!sourceObj) {
            return json({ error: 'Source file not found' }, 404);
        }

        // 复制到新位置
        await env.MEDIA_BUCKET.put(to, sourceObj.body, {
            httpMetadata: sourceObj.httpMetadata,
            customMetadata: sourceObj.customMetadata,
        });

        // 删除原文件
        await env.MEDIA_BUCKET.delete(from);

        return json({ ok: true, message: '重命名成功', from, to });
    } catch (err) {
        console.error('[rename] Error:', err);
        return json({ error: 'Rename failed: ' + err.message }, 500);
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