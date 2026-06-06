import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(__dirname, '../../dist/weapp');

describe('build smoke', () => {
  beforeAll(() => {
    if (!fs.existsSync(DIST_DIR)) {
      console.warn(`dist/weapp not found, skipping smoke tests. Run: TARO_APP_ID=xxx just miniprogram-build`);
    }
  });

  it('runtime.js has process + document mock', () => {
    if (!fs.existsSync(DIST_DIR)) return;
    const runtime = fs.readFileSync(path.join(DIST_DIR, 'runtime.js'), 'utf-8');
    expect(runtime).toContain('var process={');
    // Terser 压缩: var process={...},document="undefined"...
    expect(runtime).toContain('document="undefined"');
  });

  it('all JS files have process + document mock', () => {
    if (!fs.existsSync(DIST_DIR)) return;
    // app.js / vendors.js 开头有 webpack license comment, banner 在后面
    const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(DIST_DIR, f), 'utf-8');
      expect(content).toContain('var process={');
      expect(content).toContain('document=');
    }
  });

  it('dist/weapp has page directories', () => {
    if (!fs.existsSync(DIST_DIR)) return;
    const pagesDir = path.join(DIST_DIR, 'pages');
    expect(fs.existsSync(pagesDir)).toBe(true);
  });
});
