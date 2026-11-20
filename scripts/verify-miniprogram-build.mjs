#!/usr/bin/env node
/**
 * 检查小程序**构建产物**里的后端地址，而不是只检查源码。
 *
 *   node scripts/verify-miniprogram-build.mjs [distDir]
 *
 * 为什么需要它：`src/utils/request.ts` 里曾经写死 `http://localhost:3001`。
 * 开发工具里那是对的（工具和本地后端同机），**真机上 localhost 是手机自己**，
 * 每个请求都失败。而源码改了不等于产物改了：地址是构建期替换进去的字面量，
 * 构建参数漏了、defineConstants 写错了，源码看着没问题，包却是坏的。
 * 只 build 不检查的话，CI 全绿、拿到的包却连不上后端——和 web 那次「/health 200
 * 但页面点不动」是同一类错误。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = process.argv[2] || process.env.MP_DIST || "apps/miniprogram/dist/weapp";
/** 开发地址漏进包：真机上打到手机自己，所有请求都失败。 */
const DEV_ORIGIN = /localhost:3001|\/\/127\.0\.0\.1:3001/;

/** 必须存在的文件：少了任何一个，微信开发者工具打开就是空白或直接报错。 */
const REQUIRED = ["app.js", "app.json", "app.wxss", "project.config.json"];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error(`没有找到产物目录 ${DIST}，先跑 pnpm --filter @roselet/miniprogram build:weapp`);
  process.exit(1);
}

const files = walk(DIST);
const jsFiles = files.filter((f) => f.endsWith(".js"));
const failures = [];

for (const name of REQUIRED) {
  if (!files.includes(join(DIST, name))) failures.push(`缺少 ${name}`);
}

let bytes = 0;
let prodBase = null;
for (const file of files) bytes += statSync(file).size;

for (const file of jsFiles) {
  const text = readFileSync(file, "utf8");
  if (DEV_ORIGIN.test(text)) failures.push(`开发地址漏进产物：${relative(DIST, file)}`);
  for (const hit of text.match(/https:\/\/[a-zA-Z0-9.-]+/g) ?? []) {
    // 只关心我们自己后端的那一个，第三方 https（例如 github.com）不算。
    if (hit.includes("sslip.io") || hit.includes("roselet")) prodBase = hit;
  }
}

if (!prodBase) {
  failures.push("产物里找不到后端地址（构建期替换没生效？真机上会连不上任何后端）");
}

console.log(`产物 ${DIST}：${files.length} 个文件，${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`后端地址：${prodBase ?? "（没找到）"}`);

if (failures.length > 0) {
  console.error("\n小程序产物检查失败：");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("OK：产物齐全，后端地址是 https，没有开发地址漏进去");
