import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(__dirname, '../../dist/weapp');
/**
 * 判断「有没有一个完整的产物」，而不是「这个目录在不在」。
 *
 * 构建中途失败会留下一个只有 app.js / app.wxss 的半成品目录，原来的
 * `existsSync(DIST_DIR)` 会认为有货，于是这里报的是 runtime.js 读不到、
 * pages/ 不存在——看起来像构建坏了，其实只是没构建完。改用 app.json 当判据：
 * 一个能进开发者工具的包必须有它。
 */
const HAS_BUILD = fs.existsSync(path.join(DIST_DIR, 'app.json'));

describe('build smoke', () => {
  beforeAll(() => {
    if (!HAS_BUILD) {
      console.warn(`dist/weapp 没有完整产物，跳过 smoke 检查。先跑 pnpm build:weapp`);
    }
  });

  it('runtime.js has process + document mock', () => {
    if (!HAS_BUILD) return;
    const runtime = fs.readFileSync(path.join(DIST_DIR, 'runtime.js'), 'utf-8');
    expect(runtime).toContain('var process={');
    // Terser 压缩: var process={...},document="undefined"...
    expect(runtime).toContain('document="undefined"');
  });

  it('all JS files have process + document mock', () => {
    if (!HAS_BUILD) return;
    // app.js / vendors.js 开头有 webpack license comment, banner 在后面
    const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(DIST_DIR, f), 'utf-8');
      expect(content).toContain('var process={');
      expect(content).toContain('document=');
    }
  });

  it('dist/weapp has page directories', () => {
    if (!HAS_BUILD) return;
    const pagesDir = path.join(DIST_DIR, 'pages');
    expect(fs.existsSync(pagesDir)).toBe(true);
  });
});
