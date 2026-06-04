#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pkgDir = path.resolve(__dirname, '../apps/miniprogram/pkg');
const gluePath = path.join(pkgDir, 'roselet_recommend.js');

if (!fs.existsSync(gluePath)) {
  console.error('胶水代码不存在，请先执行 wasm-pack build');
  process.exit(1);
}

let code = fs.readFileSync(gluePath, 'utf8');

// (?<!WX) 防止重复替换：WXWebAssembly.instantiate 包含 WebAssembly.instantiate 子串
code = code.replace(/(?<!WX)WebAssembly\.instantiateStreaming/g, 'WXWebAssembly.instantiate');
code = code.replace(/(?<!WX)WebAssembly\.instantiate\b/g, 'WXWebAssembly.instantiate');
code = code.replace(/(?<!WX)WebAssembly\./g, 'WXWebAssembly.');
code = code.replace(/typeof (?<!WX)WebAssembly/g, 'typeof WXWebAssembly');

// 在文件头注入 polyfill 引用
const header = "import '../src/polyfill';\n";
if (!code.startsWith(header)) {
  code = header + code;
}

fs.writeFileSync(gluePath, code);
console.log('patch-wasm: WXWebAssembly 补丁注入成功');
