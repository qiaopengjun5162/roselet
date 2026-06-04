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

import { Nav } from "../nav";

describe("Nav", () => {
  beforeEach(() => jest.clearAllMocks());

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
});
