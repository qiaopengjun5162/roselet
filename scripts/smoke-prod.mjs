#!/usr/bin/env node
/**
 * 生产冒烟：走完一次真实用户旅程，而不只是「页面能打开」。
 *
 *   node scripts/smoke-prod.mjs [baseUrl]
 *
 * 覆盖：注册 → 选色 → 写内容 → 种下 → 花圃可见 → 详情可读 → 一周回顾 → 我的花圃
 * 任何一步失败都会以非 0 退出，方便接进 CI 或发版后手动验一遍。
 *
 * 需要 playwright（仓库根目录已有依赖）。若本机走代理，请显式传 --no-proxy-server：
 * 浏览器侧的 502 很可能是代理发的，不是线上故障（见 DEVLOG「无代理对照」）。
 */
import { chromium } from "playwright";

const BASE = (process.argv[2] || process.env.SMOKE_BASE || "http://47.131.238.0").replace(/\/$/, "");
const stamp = Date.now().toString().slice(-6);
const NICK = `冒烟测试${stamp}`;
const TEXT = `冒烟测试 ${stamp}：把整条链路走一遍`;

const results = [];
const pageErrors = [];

function record(name, ok, ms, detail = "") {
  results.push({ name, ok, ms, detail });
  console.log(`${ok ? "✓" : "✗"} ${name.padEnd(24)} ${String(ms).padStart(6)}ms ${detail}`);
}

async function step(name, fn) {
  const t = Date.now();
  try {
    const detail = await fn();
    record(name, true, Date.now() - t, detail || "");
    return true;
  } catch (e) {
    record(name, false, Date.now() - t, String(e.message).split("\n")[0].slice(0, 120));
    return false;
  }
}

