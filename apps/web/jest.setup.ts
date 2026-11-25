import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

// jsdom does not ship TextEncoder/TextDecoder. Wallet login encodes the
// challenge message with TextEncoder (as browsers do), so polyfill the globals
// instead of weakening production code for the test environment.
if (typeof globalThis.TextEncoder === "undefined") {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}
