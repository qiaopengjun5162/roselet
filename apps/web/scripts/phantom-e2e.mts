/**
 * End-to-end check of the real Solana wallet flow in a real browser.
 *
 * Goal: prove the full path — open the app, connect a Wallet Standard wallet
 * (Phantom, or a local fake extension for CI), sign a Memo transaction in the
 * browser, broadcast it to Devnet, and verify on-chain — works end to end.
 *
 * Two modes:
 *   • Real Phantom (default when detected): loads the installed Phantom
 *     extension. You must approve the connect + transaction popups yourself.
 *   • Fake wallet (--fake-wallet or when Phantom is not found): injects
 *     scripts/fake-phantom-extension/content.js into the page MAIN world via
 *     addInitScript. It registers the same Wallet Standard wallet and signs
 *     with a real (fixed) WebCrypto Ed25519 key. No popups, fully automated.
 *     --load-extension proved unreliable across Playwright launch modes.
 *
 * Usage:
 *   pnpm verify:phantom:local                 # one-command: local chain + build + E2E
 *   pnpm verify:phantom                       # auto-detect Phantom, headed
 *   pnpm verify:phantom -- --fake-wallet
 *   pnpm verify:phantom -- --url http://localhost:3000
 *
 * Env:
 *   PHANTOM_EXTENSION_PATH  explicit Phantom extension directory
 *   E2E_PROXY               e.g. http://127.0.0.1:7890 (browser + node RPC)
 *   E2E_HEADLESS=1          force headless (--headless also works)
 *   ALLOW_MAINNET=1         required if NEXT_PUBLIC_SOLANA_RPC_URL is mainnet
 *
 * A mainnet RPC without ALLOW_MAINNET=1 is refused — this test spends SOL.
 */
import { chromium, type Browser, type Page } from "playwright";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PHANTOM_ID = "bfnaelmomeimhlpmgjnjophhpkkoljpa";

function log(...args: unknown[]) {
  console.log("[phantom-e2e]", ...args);
}

interface Opts {
  fakeWallet: boolean;
  url: string;
  roseId: string;
  message: string;
  verify: boolean;
  headless: boolean;
}

function parseArgs(argv: string[]): Opts {
  let fakeWallet = false;
  let headlessFromFlag = false;
  let headlessFlagSet = false;
  const headlessFromEnv = process.env.E2E_HEADLESS === "1";
  const opts: Opts = {
    fakeWallet: false,
    url: process.env.E2E_URL || "http://localhost:3000",
    roseId: crypto.randomUUID(),
    message: "E2E 自动验证 · roselet",
    verify: true,
    headless: false,
  };
  for (const a of argv) {
    if (a === "--fake-wallet") fakeWallet = true;
    else if (a === "--no-verify") opts.verify = false;
    else if (a === "--headless") { headlessFromFlag = true; headlessFlagSet = true; }
    else if (a.startsWith("--url=")) opts.url = a.slice("--url=".length);
    else if (a.startsWith("--rose-id=")) opts.roseId = a.slice("--rose-id=".length);
    else if (a.startsWith("--message=")) opts.message = a.slice("--message=".length);
  }
  opts.fakeWallet = fakeWallet;
  // Fake mode runs headless by default (no popups, and headful clicks are
  // unreliable in headless sandboxes). Real Phantom needs a headed browser so
  // you can approve the connect / transaction popups. --headless overrides.
  opts.headless = headlessFlagSet
    ? headlessFromFlag
    : headlessFromEnv || fakeWallet;
  return opts;
}

function detectPhantomPath(): string | null {
  if (process.env.PHANTOM_EXTENSION_PATH) return process.env.PHANTOM_EXTENSION_PATH;
  const roots = [
    join(homedir(), "Library/Application Support/Google/Chrome"),
    join(homedir(), "Library/Application Support/BraveSoftware/Brave-Browser"),
    join(homedir(), "Library/Application Support/Arc"),
    join(homedir(), "Library/Application Support/Microsoft Edge"),
    join(homedir(), ".config/google-chrome"),
  ];
  for (const root of roots) {
    const base = join(root, "Default/Extensions", PHANTOM_ID);
    if (!existsSync(base)) continue;
    for (const ver of readdirSync(base)) {
      const dir = join(base, ver);
      if (existsSync(join(dir, "manifest.json"))) return dir;
    }
  }
  return null;
}

type SolanaRpcClient = ReturnType<typeof import("@solana/kit").createSolanaRpc>;
type FakeWalletWindow = Window & {
  __fakePhantomAddress?: string;
  __fakePhantomParse?: Record<string, unknown>;
  __fakePhantomSignature?: string;
};
type ParsedInstruction = { parsed?: unknown };
type OnChainTx = {
  meta?: { err?: unknown } | null;
  transaction?: {
    message?: {
      instructions?: ParsedInstruction[];
      accountKeys?: Array<{ pubkey?: string }>;
    } | null;
  } | null;
};

