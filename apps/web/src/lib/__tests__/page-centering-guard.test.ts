import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

/**
 * 这条守卫管的是「首屏最上面那块东西还在不在」。
 *
 * 2026-11-19：首页是 `h-full flex items-center justify-center`。页面比手机屏高时
 * （390×667 实测内容 928px、可视 610px），flex 的居中是**双向**溢出的：顶部那 47px
 * 被顶到可视区上方，而滚动容器的 scrollTop 不能为负，于是顶上那朵玫瑰被导航栏切掉一半，
 * 而且怎么划都看不见。肉眼看就是「越改越坏」——但那其实是这行写法一直在的后果。
 *
 * 正确写法是 `min-h-full` + 内容块 `m-auto`：装得下才居中，装不下就从顶部开始排。
 * 这个区别不会让任何业务测试变红，所以在这里守着。
 */

const APP = resolve(__dirname, "../../app");

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : pageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

describe("页面容器不会把顶部内容顶出可视区", () => {
  it("没有页面用 h-full + flex + justify-center 给整页居中", () => {
    const offenders = pageFiles(APP).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/<main[^>]*className="([^"]*)"/g)]
        .map((m) => m[1])
        .filter((cls) => cls.includes("h-full"))
        .filter((cls) => cls.includes("justify-center") && cls.includes("flex"))
        .map((cls) => `${file.replace(APP, "app")}: ${cls}`);
    });

    expect(offenders).toEqual([]);
  });

  it("首页用 min-h-full 加 m-auto 做「装得下才居中」", () => {
    const source = readFileSync(join(APP, "page.tsx"), "utf8");
    expect(source).toContain("min-h-full");
    // 内容块必须自己带 m-auto，否则 min-h-full 只会让它贴着顶部。
    expect(source).toMatch(/m-auto/);
  });
});
