/**
 * POST /api/admin/delete
 * 删除文件
 */
export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const { path } = body; // 前端传来的文件路径，例如 "movies/test.mp4"

        if (!path) {
            return new Response(JSON.stringify({ error: 'Missing path' }), { status: 400 });
        }

        // 安全检查：防止路径遍历攻击 (例如 ../admin)
        if (path.includes('..') || path.startsWith('/')) {
             return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400 });
        }

        // 1. 直接使用 Binding 删除，无需 Access Key
        // 注意：这里直接使用 env.MEDIA_BUCKET，不需要 new S3Client 等复杂操作
        await env.MEDIA_BUCKET.delete(path);

        // 2. 如果是删除了分享文件，可能还需要更新索引（可选）
        // await env.MEDIA_BUCKET.delete(`_admin/shares/${path}.json`); 

        return new Response(JSON.stringify({ success: true, message: 'Deleted successfully' }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Delete error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