let rpcClientPromise: Promise<SolanaRpcClient> | null = null;
async function getRpc(): Promise<SolanaRpcClient> {
  if (!rpcClientPromise) {
    rpcClientPromise = (async () => {
      const proxy = process.env.E2E_PROXY;
      if (proxy) {
        const undici = await import("undici");
        const agent = new undici.ProxyAgent(proxy);
        const proxiedFetch = (input: unknown, init?: unknown) =>
          undici.fetch(input as string, {
            ...(init as object),
            dispatcher: agent,
          } as unknown as Parameters<typeof undici.fetch>[1]);
        globalThis.fetch = proxiedFetch as unknown as typeof globalThis.fetch;
      }
      const kit = await import("@solana/kit");
      return kit.createSolanaRpc(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
      );
    })();
  }
  return rpcClientPromise;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const fakeExtDir = join(process.cwd(), "scripts/fake-phantom-extension");
  const phantomPath = opts.fakeWallet ? null : detectPhantomPath();
  const useFake = opts.fakeWallet || !phantomPath;

  // In fake mode we inject the FakePhantom wallet into the page's MAIN world via
  // an init script instead of loading an MV3 extension: it registers the same
  // Wallet Standard wallet and signs with real WebCrypto, but addInitScript is
  // far more reliable across Playwright launch modes than --load-extension.
  let fakeSource: string | null = null;
  if (useFake) {
    fakeSource = readFileSync(join(fakeExtDir, "content.js"), "utf8");
    log(opts.fakeWallet ? "mode: fake wallet (injected, explicit)" : "Phantom not detected — injecting fake wallet");
  } else {
    log("mode: real Phantom at", phantomPath);
  }

  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
 if (!rpcUrl.includes("devnet") && process.env.ALLOW_MAINNET !== "1") {
    throw new Error(
      `Refusing to run against non-devnet RPC (${rpcUrl}). Set ALLOW_MAINNET=1 to override.`,
    );
  }

  const proxyArg = process.env.E2E_PROXY;
  const localRpc = /localhost|127\.0\.0\.1/.test(rpcUrl);
  const launchArgs = [
    // For a local solana-test-validator, force a direct connection: an OS
    // proxy (e.g. Clash) can break localhost requests in sandboxes. For real
    // Phantom against devnet/mainnet, leave the OS proxy alone (or use the
    // explicit E2E_PROXY) so public RPC hosts stay reachable.
    proxyArg
      ? `--proxy-server=${proxyArg}`
      : localRpc
        ? "--no-proxy-server"
        : "",
    // localhost must stay out of the proxy so the app itself is reachable.
    proxyArg ? "--proxy-bypass-list=localhost;127.0.0.1" : "",
    // Load the real Phantom extension only in real mode; fake mode uses injection.
    !useFake && phantomPath ? `--load-extension=${phantomPath}` : "",
    !useFake && phantomPath ? `--disable-extensions-except=${phantomPath}` : "",
  ].filter(Boolean);

  const browser: Browser = await chromium.launch({ headless: opts.headless, args: launchArgs });
  log("browser launched (headless=" + opts.headless + ")", useFake ? "fake wallet injected" : "real Phantom");

  const page: Page = await browser.newPage();
  if (fakeSource) await page.addInitScript({ content: fakeSource });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("requestfailed", (r) => {
    if (/\.js|_next|chunk|\/api\//.test(r.url())) {
      failedRequests.push(`${r.url()} :: ${r.failure()?.errorText ?? "failed"}`);
    }
  });
  const rpcResponses: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes(":8899")) {
      try {
        const body = await r.text();
        rpcResponses.push(`${r.status()} ${r.request().method()} ${body.slice(0, 240)}`);
      } catch {
        rpcResponses.push(`${r.status()} ${r.request().method()} (body unreadable)`);
      }
    }
  });

  try {
    log("navigating to", opts.url);
    const response = await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: 240_000 });
    log("navigation status:", response?.status() ?? "(none)");
    // Next dev compiles the route on the first request, so React hydration can
    // be far slower than on a warm server. A fixed sleep is not enough: retry
    // the click until the handler is attached and the panel actually rendered.
    await openMembershipPanel(page, { consoleErrors, pageErrors, failedRequests });
    await page.getByRole("button", { name: /连接钱包/ }).first().click();
    log("clicked 会员 → 连接钱包");

    await page.getByText(/钱包：/).waitFor({ timeout: 30_000 });
    const walletAddress = await page.evaluate(
      () => (window as FakeWalletWindow).__fakePhantomAddress ?? null,
    );
    log("wallet connected:", walletAddress ? walletAddress.slice(0, 8) + "…" : "(real Phantom)");

    if (useFake && walletAddress) await airdropIfNeeded(walletAddress);

    await page.getByPlaceholder(/550e8400/).fill(opts.roseId);
    await page.getByPlaceholder(/写一句想留在链上的话/).fill(opts.message);
    // The file input is also named "…上链…", so match the rocket button exactly.
    await page.getByRole("button", { name: /🚀\s*上链/ }).click();
    log("clicked 上链 — waiting for broadcast");

    // Do NOT gate on UI copy: success rendering depends on the backend save,
    // which is intentionally not running here, and failures render into a
    // red <p> whose text varies. The chain itself is the source of truth.
    await page.waitForTimeout(5_000);
    const panelText = await page.locator("body").innerText().catch(() => "");
    log("panel text tail:", panelText.slice(-700).replace(/\s+/g, " ") || "(empty)");
    const parse = await page
      .evaluate(() => (window as FakeWalletWindow).__fakePhantomParse ?? null)
      .catch(() => null);
    if (parse) log("fake wallet wire parse:", JSON.stringify(parse));
    log("RPC responses:", rpcResponses.slice(-8));
    if (consoleErrors.length) log("browser console errors:", consoleErrors.slice(0, 5));
    if (pageErrors.length) log("page errors:", pageErrors.slice(0, 5));
    if (failedRequests.length) log("failed requests:", failedRequests.slice(0, 5));

    // Discover the signature on-chain when we know the wallet (fake mode): this
    // works even if the backend save failed or is not running. Fall back to
    // scraping the UI for real Phantom, where the explorer link is rendered on
    // the success screen.
    let signature: string | null = await page
      .evaluate(() => (window as FakeWalletWindow).__fakePhantomSignature ?? null)
      .catch(() => null);
    if (signature) log("signature from wallet:", signature.slice(0, 16) + "…");
    if (!signature && walletAddress) {
      signature = await findSignatureByRoseId(opts, walletAddress);
      if (!signature) log("on-chain signature lookup found nothing yet");
    }
    if (!signature) signature = await extractSignature(page);
    if (!signature) {
      throw new Error("could not read the transaction signature (see panel text above)");
    }
    log("signature:", signature.slice(0, 16) + "…");

    if (opts.verify) await verifyOnChain(signature, opts, walletAddress);

    if (consoleErrors.length) log("browser console errors:", consoleErrors.slice(0, 5));
    console.log("\n✅ PHANTOM E2E PASSED");
  } finally {
    await browser.close();
  }
}

