import { test, expect } from '@playwright/test';
import { bridge, clickHost, openDemo, selectHost, startInspect } from './helpers/overlay';

test.describe('0.2 comments', () => {
  test('Comment mode drops a pin where you click; resolve and delete', async ({ page, request }) => {
    const api = bridge(request);
    await openDemo(page);
    await page.locator('#ah-d-comment').click();
    await expect(page.locator('#ah-d-comment')).toHaveAttribute('aria-pressed', 'true');
    const box = await clickHost(page, '#hero-primary-cta', { fx: 0.2, fy: 0.5 });
    const card = page.locator('#ah-comment-card');
    await expect(card).toBeVisible();
    const text = `Arrow should be white ${Date.now()}`;
    await page.locator('#ah-comment-input').fill(text);
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(card).toContainText(text);

    const { comments } = await api.get('/comments');
    const saved = comments.find((c: any) => c.text === text);
    expect(saved.selector).toBe('button#hero-primary-cta');
    expect(saved.offsetX).toBeCloseTo(0.2, 1);

    const pin = page.locator('.ah-cpin.active');
    const p = (await pin.boundingBox())!;
    expect(Math.abs(p.x - (box.x + box.width * 0.2))).toBeLessThan(4);

    await card.locator('[data-act=resolve]').click();
    await expect(card.locator('[data-act=resolve]')).toHaveText('Reopen');
    await card.locator('[data-act=delete]').click();
    await expect(card).toBeHidden();
    const after = await api.get('/comments');
    expect(after.comments.some((c: any) => c.text === text)).toBe(false);
  });

  test('Comments tab lists comments and sends open ones as one task', async ({ page, request }) => {
    const api = bridge(request);
    await openDemo(page);
    await selectHost(page, '#hero-primary-cta');
    await page.keyboard.press('c');
    const text = `Use the brand font ${Date.now()}`;
    await page.locator('#ah-comment-input').fill(text);
    await page.locator('#ah-comment-card [data-act=save]').click();
    await page.keyboard.press('Escape');
    await page.locator('#ah-d-more').click();
    await page.locator('#ah-dock-menu [data-act=sidebar]').click();
    await page.locator('#ah-side [data-tab=comments]').click();
    await expect(page.locator('#ah-side .ah-li', { hasText: text })).toBeVisible();
    await page.locator('#ah-side [data-act=send-all]').click();
    await expect.poll(async () => (await api.get('/agent/tasks?limit=10')).tasks.some((t: any) => t.type === 'note' && t.payload?.prompt?.includes(text))).toBe(true);
    const { comments } = await api.get('/comments');
    for (const c of comments.filter((x: any) => x.text === text)) await api.post('/comments', { action: 'delete', id: c.id });
  });
});

test.describe('0.2 batch', () => {
  test('B collects elements with numbered badges; Send creates one task with roles', async ({ page, request }) => {
    const api = bridge(request);
    await openDemo(page);
    await api.post('/agent/presence', { client: 'claude-code' });
    await selectHost(page, '#hero-primary-cta');
    await page.keyboard.press('b');
    await clickHost(page, '#hero-badge');
    await page.keyboard.press('b');
    await expect(page.locator('.ah-batch-num')).toHaveCount(2);
    await expect(page.locator('#ah-d-batch-count')).toHaveText('2');
    await page.locator('#ah-d-batch').click();
    const side = page.locator('#ah-side');
    await side.locator('select.ah-role').nth(1).selectOption('reference');
    const goal = `Match the badge style ${Date.now()}`;
    await side.locator('#ah-batch-goal').fill(goal);
    await side.locator('[data-act=send]').click();
    await expect.poll(async () => {
      const t = (await api.get('/agent/tasks?limit=10')).tasks.find((x: any) => x.instruction === goal);
      return t ? t.payload.pins.map((p: any) => p.role).join(',') : null;
    }).toBe('TARGET,REFERENCE');
    await expect(page.locator('.ah-batch-num')).toHaveCount(0);
  });
});

test.describe('0.2 cursor', () => {
  test('the page cursor says what a click does; with the Batch tab open, clicks collect', async ({ page }) => {
    await openDemo(page);
    const layer = page.locator('#ah-capture-layer');
    const marks = page.locator('#ah-layer-batch .ah-batch-num');
    await startInspect(page);
    await expect(layer).toHaveAttribute('data-cursor', 'inspect');
    expect(await layer.evaluate((el) => getComputedStyle(el).cursor)).toMatch(/^url\("data:image\/svg\+xml,.*crosshair$/);

    await page.locator('#ah-d-batch').click();
    await expect(layer).toHaveAttribute('data-cursor', 'batch');
    await clickHost(page, '#hero-primary-cta');
    await clickHost(page, '#hero-badge');
    await expect(marks).toHaveCount(2);
    await expect(page.locator('#ah-side .ah-li')).toHaveCount(2);
    // Clicking an element that is already in the batch takes it out again.
    await clickHost(page, '#hero-primary-cta');
    await expect(marks).toHaveCount(1);

    await page.locator('#ah-d-batch').click();
    await expect(layer).toHaveAttribute('data-cursor', 'inspect');
    await clickHost(page, '#hero-primary-cta');
    await expect(marks).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.locator('#ah-d-comment').click();
    await expect(layer).toHaveAttribute('data-cursor', 'comment');
  });
});
