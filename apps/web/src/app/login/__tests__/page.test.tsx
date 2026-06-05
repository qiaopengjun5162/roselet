import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/lib/api", () => ({
  register: jest.fn(),
  setToken: jest.fn(),
  setRefreshToken: jest.fn(),
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
    expect(screen.getByPlaceholderText("你想叫什么名字？")).toBeInTheDocument();
    expect(screen.getByText("进入花圃")).toBeInTheDocument();
  });

  it("should show error on register failure", async () => {
    register.mockRejectedValue(new Error("fail"));
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("你想叫什么名字？"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("进入花圃"));
    await waitFor(() => {
      expect(screen.getByText("昵称已被占用，换一个试试？")).toBeInTheDocument();
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
    fireEvent.click(screen.getByText("进入花圃"));
    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("alice");
    });
  });
});