/**
 * Open the membership panel and wait until its connect button is visible.
 *
 * `openPanel()` is idempotent, so clicking the nav button repeatedly is safe —
 * which lets us tolerate slow hydration on a cold `next dev` compile. On total
 * failure we dump the page so a broken build / runtime error is diagnosable
 * instead of surfacing as a bare locator timeout.
 */
async function openMembershipPanel(
  page: Page,
  diagnostics: { consoleErrors: string[]; pageErrors: string[]; failedRequests: string[] },
) {
  const memberButton = page.getByRole("button", { name: /会员/ }).first();
  const connectButton = page.getByRole("button", { name: /连接钱包/ }).first();
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      await memberButton.click({ timeout: 10_000 });
    } catch (e) {
      log(`member button click failed (attempt ${attempt}):`, (e as Error).message.split("\n")[0]);
    }
    try {
      await connectButton.waitFor({ state: "visible", timeout: 6_000 });
      log("membership panel open after", attempt, "attempt(s)");
      return;
    } catch {
      log(`panel not visible yet (attempt ${attempt}); waiting for hydration…`);
      await page.waitForTimeout(2_000);
    }
  }
  const body = await page.locator("body").innerText().catch(() => "(unreadable)");
  const buttons = await page.getByRole("button").allInnerTexts().catch(() => []);
  const hydrated = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("会员"),
    );
    // React 18+ attaches __reactProps$* to hydrated DOM nodes.
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps$")));
  }).catch(() => "unknown");
  log("DIAGNOSTICS body:", body.slice(0, 900).replace(/\s+/g, " "));
  log("DIAGNOSTICS buttons:", buttons.slice(0, 30));
  log("DIAGNOSTICS hydrated (React props attached):", hydrated);
  log("DIAGNOSTICS page errors:", diagnostics.pageErrors.slice(0, 8));
  log("DIAGNOSTICS failed requests:", diagnostics.failedRequests.slice(0, 8));
  log("DIAGNOSTICS console errors:", diagnostics.consoleErrors.slice(0, 8));
  throw new Error("membership panel did not open after 15 attempts");
}

