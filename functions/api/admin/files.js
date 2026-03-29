// functions/api/admin/files.js
import { verifyAuth } from './_auth_helper.js';

const SCAN_PREFIXES = ['media/', 'drive/'];

export async function onRequestGet({ request, env }) {
    // CORS
    if (request.method === 'OPTIONS') {
        return cors();
    }

    const isAuth = await verifyAuth(request, env);
    if (!isAuth) {
        return json({ error: 'Unauthorized' }, 401);
    }

    if (!env.MEDIA_BUCKET) {
        return json({ error: 'MEDIA_BUCKET not bound' }, 500);
    }

    const files = [];

    for (const prefix of SCAN_PREFIXES) {
        let cursor;
        do {
            const opts = { prefix, limit: 1000 };
            if (cursor) opts.cursor = cursor;
            const listed = await env.MEDIA_BUCKET.list(opts);
            for (const obj of listed.objects) {
                files.push({
                    key: obj.key,
                    size: obj.size,
                    uploaded: obj.uploaded,
                });
            }
            cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);
    }

    files.sort((a, b) => a.key.localeCompare(b.key));
    return json({ files });
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
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}