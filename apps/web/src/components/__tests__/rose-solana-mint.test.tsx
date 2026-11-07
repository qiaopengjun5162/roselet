import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Rose } from "@/lib/api";

const mockGetSolanaMint = jest.fn();

jest.mock("@/lib/api", () => ({
  getSolanaMint: (...args: unknown[]) => mockGetSolanaMint(...args),
}));

import {
  MembershipProvider,
  useMembership,
} from "@/app/membership-context";
import { RoseSolanaMint } from "../rose-solana-mint";

const rose = {
  id: "a8664541-09d6-4da7-9b78-7f8ca20ba60a",
  color: "red",
  is_private: false,
} as Rose;

function renderWithProvider(ui: React.ReactNode) {
  return render(<MembershipProvider>{ui}</MembershipProvider>);
}

/** Test-only handles for the membership context (no Nav / Panel needed). */
function EnterButton() {
  const { openPanel } = useMembership();
  return <button onClick={openPanel}>enter-member</button>;
}
function TargetProbe() {
  const { mintTargetRoseId } = useMembership();
  return <span data-testid="target">{mintTargetRoseId ?? "none"}</span>;
}

describe("RoseSolanaMint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSolanaMint.mockResolvedValue(null);
  });

  it("renders no Web3 surface in default (plain) mode", () => {
    const { container } = renderWithProvider(
      <RoseSolanaMint rose={rose} canMint />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(mockGetSolanaMint).not.toHaveBeenCalled();
  });

  it("renders nothing without a MembershipProvider (isolated pages/tests)", () => {
    const { container } = render(<RoseSolanaMint rose={rose} canMint />);
    expect(container).toBeEmptyDOMElement();
    expect(mockGetSolanaMint).not.toHaveBeenCalled();
  });

  it("shows a mint button and preselects this rose when membership is on", async () => {
    renderWithProvider(
      <>
        <EnterButton />
        <TargetProbe />
        <RoseSolanaMint rose={rose} canMint />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "enter-member" }));

    const button = await screen.findByRole("button", { name: /把这朵玫瑰上链/ });
    expect(mockGetSolanaMint).toHaveBeenCalledWith(rose.id);
    expect(screen.getByTestId("target")).toHaveTextContent("none");

    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByTestId("target")).toHaveTextContent(rose.id),
    );
  });

  it("shows the on-chain badge and explorer link when a mint exists", async () => {
    mockGetSolanaMint.mockResolvedValue({
      signature: "5fhWkrdxSignature",
      account: "5FHwkrdxAccount",
      wallet_address: "5FHwkrdxWallet",
      ipfs_cid: "bafyTestCid",
      on_chain_metadata: { message: "永远盛开" },
      minted_at: "2026-11-07T00:00:00Z",
    });

    renderWithProvider(
      <>
        <EnterButton />
        <RoseSolanaMint rose={rose} canMint />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "enter-member" }));

    expect(await screen.findByText("永远盛开")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看链上交易" })).toHaveAttribute(
      "href",
      expect.stringContaining("explorer.solana.com/tx/5fhWkrdxSignature"),
    );
    expect(screen.getByText(/bafyTestCid/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /把这朵玫瑰上链/ })).not.toBeInTheDocument();
  });

  it("hides the mint button for non-owners but keeps the badge", async () => {
    mockGetSolanaMint.mockResolvedValue({
      signature: "sig",
      account: "acct",
      wallet_address: "wallet",
      ipfs_cid: null,
      on_chain_metadata: {},
      minted_at: "2026-11-07T00:00:00Z",
    });
    renderWithProvider(
      <>
        <EnterButton />
        <RoseSolanaMint rose={rose} canMint={false} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "enter-member" }));

    await waitFor(() => expect(mockGetSolanaMint).toHaveBeenCalled());
    expect(await screen.findByRole("link", { name: "查看链上交易" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /把这朵玫瑰上链/ })).not.toBeInTheDocument();
  });

  it("never renders for private roses", () => {
    const privateRose = { ...rose, is_private: true } as Rose;
    const { container } = renderWithProvider(
      <RoseSolanaMint rose={privateRose} canMint />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
