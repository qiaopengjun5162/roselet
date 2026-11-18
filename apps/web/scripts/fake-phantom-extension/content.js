/**
 * FakePhantom — a minimal Wallet Standard wallet for the Roselet E2E test.
 *
 * Runs in the page MAIN world (so the registered wallet object is directly
 * callable by the app, exactly like Phantom's injected script). It imports a
 * FIXED test Ed25519 key (PKCS#8, no real funds) with WebCrypto, signs
 * transactions for real, then inserts the signature at its own account index.
 * The fixed address lets the harness pre-fund it once on a local validator.
 * This exercises the full "wallet partially signs a wire transaction ->
 * broadcast -> on-chain verify" path without a real extension or approvals.
 *
 * It can be loaded as an MV3 extension (manifest.json) or injected by the E2E
 * harness with page.addInitScript. Exposes:
 *   __fakePhantomAddress   — funding target
 *   __fakePhantomSignature — base58 signature produced for the last tx
 *   __fakePhantomParse     — wire-format diagnostics
 */
(() => {
  "use strict";

  const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  function base58Encode(bytes) {
    let value = 0n;
    for (const b of bytes) value = (value << 8n) | BigInt(b);
    let out = "";
    while (value > 0n) {
      out = BASE58[Number(value % 58n)] + out;
      value /= 58n;
    }
    for (const b of bytes) {
      if (b !== 0) break;
      out = "1" + out;
    }
    return out;
  }

  // Compact-u16 (Solana / borsh varint). Returns the value and its byte length.
  function readCompactU16(buf, offset) {
    let value = 0;
    let len = 0;
    for (;;) {
      const byte = buf[offset + len];
      value |= (byte & 0x7f) << (7 * len);
      len += 1;
      if ((byte & 0x80) === 0) break;
    }
    return { value, len };
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  async function main() {
    // A fixed TEST keypair (devnet / local-validator SOL only — no real funds).
    //
    // WebCrypto can only import an Ed25519 *public* key from "raw"; a raw
    // 32-byte seed is not a valid private-key encoding. The earlier version
    // used importKey("raw", SEED, ...) which always threw and silently fell
    // back to a random key, so the pre-funded address never matched. Wrap the
    // seed in a PKCS#8 PrivateKeyInfo envelope instead, and embed the matching
    // public key verbatim (WebCrypto has no Ed25519 derivePublicKey()).
    const SEED = new Uint8Array([
      25, 136, 216, 245, 155, 38, 223, 16, 85, 7, 97, 95, 62, 220, 138, 156,
      131, 148, 48, 239, 46, 101, 162, 255, 112, 221, 145, 27, 198, 235, 53, 2,
    ]);
    const rawPublic = new Uint8Array([
      22, 141, 200, 75, 87, 215, 218, 198, 25, 31, 166, 241, 0, 250, 108, 134,
      155, 64, 151, 187, 168, 225, 36, 59, 213, 184, 27, 234, 192, 16, 85, 242,
    ]);
    // DER: SEQ(46) { INT 0, SEQ(5){OID 1.3.101.112}, OCTET STRING(34){OCTET STRING(32)} }
    const PKCS8_PREFIX = new Uint8Array([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22, 0x04, 0x20,
    ]);
    const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + SEED.length);
    pkcs8.set(PKCS8_PREFIX, 0);
    pkcs8.set(SEED, PKCS8_PREFIX.length);

    let privateKey;
    let address = base58Encode(rawPublic);
    try {
      privateKey = await crypto.subtle.importKey(
        "pkcs8",
        pkcs8,
        { name: "Ed25519" },
        false,
        ["sign"],
      );
    } catch (e) {
      // Last-resort fallback. The E2E harness airdrops whatever address the
      // wallet reports, so a random key still works — just not deterministically.
      console.warn("[FakePhantom] PKCS#8 import failed, using a random key", e);
      const kp = await crypto.subtle.generateKey(
        { name: "Ed25519" },
        true,
        ["sign", "verify"],
      );
      privateKey = kp.privateKey;
      rawPublic.set(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
      address = base58Encode(rawPublic);
    }
    // The harness reads this to airdrop SOL before minting.
    window.__fakePhantomAddress = address;
    window.__fakePhantomPublicKey = rawPublic;

    async function signTransactionInput(input) {
      const tx = input.transaction;
      // Solana wire format (legacy AND v0) is:
      //   compact-u16 signature count | signatures (64B each) | message
      // The 0x80|version prefix belongs to the START OF THE MESSAGE, not to
      // byte 0 of the transaction. Treating tx[0] as a version byte shifts
      // every offset by 64 bytes and makes the fee payer undiscoverable.
      const sigCount = readCompactU16(tx, 0);
      const sigStart = sigCount.len;
      const sigRegionLen = sigCount.value * 64;
      const messageBytes = tx.subarray(sigStart + sigRegionLen);

      // message = [0x80 version prefix?] + header(3) + compact-u16 account
      // count + account keys (32B each) + blockhash + instructions + ...
      const messageVersioned = (messageBytes[0] & 0x80) !== 0;
      const headerOffset = messageVersioned ? 1 : 0;
      const accCount = readCompactU16(messageBytes, headerOffset + 3);
      const accStart = headerOffset + 3 + accCount.len;
      // Expose the parse so the E2E harness can diagnose a missing signature.
      window.__fakePhantomParse = {
        wireLen: tx.length,
        wireHead: Array.from(tx.subarray(0, 8)),
        messageVersioned,
        headerOffset,
        sigCount: sigCount.value,
        sigLen: sigCount.len,
        sigStart,
        sigRegionLen,
        msgHead: Array.from(messageBytes.subarray(0, 12)),
        accCount: accCount.value,
        accLen: accCount.len,
        accStart,
        rawPublicHead: Array.from(rawPublic.subarray(0, 8)),
        firstAccountHead: Array.from(messageBytes.subarray(accStart, accStart + 8)),
      };
      let myIndex = -1;
      for (let i = 0; i < accCount.value; i += 1) {
        const key = messageBytes.subarray(
          accStart + i * 32,
          accStart + i * 32 + 32,
        );
        if (sameBytes(key, rawPublic)) {
          myIndex = i;
          break;
        }
      }
      // Not a required signer (e.g. a read-only account) — return untouched.
      window.__fakePhantomParse.myIndex = myIndex;
      if (myIndex < 0) return { signedTransaction: tx };

      const signature = new Uint8Array(
        await crypto.subtle.sign("Ed25519", privateKey, messageBytes),
      );
      // A Solana transaction signature IS the Ed25519 signature over the
      // message. Expose it so the harness can look the tx up directly instead
      // of polling getSignaturesForAddress (which needs backend indexing).
      window.__fakePhantomSignature = base58Encode(signature);
      const newSigs = new Uint8Array(sigRegionLen);
      newSigs.set(tx.subarray(sigStart, sigStart + sigRegionLen));
      newSigs.set(signature, myIndex * 64);

      const out = new Uint8Array(tx.length);
      out.set(tx.subarray(0, sigStart));
      out.set(newSigs, sigStart);
      out.set(messageBytes, sigStart + sigRegionLen);
      return { signedTransaction: out };
    }

    const account = {
      address,
      publicKey: rawPublic,
      chains: ["solana:devnet", "solana:mainnet"],
      features: [],
    };

    const wallet = {
      version: "1.0.0",
      name: "FakePhantom",
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
      chains: ["solana:devnet", "solana:mainnet"],
      accounts: [account],
      features: {
        "standard:connect": {
          version: "1.0.0",
          connect: async () => ({ accounts: [account] }),
        },
        "solana:signTransaction": {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: async (...inputs) => {
            const out = [];
            for (const i of inputs) out.push(await signTransactionInput(i));
            return out;
          },
        },
        "standard:disconnect": {
          version: "1.0.0",
          disconnect: async () => {},
        },
      },
    };

    window.addEventListener("wallet-standard:app-ready", (event) => {
      const api = event.detail;
      if (api && typeof api.register === "function") api.register(wallet);
    });
    // Nudge the registry in case it was already listening.
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready"));
  }

  main().catch((err) => {
    // Surface failures in the page console for the harness to capture.
    console.error("[FakePhantom] init failed", err);
  });
})();
