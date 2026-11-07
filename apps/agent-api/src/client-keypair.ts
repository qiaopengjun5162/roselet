export function parseKeypairBytes(value: unknown): Uint8Array {
  if (!Array.isArray(value) || value.length !== 64) {
    throw new Error("Solana keypair file must contain 64 bytes");
  }
  if (!value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    throw new Error("Solana keypair file contains an invalid byte");
  }
  return Uint8Array.from(value);
}
