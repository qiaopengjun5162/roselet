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

// 顺序重要：先替换长的
code = code.replace(/WebAssembly\.instantiateStreaming/g, 'WXWebAssembly.instantiate');
code = code.replace(/WebAssembly\.instantiate\b/g, 'WXWebAssembly.instantiate');
code = code.replace(/WebAssembly\./g, 'WXWebAssembly.');
code = code.replace(/typeof WebAssembly/g, 'typeof WXWebAssembly');

// 在文件头注入 polyfill 引用
const header = "import '../polyfill';\n";
if (!code.startsWith(header)) {
  code = header + code;
}

fs.writeFileSync(gluePath, code);
console.log('patch-wasm: WXWebAssembly 补丁注入成功');
