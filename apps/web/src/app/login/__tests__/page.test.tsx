import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/lib/api", () => ({
  getUser: jest.fn().mockReturnValue(null),
  register: jest.fn(),
  requestWalletChallenge: jest.fn(),
  verifyWalletLogin: jest.fn(),
  setToken: jest.fn(),
  setRefreshToken: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock("@/lib/sound", () => ({
  playClick: jest.fn(),
}));

jest.mock("@/components/tip-ticker", () => ({
  TipTicker: ({ context }: { context: string }) => <div data-testid={`tip-${context}`} />,
}));

const { register } = require("@/lib/api") as { register: jest.Mock };

import LoginPage from "../page";

describe("LoginPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should render login form", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("你想叫什么名字？")).toBeInTheDocument();
    expect(screen.getByTestId("tip-login")).toBeInTheDocument();
    expect(screen.getByText("继续种花")).toBeInTheDocument();
  });

  it("should show error on register failure", async () => {
    register.mockRejectedValue(new Error("fail"));
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("你想叫什么名字？"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("继续种花"));
    await waitFor(() => {
      expect(screen.getByText("登录失败，请重试")).toBeInTheDocument();
    });
  });

  it("should call register on submit", async () => {
    register.mockResolvedValue({
      token: "jwt",
      user: { id: "u1", nickname: "alice", created_at: "" },
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("你想叫什么名字？"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("继续种花"));
    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("alice", undefined);
    });
  });

  it("opens the wallet tab when the URL asks for it", async () => {
    window.history.pushState({}, "", "/login?mode=wallet");
    render(<LoginPage />);
    expect(
      await screen.findByRole("heading", { name: "钱包登录 · 会员" }),
    ).toBeInTheDocument();
    window.history.pushState({}, "", "/login");
  });

  it("does not use useSearchParams (it would blank the prerendered page)", () => {
    // `useSearchParams()` forces the page under a Suspense boundary, so the
    // server ships an empty <main> and the form only appears after hydration.
    // Reading location.search in an effect keeps the HTML prerendered.
    const fs = require("node:fs");
    const path = require("node:path");
    const source = fs
      .readFileSync(path.join(__dirname, "..", "page.tsx"), "utf8")
      // Comments mention the hook by name; only real code counts.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/useSearchParams/);
    expect(source).not.toMatch(/<Suspense/);
  });
});
