// TextEncoder/TextDecoder polyfill — 微信小程序 VM 不内置这两个 API
// fast-text-encoding 在小程序打包后构造函数导出异常，改用内联实现
class MiniTextEncoder {
  encode(input: string): Uint8Array {
    const len = input.length;
    const buf = new Uint8Array(len * 3);
    let pos = 0;
    for (let i = 0; i < len; i++) {
      const c = input.charCodeAt(i);
      if (c < 0x80) { buf[pos++] = c; }
      else if (c < 0x800) { buf[pos++] = 0xc0 | (c >> 6); buf[pos++] = 0x80 | (c & 0x3f); }
      else { buf[pos++] = 0xe0 | (c >> 12); buf[pos++] = 0x80 | ((c >> 6) & 0x3f); buf[pos++] = 0x80 | (c & 0x3f); }
    }
    return buf.slice(0, pos);
  }
}

class MiniTextDecoder {
  decode(input: ArrayBuffer | Uint8Array): string {
    const buf = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    let result = '';
    let i = 0;
    while (i < buf.length) {
      const b = buf[i];
      if (b < 0x80) { result += String.fromCharCode(b); i += 1; }
      else if ((b & 0xe0) === 0xc0) { result += String.fromCharCode(((b & 0x1f) << 6) | (buf[i + 1] & 0x3f)); i += 2; }
      else { result += String.fromCharCode(((b & 0x0f) << 12) | ((buf[i + 1] & 0x3f) << 6) | (buf[i + 2] & 0x3f)); i += 3; }
    }
    return result;
  }
}

// 防御性注入：仅在缺失时才设置，避免覆盖小程序环境已有的实现
if (typeof global !== 'undefined') {
  if (!(global as any).TextEncoder) (global as any).TextEncoder = MiniTextEncoder;
  if (!(global as any).TextDecoder) (global as any).TextDecoder = MiniTextDecoder;
}
