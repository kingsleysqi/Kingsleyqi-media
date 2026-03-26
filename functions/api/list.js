export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || 'media/tvshows/';

  const listed = await env.MEDIA_BUCKET.list({
    prefix: prefix,
    delimiter: '/',
    limit: 1000,
    include: ['httpMetadata']
  });

  const items = listed.objects.map(obj => {
    const parts = obj.key.split('/');
    const name = parts.pop();
    const title = name.replace(/\.(mp4|m3u8|mp3|jpg|jpeg|png)$/i, '');

    return {
      key: obj.key,
      name: name,
      title: title || name,
      url: `https://media.kingsleyqi.com/${obj.key}`,   // ← 已更新为你的自定义域名
      type: obj.key.toLowerCase().endsWith('.m3u8') ? 'hls' :
            obj.key.toLowerCase().endsWith('.mp4') ? 'mp4' :
            obj.key.toLowerCase().endsWith('.mp3') ? 'audio' : 'image'
    };
  });

  return new Response(JSON.stringify({
    success: true,
    items: items,
    folders: listed.delimitedPrefixes ? listed.delimitedPrefixes.map(p => 
      p.replace(prefix, '').replace(/\/$/, '')
    ) : []
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
