import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('P2-01 Visual Verification Screenshots', () => {
  test('captures comprehensive screenshots of overlay in dark and light modes', async ({ page }) => {
    const screenshotDir = path.resolve('docs/screenshots/P2-01');
    fs.mkdirSync(screenshotDir, { recursive: true });

    // 1. Initial Page with Floating Dock (Dark)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotDir, '01-dock-initial-dark.png'), fullPage: false });

    // 2. Enable Inspect Mode (Active Highlight)
    const dockToggle = page.locator('#cp-dock-toggle');
    await dockToggle.click();
    await page.waitForTimeout(400);

    // Hover over h1
    const h1 = page.locator('h1').first();
    await h1.hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotDir, '02-inspect-hover-dark.png'), fullPage: false });

    // 3. Click h1 to lock selection & open Flyout Inspector
    await h1.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, '03-flyout-inspector-dark.png'), fullPage: false });

    // 4. Open Pin Stack Bar
    const dockPins = page.locator('#cp-dock-pins');
    await dockPins.click({ force: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, '04-pin-stack-dark.png'), fullPage: false });

    // 5. Open Settings View via shadowRoot
    await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const settingsBtn = root?.shadowRoot?.querySelector('#cp-flyout-settings') as HTMLElement | null;
      settingsBtn?.click();
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, '05-settings-view-dark.png'), fullPage: false });

    // 6. Switch to Light Mode via shadowRoot
    await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const lightBtn = root?.shadowRoot?.querySelector('#cp-theme-set-light') as HTMLElement | null;
      lightBtn?.click();
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, '06-settings-view-light.png'), fullPage: false });

    // Back to Inspector in Light Mode
    await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const backBtn = root?.shadowRoot?.querySelector('#cp-settings-back') as HTMLElement | null;
      backBtn?.click();
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, '07-flyout-inspector-light.png'), fullPage: false });
  });
});
