/**
 * /api/admin/delete
 * 处理文件删除请求
 */
export async function onRequestPost({ request, env }) {
    try {
        // 1. 解析请求体
        let body;
        try {
            body = await request.json(); // 依赖前端发送的 JSON 数据
        } catch (parseError) {
            return new Response(
                JSON.stringify({ error: '请求格式错误，需为 JSON' }),
                { status: 400 }
            );
        }

        const { path } = body;

        // 2. 参数校验
        if (!path) {
            return new Response(
                JSON.stringify({ error: '缺少参数：path' }),
                { status: 400 }
            );
        }

        // 3. 执行删除操作
        try {
            await env.MEDIA_BUCKET.delete(path);
            return new Response(
                JSON.stringify({ success: true, message: '删除成功' }),
                { status: 200 }
            );
        } catch (deleteError) {
            console.error('删除失败：', deleteError);
            return new Response(
                JSON.stringify({ error: '文件删除失败' }),
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('服务器错误：', error);
        return new Response(
            JSON.stringify({ error: '服务器内部错误' }),
            { status: 500 }
        );
    }
}
