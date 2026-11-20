/**
 * 发版瞬间的兜底守卫。
 *
 * 2026-11-20 生产冒烟撞到过一次：页面 HTML 已经下来，但一个 JS chunk 没加载成功
 * （控制台 `Failed to load chunk ... from module ...`），表现是「页面能看，
 * 颜色卡片一个都没有、按钮全死」——比白屏更难判断，因为看起来是好的。
 *
 * 组件本身的三种行为由 chunk-recovery.test.tsx 覆盖；这里守的是两件容易在
 * 后续重构里丢掉的事：它还挂在全站 layout 上，以及它没有放宽到「什么错都刷新」。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const LAYOUT = "apps/web/src/app/layout.tsx";
const COMPONENT = "apps/web/src/components/chunk-recovery.tsx";

describe("chunk 加载失败的自愈", () => {
  it("挂在全站 layout 上，而不是某一页", () => {
    const layout = read(LAYOUT);
    expect(layout).toContain("ChunkRecovery");
    expect(layout).toMatch(/<ChunkRecovery\s*\/>/);
  });

  it("只对 /_next/static/ 的脚本失败动手，且有冷却时间", () => {
    const src = read(COMPONENT);
    expect(src).toContain("/_next/static/");
    // 少了冷却，产物真缺文件时会把用户困在刷新循环里。
    expect(src).toMatch(/COOLDOWN_MS/);
    // 少了前缀判断，一张图片 404 也会把用户正在填的表单刷掉。
    expect(src).toMatch(/includes\("\/_next\/static\/"\)/);
  });
});
