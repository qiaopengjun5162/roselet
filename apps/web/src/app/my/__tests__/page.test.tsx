import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/rose-card", () => ({
  RoseCard: ({ rose }: { rose: { gratitude?: string; anxiety?: string; hope?: string } }) => (
    <div>
      {rose.gratitude && <span>{rose.gratitude}</span>}
      {rose.anxiety && <span>{rose.anxiety}</span>}
      {rose.hope && <span>{rose.hope}</span>}
    </div>
  ),
}));

jest.mock("next/link", () =>
  function Link({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  }
);

jest.mock("@/lib/api", () => ({
  getMyRoses: jest.fn(),
  getToken: jest.fn().mockReturnValue("jwt-token"),
}));

const { getMyRoses, getToken } = require("@/lib/api") as {
  getMyRoses: jest.Mock;
  getToken: jest.Mock;
};

import MyPage from "../page";

describe("MyPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should show loading state", () => {
    getToken.mockReturnValue("jwt-token");
    getMyRoses.mockReturnValue(new Promise(() => {}));
    render(<MyPage />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("should show empty state", async () => {
    getToken.mockReturnValue("jwt-token");
    getMyRoses.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
    render(<MyPage />);
    await waitFor(() => {
      expect(screen.getByText("你还没有种过玫瑰")).toBeInTheDocument();
    });
  });

  it("should display roses", async () => {
    getToken.mockReturnValue("jwt-token");
    getMyRoses.mockResolvedValue({
      data: [
        { id: "r1", color: "red", gratitude: "感恩", anxiety: null, hope: null, user_id: "u1", nickname: "alice", like_count: 0, ai_reply: null, created_at: "" },
      ],
      total: 1,
      page: 1,
      per_page: 20,
    });
    render(<MyPage />);
    await waitFor(() => {
      expect(screen.getByText("感恩")).toBeInTheDocument();
    });
  });
});
