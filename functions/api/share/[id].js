/**
 * /api/share/[id]
 * GET ?password=xxx → { share } 或 { needPassword: true } 或 404
 * 
 * 使用 R2 Binding 直接访问，不再使用 S3 API 签名
 */
export async function onRequestGet({ params, request, env }) {
    const id = params.id;
    if (!id) return json({ error: 'Not found' }, 404);

    const shareKey = `_admin/shares/${id}.json`;
    let share;

    try {
        // 1. 直接使用 Binding 读取 R2，无需复杂签名
        const obj = await env.MEDIA_BUCKET.get(shareKey);
        if (!obj) return json({ error: 'Not found' }, 404);
        share = await obj.json();
    } catch (err) {
        return json({ error: 'Not found', details: err.message }, 404);
    }

    // 2. 检查过期
    if (share.expires && share.expires < Date.now()) {
        return json({ error: 'This share has expired', expired: true }, 410);
    }

    // 3. 检查访问次数
    if (share.maxUse > 0 && share.useCount >= share.maxUse) {
        return json({ error: 'Access limit reached', limitReached: true }, 403);
    }

    // 4. 检查密码 (如果需要)
    if (share.password) {
        const url = new URL(request.url);
        const pw = url.searchParams.get('password') || '';
        if (!pw) {
            return json({ 
                needPassword: true, 
                id: share.id, 
                title: share.title, 
                desc: share.desc || '', 
                fileCount: (share.files || []).length 
            });
        }
        if (pw !== share.password) {
            return json({ error: 'Wrong password', wrongPassword: true }, 401);
        }
    }

    // 5. 异步递增访问次数 (不阻塞响应)
    incrementUseCount(env, shareKey, share).catch(console.error);

    // 6. 构建响应数据
    // 注意：这里不再生成临时下载链接，而是前端直接请求 /share/[id]/file-key
    // 或者你可以在 Pages Functions 里做一个代理下载接口 /api/proxy/[id]/file-key
    // 为了简单稳定，这里先只返回文件列表结构
    return json({
        id: share.id,
        title: share.title,
        desc: share.desc || '',
        expires: share.expires,
        created: share.created,
        useCount: share.useCount,
        maxUse: share.maxUse,
        files: (share.files || []).map(f => ({
            name: f.split('/').pop(),
            key: f,
            // 提示前端去请求 /share/${id}/${encodedKey} 获取文件
            // 或者配置一个代理接口
            url: `/share/${id}/${encodeURIComponent(f.split('/').pop())}?file=${encodeURIComponent(f)}`
        }))
    });
}

// 异步增加计数器
async function incrementUseCount(env, key, share) {
    share.useCount = (share.useCount || 0) + 1;
    await env.MEDIA_BUCKET.put(key, JSON.stringify(share), {
        httpMetadata: { contentType: 'application/json' }
    });
}

// 辅助函数：返回 JSON 响应
function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
