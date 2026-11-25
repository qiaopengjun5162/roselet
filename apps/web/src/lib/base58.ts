/**
 * Minimal base58 encoder (Bitcoin/Solana alphabet).
 *
 * Wallet Standard returns signatures as `Uint8Array`; the SIWS verify endpoint
 * takes base58. `@solana/kit` ships a codec, but pulling the whole kit into the
 * membership context for 64 bytes is not worth the bundle weight, and a naive
 * encoder that ignores leading zero bytes produces a signature with the wrong
 * length roughly once every 256 logins. This one preserves them.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;

  let value = 0n;
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte);
  }

  let encoded = "";
  while (value > 0n) {
    encoded = ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }

  return "1".repeat(zeros) + encoded;
}
