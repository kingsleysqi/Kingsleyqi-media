export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  
  try {
    const body = await request.json();
    const { filePath, outputDir, outputType, configId, serverUrl } = body;
    
    const alistHost = env.ALIST_HOST;
    const alistToken = env.ALIST_TOKEN;
    const transcodeServer = serverUrl || env.TRANSCODE_SERVER_URL;
    
    const fileRes = await fetch(`${alistHost}/api/fs/get`, {
      method: "POST",
      headers: { "Authorization": alistToken, "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath })
    });
    
    const fileData = await fileRes.json();
    const rawUrl = fileData.data?.raw_url;
    if (!rawUrl) return new Response(JSON.stringify({ error: '无法获取文件直链' }), { status: 400 });
    
    const res = await fetch(`${transcodeServer}/transcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  download_url: rawUrl,
  output_dir: outputDir,
  output_type: outputType || 'server',
  r2_config: outputType === 'r2' ? {
    account_id: env.CF_ACCOUNT_ID,
    bucket_name: env.R2_BUCKET_NAME,
    access_key_id: env.R2_ACCESS_KEY_ID,
    secret_access_key: env.R2_SECRET_ACCESS_KEY
  } : null
})
    });
    
    return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}