import { test, expect } from '@playwright/experimental-ct-react';
import { RosePlayer } from '@/components/rose-player';
import type { Rose } from '@/lib/api';

const mockRose: Rose = {
  id: 'test-1', color: 'red', gratitude: '感谢阳光',
  anxiety: null, hope: null, user_id: 'u1', nickname: 'test',
  like_count: 3, ai_reply: 'hello', is_private: false, created_at: '2026-06-04T00:00:00Z', recipient_nickname: null, is_gift: false,
};

test.describe('RosePlayer', () => {
  test('renders canvas and start button', async ({ mount }) => {
    const c = await mount(<RosePlayer rose={mockRose} />);
    await expect(c.locator('canvas')).toBeVisible();
    await expect(c.locator('button')).toContainText('听这朵玫瑰');
  });
  test('start toggles to stop', async ({ mount }) => {
    const c = await mount(<RosePlayer rose={mockRose} />);
    await c.locator('button').click();
    await expect(c.locator('button')).toContainText('停止');
  });
  test('respects canvasSize prop', async ({ mount }) => {
    const c = await mount(<RosePlayer rose={mockRose} canvasSize={160} />);
    await expect(c.locator('canvas')).toHaveAttribute('width', '160');
  });
  test('white rose renders', async ({ mount }) => {
    const c = await mount(<RosePlayer rose={{ ...mockRose, color: 'white' }} />);
    await expect(c.locator('canvas')).toBeVisible();
  });
  test('yellow rose renders', async ({ mount }) => {
    const c = await mount(<RosePlayer rose={{ ...mockRose, color: 'yellow' }} />);
    await expect(c.locator('canvas')).toBeVisible();
  });
});
