#!/usr/bin/env node
/**
 * Acceptance for the *browser* half of wallet login, without a wallet extension.
 *
 *   node scripts/wallet-login-e2e.mjs [baseUrl]
 *
 * A real browser, a real server challenge, real ed25519 signing: the script
 * generates a throwaway keypair, injects a Wallet Standard wallet backed by
 * WebCrypto, then drives `/login` like a user would.
 *
 * Why this exists: unit tests mock `signMessage`, and backend tests call the
 * API directly, so neither proves the pieces are wired together — the tab
 * opens, the challenge is fetched, the signature is base58-encoded, the token
 * is stored, the member centre flips to "bound", and a reload keeps it.
 *
 * The account it creates is soft-deleted at the end. Pass `--keep` to leave it
 * in place when debugging.
 *
 * Run it with the proxy environment cleared:
 *
 *   env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
 *     node scripts/wallet-login-e2e.mjs
 *
 * Chromium inherits those variables, and a local proxy answers this host with
 * intermittent 502s — which looks exactly like a broken deployment (blank
 * page, no React, no wallet). `curl --noproxy '*'` does not, which is the tell.
 */
import crypto from "node:crypto";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const BASE = (args.find((a) => !a.startsWith("--")) || process.env.SMOKE_BASE || "http://47.131.238.0").replace(/\/$/, "");

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }
  return "1".repeat(zeros) + out;
}

const failures = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const rawPublicKey = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
const address = base58(rawPublicKey);
console.log(`wallet: ${address}\nbase:   ${BASE}\n`);

const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

await ctx.addInitScript(
  ({ address, publicKeyB64 }) => {
    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    // Lets the test wait for hydration: the app-ready event only fires once
    // React has mounted the membership provider.
    window.__walletRegistered = false;
    const account = {
      address,
      publicKey: fromB64(publicKeyB64),
      chains: ["solana:devnet"],
    };
    const wallet = {
      version: "1.0.0",
      name: "E2EWallet",
      chains: ["solana:devnet"],
      accounts: [account],
      features: {
        "standard:connect": {
          version: "1.0.0",
          connect: async () => ({ accounts: [account] }),
        },
        "standard:disconnect": { version: "1.0.0", disconnect: async () => {} },
        // Required by the session even for login-only flows.
        "solana:signTransaction": {
          version: "1.0.0",
          signTransaction: async ({ transaction }) => [
            { signedTransaction: transaction },
          ],
        },
        // Signing is delegated to Node: `crypto.subtle` is unavailable on a
        // plain-HTTP origin, and real wallets sign inside their own extension
        // rather than in the page, so this keeps the harness honest.
        "solana:signMessage": {
          version: "1.0.0",
          signMessage: async ({ message }) => {
            const b64 = btoa(String.fromCharCode(...message));
            const signature = await window.__e2eSign(b64);
            return [{ signature: fromB64(signature), signedMessage: message }];
          },
        },
      },
    };
    window.addEventListener("wallet-standard:app-ready", (event) => {
      window.__walletRegistered = true;
      event.detail.register(wallet);
    });
  },
  { address, publicKeyB64: Buffer.from(rawPublicKey).toString("base64") },
);

const page = await ctx.newPage();
await page.exposeFunction("__e2eSign", (messageB64) =>
  crypto
    .sign(null, Buffer.from(messageB64, "base64"), privateKey)
    .toString("base64"),
);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

try {
  // The box occasionally answers a chunk with 502 for a few seconds after a
  // deploy; that yields an error page with no React at all, so check the
  // status instead of waiting 45s for a flag that will never flip.
  let response = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    response = await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    if (response?.ok()) break;
    console.log(`  … /login returned ${response?.status()}, retrying (${attempt}/3)`);
    await page.waitForTimeout(3000);
  }
  check("/login responds 200", Boolean(response?.ok()), `status ${response?.status()}`);

  // The form must be in the served HTML, not only after hydration.
  const html = await (await fetch(`${BASE}/login`)).text();
  check("login form is server-rendered", html.includes("给自己取个名字"));

  // The two modes are a tab list, not plain buttons.
  // Static HTML paints long before hydration; clicking earlier is a no-op.
  await page.waitForFunction(() => window.__walletRegistered === true, null, {
    timeout: 45000,
  });

  const walletTab = page.getByRole("tab", { name: "钱包登录 · 会员" });
  await walletTab.waitFor({ timeout: 20000 });
  await walletTab.click();

  const walletButton = page.getByRole("button", { name: /E2EWallet/ }).first();
  await walletButton.waitFor({ timeout: 10000 });
  await walletButton.click();

  const apiCalls = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/auth/wallet/")) apiCalls.push(`${r.status()} ${r.url().split("/api")[1]}`);
  });

  try {
    await page.waitForURL(/\/membership/, { timeout: 30000 });
  } catch (error) {
    // Surface what the user would see, instead of a bare navigation timeout.
    const text = ((await page.textContent("body")) || "").replace(/\s+/g, " ");
    console.error(`  … stayed on ${new URL(page.url()).pathname}`);
    console.error(`  … wallet API: ${apiCalls.join(", ") || "no calls"}`);
    console.error(`  … page said: ${text.slice(-240)}`);
    throw error;
  }
  await page.waitForTimeout(800);

  const stored = await page.evaluate(() => ({
    token: Boolean(localStorage.getItem("access_token")),
    user: JSON.parse(localStorage.getItem("user") || "null"),
  }));
  check("token stored", stored.token);
  check("wallet bound to the account", stored.user?.wallet_address === address);
  check("member_since set", Boolean(stored.user?.member_since));

  const body = (await page.textContent("body")) ?? "";
  check("member centre shows the bound wallet", body.includes(address.slice(0, 6)));
  check("member centre no longer asks to bind", !body.includes("先登录，再开通会员"));

  await page.reload({ waitUntil: "domcontentloaded" });
  const afterReload = await page.evaluate(
    () => JSON.parse(localStorage.getItem("user") || "null")?.wallet_address,
  );
  check("membership survives a reload", afterReload === address);

  await page.goto(`${BASE}/private-vault`, { waitUntil: "domcontentloaded" });
  const vault = (await page.textContent("body")) ?? "";
  check("member reaches the vault instead of the gate", !vault.includes("只在会员版开放"));

  check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));

  if (!keep) {
    const token = await page.evaluate(() => localStorage.getItem("access_token"));
    const res = await fetch(`${BASE}/api/auth/deactivate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "wallet-login e2e" }),
    });
    check("test account cleaned up", res.status === 200, `status ${res.status}`);
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall checks passed");
