import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ChunkRecovery } from "../chunk-recovery";

/**
 * 这层保护只为一个场景存在：页面 HTML 下来了、某个 JS chunk 没下来，
 * 用户看到的是「能看但点不动」。所以要守的不是「组件渲染成什么样」，
 * 而是「什么情况下刷新、什么情况下忍住不刷新」。
 */

let reload: jest.Mock;

beforeEach(() => {
  reload = jest.fn();
  sessionStorage.clear();
});

function fireScriptError(src: string) {
  const script = document.createElement("script");
  script.src = src;
  // 必须挂在 document 上，事件才会沿着捕获阶段走到 window——
  // 游离节点派发的事件只会在自己身上转一圈。
  document.body.appendChild(script);
  script.dispatchEvent(new Event("error"));
  script.remove();
}

describe("ChunkRecovery", () => {
  it("chunk 加载失败时重载一次", () => {
    render(<ChunkRecovery reload={reload} />);
    fireScriptError("http://localhost/_next/static/chunks/abc.js");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("20 秒内连续失败只重载一次，避免刷新死循环", () => {
    render(<ChunkRecovery reload={reload} />);
    fireScriptError("http://localhost/_next/static/chunks/a.js");
    fireScriptError("http://localhost/_next/static/chunks/b.js");
    fireScriptError("http://localhost/_next/static/chunks/c.js");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("别的资源失败不刷新页面", () => {
    render(<ChunkRecovery reload={reload} />);
    fireScriptError("http://localhost/avatars/rose.png");
    fireScriptError("http://localhost/api/whatever.js");
    expect(reload).not.toHaveBeenCalled();
  });
});
