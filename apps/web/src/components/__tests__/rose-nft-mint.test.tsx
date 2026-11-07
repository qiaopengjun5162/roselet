import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Rose, SolanaNft } from "@/lib/api";

const mockGetRoseNft = jest.fn();
const mockRecordRoseNft = jest.fn();
const mockMintRoseNft = jest.fn();
const mockOpenPanel = jest.fn();

/** Mutable so each test can pick the membership state it needs. */
let mockMembership: {
  isMember: boolean;
  walletAddress: string | null;
  openPanel: () => void;
} | null = null;

// Mocked so the test never loads `@solana/spl-token` (@noble/curves needs
// TextEncoder, which jsdom lacks). The component only needs the contract.
jest.mock("@/lib/rose-nft", () => ({
  mintRoseNft: (...args: unknown[]) => mockMintRoseNft(...args),
}));

jest.mock("@/lib/api", () => ({
  getRoseNft: (...args: unknown[]) => mockGetRoseNft(...args),
  recordRoseNft: (...args: unknown[]) => mockRecordRoseNft(...args),
}));

jest.mock("@/app/membership-context", () => ({
  useOptionalMembership: () => mockMembership,
}));

import { RoseNftMint } from "../rose-nft-mint";

const WALLET = "8rUcGZLeSk6PCreV7LYGEoAxv1aiNPzxDCtoSUUTuHeG";
const MINT = "Dhs11iijzktgppnv8aUa9fn9eosSjxxhpzyYuChF5DRv";

const rose = {
  id: "8f7a3c2b-4d5e-4f6a-9b1c-2d3e4f5a6b7c",
  color: "red",
  gratitude: "愿这朵玫瑰在链上永远盛开",
  anxiety: null,
  hope: null,
  is_private: false,
} as Rose;

const storedNft: SolanaNft = {
  mint_address: MINT,
  wallet_address: WALLET,
  name: "愿这朵玫瑰在链上永远",
  symbol: "ROSE",
  uri: "ipfs://bafyRose",
  additional_metadata: [{ key: "roseId", value: rose.id }],
  minted_at: "2026-11-07T00:00:00Z",
};

describe("RoseNftMint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoseNft.mockResolvedValue(null);
    mockMembership = {
      isMember: true,
      walletAddress: WALLET,
      openPanel: mockOpenPanel,
    };
    (window as unknown as { solana?: unknown }).solana = {
      signTransaction: jest.fn(),
    };
  });

  it("renders nothing at all in default (plain) mode", () => {
    mockMembership = { isMember: false, walletAddress: null, openPanel: mockOpenPanel };
    const { container } = render(<RoseNftMint rose={rose} canMint />);
    expect(container).toBeEmptyDOMElement();
    expect(mockGetRoseNft).not.toHaveBeenCalled();
  });

  it("renders nothing when membership context is absent", () => {
    mockMembership = null;
    const { container } = render(<RoseNftMint rose={rose} canMint />);
    expect(container).toBeEmptyDOMElement();
  });

  it("never renders for private roses", () => {
    const privateRose = { ...rose, is_private: true } as Rose;
    const { container } = render(<RoseNftMint rose={privateRose} canMint />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the minted NFT with an explorer link, even for non-owners", async () => {
    mockGetRoseNft.mockResolvedValue(storedNft);
    render(<RoseNftMint rose={rose} canMint={false} />);

    expect(await screen.findByText("🌹 已铸成链上 NFT")).toBeInTheDocument();
    expect(screen.getByText("愿这朵玫瑰在链上永远")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: MINT })).toHaveAttribute(
      "href",
      expect.stringContaining(`explorer.solana.com/address/${MINT}`),
    );
    // Supply is fixed on-chain, so offering a second mint would be misleading.
    expect(
      screen.queryByRole("button", { name: /铸成 NFT/ }),
    ).not.toBeInTheDocument();
  });

  it("mints and then stores the reference", async () => {
    mockMintRoseNft.mockResolvedValue({
      mintAddress: MINT,
      signature: "sig123",
      name: "n",
      uri: "u",
    });
    mockRecordRoseNft.mockResolvedValue(storedNft);

    render(<RoseNftMint rose={rose} canMint />);
    fireEvent.click(await screen.findByRole("button", { name: /🌹 铸成 NFT/ }));

    expect(await screen.findByText("🌹 已铸成链上 NFT")).toBeInTheDocument();
    expect(mockMintRoseNft).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: WALLET,
        roseId: rose.id,
        roseName: rose.gratitude,
      }),
    );
    expect(mockRecordRoseNft).toHaveBeenCalledWith(rose.id, {
      mint_address: MINT,
      wallet_address: WALLET,
    });
  });

  it("retries only the backend save after a failed store (no second mint)", async () => {
    mockMintRoseNft.mockResolvedValue({
      mintAddress: MINT,
      signature: "sig123",
      name: "n",
      uri: "u",
    });
    // The mint is already on-chain; only our bookkeeping failed.
    mockRecordRoseNft
      .mockRejectedValueOnce(new Error("后端核验失败"))
      .mockResolvedValueOnce(storedNft);

    render(<RoseNftMint rose={rose} canMint />);
    fireEvent.click(await screen.findByRole("button", { name: /🌹 铸成 NFT/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("后端核验失败");
    expect(screen.getByText(/不会重复铸造/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /重试保存/ }));
    await waitFor(() => expect(screen.getByText("🌹 已铸成链上 NFT")).toBeInTheDocument());

    expect(mockRecordRoseNft).toHaveBeenCalledTimes(2);
    // The whole point: a failed save must never mint a second asset
    // (~0.004 SOL of rent each, and permanent).
    expect(mockMintRoseNft).toHaveBeenCalledTimes(1);
  });

  it("asks the user to connect a wallet instead of minting without one", async () => {
    mockMembership = { isMember: true, walletAddress: null, openPanel: mockOpenPanel };
    render(<RoseNftMint rose={rose} canMint />);

    fireEvent.click(await screen.findByRole("button", { name: /先连接钱包/ }));
    expect(mockOpenPanel).toHaveBeenCalled();
    expect(mockMintRoseNft).not.toHaveBeenCalled();
  });

  it("surfaces an insufficient-SOL error with an actionable hint", async () => {
    mockMintRoseNft.mockRejectedValue(new Error("insufficient lamports 0x1"));
    render(<RoseNftMint rose={rose} canMint />);

    fireEvent.click(await screen.findByRole("button", { name: /🌹 铸成 NFT/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("钱包 SOL 不足");
  });
});
