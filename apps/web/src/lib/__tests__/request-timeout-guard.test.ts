import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * 2026-11-19：这条链路实测 20%~30% 的 SYN 丢包。裸 fetch 撞上黑洞连接时不会快速
 * 失败，而是等到浏览器自己的超时；组件里的降级分支（拿不到就不显示）因此永远轮不到，
 * 用户看到的是骷髅屏一直闪、按钮一直转。
 *
 * 这类改动不会让任何业务测试变红——除非有人拿一条烂链路去点——所以在这里守着：
 * `lib/api.ts` 里出现裸 fetch 就说明超时被绕过去了。
 */

const LIB = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(LIB, file), "utf8");

/** 匹配裸 fetch(...)，排除 fetchWithTimeout(...) 之类。 */
const BARE_FETCH = /(?<![A-Za-z])fetch\s*\(/;

describe("所有对外请求都带超时", () => {
  it("lib/api.ts 里不出现裸 fetch", () => {
    const lines = read("api.ts").split("\n");
    const offenders = lines
      .map((line, index) => ({ line, index: index + 1 }))
      .filter(({ line }) => BARE_FETCH.test(line) && !line.trimStart().startsWith("*"))
      .map(({ line, index }) => `${index}: ${line.trim()}`);

    expect(offenders).toEqual([]);
  });

  it("上传超时比普通请求宽松，否则大图会被误判失败", () => {
    const source = read("net.ts");
    const net = Number(/NET_TIMEOUT_MS\s*=\s*([\d_]+)/.exec(source)?.[1]?.replace(/_/g, ""));
    const upload = Number(/UPLOAD_TIMEOUT_MS\s*=\s*([\d_]+)/.exec(source)?.[1]?.replace(/_/g, ""));

    expect(net).toBeGreaterThan(0);
    expect(upload).toBeGreaterThan(net);
  });
});
