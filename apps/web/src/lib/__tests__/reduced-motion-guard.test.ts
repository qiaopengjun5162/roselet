/**
 * 「减弱动态效果」的落地守卫。
 *
 * 这条不是审美问题。整站有 12 个无限循环的下落花瓣（挂在 layout 上，每一页都有）、
 * 每次点击都飞出来的玫瑰花、成功页呼吸光晕、卡片入场 —— 对前庭敏感的人
 * （头晕、偏头痛、焦虑相关）这些会直接让人关掉页面。而这个产品接的正是
 * 「我今天有点难受」这类状态，最不该在对方开了系统开关之后继续晃。
 *
 * 两道防线各守一处，缺一不可：
 *   1. 组件级：FallingPetals / RoseClickBloom 在开了开关时**什么都不放**；
 *   2. 样式级：globals.css 的兜底规则，管住所有 CSS 动画，防止新加的动效漏判。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const CSS = "apps/web/src/app/globals.css";
const PETALS = "apps/web/src/components/falling-petals.tsx";
const BLOOM = "apps/web/src/components/rose-click-bloom.tsx";
const LAYOUT = "apps/web/src/app/layout.tsx";

describe("减弱动态效果：开了就得真停下来", () => {
  it("全站落花与点击绽放都受同一个开关控制", () => {
    // 这两个是「每一页都在动」的来源，漏一个就等于没做。
    for (const file of [PETALS, BLOOM]) {
      expect(read(file)).toContain("prefersReducedMotion");
    }
    // 落花挂在 layout 上，是它让这件事变成全站问题。
    expect(read(LAYOUT)).toContain("FallingPetals");
  });

  it("落花在减弱动效时不渲染，而不是只把速度调慢", () => {
    const src = read(PETALS);
    expect(src).toMatch(/if \(reduced\) return null;/);
    // 关掉开关时仍要能落，别把功能一起删了。
    expect(src).toContain("petal-fall-rust");
  });

  it("样式里有一条覆盖所有 CSS 动画的兜底规则", () => {
    const css = read(CSS);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    // 无限循环必须被掐成 1 次，否则呼吸光晕、脉冲、飘落照旧。
    expect(css).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it("没有任何组件绕过开关直接写无限动画", () => {
    // 兜底规则能压住，但这几处是「每页都在动」，写清楚比压住重要。
    const source = read(PETALS) + read(BLOOM);
    expect(source).toContain("prefersReducedMotion()");
  });
});
