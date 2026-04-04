export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  
  try {
    const { filePath } = await request.json();
    const alistHost = env.ALIST_HOST;
    const alistToken = env.ALIST_TOKEN;
    const transcodeServer = env.TRANSCODE_SERVER_URL;
    
    const fileRes = await fetch(`${alistHost}/api/fs/get`, {
      method: "POST",
      headers: { "Authorization": alistToken, "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath })
    });
    
    const fileData = await fileRes.json();
    const rawUrl = fileData.data.raw_url;
    
    const transcodeServer = body.serverUrl || env.TRANSCODE_SERVER_URL;
    
    const res = await fetch(`${transcodeServer}/transcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ download_url: rawUrl })
    });
    
    return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}