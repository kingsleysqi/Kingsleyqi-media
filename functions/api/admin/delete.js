// functions/api/admin/delete.js
import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    try {
        // 验证认证
        const isAuth = await verifyAuth(request, env);
        if (!isAuth) {
            return json({ error: 'Unauthorized - Please login first' }, 401);
        }

        // 解析请求体
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return json({ error: 'Invalid JSON format' }, 400);
        }

        const { path } = body;
        
        // 详细日志
        console.log('[delete] Request:', { path, body });
        
        if (!path) {
            return json({ error: 'Missing parameter: path' }, 400);
        }

        // 安全检查
        if (!path.startsWith('media/') && !path.startsWith('drive/')) {
            return json({ error: 'Cannot delete files outside media/ or drive/' }, 403);
        }

        if (path.includes('..')) {
            return json({ error: 'Invalid path - path traversal not allowed' }, 400);
        }

        // 执行删除
        try {
            await env.MEDIA_BUCKET.delete(path);
            console.log('[delete] Success:', path);
            return json({ success: true, message: 'File deleted successfully' });
        } catch (deleteError) {
            console.error('[delete] Delete failed:', deleteError);
            return json({ error: 'Failed to delete file: ' + deleteError.message }, 500);
        }
    } catch (error) {
        console.error('[delete] Server error:', error);
        return json({ error: 'Internal server error: ' + error.message }, 500);
    }
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}