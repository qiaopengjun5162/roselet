#!/usr/bin/env node
/**
 * 部署后「发出去的东西到底是什么」的检查。
 *
 *   node scripts/verify-deploy.mjs [baseUrl]
 *
 * 只看 /health 是不够的——它只证明后端活着。2026-11-20 那次线上是这样：
 * 后端 200、`/health` 200、镜像构建成功、部署绿，但前端包里写死了
 * `http://<ip>`，https 页面一打开就把所有请求当混合内容拦掉，注册点了没反应。
 * 整条流水线全绿，产品是坏的。
 *
 * 所以这里直接翻产物：把首页引用的 JS chunk 下下来，看里面有没有
 * 「协议被钉死的绝对地址」。有就非 0 退出，让它挡住部署。
 */
const DEFAULT_BASE = "http://47.131.238.0";

/** IPv4 形式的绝对地址（`http://1.2.3.4`、`http://1.2.3.4:3001`）。 */
const PINNED_IPV4 = /http:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?/g;
/** 开发地址漏进产物：线上每个请求都会打到用户自己的机器。 */
const DEV_LEAK = /localhost:3001/g;

export function scanBundle(text) {
  const problems = [];
  for (const hit of text.match(PINNED_IPV4) ?? []) problems.push(`pinned http origin: ${hit}`);
  for (const hit of text.match(DEV_LEAK) ?? []) problems.push(`dev origin leaked: ${hit}`);
  return problems;
}

export function bundleUrls(html, base) {
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  // 首屏之外的 chunk 不在 HTML 里，但 Next 会在内联脚本里列出它们的路径。
  const chunks = [...html.matchAll(/"(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
  return [...new Set([...srcs, ...chunks])]
    .filter((p) => p.includes("/_next/static/"))
    .map((p) => (p.startsWith("http") ? p : `${base}${p}`));
}

async function get(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const base = (process.argv[2] || process.env.VERIFY_BASE || DEFAULT_BASE).replace(/\/$/, "");
  const failures = [];

  for (const path of ["/", "/health", "/api/garden?per_page=1"]) {
    try {
      const res = await get(`${base}${path}`);
      console.log(`${res.ok ? "✓" : "✗"} ${path.padEnd(24)} ${res.status}`);
      if (!res.ok) failures.push(`${path} -> ${res.status}`);
    } catch (e) {
      console.log(`✗ ${path.padEnd(24)} ${e.message}`);
      failures.push(`${path} -> ${e.message}`);
    }
  }

  const html = await get(`${base}/`).then((r) => r.text());
  // 只扫有上限的一批：首屏 chunk 足够代表「协议有没有被钉死」，
  // 全量下下来在丢包链路上要几分钟，部署校验不能比部署本身还慢。
  const urls = bundleUrls(html, base).slice(0, 30);
  if (urls.length === 0) failures.push("首页没有引用任何 /_next/static 脚本，产物不对");

  let scanned = 0;
  const batch = 6;
  for (let i = 0; i < urls.length; i += batch) {
    const slice = urls.slice(i, i + batch);
    await Promise.all(
      slice.map(async (url) => {
        try {
          const text = await get(url).then((r) => r.text());
          scanned += 1;
          for (const problem of scanBundle(text)) failures.push(`${problem} in ${url.replace(base, "")}`);
        } catch (e) {
          failures.push(`${url} -> ${e.message}`);
        }
      }),
    );
  }
  console.log(`✓ scanned ${scanned}/${urls.length} js chunks for pinned origins`);

  if (failures.length) {
    console.error("\n部署校验失败：");
    for (const f of [...new Set(failures)]) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\nOK ${base}：页面、健康检查、接口、产物地址都对`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("verify-deploy 异常:", e);
    process.exit(2);
  });
}
