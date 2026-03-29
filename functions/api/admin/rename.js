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

    try {
        // 验证认证
        const isAuth = await verifyAuth(request, env);
        if (!isAuth) {
            return json({ error: 'Unauthorized' }, 401);
        }

        // 解析请求
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return json({ error: 'Invalid JSON format' }, 400);
        }

        const { from, to, oldPath, newPath } = body;
        
        // 兼容两种参数名
        const sourcePath = from || oldPath;
        const targetPath = to || newPath;
        
        console.log('[rename] Request:', { sourcePath, targetPath });
        
        if (!sourcePath || !targetPath) {
            return json({ error: 'Missing parameters: from and to are required' }, 400);
        }

        // 安全检查
        if ((!sourcePath.startsWith('media/') && !sourcePath.startsWith('drive/')) ||
            (!targetPath.startsWith('media/') && !targetPath.startsWith('drive/'))) {
            return json({ error: 'Files must be under media/ or drive/' }, 403);
        }

        if (sourcePath.includes('..') || targetPath.includes('..')) {
            return json({ error: 'Invalid path' }, 400);
        }

        if (sourcePath === targetPath) {
            return json({ ok: true, message: 'Same path, no action needed' });
        }

        // 检查目标是否存在
        const existing = await env.MEDIA_BUCKET.get(targetPath);
        if (existing) {
            return json({ error: 'Target file already exists' }, 409);
        }

        // 获取源文件
        const sourceObj = await env.MEDIA_BUCKET.get(sourcePath);
        if (!sourceObj) {
            return json({ error: 'Source file not found' }, 404);
        }

        // 复制到新位置
        await env.MEDIA_BUCKET.put(targetPath, sourceObj.body, {
            httpMetadata: sourceObj.httpMetadata,
            customMetadata: sourceObj.customMetadata,
        });

        // 删除原文件
        await env.MEDIA_BUCKET.delete(sourcePath);

        console.log('[rename] Success:', { from: sourcePath, to: targetPath });
        return json({ ok: true, message: 'Renamed successfully' });
    } catch (err) {
        console.error('[rename] Error:', err);
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