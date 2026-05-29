import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/api", () => ({
  register: jest.fn(),
  setToken: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock("@/lib/sound", () => ({
  playClick: jest.fn(),
}));

const { register } = require("@/lib/api") as { register: jest.Mock };

import LoginPage from "../page";

describe("LoginPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should render login form", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("你的昵称")).toBeInTheDocument();
    expect(screen.getByText("开始种花")).toBeInTheDocument();
  });

  it("should show error on register failure", async () => {
    register.mockRejectedValue(new Error("fail"));
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("你的昵称"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("开始种花"));
    await waitFor(() => {
      expect(screen.getByText("注册失败，请重试")).toBeInTheDocument();
    });
  });

  it("should call register on submit", async () => {
    register.mockResolvedValue({
      token: "jwt",
      user: { id: "u1", nickname: "alice", created_at: "" },
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("你的昵称"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("开始种花"));
    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("alice");
    });
  });
});
