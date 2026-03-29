export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const res = await fetch(`${url.origin}/share/index.html`);
  const html = await res.text();
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}
