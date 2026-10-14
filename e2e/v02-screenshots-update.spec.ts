import { test, expect } from '@playwright/test';
import path from 'path';
import { clickHost, openDemo, selectHost, startInspect, shotsDir } from './helpers/overlay';

test.describe('0.2 screenshots and update notice', () => {
  const shots = shotsDir('v0.2');

  test('Screenshot element: toast, then View opens the lightbox; Escape closes it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openDemo(page);
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-more').click();
    await page.locator('#ah-pill-menu [data-act=shot]').click();

    const toast = page.locator('#ah-toast');
    await expect(toast).toContainText('saved to .agent-hover/screenshots', { timeout: 15000 });
    await toast.getByRole('button', { name: 'View' }).click();

    const box = page.locator('#ah-lightbox');
    await expect(box).toBeVisible();
    await expect(box.locator('.title')).toContainText('Element');
    await expect(box.locator('.title .file')).toContainText('.agent-hover/screenshots/');
    const size = await box.locator('img').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    expect(size[0]).toBeGreaterThan(50);
    await page.screenshot({ path: path.join(shots, '08-lightbox.png') });

    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
    // Escape closed only the lightbox: the selection is still there.
    await expect(page.locator('#ah-pill')).toBeVisible();
  });

  test('Screenshot element draws an SVG component (the hero underline), not a blank image', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openDemo(page);
    await startInspect(page);
    await clickHost(page, '#hero-headline svg', { fx: 0.5, fy: 0.2 });
    await expect(page.locator('#ah-pill-name')).toHaveText('<Squiggle />');
    await page.locator('#ah-pill-more').click();
    await page.locator('#ah-pill-menu [data-act=shot]').click();
    const toast = page.locator('#ah-toast');
    await expect(toast).toContainText('saved to .agent-hover/screenshots', { timeout: 15000 });
    await toast.getByRole('button', { name: 'View' }).click();
    const img = page.locator('#ah-lightbox img');
    await expect(img).toBeVisible();
    // The underline is the brand green; count its pixels.
    const green = await img.evaluate(async (el: HTMLImageElement) => {
      await el.decode();
      const c = document.createElement('canvas');
      c.width = el.naturalWidth;
      c.height = el.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(el, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 30 && d[i + 1] > d[i + 2] + 10) n++;
      return n;
    });
    expect(green).toBeGreaterThan(200);
  });

  test('Screenshot visible area from the dock menu', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openDemo(page);
    await page.locator('#ah-d-more').click();
    await page.locator('#ah-dock-menu [data-act=shot]').click();
    await expect(page.locator('#ah-toast')).toContainText('Screenshot', { timeout: 15000 });
    await page.locator('#ah-toast').getByRole('button', { name: 'View' }).click();
    await expect(page.locator('#ah-lightbox .title')).toContainText('Visible area');
    await expect(page.locator('#ah-lightbox .title')).toContainText('1280 × 800');
    const size = await page.locator('#ah-lightbox img').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    // Captured at 2× for sharpness.
    expect(size).toEqual([2560, 1600]);
    await page.locator('#ah-lightbox [data-act=close]').click();
    await expect(page.locator('#ah-lightbox')).toBeHidden();
  });

  test('a newer release shows one toast, the dock popover line and Settings › About', async ({ page }) => {
    await page.route(/\/api\/health$/, async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, updateAvailable: { current: body.version, latest: '9.9.9' } } });
    });
    await openDemo(page);
    const toast = page.locator('#ah-toast');
    await expect(toast).toContainText('Agent Hover 9.9.9 is available');
    await page.locator('#ah-d-mark').click();
    await expect(page.locator('#ah-conn')).toContainText('Update available');
    await page.locator('#ah-conn [data-act=about]').click();
    await expect(page.locator('#ah-set-about')).toContainText('9.9.9');
    await expect(page.locator('#ah-set-about')).toContainText('npm i -D @agent-hover/vite@latest');

    // Once per version: a reload does not toast again.
    await page.reload();
    await page.waitForSelector('#agent-hover-root');
    await page.waitForTimeout(1500);
    await expect(toast).not.toContainText('9.9.9');
  });
});
