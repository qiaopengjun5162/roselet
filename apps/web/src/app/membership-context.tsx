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

import {
  getUser,
  requestWalletChallenge,
  setRefreshToken,
  setToken,
  setUser,
  verifyWalletLogin,
} from "@/lib/api";
import { encodeBase58 } from "@/lib/base58";
import type { SignTransactionFn } from "@/lib/solana-rpc";
import {
  type SolanaWalletOption,
  type WalletSession,
  connectSolanaWallet,
  listSolanaWalletOptions,
  onSolanaWalletsChanged,
} from "@/lib/wallet";

interface MembershipContextValue {
  /**
   * Server-verified membership: the account has a bound Solana wallet.
   * Comes from `users.wallet_address`, not from a client-side toggle, so it
   * survives reloads and cannot be granted by clicking a button.
   */
  hasMembership: boolean;
  /** The bound wallet address (server truth), or null. */
  memberAddress: string | null;
  /** ISO timestamp of the first bind, or null. */
  memberSince: string | null;
  /**
   * Whether the member *view* is active. Only possible when `hasMembership`.
   * The plain app stays Web3-free until a member explicitly opens it.
   */
  isMember: boolean;
  /** Enter / leave member view. No-op without membership. */
  toggleMember: () => void;
  /** Enter member view without opening the mint panel (for member pages). */
  enterMemberView: () => void;
  /** Whether the membership panel is currently shown. */
  panelOpen: boolean;
  closePanel: () => void;
  /** Re-open the panel (enters member view). No-op without membership. */
  openPanel: () => void;
  /** Rose id pre-selected for minting (from a rose detail page), or null. */
  mintTargetRoseId: string | null;
  /** Open the panel for a specific rose. No-op without membership. */
  openMint: (roseId: string) => void;
  clearMintTarget: () => void;
  /**
   * Address of the *connected signing session*, or null. Distinct from
   * `memberAddress`: a member who reloads has an address on the server but no
   * signing session until the wallet reconnects silently.
   */
  walletAddress: string | null;
  signTransaction: SignTransactionFn | null;
  connectError: string | null;
  /** Installed Solana wallets, for the chooser. */
  solanaWallets: SolanaWalletOption[];
  /**
   * Wallet login / registration — the membership entry point. Signs a
   * server-issued challenge (no transaction, no fee) and stores the JWT.
   * Returns true on success; the error is also kept in `connectError`.
   */
  loginWithWallet: (walletName?: string) => Promise<boolean>;
  loggingIn: boolean;
  /** Connect a wallet session only (for signing txs). Does not log in. */
  connectWallet: (walletName?: string) => Promise<void>;
  /** Drop the signing session. Membership itself stays bound to the account. */
  disconnectWallet: () => void;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

/**
 * The wallet the user last connected by choice. Stored only so we can silently
 * reconnect on a later visit; it is NOT a permission boundary and never causes
 * a wallet popup on its own. Signing out clears it.
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
  const [memberAddress, setMemberAddress] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mintTargetRoseId, setMintTargetRoseId] = useState<string | null>(null);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
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

  // Membership is read from the stored account (written by the server's
  // verify response). `auth-change` fires on login and logout, `storage`
  // covers a second tab — without both, one tab could keep showing member UI
  // after the other signed out.
  useEffect(() => {
    const sync = () => {
      const user = getUser();
      setMemberAddress(user?.wallet_address ?? null);
      setMemberSince(user?.member_since ?? null);
      if (!user?.wallet_address) {
        setIsMember(false);
        setPanelOpen(false);
        setMintTargetRoseId(null);
      }
      if (!user) {
        // Signing capability must never outlive the account that owns it.
        setSession(null);
      }
    };
    sync();
    window.addEventListener("auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const loginWithWallet = useCallback(async (walletName?: string) => {
    setConnectError(null);
    if (typeof window === "undefined") return false;
    setLoggingIn(true);
    try {
      // 1. Connect so the wallet exposes its account + signMessage.
      const next = await connectSolanaWallet(walletName);
      // 2. Ask the backend for a one-time message.
      const challenge = await requestWalletChallenge(next.address);
      // 3. Sign the exact message (ed25519, no transaction, no fee).
      const signatureBytes = await next.signMessage(
        new TextEncoder().encode(challenge.message),
      );
      // 4. Verify server-side; this either logs in or binds to the current
      //    account (the request carries the existing token when present).
      const auth = await verifyWalletLogin({
        walletAddress: next.address,
        nonce: challenge.nonce,
        signature: encodeBase58(signatureBytes),
      });

      setToken(auth.access_token);
      setRefreshToken(auth.refresh_token);
      setUser(auth.user);
      setSession(next);
      setMemberAddress(auth.user.wallet_address ?? next.address);
      setMemberSince(auth.user.member_since ?? null);
      setIsMember(true);
      setPanelOpen(false);
      autoReconnectDone.current = true;
      if (walletName) rememberLastWallet(walletName);
      window.dispatchEvent(new Event("auth-change"));
      return true;
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "钱包登录失败");
      return false;
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const connectWallet = useCallback(async (walletName?: string) => {
    setConnectError(null);
    if (typeof window === "undefined") return;
    try {
      const next = await connectSolanaWallet(walletName);
      setSession(next);
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
  }, [session]);

  // Silent reconnect for members in member view: restores the *signing*
  // session after a reload without any popup. Membership itself already comes
  // from the account, so a rejection here only means "cannot sign yet".
  useEffect(() => {
    if (!isMember || !memberAddress || session || autoReconnectDone.current) return;
    const last = readLastWallet();
    if (!last || !solanaWallets.some((w) => w.name === last)) return;

    autoReconnectDone.current = true;
    connectSolanaWallet(last, { silent: true })
      .then((next) => setSession(next))
      .catch(() => {
        /* never-approved or rejected — stay quiet */
      });
  }, [isMember, memberAddress, session, solanaWallets]);

  const toggleMember = useCallback(() => {
    if (!memberAddress) {
      setConnectError("请先登录并绑定钱包，开通会员");
      return;
    }
    const next = !isMember;
    setIsMember(next);
    setPanelOpen(next);
    if (!next) setMintTargetRoseId(null);
  }, [isMember, memberAddress]);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const enterMemberView = useCallback(() => {
    if (!memberAddress) return;
    setIsMember(true);
    setPanelOpen(false);
  }, [memberAddress]);

  const openPanel = useCallback(() => {
    if (!memberAddress) return;
    setMintTargetRoseId(null);
    setPanelOpen(true);
    setIsMember(true);
  }, [memberAddress]);

  const openMint = useCallback((roseId: string) => {
    if (!memberAddress) return;
    setMintTargetRoseId(roseId);
    setPanelOpen(true);
    setIsMember(true);
  }, [memberAddress]);

  const clearMintTarget = useCallback(() => setMintTargetRoseId(null), []);

  const value = useMemo<MembershipContextValue>(
    () => ({
      hasMembership: Boolean(memberAddress),
      memberAddress,
      memberSince,
      isMember,
      toggleMember,
      enterMemberView,
      panelOpen,
      closePanel,
      openPanel,
      mintTargetRoseId,
      openMint,
      clearMintTarget,
      walletAddress: session?.address ?? null,
      signTransaction: session?.signTransaction ?? null,
      connectError,
      solanaWallets,
      loginWithWallet,
      loggingIn,
      connectWallet,
      disconnectWallet,
    }),
    [
      memberAddress,
      memberSince,
      isMember,
      toggleMember,
      enterMemberView,
      panelOpen,
      closePanel,
      openPanel,
      mintTargetRoseId,
      openMint,
      clearMintTarget,
      session,
      connectError,
      solanaWallets,
      loginWithWallet,
      loggingIn,
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
