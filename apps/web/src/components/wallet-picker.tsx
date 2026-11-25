"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  ALEO_WALLET_OPTIONS,
  INSTALL_LINKS,
  WALLET_CHAINS,
  type WalletChainMeta,
  type WalletOption,
} from "@/lib/wallet-chains";

export interface WalletPickerProps {
  /** Wallets detected in this browser, already tagged with their chain. */
  wallets: WalletOption[];
  /**
   * Also render chains whose provider lives on another page (Aleo). Off by
   * default so single-chain surfaces — the mint panel — stay focused.
   */
  showExternal?: boolean;
  /** Signing / connecting in progress: every row is disabled. */
  busy?: boolean;
  /** Row text while `busy`. Defaults to the wallet name. */
  busyLabel?: string;
  /** Row label, e.g. `连接 Phantom 并登录`. */
  actionLabel: (wallet: WalletOption) => string;
  onPick: (wallet: WalletOption) => void;
  /**
   * Overrides where an `external` chain row goes. Callers use this to route
   * through their own gates (e.g. send logged-out users to /membership first
   * instead of straight into the Vault page).
   */
  onExternal?: (wallet: WalletOption) => void;
  /** Denser rows, for panels. */
  compact?: boolean;
  className?: string;
}

function InstallLinks({ chain }: { chain: WalletChainMeta }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 px-3 py-2.5 text-xs text-slate-400">
      <p>未检测到 {chain.label} 钱包，先安装一个再回来：</p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {INSTALL_LINKS[chain.id].map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="text-violet-300 hover:underline"
          >
            {link.name} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

function WalletIcon({ wallet }: { wallet: WalletOption }) {
  if (wallet.icon) {
    return (
      // Wallet Standard hands us a data: URI; next/image cannot optimise it.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={wallet.icon} alt="" className="size-5 rounded-sm" />
    );
  }
  return (
    <span aria-hidden="true" className="grid size-5 place-items-center rounded-sm bg-white/10 text-[11px]">
      🔌
    </span>
  );
}

/**
 * The one wallet chooser in the app.
 *
 * Renders the chain registry grouped by chain: Solana wallets that can connect
 * right here, and (optionally) Aleo, which links to the page that owns its
 * provider. All four former call sites go through this component, so the list
 * of wallets and the install hints can no longer drift apart.
 */
export function WalletPicker({
  wallets,
  showExternal = false,
  busy = false,
  busyLabel,
  actionLabel,
  onPick,
  onExternal,
  compact = false,
  className,
}: WalletPickerProps) {
  return (
    <div className={cn("space-y-4", className)} data-testid="wallet-picker">
      {WALLET_CHAINS.filter((chain) => chain.mode !== "external" || showExternal).map((chain) => {
        const inline = chain.mode === "inline"
          ? wallets.filter((wallet) => wallet.chain === chain.id)
          : [];
        const external =
          showExternal && chain.mode === "external" ? ALEO_WALLET_OPTIONS : [];

        return (
          <section key={chain.id} aria-label={`${chain.label} 钱包`}>
            <header className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="text-xs font-medium text-slate-200">{chain.label}</h3>
              <p className="text-[11px] text-slate-500">{chain.purpose}</p>
            </header>

            <div className="space-y-2">
              {inline.length > 1 && (
                <p className="text-[11px] text-slate-500">
                  检测到 {inline.length} 个钱包，选一个：
                </p>
              )}

              {inline.map((wallet) => (
                <button
                  key={wallet.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(wallet)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
                    compact ? "py-2" : "py-3",
                  )}
                >
                  <WalletIcon wallet={wallet} />
                  <span className="truncate">
                    {busy ? (busyLabel ?? "等待钱包…") : actionLabel(wallet)}
                  </span>
                </button>
              ))}

              {external.map((wallet) => {
                const label = actionLabel(wallet);
                const rowClass = cn(
                  "flex w-full items-center gap-2 rounded-lg border border-violet-400/30 px-4 text-sm text-violet-100 transition-colors hover:bg-violet-500/10",
                  compact ? "py-2" : "py-3",
                );
                return onExternal ? (
                  <button
                    key={wallet.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onExternal(wallet)}
                    className={cn(rowClass, "text-left disabled:opacity-50")}
                  >
                    <WalletIcon wallet={wallet} />
                    <span className="truncate">{label}</span>
                  </button>
                ) : (
                  <Link
                    key={wallet.id}
                    href={chain.href ?? "/"}
                    className={rowClass}
                  >
                    <WalletIcon wallet={wallet} />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}

              {chain.mode === "inline" && inline.length === 0 && <InstallLinks chain={chain} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
