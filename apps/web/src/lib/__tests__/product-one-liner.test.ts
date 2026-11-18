/**
 * 产品一句话的跨载体单源守卫。
 *
 * 这句话同时出现在 Web 首屏、种完反馈、小程序首屏、中英文 README 和发给
 * 试用者的转发卡。前 3 处能 import TS，直接引用 @roselet/core；Markdown 不能，
 * 只能在测试时读文件比对 —— 与 crates/recommend/src/contract.rs 读前端源码
 * 防止「两端各写一份」是同一种手法。AGENTS.md：纸面规则不算数。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLANTED_CONFIRMATION,
  PLANTED_CONFIRMATION_PRIVATE,
  PLANTED_TITLE,
  PRODUCT_ONE_LINER_EN,
  PRODUCT_ONE_LINER_ZH,
  PRODUCT_ONE_LINER_ZH_LINE_1,
  PRODUCT_ONE_LINER_ZH_LINE_2,
  RETURN_PROMISE,
} from "@roselet/core";

const ROOT = resolve(__dirname, "../../../../..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const WEB_HOME = "apps/web/src/app/page.tsx";
const WEB_PLANT = "apps/web/src/app/plant/page.tsx";
const MINIPROGRAM_HOME = "apps/miniprogram/src/pages/index/index.tsx";
const UI_SOURCES = [WEB_HOME, WEB_PLANT, MINIPROGRAM_HOME];

describe("产品一句话：所有载体只允许一个来源", () => {
  it("小程序两行由主句切分派生，拼回去逐字相同", () => {
    expect(`${PRODUCT_ONE_LINER_ZH_LINE_1}，${PRODUCT_ONE_LINER_ZH_LINE_2}`).toBe(
      PRODUCT_ONE_LINER_ZH,
    );
    expect(PRODUCT_ONE_LINER_ZH_LINE_2.length).toBeGreaterThan(0);
  });

  it("主句与种完反馈共用同一个「一周后回来」的承诺", () => {
    expect(PRODUCT_ONE_LINER_ZH).toContain(RETURN_PROMISE);
    expect(PLANTED_CONFIRMATION).toContain(RETURN_PROMISE);
    expect(PLANTED_TITLE).toBe("种好了");
  });

  it("私密玫瑰的种完反馈不得说「留在花圃里」（它不进公共花圃）", () => {
    // garden.rs 只查 is_private = false：私密玫瑰去 /garden 必然找不到。
    // 所以私密反馈不能复用公开那句，且必须指向「我的花圃」。
    expect(PLANTED_CONFIRMATION_PRIVATE).toContain(RETURN_PROMISE);
    expect(PLANTED_CONFIRMATION_PRIVATE).not.toBe(PLANTED_CONFIRMATION);
    expect(PLANTED_CONFIRMATION_PRIVATE).not.toContain("已经留在花圃里");
    expect(read(WEB_PLANT)).toContain("PLANTED_CONFIRMATION_PRIVATE");
    expect(read(WEB_PLANT)).toContain('"/my"');
  });

  it("Markdown 载体（README / 试用转发卡）显示同一句", () => {
    expect(read("README_zh.md")).toContain(PRODUCT_ONE_LINER_ZH);
    expect(read("README.md")).toContain(PRODUCT_ONE_LINER_EN);
    expect(read("docs/TEAM_REVIEW_CHECKLIST.md")).toContain(PRODUCT_ONE_LINER_ZH);
  });

  it("三处 UI 从 @roselet/core 取文案，不再各自硬编码", () => {
    for (const file of UI_SOURCES) {
      const src = read(file);
      expect(src).toMatch(/from ["']@roselet\/core["']/);
      expect(src).not.toContain(PRODUCT_ONE_LINER_ZH);
      expect(src).not.toContain(RETURN_PROMISE);
    }
    expect(read(WEB_HOME)).toContain("PRODUCT_ONE_LINER_ZH");
    expect(read(WEB_PLANT)).toContain("PLANTED_CONFIRMATION");
    expect(read(MINIPROGRAM_HOME)).toContain("PRODUCT_ONE_LINER_ZH_LINE_1");
  });

  it("用户可见载体不得改回抽象口号", () => {
    for (const file of [...UI_SOURCES, "README.md", "README_zh.md"]) {
      const src = read(file);
      expect(src).not.toContain("等待宇宙的回响");
      expect(src).not.toContain("wait for the universe to respond");
    }
  });
});
