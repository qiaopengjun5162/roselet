import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = new URL('.', import.meta.url).pathname;

if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});

const page = await context.newPage();

// 1. Home page (with dynamic background loaded)
console.log('Taking: home page');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000); // Let background animations settle
await page.screenshot({ path: SCREENSHOT_DIR + '01-home.png', fullPage: true });
console.log('  ✓ 01-home.png');

// 2. Login page
console.log('Taking: login page');
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: SCREENSHOT_DIR + '02-login.png', fullPage: true });
console.log('  ✓ 02-login.png');

// 3. Register/Login - create a test user
console.log('Taking: plant page (after login)');
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
// Fill in nickname
const nicknameInput = page.locator('input[type="text"], input[placeholder*="昵称"]').first();
if (await nicknameInput.isVisible()) {
  await nicknameInput.fill('明日的分享嘉宾');
  // Click submit button
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(3000);
  // Should be redirected to home or plant
}

// Now navigate to plant page
await page.goto(BASE + '/plant', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: SCREENSHOT_DIR + '03-plant.png', fullPage: true });
console.log('  ✓ 03-plant.png');

// 4. Fill in plant form with some content
const roseInput = page.locator('textarea').first();
if (await roseInput.isVisible({ timeout: 3000 }).catch(() => false)) {
  await roseInput.fill('今天的阳光很好，感谢社区朋友的陪伴');
  await page.waitForTimeout(500);

  // Try to find and fill other inputs
  const textareas = page.locator('textarea');
  const count = await textareas.count();
  if (count > 1) {
    await textareas.nth(1).fill('下周的演讲让我有点紧张');
  }
  if (count > 2) {
    await textareas.nth(2).fill('期待看到社区花圃慢慢生长');
  }

  await page.waitForTimeout(500);
  // Click the plant button
  const plantBtn = page.locator('button').filter({ hasText: /种下|种.*玫瑰|plant/i }).first();
  if (await plantBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await plantBtn.click();
    await page.waitForTimeout(3000); // Wait for fireworks animation
  }
}

// 5. Garden page
console.log('Taking: garden page');
await page.goto(BASE + '/garden', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: SCREENSHOT_DIR + '04-garden.png', fullPage: true });
console.log('  ✓ 04-garden.png');

// 6. Rose detail page (click on first rose card)
const roseCard = page.locator('a[href*="/rose/"]').first();
if (await roseCard.isVisible({ timeout: 3000 }).catch(() => false)) {
  await roseCard.click();
  await page.waitForTimeout(2000);
  console.log('Taking: rose detail page');
  await page.screenshot({ path: SCREENSHOT_DIR + '05-rose-detail.png', fullPage: true });
  console.log('  ✓ 05-rose-detail.png');
} else {
  console.log('  ⚠ No rose cards found, skipping detail page');
}

// 7. My garden / profile
console.log('Taking: profile page');
await page.goto(BASE + '/my', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: SCREENSHOT_DIR + '06-my-garden.png', fullPage: true });
console.log('  ✓ 06-my-garden.png');

await browser.close();
console.log('\nDone! Screenshots saved to:', SCREENSHOT_DIR);
