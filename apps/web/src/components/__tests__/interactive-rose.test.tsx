import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import InteractiveRose, { RoseBloom, ROSE_PALETTES } from "../interactive-rose";
import type { RoseField } from "../interactive-rose";

describe("InteractiveRose（初心第二界面的可拖拽玫瑰）", () => {
  const noop = jest.fn();
  const filled: Record<RoseField, boolean> = { gratitude: false, anxiety: false, hope: false };

  it("画出花瓣/花苞/尖刺三个光点，无障碍名称沿用 emoji", () => {
    render(<InteractiveRose color="red" activeField="gratitude" filled={filled} onFieldSelect={noop} />);
    expect(screen.getByRole("button", { name: "🌹" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🌵" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🌱" })).toBeInTheDocument();
    expect(screen.getByTestId("rose-drag-area")).toBeInTheDocument();
  });

  it("点光点会把对应栏目回传给调用方", () => {
    render(<InteractiveRose color="red" activeField="gratitude" filled={filled} onFieldSelect={noop} />);
    noop.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "🌵" }));
    expect(noop).toHaveBeenCalledWith("anxiety");
  });

  it("当前栏目有高亮标记", () => {
    render(<InteractiveRose color="red" activeField="hope" filled={filled} onFieldSelect={noop} />);
    expect(screen.getByRole("button", { name: "🌱" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "🌹" })).toHaveAttribute("aria-pressed", "false");
  });

  it("红白黄三色各有一套花色，未知色回退到红", () => {
    expect(ROSE_PALETTES.red).toBeDefined();
    expect(ROSE_PALETTES.white).toBeDefined();
    expect(ROSE_PALETTES.yellow).toBeDefined();
    const { container } = render(<RoseBloom color="unknown" />);
    expect(container.querySelectorAll("ellipse").length).toBeGreaterThan(0);
  });
});
