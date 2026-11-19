import { fetchWithTimeout } from "../net";

/**
 * 2026-11-19：国内到服务器这条链路有 20%~30% 的 SYN 丢包，裸 fetch 在这种时候
 * 不会快速失败，界面就一直停在骨架屏上。这个超时是「让降级分支有机会执行」。
 */
const net = globalThis as unknown as { fetch: unknown };
const originalFetch = net.fetch;

describe("fetchWithTimeout", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.fn();
    net.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    net.fetch = originalFetch;
  });

  it("正常返回时原样透传响应", async () => {
    const response = { ok: true, status: 200 } as Response;
    fetchMock.mockResolvedValue(response);

    await expect(fetchWithTimeout("http://example.test/", {}, 1_000)).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("到点就中断，不会一直挂着等浏览器自己超时", async () => {
    fetchMock.mockImplementation((_input: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted by timeout")));
      });
    });

    const pending = fetchWithTimeout("http://example.test/", {}, 1_000);
    jest.advanceTimersByTime(1_000);

    await expect(pending).rejects.toThrow("aborted by timeout");
  });

  it("调用方自己的 signal 仍然有效", async () => {
    fetchMock.mockImplementation((_input: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted by caller")));
      });
    });

    const caller = new AbortController();
    const pending = fetchWithTimeout("http://example.test/", { signal: caller.signal }, 60_000);
    caller.abort();

    await expect(pending).rejects.toThrow("aborted by caller");
  });

  it("正常返回后不留定时器", async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await fetchWithTimeout("http://example.test/", {}, 1_000);

    expect(jest.getTimerCount()).toBe(0);
  });
});
