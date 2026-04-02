export async function onRequest(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const transcodeServer = env.TRANSCODE_SERVER_URL;
  
  try {
    const res = await fetch(`${transcodeServer}/status/${jobId}`);
    return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}