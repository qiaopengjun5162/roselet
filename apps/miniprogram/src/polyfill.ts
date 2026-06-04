import { TextEncoder, TextDecoder } from 'fast-text-encoding';

if (typeof global !== 'undefined') {
  // 文本编码 Polyfill
  (global as any).TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;

  // 防御性 Mock document 对象，防止 Webpack 5 runtime 访问 baseURI 崩溃
  if (!(global as any).document) {
    (global as any).document = {
      baseURI: '/',
      currentScript: {
        baseURI: '/',
      },
    };
  }
}
