/**
 * 注册 / 登录失败的用户可读提示。
 *
 * 登录页和种花页的「先取个名字」弹窗都会调 `register()`，两处若各写一份
 * 错误映射，迟早会出现「同一个错误、两种说法」。这里只做一件事：
 * 把后端/网络的错误信息翻译成一句人话。
 */
export function registerErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("fetch")) {
    return "网络连接失败，可能是新域名还未被后端允许，请稍后再试";
  }
  if (msg.includes("密码错误")) return "密码错误";
  if (msg.includes("正在冷却期内")) return "这个昵称正在 30 天冷却期内，如要恢复账号请输入原密码";
  if (msg.includes("已设置密码")) return "该昵称已设置密码，请输入密码";
  return "登录失败，请重试";
}
