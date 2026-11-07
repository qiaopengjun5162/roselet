import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/tip-ticker", () => ({
  TipTicker: () => <div data-testid="tip-ticker" />,
}));

jest.mock("@/components/activity-feed", () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));

import Home from "../page";

describe("Home", () => {
  it("exposes the Aleo vault without requiring a Roselet login", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "使用 Aleo 私密 Vault" })).toHaveAttribute(
      "href",
      "/private-vault",
    );
  });
});
