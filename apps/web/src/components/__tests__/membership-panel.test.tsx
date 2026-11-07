import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

// jsdom does not ship TextEncoder/TextDecoder, which the Solana mint flow uses
// to encode the on-chain memo payload. Polyfill from Node's `util` for tests.
const globalScope = globalThis as {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
};
if (!globalScope.TextEncoder) globalScope.TextEncoder = TextEncoder;
if (!globalScope.TextDecoder) globalScope.TextDecoder = TextDecoder;

const mockUpload = jest.fn();
const mockGetLatestBlockhash = jest.fn();
const mockSendRawTransaction = jest.fn();
const mockConfirmTransaction = jest.fn();

// @solana/web3.js pulls in @noble/curves, which requires TextEncoder (jsdom
// doesn't provide it). Stub the SDK instead of loading it; the panel uses only
// a small method surface, stubbed here so mint-flow tests stay in jsdom.
jest.mock("@solana/web3.js", () => ({
  clusterApiUrl: () => "https://api.devnet.solana.com",
  PublicKey: class PublicKeyStub {
    constructor() {}
  },
  Connection: class ConnectionStub {
    getLatestBlockhash = mockGetLatestBlockhash;
    sendRawTransaction = mockSendRawTransaction;
    confirmTransaction = mockConfirmTransaction;
  },
  Transaction: class TransactionStub {
    add() {
      return this;
    }
    serialize() {
      return new Uint8Array([1, 2, 3]);
    }
  },
  TransactionInstruction: class TransactionInstructionStub {
    constructor() {}
  },
  ComputeBudgetProgram: {
    setComputeUnitLimit: () => ({}),
    setComputeUnitPrice: () => ({}),
  },
}));

jest.mock("@/lib/api", () => ({
  getToken: () => null,
  uploadImageToIpfs: (...args: unknown[]) => mockUpload(...args),
}));

import { MembershipProvider, useMembership } from "@/app/membership-context";
import { MembershipPanel } from "../membership-panel";

function EnterButton() {
  const { openPanel } = useMembership();
  return <button onClick={openPanel}>enter-member</button>;
}

function renderPanel() {
  return render(
    <MembershipProvider>
      <EnterButton />
      <MembershipPanel />
    </MembershipProvider>,
  );
}

function selectImage() {
  const input = screen.getByLabelText("选择要上链的图片");
  const file = new File(["fake-image"], "rose.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

const cidInput = () =>
  screen.getByPlaceholderText(
    /未配置上传服务时可手填已有 CID/,
  ) as HTMLInputElement;

describe("MembershipPanel · image → IPFS CID", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders no Web3 surface in default (plain) mode", () => {
    const { container } = render(
      <MembershipProvider>
        <MembershipPanel />
      </MembershipProvider>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText("选择要上链的图片")).not.toBeInTheDocument();
  });

  it("requires a selected file before the upload button is enabled", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "enter-member" }));

    expect(screen.getByRole("button", { name: "↑ 上传" })).toBeDisabled();
    selectImage();
    expect(screen.getByRole("button", { name: "↑ 上传" })).toBeEnabled();
  });

  it("auto-fills the CID and shows a gateway link after a successful upload", async () => {
    mockUpload.mockResolvedValue({
      cid: "bafyTestCid123",
      gateway_url: "https://gateway.pinata.cloud/ipfs/bafyTestCid123",
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "enter-member" }));
    const file = selectImage();
    fireEvent.click(screen.getByRole("button", { name: "↑ 上传" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(file));
    await waitFor(() => expect(cidInput().value).toBe("bafyTestCid123"));
    expect(screen.getByRole("link", { name: /查看已上传的图片/ })).toHaveAttribute(
      "href",
      "https://gateway.pinata.cloud/ipfs/bafyTestCid123",
    );
  });

  it("shows an actionable hint and keeps manual CID entry when upload is unavailable", async () => {
    mockUpload.mockRejectedValue(
      new Error(
        "图片上传服务未配置（PINATA_JWT）；请手动填写图片 CID，或让管理员配置后重试",
      ),
    );
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "enter-member" }));
    selectImage();
    fireEvent.click(screen.getByRole("button", { name: "↑ 上传" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("请手动填写图片 CID");
    fireEvent.change(cidInput(), { target: { value: "QmManualCid" } });
    expect(cidInput().value).toBe("QmManualCid");
  });
});

describe("MembershipPanel · Solana mint retry safety", () => {
  const WALLET = "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM";
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    window.solana = {
      connect: jest
        .fn()
        .mockResolvedValue({ publicKey: { toBase58: () => WALLET } }),
      signTransaction: jest
        .fn()
        .mockResolvedValue({ serialize: () => new Uint8Array([1, 2, 3]) }),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    mockGetLatestBlockhash.mockResolvedValue({
      blockhash: "bh",
      lastValidBlockHeight: 100,
    });
    mockSendRawTransaction.mockResolvedValue("sig-broadcast");
    mockConfirmTransaction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete window.solana;
  });

  it("retries only the backend save after a post-broadcast failure (no duplicate tx)", async () => {
    // First save fails (backend 500), second succeeds.
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "enter-member" }));
    fireEvent.click(screen.getByRole("button", { name: /连接钱包/ }));
    await screen.findByText(/钱包：/);

    fireEvent.change(screen.getByPlaceholderText(/例如 550e8400/), {
      target: { value: "550e8400-e29b-41d4-a716-446655440000" },
    });
    fireEvent.change(screen.getByPlaceholderText(/写一句想留在链上的话/), {
      target: { value: "hi" },
    });

    fireEvent.click(screen.getByRole("button", { name: /🚀 上链/ }));

    await waitFor(() => expect(mockSendRawTransaction).toHaveBeenCalledTimes(1));
    const retry = await screen.findByRole("button", { name: /重试保存/ });
    fireEvent.click(retry);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // The critical guarantee: retry re-saved but did NOT broadcast again.
    expect(mockSendRawTransaction).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/已上链/)).toBeInTheDocument();
  });

  it("pins the signature when confirmation times out, so retry never re-broadcasts", async () => {
    // The RPC accepts the tx, but waiting for `finalized` times out locally
    // (congested cluster / slow finality). That must not look like a failed
    // broadcast — rebuilding the tx would put a second memo on-chain.
    mockConfirmTransaction.mockRejectedValue(
      new Error("Transaction was not confirmed in 30.00 seconds"),
    );
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503, text: async () => "rpc busy" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "enter-member" }));
    fireEvent.click(screen.getByRole("button", { name: /连接钱包/ }));
    await screen.findByText(/钱包：/);

    fireEvent.change(screen.getByPlaceholderText(/例如 550e8400/), {
      target: { value: "550e8400-e29b-41d4-a716-446655440000" },
    });
    fireEvent.change(screen.getByPlaceholderText(/写一句想留在链上的话/), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /🚀 上链/ }));

    await waitFor(() => expect(mockSendRawTransaction).toHaveBeenCalledTimes(1));
    // Signature was pinned before the confirm wait -> "save only" retry path.
    expect(await screen.findByRole("button", { name: /重试保存/ })).toBeInTheDocument();
    expect(screen.getByText(/重试只会重新保存到后端/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /重试保存/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(mockSendRawTransaction).toHaveBeenCalledTimes(1);
  });
});
