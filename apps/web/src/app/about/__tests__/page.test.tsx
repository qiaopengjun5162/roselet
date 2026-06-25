import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/link", () => {
  return function MockLink({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock("@/components/about-health", () => ({
  AboutHealth: () => <div data-testid="about-health" />,
}));
jest.mock("@/components/feedback-bottle", () => ({
  FeedbackBottle: () => <div data-testid="feedback-bottle" />,
}));
jest.mock("@/components/star-bottle", () => ({
  StarBottle: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
jest.mock("@/components/star-particles", () => ({
  StarParticles: () => <div data-testid="star-particles" />,
}));
jest.mock("@/components/silent-error-boundary", () => ({
  SilentErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/lib/version", () => ({
  getAppVersionInfo: jest.fn(),
}));

const { getAppVersionInfo } = require("@/lib/version") as {
  getAppVersionInfo: jest.Mock;
};

import AboutPage from "../page";

describe("AboutPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAppVersionInfo.mockReturnValue({
      version: "v0.2.0",
      commit: "76738cb",
      buildTime: "2026-06-25T10:00:00Z",
      releaseNotesUrl: "https://github.com/qiaopengjun5162/roselet/releases/tag/v0.2.0",
    });
  });

  it("renders app version metadata and release notes link", () => {
    render(<AboutPage />);

    expect(screen.getByText("当前版本")).toBeInTheDocument();
    expect(screen.getByText("Roselet v0.2.0")).toBeInTheDocument();
    expect(screen.getByText(/76738cb/)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-25T10:00:00Z/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看本次更新" })).toHaveAttribute(
      "href",
      "https://github.com/qiaopengjun5162/roselet/releases/tag/v0.2.0"
    );
  });

  it("hides release notes link when release URL is absent", () => {
    getAppVersionInfo.mockReturnValue({
      version: "dev",
      commit: "unknown",
      buildTime: null,
      releaseNotesUrl: null,
    });

    render(<AboutPage />);

    expect(screen.getByText("Roselet dev")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "查看本次更新" })).not.toBeInTheDocument();
  });
});
