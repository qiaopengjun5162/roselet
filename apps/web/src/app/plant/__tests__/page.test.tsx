// RosePlayer 在成功页 autoPlay，需要 mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn().mockReturnValue({
    type: "sine", frequency: { value: 0 },
    connect: jest.fn(), start: jest.fn(), stop: jest.fn(),
    onended: null,
  }),
  createGain: jest.fn().mockReturnValue({ gain: { value: 0 }, connect: jest.fn() }),
  createAnalyser: jest.fn().mockReturnValue({
    fftSize: 256, frequencyBinCount: 128,
    connect: jest.fn(), getFloatTimeDomainData: jest.fn(),
  }),
  createDelay: jest.fn().mockReturnValue({ delayTime: { value: 0 }, connect: jest.fn() }),
  createChannelMerger: jest.fn().mockReturnValue({ connect: jest.fn() }),
  destination: {},
  close: jest.fn().mockResolvedValue(undefined),
})) as unknown as typeof AudioContext;

global.requestAnimationFrame = jest.fn().mockReturnValue(1);
global.cancelAnimationFrame = jest.fn();

HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  fillStyle: "", strokeStyle: "", lineWidth: 0, shadowBlur: 0,
  shadowColor: "", lineCap: "", fillRect: jest.fn(),
  beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn(),
});

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PLANTED_CONFIRMATION, PLANTED_CONFIRMATION_PRIVATE, PLANTED_TITLE } from "@roselet/core";

