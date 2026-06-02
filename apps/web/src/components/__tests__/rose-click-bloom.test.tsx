import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.useFakeTimers();

import { RoseClickBloom } from "../rose-click-bloom";

function click(x = 100, y = 200, target = document.body) {
  act(() => {
    const e = new MouseEvent("click", { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(e, "target", { value: target });
    window.dispatchEvent(e);
  });
}

describe("RoseClickBloom", () => {
  afterEach(() => jest.clearAllTimers());

  it("renders nothing initially", () => {
    const { container } = render(<RoseClickBloom />);
    expect(container.querySelectorAll(".animate-rose-bloom")).toHaveLength(0);
  });

  it("shows bloom on window click", () => {
    const { container } = render(<RoseClickBloom />);
    click(100, 200);
    expect(container.querySelectorAll(".animate-rose-bloom")).toHaveLength(1);
  });

  it("positions bloom at click coordinates", () => {
    const { container } = render(<RoseClickBloom />);
    click(300, 450);
    const bloom = container.querySelector(".animate-rose-bloom") as HTMLElement;
    expect(bloom.style.left).toBe("300px");
    expect(bloom.style.top).toBe("450px");
  });

  it("removes bloom after 700ms", () => {
    const { container } = render(<RoseClickBloom />);
    click(100, 200);
    expect(container.querySelectorAll(".animate-rose-bloom")).toHaveLength(1);
    act(() => jest.advanceTimersByTime(700));
    expect(container.querySelectorAll(".animate-rose-bloom")).toHaveLength(0);
  });

  it("supports multiple simultaneous blooms", () => {
    const { container } = render(<RoseClickBloom />);
    click(100, 100);
    click(200, 200);
    click(300, 300);
    expect(container.querySelectorAll(".animate-rose-bloom")).toHaveLength(3);
  });

  it("does not bloom on button click", () => {
    const { container } = render(<RoseClickBloom />);
    const btn = document.createElement("button");
    act(() => {
      const e = new MouseEvent("click", { bubbles: true, clientX: 50, clientY: 50 });
      Object.defineProperty(e, "target", { value: btn });
      window.dispatchEvent(e);
    });
    expect(container.querySelectorAll(".animate-rose-bloom")).toHaveLength(0);
  });

  it("does not bloom on input click", () => {
    const { container } = render(<RoseClickBloom />);
    const input = document.createElement("input");
    act(() => {
      const e = new MouseEvent("click", { bubbles: true, clientX: 50, clientY: 50 });
      Object.defineProperty(e, "target", { value: input });
      window.dispatchEvent(e);
    });
    expect(container.querySelectorAll(".animate-rose-bloom")).toHaveLength(0);
  });

  it("bloom has correct font-size range", () => {
    const { container } = render(<RoseClickBloom />);
    click(100, 100);
    const bloom = container.querySelector(".animate-rose-bloom") as HTMLElement;
    const size = parseFloat(bloom.style.fontSize);
    expect(size).toBeGreaterThanOrEqual(20);
    expect(size).toBeLessThanOrEqual(36);
  });
});
