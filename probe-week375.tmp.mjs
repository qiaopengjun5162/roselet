import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3100";
const DAY = 24 * 60 * 60 * 1000;

// 真实生产数据里最长的一条（多行、约 130 字），用来验排版会不会撑破卡片。
const LONG = `喜欢，是天底下顶顶重要的事情。
热爱是平淡生活里的光，用热爱对抗无趣。
人总要爱点什么，恰似草木对光阴的钟情，
人总要爱着点什么，才不负这光阴流转。
我们总是在意自己的缺陷，遮掩着生怕别人看到。可是，当你的吸引力大于你的缺憾，谁又在意你的不完美呢？`;

const mk = (id, daysAgo, f) => ({
  id, color: f.color ?? "red", gratitude: f.gratitude ?? null, anxiety: f.anxiety ?? null, hope: f.hope ?? null,
  user_id: "u-1", nickname: "小满", like_count: 0, ai_reply: null, is_private: false,
  created_at: new Date(Date.now() - daysAgo * DAY).toISOString(),
  recipient_nickname: null, is_gift: false,
});

const payload = [
  mk("q1", 0.2, { hope: LONG }),
  mk("q2", 1, { gratitude: "谢谢楼下的猫" }),
  mk("q3", 1.5, { anxiety: "怕明天开会被点名" }),
  mk("q4", 2, { gratitude: "邻居帮我搬花" }),
  mk("q5", 2.5, { hope: "想学陶艺" }),
  mk("q6", 3, { gratitude: "今天吃到了很好吃的红薯" }),
  mk("q7", 3.5, { anxiety: "房租又要涨了" }),
  mk("q8", 4, { hope: "把攒的钱花在喜欢的事上" }),
  mk("q9", 5, { gratitude: "妈妈打电话来" }),
  mk("q10", 6, { hope: "春天去看一次海" }),
  mk("q11", 7, { gratitude: "公交上有人给我让座" }),
  mk("q12", 8, { anxiety: "有点想退出这个群" }),
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));
await page.addInitScript(() => {
  localStorage.setItem("access_token", "probe-token");
  localStorage.setItem("user", JSON.stringify({ id: "u-1", nickname: "小满" }));
});
await page.route("**/api/**", (route) => {
  const url = route.request().url();
  if (url.includes("/api/my/roses")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: payload, total: payload.length, page: 1, per_page: 100 }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], total: 0 }) });
});

await page.goto(`${BASE}/week`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const quotes = await page.$$('[data-testid="week-quote"]');
const boxes = [];
for (const q of quotes) boxes.push(await q.boundingBox());
const overflows = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="week-quote"]')].map((el) => el.scrollWidth - el.clientWidth),
);

console.log("原话条数:", quotes.length);
console.log("横向溢出(页):", await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
console.log("卡片内溢出:", overflows.join(","));
console.log("首条高度:", boxes[0]?.height.toFixed(0), "最矮:", Math.min(...boxes.map((b) => b.height)).toFixed(0));
console.log("末条 bottom:", boxes[boxes.length - 1]?.y + boxes[boxes.length - 1]?.height, "/ 视口 667");

// 从页面底部往上滚，确认「再种一朵」可达
const btnY = await page.evaluate(() => {
  const b = [...document.querySelectorAll("a")].find((a) => a.textContent.includes("再种一朵"));
  return b ? b.getBoundingClientRect().top : null;
});
await page.screenshot({ path: "/tmp/week-375-top.png" });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/week-375-bottom.png" });
console.log("再种一朵 初始 y:", btnY?.toFixed(0), "滚动后可见:", await page.isVisible('text=再种一朵'));
console.log("pageerror:", errs.length ? errs.join(" | ") : "无");
await browser.close();
