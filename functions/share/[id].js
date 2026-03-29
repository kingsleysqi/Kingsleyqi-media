import html from '../../share/index.html';

export async function onRequestGet() {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}