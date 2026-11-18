/**
 * 产品一句话的唯一来源（用户 2026-11-18 拍板）。
 *
 * 「一句话讲不清就不是好项目」——这句话既是产品定位，也是发给试用者的全部说明。
 * 它原先分散写在 Web 首屏 / 种完反馈 / 小程序首屏 / 中英文 README / 试用转发卡
 * 六处，改一次要同步六处。现在由本文件单源导出：
 *   - 能 import TS 的页面直接引用常量；
 *   - Markdown 载体无法 import，由 apps/web/src/lib/__tests__/product-one-liner.test.ts
 *     在测试时读文件断言与常量一致（与 crates/recommend/src/contract.rs 的
 *     「读源码防漂移」是同一种手法）。
 *
 * 注意：这里是静态产品标语，不是业务 i18n 逻辑，因此不放 Rust WASM；
 * 但跨端不得各维护一套的规则与 AGENTS.md 第 9 条一致。
 */

/** 这句话里唯一「为什么要回来」的承诺，主句与种完反馈都复用它。 */
export const RETURN_PROMISE = "看看自己长出了什么";

/** 中文主句：Web 首屏、README_zh、试用转发卡必须显示这一句。 */
export const PRODUCT_ONE_LINER_ZH = `写一句，种一朵玫瑰，一周后${RETURN_PROMISE}`;

/** 英文对应句：README.md 必须显示这一句。 */
export const PRODUCT_ONE_LINER_EN =
  "Write one line, plant a rose, and come back in a week to see what you have grown";

/**
 * 小程序首屏在 375px 下放不下 22 个字，拆两行显示。
 * 从主句最后一个逗号切分派生，避免再手抄第二份文案。
 */
const LAST_COMMA = PRODUCT_ONE_LINER_ZH.lastIndexOf("，");
export const PRODUCT_ONE_LINER_ZH_LINE_1 = PRODUCT_ONE_LINER_ZH.slice(0, LAST_COMMA);
export const PRODUCT_ONE_LINER_ZH_LINE_2 = PRODUCT_ONE_LINER_ZH.slice(LAST_COMMA + 1);

/** 种完那一下：唯一能回答「凭什么一周后回来」的位置，不许改回抽象口号。 */
export const PLANTED_TITLE = "种好了";
export const PLANTED_CONFIRMATION = `这一朵已经留在花圃里。一周后回来，${RETURN_PROMISE}。`;

/**
 * 私密玫瑰不进公共花圃（garden.rs 只查 is_private = false），也不进动态流。
 * 种完若沿用「留在花圃里」，用户去花圃找不到，会以为种丢了 —— 反馈必须说实话，
 * 并把入口指向「我的花圃」（/my）。
 */
export const PLANTED_CONFIRMATION_PRIVATE = `这一朵只留在你的花圃里。一周后回来，${RETURN_PROMISE}。`;
