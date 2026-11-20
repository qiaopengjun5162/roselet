/**
 * 前端到底该往哪儿发请求。
 *
 * 这里只有三种合法取值，别再加第四种：
 *
 * 1. `same-origin`（构建期哨兵）→ 运行时用空字符串，即相对路径 `/api/...`。
 *    线上 Caddy 已经把 `/api/*`、`/health` 分流到后端，同源请求不需要 CORS，
 *    也**不会变成混合内容**——这是 http 和 https 两个入口能共用一份构建产物的前提。
 * 2. 绝对地址（`https://api.example.com`）→ Vercel / Cloudflare Pages 这类前后端分域部署用。
 * 3. 不写 → 开发默认 `http://localhost:3001`。
 *
 * ⚠️ 踩过的坑：生产镜像曾经把 `NEXT_PUBLIC_API_URL=http://47.131.238.0` 写死进包里。
 * 页面一旦用 https 打开，浏览器会把所有 `http://` 的 XHR 当混合内容**静默拦掉**——
 * 不报错、不发请求、点了没反应，只有控制台一行 warning。看着像「网站坏了」，
 * 其实是打包时把协议钉死了。同源相对路径从根上没有这个可能。
 */
export const SAME_ORIGIN = "same-origin";

/** 开发时后端在另一个端口，构建产物里不会走到这个分支。 */
const DEV_FALLBACK = "http://localhost:3001";

/**
 * 把构建期的环境变量解析成可以直接拼在 `${base}/api/...` 前面的前缀。
 * 返回空字符串表示同源（相对路径）。
 */
export function resolveApiBase(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed === SAME_ORIGIN) return "";
  if (!trimmed) return DEV_FALLBACK;
  return trimmed.replace(/\/$/, "");
}

/**
 * 同源模式下 WebSocket 该连哪儿：必须跟着页面自己的协议走，
 * https 页面连 `ws://` 一样会被浏览器当混合内容拦掉（wss 才行）。
 *
 * 参数是为了能在测试里喂一个假的 location，jsdom 的 window.location 改不动。
 */
export function sameOriginWsBase(
  loc: { protocol: string; host: string } | null = typeof window === "undefined" ? null : window.location,
): string {
  if (!loc?.host) return "ws://localhost:3001";
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}`;
}
