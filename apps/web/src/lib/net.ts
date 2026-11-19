/**
 * 带超时的 fetch。
 *
 * 2026-11-19：国内到这台服务器实测 20%~30% 的 SYN 丢包，`fetch` 在连接被丢包
 * 黑洞时不会快速失败，而是一直等到浏览器自己的超时（几十秒，甚至更久）。
 * 期间界面停在骨架屏或转圈上，用户看到的就是「这个站坏了」。
 * 组件里本来都写好了「拿不到就不显示」的降级分支，缺的只是「早点失败」。
 */

export const NET_TIMEOUT_MS = 12_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = NET_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const caller = init.signal;
  const bridge = () => controller.abort();
  if (caller) {
    if (caller.aborted) controller.abort();
    else caller.addEventListener("abort", bridge, { once: true });
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener("abort", bridge);
  }
}
