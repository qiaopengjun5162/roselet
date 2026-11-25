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
 * in place when debugging. Needs playwright at the repo root and, on a machine
 * behind a proxy, `--no-proxy-server` applies to the browser itself.
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
const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" });
const address = base58(rawPublicKey);
console.log(`wallet: ${address}\nbase:   ${BASE}\n`);

const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

await ctx.addInitScript(
  ({ pkcs8B64, address, publicKeyB64 }) => {
    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
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
        "solana:signMessage": {
          version: "1.0.0",
          signMessage: async ({ message }) => {
            const key = await crypto.subtle.importKey(
              "pkcs8",
              fromB64(pkcs8B64),
              { name: "Ed25519" },
              false,
              ["sign"],
            );
            const signature = await crypto.subtle.sign(
              { name: "Ed25519" },
              key,
              message,
            );
            return [
              { signature: new Uint8Array(signature), signedMessage: message },
            ];
          },
        },
      },
    };
    window.addEventListener("wallet-standard:app-ready", (event) => {
      event.detail.register(wallet);
    });
  },
  {
    pkcs8B64: Buffer.from(pkcs8).toString("base64"),
    address,
    publicKeyB64: Buffer.from(rawPublicKey).toString("base64"),
  },
);

const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

  // The form must be in the served HTML, not only after hydration.
  const html = await (await fetch(`${BASE}/login`)).text();
  check("login form is server-rendered", html.includes("给自己取个名字"));

  const walletTab = page.getByRole("button", { name: "钱包登录 · 会员" });
  await walletTab.waitFor({ timeout: 20000 });
  await walletTab.click();

  const walletButton = page.getByRole("button", { name: /E2EWallet/ }).first();
  await walletButton.waitFor({ timeout: 10000 });
  await walletButton.click();

  await page.waitForURL(/\/membership/, { timeout: 30000 });
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
