import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Rose } from "@/lib/api";

const mockMintRoseMemorial = jest.fn();
const mockVerifyRoseMemorial = jest.fn();

jest.mock("@/lib/chain", () => ({
  mintRoseMemorial: (...args: unknown[]) => mockMintRoseMemorial(...args),
}));

jest.mock("@/lib/api", () => ({
  verifyRoseMemorial: (...args: unknown[]) => mockVerifyRoseMemorial(...args),
}));

import { RoseMemorial } from "../rose-memorial";

const rose = {
  id: "a8664541-09d6-4da7-9b78-7f8ca20ba60a",
  color: "red",
  is_private: false,
} as Rose;

describe("RoseMemorial", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the verified transaction to every visitor", () => {
    render(
      <RoseMemorial
        rose={rose}
        canMint={false}
        onVerified={jest.fn()}
        mint={{ tx_hash: "0xabc", on_chain_message: "Keep growing" } as never}
      />,
    );

    expect(screen.getByText("Keep growing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看已验证交易" })).toHaveAttribute(
      "href",
      "https://sepolia.basescan.org/tx/0xabc",
    );
  });

  it("keeps the panel hidden when the visitor cannot mint", () => {
    const { container } = render(
      <RoseMemorial rose={rose} canMint={false} onVerified={jest.fn()} mint={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("requires a message before opening the wallet", () => {
    render(<RoseMemorial rose={rose} canMint onVerified={jest.fn()} mint={null} />);
    fireEvent.click(screen.getByRole("button", { name: "创建纪念版" }));

    expect(screen.getByText("写下一句想永久留存的话")).toBeInTheDocument();
    expect(mockMintRoseMemorial).not.toHaveBeenCalled();
  });

  it("verifies the confirmed wallet transaction", async () => {
    const onVerified = jest.fn();
    mockMintRoseMemorial.mockResolvedValue({
      txHash: "0xabc",
      walletAddress: "0x0000000000000000000000000000000000000001",
    });
    const mint = { tx_hash: "0xabc", on_chain_message: "Keep growing" };
    mockVerifyRoseMemorial.mockResolvedValue(mint);
    render(<RoseMemorial rose={rose} canMint onVerified={onVerified} mint={null} />);

    fireEvent.change(screen.getByPlaceholderText("写下一句想留存的话"), {
      target: { value: "Keep growing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建纪念版" }));

    await waitFor(() => expect(mockVerifyRoseMemorial).toHaveBeenCalledWith(rose.id, {
      tx_hash: "0xabc",
      wallet_address: "0x0000000000000000000000000000000000000001",
      message: "Keep growing",
    }));
    expect(onVerified).toHaveBeenCalledWith(mint);
  });
});