// 门闩本身由 member-only.test.tsx 验证；这里控制会员模式，确认种花页确实
// 把 Aleo 入口放进了门闩。
let memberMode = false;
jest.mock("@/components/member-only", () => ({
  MemberOnly: ({ children }: { children: React.ReactNode }) =>
    memberMode ? <>{children}</> : null,
}));
afterEach(() => { memberMode = false; });

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));
jest.mock("@/lib/api", () => ({
  createRose: jest.fn(),
  getMyRoses: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  getToken: jest.fn().mockReturnValue("jwt-token"),
  register: jest.fn(),
  setToken: jest.fn(),
  setRefreshToken: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock("@/lib/recommend", () => ({
  getRecommendation: jest.fn().mockResolvedValue(null),
  validatePlantInput: jest.fn().mockResolvedValue({ valid: true, error: null, cleaned: null }),
  getFireworkLaunches: jest.fn().mockResolvedValue([]),
  burstFireworks: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sound", () => ({
  playClick: jest.fn(),
  playPlant: jest.fn(),
  playComplete: jest.fn(),
}));

jest.mock("@/components/rose-player", () => ({
  RosePlayer: () => <div data-testid="rose-player" />,
}));


const { createRose, getToken, register } = require("@/lib/api") as {
  createRose: jest.Mock;
  getToken: jest.Mock;
  register: jest.Mock;
};
import PlantPage from "../page";

describe("PlantPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 默认已登录；「先写后取名」的用例会临时改成 null。
    getToken.mockReturnValue("jwt-token");
  });

  it("should render color selection step", () => {
    render(<PlantPage />);
    expect(screen.getByText("选择玫瑰的颜色")).toBeInTheDocument();
    expect(screen.getByText("红玫瑰")).toBeInTheDocument();
    expect(screen.getByText("白玫瑰")).toBeInTheDocument();
    expect(screen.getByText("黄玫瑰")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "使用 Aleo 私密 Vault" })).not.toBeInTheDocument();
  });

  it("should expose the Aleo vault only in membership mode", () => {
    memberMode = true;
    render(<PlantPage />);
    expect(screen.getByRole("link", { name: "使用 Aleo 私密 Vault" })).toHaveAttribute("href", "/private-vault");
  });

  it("should navigate to interactive step on color click", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    expect(screen.getByText(/种下你的玫瑰/)).toBeInTheDocument();
  });

  it("should show hotspot buttons", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    // Hotspot buttons are accessible by role
    expect(screen.getByRole("button", { name: "🌹" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🌵" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🌱" })).toBeInTheDocument();
  });

  // 曾经输入框藏在光点弹窗后面：不点光点，页面上根本看不到能写字的地方，
  // 没耐心的人会以为这里不能写。选完颜色必须直接看见输入框。
  it("选完颜色就能看到输入框，不需要先点光点", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    const editor = screen.getByRole("textbox", { name: "玫瑰" });
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute(
      "placeholder",
      "这周让你感到幸福或感恩的事情是...",
    );
  });

  it("点光点只切换要写的栏目，三栏内容各自保留", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));

    fireEvent.change(screen.getByRole("textbox", { name: "玫瑰" }), {
      target: { value: "今天很开心" },
    });

    fireEvent.click(screen.getByRole("button", { name: "🌵" }));
    const anxiety = screen.getByRole("textbox", { name: "尖刺" });
    expect(anxiety).toHaveValue("");
    fireEvent.change(anxiety, { target: { value: "有点累" } });

    fireEvent.click(screen.getByRole("button", { name: "🌹" }));
    expect(screen.getByRole("textbox", { name: "玫瑰" })).toHaveValue("今天很开心");
  });

  it("should fill and submit the sentence written on the page", async () => {
    createRose.mockResolvedValue({ id: "r1", color: "red" });
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.change(screen.getByRole("textbox", { name: "玫瑰" }), { target: { value: "感恩测试" } });
    fireEvent.click(screen.getByText("种下玫瑰吧"));
    await waitFor(() => {
      expect(createRose).toHaveBeenCalled();
      expect(screen.getByText(PLANTED_TITLE)).toBeInTheDocument();
      // 种完这一下是唯一能给出「为什么一周后回来」的位置，别改回抽象口号。
      expect(screen.getByText(PLANTED_CONFIRMATION)).toBeInTheDocument();
    });
  });

  it("should submit private flag when private toggle is enabled", async () => {
    createRose.mockResolvedValue({ id: "r1", color: "red" });
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByText("🌐 公开分享"));
    fireEvent.change(screen.getByRole("textbox", { name: "玫瑰" }), { target: { value: "私密感恩" } });
    fireEvent.click(screen.getByText("种下玫瑰吧"));

    await waitFor(() => {
      expect(createRose).toHaveBeenCalledWith(expect.objectContaining({
        gratitude: "私密感恩",
        is_private: true,
      }));
    });

    // 私密玫瑰不进公共花圃：种完不能说「留在花圃里」，入口要给「我的花圃」。
    expect(screen.getByText(PLANTED_CONFIRMATION_PRIVATE)).toBeInTheDocument();
    expect(screen.queryByText(PLANTED_CONFIRMATION)).not.toBeInTheDocument();
    const myGarden = screen.getByText("查看我的花圃");
    fireEvent.click(myGarden);
    expect(mockPush).toHaveBeenCalledWith("/my");
  });

  it("disables private toggle when a recipient is entered", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));

    const privateToggle = screen.getByText("🌐 公开分享");
    expect(privateToggle).not.toBeDisabled();

    const recipientInput = screen.getByPlaceholderText(/送给谁/);
    fireEvent.change(recipientInput, { target: { value: "小花" } });

    expect(privateToggle).toBeDisabled();
  });

  it("switches to public when typing a recipient", async () => {
    createRose.mockResolvedValue({ id: "r1", color: "red" });
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByText("🌐 公开分享"));
    expect(screen.getByText("🔒 仅自己可见")).toBeInTheDocument();

    const recipientInput = screen.getByPlaceholderText(/送给谁/);
    fireEvent.change(recipientInput, { target: { value: "小花" } });
    expect(screen.getByText("🌐 公开分享")).toBeInTheDocument();
  });

  it("should show error on submit failure", async () => {
    createRose.mockRejectedValue(new Error("fail"));
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.change(screen.getByRole("textbox", { name: "玫瑰" }), { target: { value: "感恩" } });
    fireEvent.click(screen.getByText("种下玫瑰吧"));
    await waitFor(() => {
      expect(screen.getByText("提交失败，请重试")).toBeInTheDocument();
    });
  });

  it("should go back to color step", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByText("换颜色"));
    expect(screen.getByText("选择玫瑰的颜色")).toBeInTheDocument();
  });

  it("should allow planting another rose after success", async () => {
    createRose.mockResolvedValue({ id: "r1", color: "red" });
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.change(screen.getByRole("textbox", { name: "玫瑰" }), { target: { value: "感恩" } });
    fireEvent.click(screen.getByText("种下玫瑰吧"));
    await waitFor(() => {
      expect(screen.getByText("再种一朵")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("再种一朵"));
    expect(screen.getByText("选择玫瑰的颜色")).toBeInTheDocument();
  });

  it("should view garden after success", async () => {
    createRose.mockResolvedValue({ id: "r1", color: "red" });
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.change(screen.getByRole("textbox", { name: "玫瑰" }), { target: { value: "感恩" } });
    fireEvent.click(screen.getByText("种下玫瑰吧"));
    await waitFor(() => {
      expect(screen.getByText("查看花圃")).toBeInTheDocument();
    });
  });

  it("未登录打开种花页不再跳登录（先让人写完）", () => {
    getToken.mockReturnValue(null);
    render(<PlantPage />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText("选择玫瑰的颜色")).toBeInTheDocument();
  });

  it("未登录提交时才要昵称，已写的内容不丢", async () => {
    getToken.mockReturnValue(null);
    register.mockResolvedValue({
      access_token: "a",
      refresh_token: "r",
      user: { id: "u1", nickname: "alice", created_at: "" },
    });
    createRose.mockResolvedValue({ id: "r1", color: "red" });

    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.change(screen.getByRole("textbox", { name: "玫瑰" }), { target: { value: "今天很好" } });
    fireEvent.click(screen.getByText("种下玫瑰吧"));

    await waitFor(() => {
      expect(screen.getByText("先给自己取个名字")).toBeInTheDocument();
    });
    // 还没取名，不能偷偷提交到公开花圃。
    expect(createRose).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("你想叫什么名字？"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("种下这朵玫瑰"));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("alice", undefined);
      // 刚才写的那句话原样带进最终提交。
      expect(createRose).toHaveBeenCalledWith(expect.objectContaining({ gratitude: "今天很好" }));
      expect(screen.getByText(PLANTED_TITLE)).toBeInTheDocument();
    });
  });

  it("取名失败时留在弹窗里，内容不丢", async () => {
    getToken.mockReturnValue(null);
    register.mockRejectedValue(new Error("已设置密码"));
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.change(screen.getByRole("textbox", { name: "玫瑰" }), { target: { value: "今天很好" } });
    fireEvent.click(screen.getByText("种下玫瑰吧"));

    await waitFor(() => expect(screen.getByText("先给自己取个名字")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("你想叫什么名字？"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("种下这朵玫瑰"));

    await waitFor(() => {
      expect(screen.getByText("该昵称已设置密码，请输入密码")).toBeInTheDocument();
    });
    expect(createRose).not.toHaveBeenCalled();
    expect(screen.getByText("先给自己取个名字")).toBeInTheDocument();
  });
});
