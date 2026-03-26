/**
 * /api/list — 动态读取 R2 Bucket 媒体文件列表
 * 路径约定：
 *   media/tvshows/<剧名>/Season XX/<文件>.mp4
 *   media/tvshows/<剧名>/poster.jpg
 *   media/movies/<电影名>/<文件>.mp4
 *   media/movies/<电影名>/poster.jpg
 *   media/music/<歌名>/<文件>.mp3
 */

export async function onRequest(context) {
  const { env } = context;

  if (!env.MEDIA_BUCKET) {
    return new Response(JSON.stringify({ error: "R2 binding MEDIA_BUCKET not configured." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 列出所有文件
    const listObjects = async (prefix) => {
      const files = [];
      let cursor;
      do {
        const resp = await env.MEDIA_BUCKET.list({ prefix, cursor });
        files.push(...resp.objects);
        cursor = resp.list_complete ? null : resp.cursor;
      } while (cursor);
      return files;
    };

    const allFiles = await listObjects("media/");
    const itemsMap = {}; // 临时存储 media

    for (const file of allFiles) {
      if (file.key.endsWith("/")) continue; // 忽略文件夹

      const parts = file.key.split("/");
      if (parts.length < 3) continue;

      const type = parts[1]; // tvshows/movies/music
      const name = parts[2]; // 剧名/电影名/歌名
      if (!itemsMap[type]) itemsMap[type] = {};
      if (!itemsMap[type][name]) itemsMap[type][name] = { type, name, episodes: [] };

      const url = `https://${env.MEDIA_BUCKET.account_id}.r2.cloudflarestorage.com/${file.key}`;

      // poster 单独处理
      if (file.key.endsWith("poster.jpg")) {
        itemsMap[type][name].poster = url;
        continue;
      }

      // tvshows 可能有子文件夹 (Season XX)
      if (type === "tvshows" && parts.length >= 5) {
        const episodeName = parts[4];
        itemsMap[type][name].episodes.push({ name: episodeName, url });
      } else if (type === "movies" || type === "music") {
        itemsMap[type][name].url = url;
      }
    }

    // 转成数组
    const result = [];
    Object.values(itemsMap).forEach(group => {
      Object.values(group).forEach(item => {
        result.push(item);
      });
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}