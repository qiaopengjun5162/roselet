/**
 * 系统是否要求减弱动态效果（macOS / iOS / Windows / Android 都有这个开关）。
 *
 * 整站有好几处常驻动效：落花、点击绽放、成功页呼吸光晕、卡片入场。
 * 对前庭敏感的人（头晕、偏头痛、焦虑相关）这些不是装饰，是让人关掉页面的原因。
 * 而且这个产品本来就在接「我今天有点难受」这类状态，更不该在对方开了开关之后
 * 继续往屏幕上撒会动的东西。
 *
 * jsdom 没有 matchMedia，跑测试时按「没开」处理。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
