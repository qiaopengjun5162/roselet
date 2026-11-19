import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import { FallingPetals } from "../falling-petals";

// 落到内置的 FALLBACK 上，测试不依赖 WASM
jest.mock("@/lib/recommend", () => ({ generatePetals: jest.fn().mockResolvedValue(null) }));

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

afterEach(() => {
  if (ORIGINAL) {
    Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: ORIGINAL });
  } else {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  }
});

describe("FallingPetals", () => {
  it("默认会落下花瓣", () => {
    stubMatchMedia(false);
    const { container } = render(<FallingPetals />);
    expect(container.querySelectorAll("span").length).toBeGreaterThan(0);
  });

  it("系统要求减弱动效时整块不渲染", () => {
    stubMatchMedia(true);
    const { container } = render(<FallingPetals />);
    expect(container.innerHTML).toBe("");
  });

  it("渲染出来的花瓣确有下落动画", () => {
    stubMatchMedia(false);
    const { container } = render(<FallingPetals />);
    const first = container.querySelector("span") as HTMLElement;
    expect(first.style.animation).toContain("petal-fall-rust");
  });
});
