import { chromium } from "playwright";

const BASE = "http://47.131.238.0";
const browser = await chromium.launch({ args: ["--no-proxy-server"] });

for (let i = 1; i <= 3; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
  const t0 = Date.now();
  const resp = await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000 });
  const status = resp?.status();
  await page.waitForTimeout(1500);
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const ok = performance.getEntriesByType("resource").filter((r) => r.responseStatus >= 400 || r.responseStatus === 0).length;
    return {
      ttfb: Math.round(n.responseStart),
      fcp: fcp ? Math.round(fcp.startTime) : null,
      resources: performance.getEntriesByType("resource").length,
      badResources: ok,
      bytes: Math.round((n.transferSize || 0) / 1024),
    };
  });
  const text = await page.evaluate(() => document.body.innerText);
  console.log(
    `第 ${i} 次 status=${status} 墙钟=${Date.now() - t0}ms TTFB=${nav.ttfb} FCP=${nav.fcp} 资源=${nav.resources}(坏 ${nav.badResources}) ` +
      `HTML=${nav.bytes}KB 标语=${text.includes("一起来种一个玫瑰花圃吧")} pageerror=${errs.length}`,
  );
  await ctx.close();
}

// 种花页：等 hydration 完成再点，避免把「没挂载」误判成「功能坏了」
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
await page.goto(`${BASE}/plant`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
const colorBtn = page.getByText("红玫瑰", { exact: true }).first();
await colorBtn.click({ timeout: 20000 });
await page.waitForTimeout(1200);
const rose = await page.$('[data-testid="rose-drag-area"]');
const spots = await page.$$("[data-hotspot]");
if (spots[1]) {
  await spots[1].click();
  await page.waitForTimeout(600);
}
const hint = await page.evaluate(() => document.body.innerText.includes("写好了"));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log(
  `种花页：玫瑰=${Boolean(rose)} 光点=${spots.length} 提示卡=${hint} 横向溢出=${overflow} pageerror=${errs.length}`,
);
await browser.close();
