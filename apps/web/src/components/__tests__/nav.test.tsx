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
  toggleMute: jest.fn().mockReturnValue(true),
  startBgMusic: jest.fn(),
  stopBgMusic: jest.fn(),
}));

const { getUser, logout } = require("@/lib/api") as {
  getUser: jest.Mock;
  logout: jest.Mock;
};
const { toggleMute, startBgMusic, stopBgMusic } = require("@/lib/sound") as {
  toggleMute: jest.Mock;
  startBgMusic: jest.Mock;
  stopBgMusic: jest.Mock;
};

import { Nav } from "../nav";

describe("Nav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUser.mockReturnValue(null);
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

  it("stops background music when mute is enabled", () => {
    render(<Nav />);

    fireEvent.click(screen.getByTitle("关闭声音"));

    expect(toggleMute).toHaveBeenCalledTimes(1);
    expect(stopBgMusic).toHaveBeenCalledTimes(1);
  });

  it("starts background music when mute is disabled", () => {
    toggleMute.mockReturnValue(false);

    render(<Nav />);

    fireEvent.click(screen.getByTitle("关闭声音"));

    expect(startBgMusic).toHaveBeenCalledTimes(1);
  });
});
