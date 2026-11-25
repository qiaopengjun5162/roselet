import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// 默认按会员渲染，保留原有钱包流程用例；单独一个用例切到普通模式验证拦截。
let memberMode = true;
let hasMembership = true;
const mockOpenPanel = jest.fn();
const mockEnterMemberView = jest.fn();
jest.mock("@/app/membership-context", () => ({
  useOptionalMembership: () => ({
    isMember: memberMode,
    hasMembership,
    openPanel: mockOpenPanel,
    enterMemberView: mockEnterMemberView,
  }),
}));
afterEach(() => { memberMode = true; hasMembership = true; });

const mockSelect = jest.fn();
const mockConnect = jest.fn();
const mockRequestTransaction = jest.fn();
const mockCreatePrivateRoseTransaction = jest.fn();
const mockBuildAleoVaultInputs = jest.fn();
const mockGetRecommendation = jest.fn();

let walletState = {
  wallet: { adapter: {} },
  publicKey: "aleo1owner",
  connected: true,
  connecting: false,
  select: mockSelect,
  connect: mockConnect,
  requestTransaction: mockRequestTransaction,
};

jest.mock("@demox-labs/aleo-wallet-adapter-base", () => ({
  DecryptPermission: { UponRequest: "upon-request" },
}));

jest.mock("@demox-labs/aleo-wallet-adapter-react", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
  useWallet: () => walletState,
}));

jest.mock("@demox-labs/aleo-wallet-adapter-leo", () => ({
  LeoWalletAdapter: jest.fn().mockImplementation(() => ({})),
  LeoWalletName: "Leo Wallet",
}));

jest.mock("@/lib/aleo", () => ({
  ALEO_NETWORK: "testnet",
  ALEO_PROGRAM_ID: "roselet_private_vault.aleo",
  createPrivateRoseTransaction: (...args: unknown[]) => mockCreatePrivateRoseTransaction(...args),
}));

jest.mock("@/lib/recommend", () => ({
  buildAleoVaultInputs: (...args: unknown[]) => mockBuildAleoVaultInputs(...args),
  getRecommendation: (...args: unknown[]) => mockGetRecommendation(...args),
}));

import PrivateVaultPage from "../page";

describe("PrivateVaultPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    walletState = {
      wallet: { adapter: {} },
      publicKey: "aleo1owner",
      connected: true,
      connecting: false,
      select: mockSelect,
      connect: mockConnect,
      requestTransaction: mockRequestTransaction,
    };
    mockGetRecommendation.mockResolvedValue({
      flower_language: { title: "静谧" },
      theme: { title: "照顾自己" },
    });
    mockBuildAleoVaultInputs.mockResolvedValue({
      rose_id: "1field",
      content_commitment: "2field",
      ai_reply_commitment: "3field",
      share_key: "4field",
    });
    mockCreatePrivateRoseTransaction.mockReturnValue({ transaction: true });
    mockRequestTransaction.mockResolvedValue("wallet-request-1");
  });

  it("两态内容块都有不透背景，飘落花瓣不会糊在正文/输入框上", () => {
    const source = readFileSync(resolve(__dirname, "../page.tsx"), "utf8").replace(
      /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
      "",
    );
    // 会员表单块 + 非会员提示块都必须有近全不透背景与毛玻璃；
    // bg-.../5 这类半透明会让 z-0 的花瓣透上来，正是本次要修的缺陷。
    const opaqueBlocks = source.match(/bg-\[#0f081e\]\/90[^"']*backdrop-blur-xl/g) || [];
    expect(opaqueBlocks.length).toBeGreaterThanOrEqual(2);
    expect(source).not.toMatch(/bg-violet-500\/5/);
  });

  it("普通模式直接输网址也看不到任何钱包操作", () => {
    memberMode = false;
    hasMembership = false;
    render(<PrivateVaultPage />);

    expect(screen.getByText("Aleo 私密 Vault 只对会员开放")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("写下一段不想公开的感恩、焦虑或期待")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "种下私密玫瑰" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去开通会员" })).toHaveAttribute(
      "href",
      "/membership",
    );
  });

  it("会员但未进入会员版时，提示进入会员版并打开面板", () => {
    memberMode = false;
    hasMembership = true;
    render(<PrivateVaultPage />);

    expect(screen.getByText("进入会员版后使用 Aleo Vault")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "进入会员版" }));
    expect(mockEnterMemberView).toHaveBeenCalledTimes(1);
  });

  it("requires private content before requesting the wallet", () => {
    render(<PrivateVaultPage />);

    fireEvent.click(screen.getByRole("button", { name: "种下私密玫瑰" }));

    expect(screen.getByText("请先写下一段只属于你的内容")).toBeInTheDocument();
    expect(mockRequestTransaction).not.toHaveBeenCalled();
  });

  it("connects the selected Leo Wallet on Testnet", async () => {
    walletState = { ...walletState, publicKey: "", connected: false };
    render(<PrivateVaultPage />);

    fireEvent.click(screen.getByRole("button", { name: "确认连接" }));

    await waitFor(() => expect(mockConnect).toHaveBeenCalledWith(
      "upon-request",
      "testnet",
      ["roselet_private_vault.aleo"],
    ));
  });

  it("builds commitments locally before requesting the wallet transaction", async () => {
    render(<PrivateVaultPage />);
    fireEvent.change(screen.getByPlaceholderText("写下一段不想公开的感恩、焦虑或期待"), {
      target: { value: "  只留在浏览器里的原文  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "种下私密玫瑰" }));

    await waitFor(() => expect(mockRequestTransaction).toHaveBeenCalledWith({ transaction: true }));
    expect(mockGetRecommendation).toHaveBeenCalledWith([
      { color: "white", anxiety: "只留在浏览器里的原文" },
    ]);
    expect(mockBuildAleoVaultInputs).toHaveBeenCalledWith(
      expect.any(String),
      "只留在浏览器里的原文",
      "静谧：照顾自己",
      expect.any(String),
    );
    expect(mockCreatePrivateRoseTransaction).toHaveBeenCalledWith("aleo1owner", {
      rose_id: "1field",
      content_commitment: "2field",
      ai_reply_commitment: "3field",
      share_key: "4field",
    });
    expect(screen.getByText("钱包请求编号：wallet-request-1")).toBeInTheDocument();
    expect(screen.getByText("静谧：照顾自己")).toBeInTheDocument();
  });
});
