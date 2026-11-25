import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/garden",
}));

jest.mock("@/lib/api", () => ({
  getUser: jest.fn().mockReturnValue(null),
  logout: jest.fn(),
}));

jest.mock("@/lib/sound", () => ({
  isMuted: jest.fn().mockReturnValue(false),
  isBgPlaying: jest.fn().mockReturnValue(false),
  toggleMute: jest.fn().mockReturnValue(true),
  startBgMusic: jest.fn(),
  stopBgMusic: jest.fn(),
}));

// Nav renders in both worlds: isolated (no provider) and inside the app shell.
// Keep the default null so the existing assertions below describe the isolated
// case, and opt in per-test where the unified wallet entry matters.
let mockMembership: Record<string, unknown> | null = null;
jest.mock("@/app/membership-context", () => ({
  useOptionalMembership: () => mockMembership,
}));

const { getUser, logout } = require("@/lib/api") as {
  getUser: jest.Mock;
  logout: jest.Mock;
};
const { isBgPlaying, toggleMute, startBgMusic, stopBgMusic } = require("@/lib/sound") as {
  isBgPlaying: jest.Mock;
  toggleMute: jest.Mock;
  startBgMusic: jest.Mock;
  stopBgMusic: jest.Mock;
};

import { Nav } from "../nav";

describe("Nav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMembership = null;
    getUser.mockReturnValue(null);
    isBgPlaying.mockReturnValue(false);
    toggleMute.mockReturnValue(true);
  });

  it("renders main links", () => {
    render(<Nav />);
    expect(screen.getByText("种玫瑰")).toBeInTheDocument();
    expect(screen.getByText("花圃")).toBeInTheDocument();
    expect(screen.getByText("示波器")).toBeInTheDocument();
  });

  it("shows login button when not authenticated", () => {
    render(<Nav />);
    expect(screen.getByText("登录")).toBeInTheDocument();
  });

  it("keeps the member entry reachable when its label collapses on mobile", () => {
    // 390px 下顶栏只剩 250px 可用宽度，会员入口只留 🌐 图标；文字隐藏后
    // 必须靠 aria-label 保住可访问名，否则链接变成无名图标。
    // No provider here: the isolated fallback link is what keeps /membership
    // reachable in that case.
    render(<Nav />);
    const member = screen.getByRole("link", { name: "会员中心" });
    expect(member).toBeInTheDocument();
    expect(member).toHaveAttribute("href", "/membership");
    expect(member.textContent).toContain("会员");
  });

  it("collapses wallet and membership into one entry inside the app shell", () => {
    // Two adjacent icons for "membership" and "connect wallet" would read as
    // two doors, and the 375px bar has no room for another one.
    mockMembership = {
      memberAddress: null,
      walletAddress: null,
      solanaWallets: [],
      loggingIn: false,
      connectError: null,
      loginWithWallet: jest.fn(),
      disconnectWallet: jest.fn(),
    };

    render(<Nav />);

    expect(screen.getByRole("button", { name: "连接钱包" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "会员中心" })).not.toBeInTheDocument();
  });

  it("active link has highlight", () => {
    render(<Nav />);
    const gardenLink = screen.getByText("花圃").closest("a");
    expect(gardenLink?.className).toContain("bg-rose-500/15");
  });

  it("opens authenticated menu and logs out", async () => {
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });

    render(<Nav />);

    fireEvent.click(await screen.findByText(/alice/));
    expect(screen.getByText(/我的花圃/)).toBeInTheDocument();
    expect(screen.getByText(/个人资料/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("登出"));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("starts background music when sound is enabled from idle state", () => {
    render(<Nav />);

    fireEvent.click(screen.getByTitle("开启声音"));

    expect(toggleMute).not.toHaveBeenCalled();
    expect(startBgMusic).toHaveBeenCalledTimes(1);
  });

  it("stops background music when sound is turned off", () => {
    isBgPlaying.mockReturnValue(true);

    render(<Nav />);

    fireEvent.click(screen.getByTitle("关闭声音"));

    expect(stopBgMusic).toHaveBeenCalledTimes(1);
  });

  it("does not start background music while muted", () => {
    const { isMuted } = require("@/lib/sound") as { isMuted: jest.Mock };
    isMuted.mockReturnValue(true);

    render(<Nav />);

    fireEvent.click(screen.getByTitle("开启声音"));

    expect(toggleMute).toHaveBeenCalledTimes(1);
    expect(startBgMusic).not.toHaveBeenCalled();
  });
});
