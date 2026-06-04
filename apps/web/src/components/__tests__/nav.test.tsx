import '@testing-library/jest-dom';
import { render, screen, fireEvent } from "@testing-library/react";
import { Nav } from "../nav";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  );
});

jest.mock("@/lib/api", () => ({
  getUser: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("@/lib/sound", () => ({
  isMuted: jest.fn().mockReturnValue(true),
  toggleMute: jest.fn().mockReturnValue(false),
  startBgMusic: jest.fn(),
  stopBgMusic: jest.fn(),
}));

const { getUser } = require("@/lib/api") as { getUser: jest.Mock };

describe("Nav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show login link when not logged in", () => {
    getUser.mockReturnValue(null);
    render(<Nav />);
    expect(screen.getByText("登录")).toBeInTheDocument();
    expect(screen.queryByText("登出")).not.toBeInTheDocument();
  });

  it("should show user info when logged in", () => {
    getUser.mockReturnValue({ id: "u1", nickname: "alice", created_at: "" });
    render(<Nav />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("登出")).toBeInTheDocument();
    expect(screen.queryByText("登录")).not.toBeInTheDocument();
  });

  it("should show navigation links", () => {
    getUser.mockReturnValue(null);
    render(<Nav />);
    expect(screen.getByText("种玫瑰")).toBeInTheDocument();
    expect(screen.getByText("花圃")).toBeInTheDocument();
  });

  it("should show my garden link when logged in", () => {
    getUser.mockReturnValue({ id: "u1", nickname: "alice", created_at: "" });
    render(<Nav />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("should toggle mute on button click", () => {
    getUser.mockReturnValue(null);
    const { toggleMute } = require("@/lib/sound") as { toggleMute: jest.Mock };
    toggleMute.mockReturnValue(false);
    render(<Nav />);
    const muteBtn = screen.getAllByRole("button")[0]; // mute btn
    fireEvent.click(muteBtn);
    expect(toggleMute).toHaveBeenCalled();
  });
});
