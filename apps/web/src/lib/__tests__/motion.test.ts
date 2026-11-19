import { prefersReducedMotion } from "../motion";

const ORIGINAL = window.matchMedia;

function stubMatchMedia(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
}

function restore() {
  if (ORIGINAL) {
    Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: ORIGINAL });
  } else {
    // jsdom 默认没有 matchMedia，删掉回到默认
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  }
}

describe("prefersReducedMotion", () => {
  afterEach(restore);

  it("系统开了开关时为 true", () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it("系统没开时为 false", () => {
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("环境里没有 matchMedia 时按「没开」处理，不抛错", () => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    expect(prefersReducedMotion()).toBe(false);
  });
});