/** 按可见文字点按钮：文本匹配容易命中多个，这里取第一个可见的。 */
async function clickByText(page, text) {
  const clicked = await page.evaluate((t) => {
    const els = [...document.querySelectorAll("button, a")];
    const el = els.find((e) => (e.textContent || "").includes(t) && e.offsetParent !== null);
    if (!el) return false;
    el.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`找不到可点的「${text}」`);
}

/**
 * 点了之后等某个条件成立，没成立就再点。
 * 原因很实在：这些页面是重客户端页，JS 没下载完时按钮是「死」的——
 * 点下去没有任何反应，也不报错。一次点击就断言会变成随机失败。
 */
async function clickUntil(page, text, check, { attempts = 6, gap = 3000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (await check()) return i + 1;
    await clickByText(page, text);
    for (let waited = 0; waited < gap; waited += 500) {
      await page.waitForTimeout(500);
      if (await check()) return i + 1;
    }
  }
  throw new Error(`点了 ${attempts} 次「${text}」，条件仍未成立`);
}

async function main() {
  const browser = await chromium.launch({ args: ["--no-proxy-server"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message.split("\n")[0]));

  // 1. 注册（昵称唯一，不走密码分支）
  const registered = await step("注册并进入花圃", async () => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.fill('input[placeholder="你想叫什么名字？"]', NICK);
    await clickByText(page, "继续种花");
    await page.waitForURL("**/garden", { timeout: 60000 });
    return NICK;
  });
  if (!registered) {
    console.log("\n注册失败，后续步骤无法进行");
    await browser.close();
    process.exit(1);
  }

  // 2. 选颜色 → 写内容 → 提交
  await step("选颜色进入编辑", async () => {
    await page.goto(`${BASE}/plant`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("button", { timeout: 30000 });
    const tries = await clickUntil(page, "红玫瑰", async () => (await page.$("textarea")) !== null);
    return `第 ${tries} 次点击后出现输入框`;
  });

  await step("写下内容并种下", async () => {
    await page.fill("textarea", TEXT);
    await clickUntil(page, "种下玫瑰吧", async () => (await page.evaluate(() => document.body.innerText.includes("种好了"))) === true, {
      attempts: 4,
      gap: 6000,
    });
    return "提交成功";
  });

  // 3. 花圃里能看到这朵
  let roseHref = null;
  await step("花圃里能找到这朵", async () => {
    await clickByText(page, "查看花圃");
    await page.waitForURL("**/garden", { timeout: 60000 });
    await page.waitForFunction((s) => document.body.innerText.includes(s), stamp, { timeout: 60000 });
    roseHref = await page.evaluate((s) => {
      const a = [...document.querySelectorAll('a[href^="/rose/"]')].find((el) => (el.textContent || "").includes(s));
      return a ? a.getAttribute("href") : null;
    }, stamp);
    if (!roseHref) throw new Error("列表里没有这朵花的链接");
    return roseHref;
  });

  // 4. 详情页能读到全文
  await step("详情页能读到全文", async () => {
    if (!roseHref) throw new Error("上一步没拿到详情链接");
    await page.goto(`${BASE}${roseHref}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction((t) => document.body.innerText.includes(t), TEXT.slice(0, 18), { timeout: 60000 });
    return "全文可见";
  });

  // 4.1 点赞：社区互动的核心动作，按钮也是「没 hydrate 就点不动」的类型
  await step("点赞并看到计数", async () => {
    const before = await page.evaluate(() => document.body.innerText.match(/❤️\s*(\d+)/)?.[1] ?? "0");
    await clickUntil(
      page,
      "❤️",
      async () => {
        const now = await page.evaluate(() => document.body.innerText.match(/❤️\s*(\d+)/)?.[1] ?? "0");
        return Number(now) > Number(before);
      },
      { attempts: 4, gap: 3000 }
    );
    const after = await page.evaluate(() => document.body.innerText.match(/❤️\s*(\d+)/)?.[1] ?? "0");
    return `${before} → ${after}`;
  });

  // 6. 收尾：把这朵花设为私密。
  //
  // 产品明确不提供「删除」（见 DEVLOG 2026-06-25：种下即留下，不开放删除入口），
  // 但冒烟每次跑都会种一朵真的花——不处理的话公共花圃里会攒一堆「冒烟测试xxxx」。
  // 设为私密是产品允许的动作，效果上等于从公共视野里收走，而且不影响别人。
  await step("收尾：把测试花设为私密", async () => {
    if (!roseHref) throw new Error("没有可收尾的玫瑰");
    const id = roseHref.split("/").pop();
    const result = await page.evaluate(async ({ id }) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/rose/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_private: true }),
      });
      return { status: res.status, body: (await res.text()).slice(0, 120) };
    }, { id });
    if (result.status !== 200) throw new Error(`HTTP ${result.status} ${result.body}`);
    return "已转私密，公共花圃不留痕";
  });
  // 5. 其余主要页面不该是错误态
  for (const [name, path] of [
    ["一周回顾可打开", "/week"],
    ["我的花圃可打开", "/my"],
    ["关于页可打开", "/about"],
  ]) {
    await step(name, async () => {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : "no response"}`);
      await page.waitForTimeout(1500);
      const txt = await page.evaluate(() => document.body.innerText);
      if (/出错了|加载失败|Application error|Internal Server Error/i.test(txt)) {
        throw new Error(`错误态：${txt.slice(0, 60).replace(/\n/g, " ")}`);
      }
      return `HTTP ${res.status()}`;
    });
  }

  // 7. 收尾：把测试账号也注销掉。
  //
  // 每跑一次冒烟就多一个「冒烟测试xxxx」账号，而 `/stats` 里的用户数
  // （`users WHERE deleted_at IS NULL`）正是「要不要继续投入」的那条判断线。
  // 不清掉的话，判断线会被自己的测试灌水。注销是产品本来就有的动作
  // （软删除 + 30 天冷静期），不需要为测试新增任何接口。
  await step("收尾：注销测试账号", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/auth/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: "automated smoke test" }),
      });
      return { status: res.status, body: (await res.text()).slice(0, 120) };
    });
    if (result.status !== 200) throw new Error(`HTTP ${result.status} ${result.body}`);
    return "已注销，不计入活跃用户";
  });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 步通过；pageerror ${pageErrors.length}`);
  if (pageErrors.length) console.log("pageerror:", pageErrors.slice(0, 3));
  console.log("测试账号:", NICK);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("冒烟脚本异常:", e);
  process.exit(2);
});
