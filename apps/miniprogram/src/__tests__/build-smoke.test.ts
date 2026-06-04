/**
 * 构建产物冒烟测试。
 * 验证 runtime.js 不包含未受保护的 document.baseURI 访问 ——
 * 这是微信小程序 VM 最常见的崩溃原因（Webpack 5 publicPath 自动探测）。
 * 若失败：检查 config/index.ts 的 BannerPlugin 配置是否正确注入。
 */
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(__dirname, '../../dist/weapp');

describe('build smoke', () => {
  it('runtime.js has document mock injected before any Webpack code', () => {
    const runtime = fs.readFileSync(path.join(DIST_DIR, 'runtime.js'), 'utf-8');
    // BannerPlugin 注入的 mock 必须在文件开头（前 200 字符内）
    expect(runtime.slice(0, 200)).toContain('var document=');
    expect(runtime.slice(0, 200)).toContain('baseURI');
  });

  it('all .js files have document mock (no unprotected baseURI access)', () => {
    const jsFiles = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(DIST_DIR, file), 'utf-8');
      // 每个 JS 文件都应由 BannerPlugin 注入 mock
      expect(content.slice(0, 300)).toContain('var document=');
    }
  });

  it('dist/weapp has expected page directories', () => {
    const pagesDir = path.join(DIST_DIR, 'pages');
    expect(fs.existsSync(pagesDir)).toBe(true);
    ['index', 'login', 'garden', 'plant', 'rose'].forEach(page => {
      expect(fs.existsSync(path.join(pagesDir, page, 'index.js'))).toBe(true);
    });
  });
});
