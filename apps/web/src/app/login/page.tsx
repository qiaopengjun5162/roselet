"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getUser,
  register,
  setToken,
  setRefreshToken,
  setUser,
  type User,
} from "@/lib/api";
import { registerErrorMessage } from "@/lib/auth-errors";
import { TipTicker } from "@/components/tip-ticker";
import { WalletPicker } from "@/components/wallet-picker";
import { toWalletOptions } from "@/lib/wallet-chains";
import { useOptionalMembership } from "@/app/membership-context";

type Mode = "nickname" | "wallet";

function WalletLoginOptions({
  onPick,
  busy,
}: {
  onPick: (name: string) => void;
  busy: boolean;
}) {
  const membership = useOptionalMembership();
  return (
    <WalletPicker
      wallets={toWalletOptions(membership?.solanaWallets ?? [])}
      busy={busy}
      busyLabel="等待钱包签名…"
      actionLabel={(wallet) => `连接 ${wallet.name} 并登录`}
      onPick={(wallet) => onPick(wallet.name)}
    />
  );
}

function LoginForm() {
  const [mode, setMode] = useState<Mode>("nickname");
  const [nickname, setNickname] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const membership = useOptionalMembership();

  useEffect(() => {
    setCurrentUser(getUser());
    if (searchParams.get("mode") === "wallet") setMode("wallet");
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await register(nickname.trim(), passphrase || undefined);
      setToken(res.access_token);
      setRefreshToken(res.refresh_token);
      setUser(res.user);
      window.dispatchEvent(new Event("auth-change"));
      router.push(redirect || "/garden");
    } catch (err) {
      setError(registerErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleWalletLogin(walletName: string) {
    if (!membership) {
      setError("会员功能暂不可用，请刷新页面重试");
      return;
    }
    setError("");
    const ok = await membership.loginWithWallet(walletName);
    if (ok) {
      router.push(redirect || "/membership");
    }
  }

  const walletBusy = Boolean(membership?.loggingIn);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">
          {mode === "wallet" ? "钱包登录 · 会员" : "给自己取个名字"}
        </h1>
        <p className="text-muted-foreground text-center mb-5">
          {mode === "wallet"
            ? "连接钱包并签名即可登录；签名不发起交易，不花手续费"
            : "起个昵称就能开始种花，已有昵称直接进入；注销后 30 天内也能用原昵称恢复"}
        </p>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "nickname"}
            onClick={() => setMode("nickname")}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              mode === "nickname"
                ? "bg-rose-500/20 text-rose-200 font-medium"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            昵称进入
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "wallet"}
            onClick={() => setMode("wallet")}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              mode === "wallet"
                ? "bg-violet-500/20 text-violet-200 font-medium"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            钱包登录 · 会员
          </button>
        </div>

        {mode === "nickname" ? (
          <>
            <div className="mb-5">
              <TipTicker context="login" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="你想叫什么名字？"
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  autoFocus
                />
              </div>
              <div>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="密码（可选，设了更安全）"
                  maxLength={100}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading || !nickname.trim()}
                className="w-full py-3 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "准备中..." : "继续种花"}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-3 text-xs leading-relaxed text-violet-100">
              {membership?.hasMembership ? (
                <p>
                  当前账号已绑定会员钱包{" "}
                  <span className="font-mono">
                    {membership.memberAddress?.slice(0, 6)}…
                    {membership.memberAddress?.slice(-4)}
                  </span>
                  。重新连接只恢复签名能力，不会重复开通。
                </p>
              ) : currentUser ? (
                <p>
                  当前已登录为 <span className="font-medium">{currentUser.nickname}</span>
                  。连接钱包会把钱包绑定到这个账号，并开通会员。
                </p>
              ) : (
                <p>
                  没有账号也可以：首次连接会自动创建一个账号（昵称可稍后修改），
                  之后用同一个钱包即可登录。
                </p>
              )}
            </div>

            <WalletLoginOptions onPick={handleWalletLogin} busy={walletBusy} />

            {(membership?.connectError || error) && (
              <p className="text-sm text-red-500 text-center">
                {membership?.connectError || error}
              </p>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              签名内容由 Roselet 服务端生成，只用于证明你拥有这个钱包；
              不包含转账、授权或任何链上操作。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
