import { SAME_ORIGIN, resolveApiBase, sameOriginWsBase } from "../api-base";

describe("resolveApiBase", () => {
  it("same-origin 归一成空串，让请求走相对路径", () => {
    expect(resolveApiBase(SAME_ORIGIN)).toBe("");
    expect(resolveApiBase("  same-origin  ")).toBe("");
  });

  it("绝对地址原样保留，顺手去掉结尾斜杠", () => {
    expect(resolveApiBase("https://api.example.com")).toBe("https://api.example.com");
    expect(resolveApiBase("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("没配就用开发端口，别把线上打到 localhost", () => {
    expect(resolveApiBase(undefined)).toBe("http://localhost:3001");
    expect(resolveApiBase("")).toBe("http://localhost:3001");
    expect(resolveApiBase("   ")).toBe("http://localhost:3001");
  });
});

describe("sameOriginWsBase", () => {
  // https 页面里连 ws:// 会被浏览器当混合内容拦掉，必须跟着页面的协议升到 wss。
  it("https 页面用 wss", () => {
    expect(sameOriginWsBase({ protocol: "https:", host: "roselet.example.com" })).toBe(
      "wss://roselet.example.com",
    );
  });

  it("http 页面用 ws", () => {
    expect(sameOriginWsBase({ protocol: "http:", host: "47.131.238.0" })).toBe(
      "ws://47.131.238.0",
    );
  });

  it("拿不到 location 时退回开发端口", () => {
    expect(sameOriginWsBase(null)).toBe("ws://localhost:3001");
    expect(sameOriginWsBase({ protocol: "https:", host: "" })).toBe("ws://localhost:3001");
  });
});
