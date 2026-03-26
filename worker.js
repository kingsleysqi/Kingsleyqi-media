export default {
  async fetch(request, env) {
    return new Response("R2 connected: " + !!env.MEDIA_BUCKET);
  }
};