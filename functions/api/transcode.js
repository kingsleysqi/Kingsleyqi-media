export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  
  try {
    const contentType = request.headers.get('content-type') || '';
    let filePath, outputDir, outputType, configId, serverUrl;
    let file = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      file = formData.get('file');
      outputDir = String(formData.get('outputDir') || '');
      outputType = String(formData.get('outputType') || 'server');
      configId = String(formData.get('configId') || '');
      serverUrl = String(formData.get('serverUrl') || '');
    } else {
      const body = await request.json();
      filePath = body.filePath;
      outputDir = body.outputDir;
      outputType = body.outputType;
      configId = body.configId;
      serverUrl = body.serverUrl;
    }

    const alistHost = env.ALIST_HOST;
    const alistToken = env.ALIST_TOKEN;
    const transcodeServer = serverUrl || env.TRANSCODE_SERVER_URL;

    let res;
    if (file) {
      const fd = new FormData();
      fd.append('file', file, file.name || 'upload');
      fd.append('output_dir', outputDir);
      fd.append('output_type', outputType || 'server');
      if (outputType === 'r2') {
        fd.append('r2_config', JSON.stringify({
          account_id: env.CF_ACCOUNT_ID,
          bucket_name: env.R2_BUCKET_NAME,
          access_key_id: env.R2_ACCESS_KEY_ID,
          secret_access_key: env.R2_SECRET_ACCESS_KEY
        }));
      }
      res = await fetch(`${transcodeServer}/transcode`, {
        method: 'POST',
        body: fd
      });
    } else {
      const fileRes = await fetch(`${alistHost}/api/fs/get`, {
        method: "POST",
        headers: { "Authorization": alistToken, "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath })
      });

      const fileData = await fileRes.json();
      const rawUrl = fileData.data?.raw_url;
      if (!rawUrl) return new Response(JSON.stringify({ error: '无法获取文件直链' }), { status: 400 });

      res = await fetch(`${transcodeServer}/transcode`, {
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
    }
    
    return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}