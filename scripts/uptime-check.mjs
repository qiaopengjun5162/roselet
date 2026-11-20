#!/usr/bin/env node
/**
 * 外部探活：从**站外**判断这个站还能不能用。
 *
 *   node scripts/uptime-check.mjs [baseUrl]
 *
 * 为什么不用本机定时器：报警和被监控的对象不能在同一台机器上。机器挂了，
 * 那个负责喊人的定时器一起挂，结果就是「没人知道」。所以这个脚本的定位是
 * 由 GitHub Actions 的 runners（站外）每 15 分钟跑一次，失败就非 0 退出，
 * 让 GitHub 把失败通知发出来。
 *
 * 检查四项，缺一项都不算「能用」：
 *
 *   1. `/health`       后端活着，且**数据库真连上了**（不是进程还在就算活）
 *   2. `/`             页面能出，且标题是对的（不是白页 / 502 的兜底页）
 *   3. `/api/garden`   读接口能返回数据（链路和后端不是半死）
 *   4. 产物地址        首页引用的 chunk 里没有钉死协议的绝对地址
 *
 * 第 4 项是 2026-11-20 那次事故的教训：前三项全绿、部署绿、`/health` 200，
 * 但 https 页面里所有请求被当混合内容静默拦掉，用户点注册没反应。**这就是
 * 「监控说正常、用户说不能用」的典型形状**，所以把它也算进探活。
 *
 * 重试是有意的：换容器时会有几秒钟 502，跨境链路本身也有 SYN 丢包。
 * 单次失败就报丧会让人很快学会忽略告警，那比没有告警更糟。
 */
import { bundleUrls, scanBundle } from "./verify-deploy.mjs";

const DEFAULT_BASE = "https://roselet.47.131.238.0.sslip.io";
const ATTEMPTS = Number(process.env.UPTIME_ATTEMPTS || 3);
const GAP_MS = Number(process.env.UPTIME_GAP_MS ?? 20000);
/** 扫多少个 chunk 就够判断「协议有没有被钉死」，不必全量下载。 */
const MAX_CHUNKS = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function checkOnce(base) {
  const failures = [];
  const lines = [];

  // 1. 后端活着，而且数据库真的连上了。
  try {
    const res = await get(`${base}/health`);
    const body = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      /* 非 JSON 就在下面报 */
    }
    const ok = res.ok && parsed?.status === "ok" && parsed?.database === "healthy";
    lines.push(`${ok ? "✓" : "✗"} /health  ${res.status}  ${body.slice(0, 80)}`);
    if (!ok) failures.push(`/health 不正常：${res.status} ${body.slice(0, 120)}`);
  } catch (e) {
    lines.push(`✗ /health  连不上：${e.message}`);
    failures.push(`/health 连不上：${e.message}`);
  }

  // 2. 页面能出，而且出的是这个产品的页面。
  let html = "";
  try {
    const res = await get(`${base}/`);
    html = await res.text();
    const title = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
    const ok = res.ok && title.includes("Roselet");
    lines.push(`${ok ? "✓" : "✗"} /        ${res.status}  title="${title}"`);
    if (!ok) failures.push(`首页不对：${res.status} title="${title}"`);
  } catch (e) {
    lines.push(`✗ /        连不上：${e.message}`);
    failures.push(`首页连不上：${e.message}`);
  }

  // 3. 读接口能返回数据：进程活着但库断了，这一项会挂。
  try {
    const res = await get(`${base}/api/garden?per_page=1`);
    lines.push(`${res.ok ? "✓" : "✗"} /api/garden  ${res.status}`);
    if (!res.ok) failures.push(`/api/garden -> ${res.status}`);
  } catch (e) {
    lines.push(`✗ /api/garden  连不上：${e.message}`);
    failures.push(`/api/garden 连不上：${e.message}`);
  }

  // 4. 产物里的地址还能不能在当前协议下用。
  if (html) {
    const urls = bundleUrls(html, base).slice(0, MAX_CHUNKS);
    if (urls.length === 0) {
      failures.push("首页没有引用任何 /_next/static 脚本，产物不对");
    }
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const text = await get(url).then((r) => r.text());
          return scanBundle(text).map((p) => `${p} in ${url.replace(base, "")}`);
        } catch (e) {
          return [`chunk 取不到 ${url.replace(base, "")} -> ${e.message}`];
        }
      }),
    );
    const problems = results.flat();
    lines.push(`${problems.length ? "✗" : "✓"} chunks  ${urls.length} 个`);
    failures.push(...problems);
  }

  return { failures, lines };
}

async function main() {
  const base = (process.argv[2] || process.env.UPTIME_BASE || DEFAULT_BASE).replace(/\/$/, "");
  const started = Date.now();
  let last = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    last = await checkOnce(base);
    for (const line of last.lines) console.log(line);
    if (last.failures.length === 0) break;
    if (attempt < ATTEMPTS) {
      console.log(`第 ${attempt}/${ATTEMPTS} 次未通过，${GAP_MS / 1000}s 后重试（换容器会有几秒 502）\n`);
      await sleep(GAP_MS);
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  if (last.failures.length > 0) {
    console.error(`\n站不可用：${base}（${ATTEMPTS} 次尝试，${elapsed}s）`);
    for (const f of [...new Set(last.failures)]) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\nOK ${base}：后端、页面、读接口、产物地址都对（${elapsed}s）`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("uptime-check 异常:", e);
    process.exit(2);
  });
}