// `createSolanaRpc()` returns a union whose generic variant lacks
// `requestAirdrop` (kit puts it on the devnet/testnet-only APIs). The E2E only
// calls this as a best-effort top-up, so narrow it locally instead of weakening
// the whole client type.
type AirdropRpc = {
  requestAirdrop: (
    address: ReturnType<typeof import("@solana/kit").address>,
    lamports: bigint,
  ) => { send: () => Promise<unknown> };
};

async function airdropIfNeeded(address: string) {
  const kit = await import("@solana/kit");
  const rpc = (await getRpc()) as unknown as AirdropRpc;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const sig = await rpc.requestAirdrop(kit.address(address), 1_000_000_000n).send();
      log(`airdropped 1 SOL (attempt ${attempt}), sig`, String(sig).slice(0, 12) + "…");
      await new Promise((r) => setTimeout(r, 3_000));
      return;
    } catch (e) {
      log(`airdrop attempt ${attempt} failed:`, (e as Error).message);
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  log("airdrop gave up — wallet may be unfunded, broadcast may fail");
}

/**
 * When we know the wallet address (fake mode), find our memo transaction
 * directly on-chain by scanning the wallet's recent signatures and matching the
 * memo's `roseId`. This makes the E2E independent of the backend — the broadcast
 * already happened in the browser; we just locate it.
 */
async function findSignatureByRoseId(opts: Opts, wallet: string): Promise<string | null> {
  const kit = await import("@solana/kit");
  const rpc = await getRpc();
  const addr = kit.address(wallet);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const sigs = await rpc.getSignaturesForAddress(addr, { limit: 20 }).send();
      for (const entry of sigs) {
        try {
          const tx = (await rpc
            .getTransaction(kit.signature(String(entry.signature)), {
              encoding: "jsonParsed",
              maxSupportedTransactionVersion: 0,
            })
            .send()) as unknown as OnChainTx | null;
          if (!tx || tx.meta?.err) continue;
          const instructions = tx.transaction?.message?.instructions ?? [];
          const memoIx = instructions.find(
            (i) => typeof i.parsed === "string" && i.parsed.includes('"roseId"'),
          );
          if (!memoIx || typeof memoIx.parsed !== "string") continue;
          const parsed = JSON.parse(memoIx.parsed) as { app?: string; roseId?: string };
          if (parsed.app === "roselet" && parsed.roseId === opts.roseId) {
            return String(entry.signature);
          }
        } catch {
          /* tx not ready / parse miss — try next */
        }
      }
    } catch {
      /* not indexed yet */
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return null;
}

async function extractSignature(page: Page): Promise<string | null> {
  const text = await page.locator("pre").first().innerText().catch(() => "");
  const match = text.match(/tx\/([1-9A-HJ-NP-Za-km-z]+)/);
  return match ? match[1] : null;
}

async function verifyOnChain(signature: string, opts: Opts, wallet?: string | null) {
  const kit = await import("@solana/kit");
  const rpc = await getRpc();
  let tx: OnChainTx | null = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      tx = (await rpc
        .getTransaction(kit.signature(signature), {
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
        })
        .send()) as unknown as OnChainTx | null;
      if (tx) break;
    } catch {
      /* not found yet */
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  if (!tx) throw new Error("transaction not found on-chain after polling");
  if (tx.meta?.err) throw new Error("transaction failed on-chain: " + JSON.stringify(tx.meta.err));

  const instructions = tx.transaction?.message?.instructions ?? [];
  const memoIx = instructions.find(
    (i) => typeof i.parsed === "string" && /roseId/.test(i.parsed),
  );
  if (!memoIx || typeof memoIx.parsed !== "string") {
    throw new Error("no roselet memo instruction found on-chain");
  }
  const parsed = JSON.parse(memoIx.parsed) as { app?: string; roseId?: string };
  if (parsed.app !== "roselet") throw new Error(`unexpected app tag: ${parsed.app}`);
  if (parsed.roseId !== opts.roseId) {
    throw new Error(`roseId mismatch: ${parsed.roseId} != ${opts.roseId}`);
  }
  if (wallet) {
    const feePayer = tx.transaction?.message?.accountKeys?.[0]?.pubkey;
    if (feePayer && feePayer !== wallet) {
      throw new Error(`fee payer ${feePayer} != connected wallet ${wallet}`);
    }
  }
  log("on-chain verify OK: app=roselet, roseId match, no error");
}

main().catch((err) => {
  console.error("\n❌ PHANTOM E2E FAILED:", err?.message ?? err);
  process.exit(1);
});
