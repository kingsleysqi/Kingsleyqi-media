/**
 * /api/app/health
 * Minimal endpoint for App server checks.
 */
export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

