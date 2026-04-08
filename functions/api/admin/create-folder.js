// functions/api/admin/create-folder.js
import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
    if (request.method === 'OPTIONS') {
        return cors();
    }

    const isAuth = await verifyAuth(request, env);
    if (!isAuth) {
        return json({ error: 'Unauthorized' }, 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        let { folderPath } = body;

        if (!folderPath) {
            return json({ error: 'Missing parameter: folderPath' }, 400);
        }

        if (!folderPath.endsWith('/')) {
            folderPath += '/';
        }

        if ((!folderPath.startsWith('media/') && !folderPath.startsWith('drive/'))) {
            return json({ error: 'Folder must be under media/ or drive/' }, 403);
        }

        if (folderPath.includes('..')) {
            return json({ error: 'Invalid folder path' }, 400);
        }

        const markerKey = folderPath + '.folder';
        
        await env.MEDIA_BUCKET.put(markerKey, '', {
            httpMetadata: { contentType: 'application/x-directory' }
        });
        
        return json({ success: true, message: 'Folder created', path: folderPath });
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