import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUpload = jest.fn();

// @solana/web3.js pulls in @noble/curves, which requires TextEncoder (jsdom
// doesn't provide it). These tests never mint, so stub the SDK instead of
// loading it — the panel only constructs a PublicKey at module scope.
jest.mock("@solana/web3.js", () => ({
  clusterApiUrl: () => "https://api.devnet.solana.com",
  PublicKey: class PublicKeyStub {
    constructor(_value: string) {}
  },
  Connection: class ConnectionStub {},
  Transaction: class TransactionStub {},
  TransactionInstruction: class TransactionInstructionStub {},
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
