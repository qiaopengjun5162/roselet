"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Phantom / Solana wallet providers inject a `solana` object on window.
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: { toBase58: () => string };
      isConnected?: boolean;
      connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
      disconnect: () => Promise<void>;
      // Phantom signs a transaction and returns it (still a Transaction with serialize()).
      signTransaction?: (transaction: unknown) => Promise<{ serialize: () => Uint8Array }>;
    };
  }
}

interface MembershipContextValue {
  /** Whether the Web3 / membership UI is active. Default OFF — normal app has no Web3. */
  isMember: boolean;
  toggleMember: () => void;
  /** Connected Solana wallet address (base58), or null. */
  walletAddress: string | null;
  connectError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const [isMember, setIsMember] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    setConnectError(null);
    if (typeof window === "undefined" || !window.solana) {
      setConnectError("未检测到 Solana 钱包（请安装 Phantom 等浏览器插件）");
      return;
    }
    try {
      const res = await window.solana.connect();
      setWalletAddress(res.publicKey.toBase58());
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "连接钱包失败");
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    window.solana?.disconnect().catch(() => {});
    setWalletAddress(null);
  }, []);

  const toggleMember = useCallback(() => setIsMember((v) => !v), []);

  const value = useMemo<MembershipContextValue>(
    () => ({
      isMember,
      toggleMember,
      walletAddress,
      connectError,
      connectWallet,
      disconnectWallet,
    }),
    [isMember, toggleMember, walletAddress, connectError, connectWallet, disconnectWallet],
  );

  return (
    <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>
  );
}

export function useMembership(): MembershipContextValue {
  const ctx = useContext(MembershipContext);
  if (!ctx) {
    throw new Error("useMembership 必须在 MembershipProvider 内使用");
  }
  return ctx;
}
