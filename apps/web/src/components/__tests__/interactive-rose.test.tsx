import { render, screen, fireEvent, act } from "@testing-library/react";
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

  // 初心原图是一朵水彩玫瑰：守护「画出来的层叠渐变花瓣」不被改回平面色块/emoji。
  it("花头用渐变 + 多层 path 画成水彩玫瑰，不是平面色块", () => {
    const { container } = render(<RoseBloom color="red" />);
    const svg = container.querySelector("svg")!;
    // 渐变定义（外瓣/中瓣/花心）必须存在
    expect(svg.querySelectorAll("linearGradient, radialGradient").length).toBeGreaterThanOrEqual(2);
    // 至少 20 片 path 花瓣（四层 8+6+5+4=23），层叠螺旋
    expect(svg.querySelectorAll("path").length).toBeGreaterThanOrEqual(20);
    // 花瓣确实引用了渐变 id，而不是写死 fill 色块
    const gradientPetal = Array.from(svg.querySelectorAll("path")).some((n) =>
      (n.getAttribute("fill") || "").startsWith("url(#"),
    );
    expect(gradientPetal).toBe(true);
  });

  // 手机上这朵花占近半屏：若用 touch-none，手指从花朵起手就滑不动页面、
  // 够不到下方输入框和「种下玫瑰吧」。必须保留 touch-pan-y 把垂直滑动还给页面。
  it("拖拽区放行垂直滚动（touch-pan-y，不能是 touch-none）", () => {
    render(<InteractiveRose color="red" activeField="gratitude" filled={filled} onFieldSelect={noop} />);
    const area = screen.getByTestId("rose-drag-area");
    expect(area.className).toContain("touch-pan-y");
    expect(area.className).not.toContain("touch-none");
  });

  it("触摸拖拽只跟水平方向，垂直手势留给页面滚动", () => {
    render(<InteractiveRose color="red" activeField="gratitude" filled={filled} onFieldSelect={noop} />);
    const area = screen.getByTestId("rose-drag-area");
    // jsdom 的 PointerEvent 不填 clientX，用 MouseEvent 构造再补 pointerType。
    const pointer = (type: string, x: number, y: number, pointerType: string) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
      Object.defineProperty(e, "pointerId", { value: 1 });
      Object.defineProperty(e, "pointerType", { value: pointerType });
      return e;
    };
    act(() => {
      area.dispatchEvent(pointer("pointerdown", 100, 300, "touch"));
    });
    act(() => {
      area.dispatchEvent(pointer("pointermove", 160, 220, "touch"));
    });
    const transform = area.style.transform;
    expect(transform).toContain("60px"); // 水平跟手
    expect(transform).toContain("0px"); // 触摸不跟垂直位移
  });

  it("同页多朵花的渐变 id 各不相同，花圃里不会串色", () => {
    const { container } = render(
      <div>
        <RoseBloom color="red" />
        <RoseBloom color="white" />
        <RoseBloom color="yellow" />
      </div>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient, radialGradient")).map(
      (n) => n.getAttribute("id"),
    );
    expect(new Set(ids).size).toBe(ids.length); // 全部唯一
  });
});
