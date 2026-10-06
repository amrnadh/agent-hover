import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

test.describe('P2-04 Design Tokens & Theme Handling', () => {
  test('renders with design tokens, tabular nums, and handles light/dark mode', async ({ page }) => {
    // 1. Emulate Dark Mode system preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const overlayRoot = page.locator('#agent-hover-root');
    await expect(overlayRoot).toBeAttached();

    // Verify Design Tokens on Shadow Host in Dark Mode
    const tokens = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      if (!root) return null;
      const cs = window.getComputedStyle(root);
      return {
        fontSans: cs.getPropertyValue('--ah-font-sans').trim(),
        textBase: cs.getPropertyValue('--ah-text-base').trim(),
        surfaceBase: cs.getPropertyValue('--ah-surface-base').trim(),
        accentPrimary: cs.getPropertyValue('--ah-accent-primary').trim(),
      };
    });

    expect(tokens).toBeTruthy();
    expect(tokens?.textBase).toBe('14px');
    expect(tokens?.surfaceBase).toBe('#111214'); // Dark mode tokens
    expect(tokens?.accentPrimary).toBe('#0090ff');

    const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots/P2-04');
    await fs.mkdir(screenshotsDir, { recursive: true });

    // Open flyout to see full palette and cards in dark mode
    const dockToggle = page.locator('#cp-dock-toggle');
    await dockToggle.click();
    const h1 = page.locator('h1').first();
    await h1.click({ force: true });

    const flyout = page.locator('#cp-flyout');
    await expect(flyout).toBeVisible();
    await page.waitForTimeout(400);

    // Save dark mode screenshot
    await page.screenshot({ path: path.join(screenshotsDir, '01-tokens-dark-mode.png') });

    // 2. Switch to Light Mode via theme button
    const themeBtn = page.locator('#cp-flyout-theme');
    await themeBtn.click();
    await page.waitForTimeout(400);

    // Verify host has class .light-mode and tokens updated
    const lightTokens = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      if (!root) return null;
      const cs = window.getComputedStyle(root);
      return {
        hasLightClass: root.classList.contains('light-mode'),
        surfaceBase: cs.getPropertyValue('--ah-surface-base').trim(),
        accentPrimary: cs.getPropertyValue('--ah-accent-primary').trim(),
      };
    });

    expect(lightTokens?.hasLightClass).toBe(true);
    expect(lightTokens?.surfaceBase).toBe('#ffffff'); // Light mode tokens
    expect(lightTokens?.accentPrimary).toBe('#0070f3');

    // Save light mode screenshot
    await page.screenshot({ path: path.join(screenshotsDir, '02-tokens-light-mode.png') });

    // 3. Verify Tabular Numbers on Badge
    const badgeFontVariant = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const badge = root?.shadowRoot?.querySelector('#cp-dock-pin-badge');
      if (!badge) return null;
      const cs = window.getComputedStyle(badge);
      return cs.fontVariantNumeric;
    });

    expect(badgeFontVariant).toBe('tabular-nums');
  });
});
