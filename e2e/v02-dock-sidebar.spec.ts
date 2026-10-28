import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { bridge, openDemo, selectHost, shotsDir } from './helpers/overlay';

test.describe('0.2 dock', () => {
  const shots = shotsDir('v0.2');
  test.beforeAll(async () => { await fs.mkdir(shots, { recursive: true }); });

  test('sits bottom-center with mark, Inspect, Comment, Tasks, Batch, More and grip', async ({ page }) => {
    await openDemo(page);
    const dock = (await page.locator('#ah-dock').boundingBox())!;
    expect(Math.abs(dock.x + dock.width / 2 - 640)).toBeLessThan(2);
    expect(800 - (dock.y + dock.height)).toBeLessThan(30);
    for (const id of ['#ah-d-mark', '#ah-d-inspect', '#ah-d-comment', '#ah-d-tasks', '#ah-d-batch', '#ah-d-more', '#ah-d-grip']) {
      await expect(page.locator(id)).toBeVisible();
    }
    await page.locator('#ah-d-inspect').hover();
    await expect(page.locator('#ah-dock-tip')).toContainText('Inspect');
    await expect(page.locator('#ah-dock-tip')).toContainText('Alt');
    await page.screenshot({ path: path.join(shots, '03-dock.png') });
  });

  test('status dot and connection popover follow agent presence', async ({ page, request }) => {
    await openDemo(page);
    await bridge(request).post('/agent/presence', { client: 'cursor' });
    await expect(page.locator('#ah-d-mark-dot')).toHaveClass(/ok/);
    await page.locator('#ah-d-mark').click();
    await expect(page.locator('#ah-conn')).toContainText('Cursor');
    await page.locator('#ah-conn [data-act=agents]').click();
    const agents = page.locator('#ah-set-agents');
    await expect(agents).toBeVisible();
    await expect(agents.locator('.ah-agent', { hasText: 'Cursor' })).toContainText('/agent-hover to listen');
    // Connecting another one: three steps, in that agent's own words.
    await agents.locator('.ah-setup > summary').click();
    await agents.locator('[data-agent=codex]').click();
    await expect(page.locator('#ah-set-agents .ah-steps')).toContainText('npx agent-hover init --agent codex');
    await expect(page.locator('#ah-set-agents .ah-steps')).toContainText('$agent-hover-status');
    // Voice language is a list, starting with the page's own language (where the browser has speech recognition).
    if (await page.evaluate(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      await expect(page.locator('#ah-voice-lang option').first()).toContainText('Same as the page');
    }
  });

  test('drag moves it, the position survives a reload, Reset puts it back', async ({ page }) => {
    await openDemo(page);
    const grip = (await page.locator('#ah-d-grip').boundingBox())!;
    await page.mouse.move(grip.x + 4, grip.y + 8);
    await page.mouse.down();
    await page.mouse.move(grip.x - 300, grip.y - 300, { steps: 8 });
    await page.mouse.up();
    const moved = (await page.locator('#ah-dock').boundingBox())!;
    expect(moved.y).toBeLessThan(600);
    await page.reload();
    await page.waitForSelector('#agent-hover-root');
    const restored = (await page.locator('#ah-dock').boundingBox())!;
    expect(Math.abs(restored.y - moved.y)).toBeLessThan(3);
    await page.locator('#ah-d-more').click();
    await page.locator('#ah-dock-menu [data-act=settings]').click();
    await page.locator('#ah-side [data-act=reset-dock]').click();
    const reset = (await page.locator('#ah-dock').boundingBox())!;
    expect(800 - (reset.y + reset.height)).toBeLessThan(30);
  });

  test('minimizes to a round button and restores (menu and ⌘/Ctrl+Shift+X)', async ({ page }) => {
    await openDemo(page);
    await page.locator('#ah-d-more').click();
    await page.locator('#ah-dock-menu [data-act=minimize]').click();
    await expect(page.locator('#ah-dock')).toBeHidden();
    await expect(page.locator('#ah-dock-min')).toBeVisible();
    await page.locator('#ah-dock-min').click();
    await expect(page.locator('#ah-dock')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Shift+KeyX');
    await expect(page.locator('#ah-dock')).toBeHidden();
    await page.keyboard.press('ControlOrMeta+Shift+KeyX');
    await expect(page.locator('#ah-dock')).toBeVisible();
  });

  test('pressing Minimize twice in Settings keeps the round button where the dock was', async ({ page }) => {
    await openDemo(page);
    const dock = (await page.locator('#ah-dock').boundingBox())!;
    await page.locator('#ah-d-more').click();
    await page.locator('#ah-dock-menu [data-act=settings]').click();
    const btn = page.locator('#ah-side [data-act=minimize]');
    await btn.dblclick();
    const min = (await page.locator('#ah-dock-min').boundingBox())!;
    expect(Math.abs(min.x + min.width / 2 - (dock.x + dock.width / 2))).toBeLessThan(4);
    // The round button can be dragged, then restores on click.
    await page.mouse.move(min.x + 20, min.y + 20);
    await page.mouse.down();
    await page.mouse.move(min.x - 200, min.y - 200, { steps: 6 });
    await page.mouse.up();
    const moved = (await page.locator('#ah-dock-min').boundingBox())!;
    expect(moved.x).toBeLessThan(min.x - 150);
    await page.locator('#ah-dock-min').click();
    await expect(page.locator('#ah-dock')).toBeVisible();
  });

  test('vertical orientation from Settings', async ({ page }) => {
    await openDemo(page);
    await page.locator('#ah-d-more').click();
    await page.locator('#ah-dock-menu [data-act=settings]').click();
    await page.locator('#ah-side [data-seg=dock] [data-v=vertical]').click();
    await expect(page.locator('#ah-dock')).toHaveClass(/vertical/);
    const box = (await page.locator('#ah-dock').boundingBox())!;
    expect(box.height).toBeGreaterThan(box.width);
  });

  test('first-run hint shows once and can be dismissed', async ({ page }) => {
    await openDemo(page, { hint: true });
    await expect(page.locator('#ah-hint')).toBeVisible();
    await page.locator('#ah-hint-close').click();
    await expect(page.locator('#ah-hint')).toBeHidden();
    await page.reload();
    await page.waitForSelector('#agent-hover-root');
    await expect(page.locator('#ah-hint')).toBeHidden();
  });
});

test.describe('0.2 sidebar', () => {
  const shots = shotsDir('v0.2');

  test('Inspect shows identity, breadcrumb, layout and source for the selection', async ({ page }) => {
    await openDemo(page);
    await selectHost(page, '#hero-primary-cta');
    await page.keyboard.press('d');
    const side = page.locator('#ah-side');
    await expect(side).toBeVisible();
    // Plain name first, the code name under it.
    await expect(side.locator('.ah-ident .name')).toHaveText('“Book a demo” button');
    await expect(side.locator('.ah-ident .code')).toHaveText('button#hero-primary-cta');
    await expect(side.locator('.ah-ident .file')).toContainText('Hero.tsx');
    await expect(side.locator('.ah-crumbs button.cur')).toHaveText('button#hero-primary-cta');
    await expect(side.locator('details.ah-sec', { hasText: 'Layout' })).toContainText('display');
    await expect(side.locator('#ah-s-foot')).toContainText('tokens');
    // The pill moves out from under the docked sidebar.
    const pill = (await page.locator('#ah-pill').boundingBox())!;
    const panel = (await side.boundingBox())!;
    expect(pill.x + pill.width).toBeLessThanOrEqual(panel.x);
    // Breadcrumb selects ancestors.
    await side.locator('.ah-crumbs button', { hasText: '<Hero />' }).click();
    await expect(page.locator('#ah-pill-name')).toHaveText('<Hero />');
    await page.screenshot({ path: path.join(shots, '04-inspect.png') });
  });

  test('tabs, Tasks list, Settings theme, float toggle', async ({ page }) => {
    await openDemo(page);
    await page.locator('#ah-d-tasks').click();
    const side = page.locator('#ah-side');
    await expect(side).toBeVisible();
    await expect(page.locator('#ah-d-tasks')).toHaveAttribute('aria-pressed', 'true');
    await side.locator('[data-tab=comments]').click();
    await expect(side.locator('[data-tab=comments]')).toHaveAttribute('aria-selected', 'true');
    await side.locator('#ah-s-gear').click();
    await side.locator('[data-seg=theme] [data-v=light]').click();
    await expect.poll(() => page.evaluate(() => document.querySelector('#agent-hover-root')!.classList.contains('light-mode'))).toBe(true);
    await page.screenshot({ path: path.join(shots, '05-settings-light.png') });
    await side.locator('#ah-s-float').click();
    await expect(side).toHaveClass(/float/);
    await side.locator('#ah-s-close').click();
    await expect(side).toBeHidden();
  });
});
