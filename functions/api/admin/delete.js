// functions/api/admin/delete.js
import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
    // 添加 CORS 预检
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
        // 解析请求体
        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            return json({ error: 'Invalid JSON format' }, 400);
        }

        const { path } = body;

        // 参数校验
        if (!path) {
            return json({ error: 'Missing parameter: path' }, 400);
        }

        // 安全检查：只允许删除 media/ 和 drive/ 下的文件
        if (!path.startsWith('media/') && !path.startsWith('drive/')) {
            return json({ error: 'Cannot delete files outside media/ or drive/' }, 403);
        }

        // 安全检查：防止路径遍历攻击
        if (path.includes('..')) {
            return json({ error: 'Invalid path' }, 400);
        }

        // 执行删除
        try {
            await env.MEDIA_BUCKET.delete(path);
            return json({ success: true, message: '删除成功' });
        } catch (deleteError) {
            console.error('删除失败：', deleteError);
            return json({ error: 'Failed to delete file: ' + deleteError.message }, 500);
        }
    } catch (error) {
        console.error('服务器错误：', error);
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