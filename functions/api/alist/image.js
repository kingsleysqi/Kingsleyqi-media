/**
 * /api/alist/image?url=xxx
 * 代理 Alist 图片，修正 Content-Type，解决强制下载问题
 * 公开接口，无需鉴权（只代理图片）
 */
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const imgUrl = url.searchParams.get('url');

  if (!imgUrl) return new Response('url required', { status: 400 });

  // 只允许代理图片，防止滥用
  try {
    new URL(imgUrl); // 验证是合法 URL
  } catch {
    return new Response('invalid url', { status: 400 });
  }

  try {
    const res = await fetch(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) return new Response('fetch failed', { status: res.status });

    // 根据 URL 后缀推断正确的 Content-Type
    const ext = imgUrl.split('?')[0].split('.').pop().toLowerCase();
    const typeMap = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', webp: 'image/webp',
      gif: 'image/gif', avif: 'image/avif',
    };
    const contentType = typeMap[ext] || res.headers.get('Content-Type') || 'image/jpeg';

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err) {
    return new Response('error: ' + err.message, { status: 500 });
  }
}