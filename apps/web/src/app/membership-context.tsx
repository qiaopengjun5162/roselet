"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { SignTransactionFn } from "@/lib/solana-rpc";
import {
  type SolanaWalletOption,
  type WalletSession,
  connectSolanaWallet,
  listSolanaWalletOptions,
  onSolanaWalletsChanged,
} from "@/lib/wallet";

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
  /** Installed Solana wallets, for the chooser. Empty on the server / no extension. */
  solanaWallets: SolanaWalletOption[];
  /** Connect a specific wallet by name; omit the name to keep the old auto-pick. */
  connectWallet: (walletName?: string) => Promise<void>;
  disconnectWallet: () => void;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

/**
 * The wallet the user last connected by choice. Stored only so we can silently
 * reconnect on a later visit; it is NOT a permission boundary and never causes
 * a wallet popup on its own. A disconnect clears it.
 */
const LAST_WALLET_KEY = "roselet:solana-last-wallet";

function readLastWallet(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_WALLET_KEY);
  } catch {
    return null;
  }
}

function rememberLastWallet(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_WALLET_KEY, name);
  } catch {
    /* private mode / storage disabled — reconnect is simply skipped */
  }
}

function forgetLastWallet() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_WALLET_KEY);
  } catch {
    /* nothing to do */
  }
}

export function MembershipProvider({ children }: { children: ReactNode }) {
  const [isMember, setIsMember] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mintTargetRoseId, setMintTargetRoseId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [solanaWallets, setSolanaWallets] = useState<SolanaWalletOption[]>([]);
  // One-shot guard so a rejected silent reconnect isn't retried on every render.
  const autoReconnectDone = useRef(false);

  // Extensions may register after hydration; refresh on mount and on any
  // register/unregister event so the chooser never shows a stale empty list.
  useEffect(() => {
    const refresh = () => setSolanaWallets(listSolanaWalletOptions());
    refresh();
    return onSolanaWalletsChanged(refresh);
  }, []);

  const connectWallet = useCallback(async (walletName?: string) => {
    setConnectError(null);
    if (typeof window === "undefined") return;
    try {
      const next = await connectSolanaWallet(walletName);
      setSession(next);
      setWalletAddress(next.address);
      // Only a deliberate connect (not silent reconnect) records the choice.
      if (walletName) rememberLastWallet(walletName);
      autoReconnectDone.current = true;
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "连接钱包失败");
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    session?.disconnect();
    forgetLastWallet();
    autoReconnectDone.current = true;
    setSession(null);
    setWalletAddress(null);
  }, [session]);

  // Silent reconnect while in membership mode. Guards, in order:
  //  1. Only members — a normal user never triggers any wallet call.
  //  2. Not already connected, and not already attempted this session.
  //  3. A wallet was remembered last time AND is still installed.
  // The effect re-runs as extensions register, so a late-injected wallet is
  // still picked up. Failure is swallowed on purpose: a wallet that has never
  // approved this site rejects silent connect; showing an error or popping a
  // dialog would break the "normal app has zero Web3 surface" promise.
  useEffect(() => {
    if (!isMember || walletAddress || autoReconnectDone.current) return;
    const last = readLastWallet();
    if (!last || !solanaWallets.some((w) => w.name === last)) return;

    autoReconnectDone.current = true;
    connectSolanaWallet(last, { silent: true })
      .then((next) => {
        setSession(next);
        setWalletAddress(next.address);
      })
      .catch(() => {
        /* never-approved or rejected — stay quiet */
      });
  }, [isMember, walletAddress, solanaWallets]);

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
      solanaWallets,
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
      solanaWallets,
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
