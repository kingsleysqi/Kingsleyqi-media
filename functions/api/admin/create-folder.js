// functions/api/admin/create-folder.js
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
        let { folderPath } = body;

        if (!folderPath) {
            return json({ error: 'Missing parameter: folderPath' }, 400);
        }

        // 确保路径以 / 结尾
        if (!folderPath.endsWith('/')) {
            folderPath += '/';
        }

        // 安全检查
        if ((!folderPath.startsWith('media/') && !folderPath.startsWith('drive/'))) {
            return json({ error: 'Folder must be under media/ or drive/' }, 403);
        }

        if (folderPath.includes('..')) {
            return json({ error: 'Invalid folder path' }, 400);
        }

        // 创建文件夹：上传一个空的 .folder 标记文件
        const markerKey = folderPath + '.folder';
        
        try {
            await env.MEDIA_BUCKET.put(markerKey, '', {
                httpMetadata: { contentType: 'application/x-directory' }
            });
            return json({ success: true, message: '文件夹创建成功', path: folderPath });
        } catch (err) {
            return json({ error: 'Failed to create folder: ' + err.message }, 500);
        }
    } catch (err) {
        console.error('[create-folder] Error:', err);
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