"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SignTransactionFn } from "@/lib/solana-rpc";
import { type WalletSession, connectSolanaWallet } from "@/lib/wallet";

interface MembershipContextValue {
  /** Whether the Web3 / membership UI is active. Default OFF — normal app has no Web3. */
  isMember: boolean;
  /** Enter / leave membership mode. Entering also opens the panel once. */
  toggleMember: () => void;
  /** Whether the membership panel is currently shown. It can be closed while
   *  staying in membership mode, so users can browse rose detail pages. */
  panelOpen: boolean;
  /** Close the panel but stay in membership mode. */
  closePanel: () => void;
  /** Re-open the panel without a preselected rose (enter membership if needed). */
  openPanel: () => void;
  /** Rose id pre-selected for minting (from a rose detail page), or null. */
  mintTargetRoseId: string | null;
  /** Open the panel for a specific rose (also enters membership mode). */
  openMint: (roseId: string) => void;
  /** Clear the preselected rose so the id field becomes editable again. */
  clearMintTarget: () => void;
  /** Connected Solana wallet address (base58), or null. */
  walletAddress: string | null;
  /**
   * Sign a compiled transaction (wire bytes) with the connected wallet, and
   * return the signed bytes. Null until a wallet is connected. Signing goes
   * through the Wallet Standard — see `lib/wallet.ts`.
   */
  signTransaction: SignTransactionFn | null;
  connectError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const [isMember, setIsMember] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mintTargetRoseId, setMintTargetRoseId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    setConnectError(null);
    if (typeof window === "undefined") return;
    try {
      const next = await connectSolanaWallet();
      setSession(next);
      setWalletAddress(next.address);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "连接钱包失败");
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    session?.disconnect();
    setSession(null);
    setWalletAddress(null);
  }, [session]);

  const toggleMember = useCallback(() => {
    const next = !isMember;
    // Entering membership shows the panel (the "membership view"); leaving
    // clears everything so the normal app has zero Web3 surface again.
    setIsMember(next);
    setPanelOpen(next);
    if (!next) setMintTargetRoseId(null);
  }, [isMember]);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const openPanel = useCallback(() => {
    setMintTargetRoseId(null);
    setPanelOpen(true);
    setIsMember(true);
  }, []);

  const openMint = useCallback((roseId: string) => {
    setMintTargetRoseId(roseId);
    setPanelOpen(true);
    setIsMember(true);
  }, []);

  const clearMintTarget = useCallback(() => setMintTargetRoseId(null), []);

  const value = useMemo<MembershipContextValue>(
    () => ({
      isMember,
      toggleMember,
      panelOpen,
      closePanel,
      openPanel,
      mintTargetRoseId,
      openMint,
      clearMintTarget,
      walletAddress,
      signTransaction: session?.signTransaction ?? null,
      connectError,
      connectWallet,
      disconnectWallet,
    }),
    [
      isMember,
      toggleMember,
      panelOpen,
      closePanel,
      openPanel,
      mintTargetRoseId,
      openMint,
      clearMintTarget,
      walletAddress,
      session,
      connectError,
      connectWallet,
      disconnectWallet,
    ],
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

/** Optional variant for components that must also render in isolation (e.g.
 *  unit tests without a Provider) or on pages where membership is disabled.
 *  Returns null instead of throwing, so callers can simply hide Web3 UI. */
export function useOptionalMembership(): MembershipContextValue | null {
  return useContext(MembershipContext);
}

/** Fired after a successful Solana mint so any open detail page can refresh
 *  its on-chain badge. Kept as a DOM event to avoid coupling components. */
export const SOLANA_MINT_EVENT = "roselet:solana-mint";
