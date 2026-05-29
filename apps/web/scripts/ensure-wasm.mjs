import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(__dirname, "..", "public", "pkg");
const jsFile = join(pkgDir, "roselet_recommend.js");
const dtsFile = join(pkgDir, "roselet_recommend.d.ts");
const bgDtsFile = join(pkgDir, "roselet_recommend_bg.wasm.d.ts");

if (!existsSync(jsFile)) {
  mkdirSync(pkgDir, { recursive: true });

  writeFileSync(
    jsFile,
    `export default function init() { return Promise.resolve(); }
export function recommend() { return null; }
`
  );

  writeFileSync(
    dtsFile,
    `export default function init(): Promise<void>;
export function recommend(roses_json: string): unknown;
`
  );

  writeFileSync(
    bgDtsFile,
    `export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export interface InitOutput {}
export default function init(input?: InitInput): Promise<InitOutput>;
`
  );

  console.log("[ensure-wasm] Created stub WASM module (run `just wasm` for real build)");
}
