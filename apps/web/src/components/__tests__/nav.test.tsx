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
