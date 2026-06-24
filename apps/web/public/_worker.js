// Cloudflare Pages catch-all worker: for any /rose/:id request that doesn't
// match a statically generated file, serve the placeholder shell so the client
// can fetch the rose dynamically.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const roseMatch = url.pathname.match(/^\/rose\/[^/]+$/);
    if (roseMatch) {
      return env.ASSETS.fetch(new URL("/rose/placeholder/index.html", request.url));
    }
    return env.ASSETS.fetch(request);
  },
};
