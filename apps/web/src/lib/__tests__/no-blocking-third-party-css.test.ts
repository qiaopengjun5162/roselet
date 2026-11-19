/**
 * 首屏不许押在境外 CDN 上。
 *
 * 2026-11-19 实测：主样式表第一行曾是 Google Fonts 的 @import。@import 进 CSSOM
 * 的外链会阻塞渲染，而 fonts.googleapis.com 在国内是「连不上、也不快速报错」，
 * 结果是首页在国内**一直白屏**到浏览器超时 —— 可达时 FCP 3.4s，不可达时 45s 内
 * 一次内容都没画出来。这不是慢，是打不开。
 *
 * 这个产品的试用对象就是国内社区里的人，用手机流量打开。所以这条检查必须可执行，
 * 不能只写在文档里（AGENTS.md：纸面规则不算数）。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

// 注释里会写「当年那行长什么样」，检查必须只看真正的声明，别被注释绊倒。
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CSS = "apps/web/src/app/globals.css";

describe("首屏不依赖境外资源", () => {
  it("主样式表里没有 @import 外链", () => {
    const css = stripComments(read(CSS));
    const importLines = css
      .split("\n")
      .filter((line) => /^\s*@import\b/.test(line) && /url\(\s*["']?https?:/.test(line));
    expect(importLines).toEqual([]);
  });

  it("源码里没有直接引用 Google Fonts / 公共 CDN", () => {
    for (const file of [CSS, "apps/web/src/app/layout.tsx"]) {
      const src = stripComments(read(file));
      expect(src).not.toMatch(/fonts\.googleapis\.com/);
      expect(src).not.toMatch(/fonts\.gstatic\.com/);
    }
  });

  it("标题字体仍指向本机已有的中文字体，去掉外链后不会掉成默认无衬线", () => {
    const css = read(CSS);
    // 毛笔字栈必须保留中文回退，否则去掉 Google Fonts 后就只剩 cursive
    expect(css).toMatch(/font-family:\s*"Ma Shan Zheng",\s*"STXingkai",\s*"华文行楷"/);
  });
});
