/* eslint-disable import/no-anonymous-default-export */
// Only /rose/* should invoke this worker; _routes.json keeps the rest of the
// mirror on free static delivery instead of consuming Pages Functions quota.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const roseMatch = url.pathname.match(/^\/rose\/[^/]+$/);
    if (roseMatch) {
      return env.ASSETS.fetch(new URL("/rose/placeholder.html", request.url));
    }
    return env.ASSETS.fetch(request);
  },
};
