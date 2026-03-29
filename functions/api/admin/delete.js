export async function onRequestPost({ request, env }) {
  try {
    const { key } = await request.json();

    if (!key || typeof key !== 'string') {
      return new Response(JSON.stringify({ error: '缺少 key 参数' }), { status: 400 });
    }

    // 支持 media/ 和 drive/ 两种前缀
    if (!key.startsWith('media/') && !key.startsWith('drive/')) {
      return new Response(JSON.stringify({ 
        error: 'Key 必须以 media/ 或 drive/ 开头' 
      }), { status: 400 });
    }

    const object = await env.R2_BUCKET.delete(key);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `已删除: ${key}` 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Delete error:', err);
    return new Response(JSON.stringify({ 
      error: '删除失败: ' + err.message 
    }), { status: 500 });
  }
}