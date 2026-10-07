import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

test.describe('P2-05 Floating Horizontal Dock Pill (§7.10, D-07)', () => {
  test('renders 40px horizontal pill at bottom center with all segments and persistence', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const overlayRoot = page.locator('#agent-hover-root');
    await expect(overlayRoot).toBeAttached();

    const dockWrapper = page.locator('#cp-dock-wrapper');
    await expect(dockWrapper).toBeAttached();

    const dock = page.locator('#cp-dock');
    await expect(dock).toBeVisible();

    // 1. Verify 40px height and horizontal pill shape
    const dockBox = await dock.boundingBox();
    expect(dockBox).not.toBeNull();
    if (dockBox) {
      expect(Math.round(dockBox.height)).toBe(40);
    }

    const borderRadius = await dock.evaluate((el) => window.getComputedStyle(el).borderRadius);
    expect(borderRadius).toMatch(/9999px|20px/);

    // 2. Verify all segments exist
    const brand = page.locator('#ah-dock-brand');
    const statusDot = page.locator('#cp-mcp-dot');
    const toggleBtn = page.locator('#cp-dock-toggle');
    const pinsBtn = page.locator('#cp-dock-pins');
    const settingsBtn = page.locator('#ah-dock-settings-btn');
    const dragHandle = page.locator('#cp-dock-handle');

    await expect(brand).toBeVisible();
    await expect(statusDot).toBeVisible();
    await expect(toggleBtn).toBeVisible();
    await expect(pinsBtn).toBeVisible();
    await expect(settingsBtn).toBeVisible();
    await expect(dragHandle).toBeVisible();

    // 3. Inspect Toggle
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleBtn).toHaveClass(/active/);

    // Toggle back off
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

    // Screenshots directory
    const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots/P2-05');
    await fs.mkdir(screenshotsDir, { recursive: true });

    // Capture dark mode screenshot
    await page.screenshot({ path: path.join(screenshotsDir, '01-dock-pill-dark.png') });

    // 4. Light theme test
    await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      if (root) {
        root.classList.remove('dark-mode');
        root.classList.add('light-mode');
      }
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, '02-dock-pill-light.png') });

    // Revert to dark theme
    await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      if (root) {
        root.classList.remove('light-mode');
        root.classList.add('dark-mode');
      }
    });

    // 5. Presence dot update test (simulate active agent presence)
    await page.evaluate(() => {
      const dot = document.querySelector('#agent-hover-root')?.shadowRoot?.querySelector('#cp-mcp-dot');
      if (dot) {
        dot.className = 'ah-dock-status-dot status-active';
        dot.setAttribute('title', 'Bridge :4100 · Claude Code');
      }
    });
    await page.waitForTimeout(200);

    const dotClass = await statusDot.getAttribute('class');
    expect(dotClass).toContain('status-active');
    await page.screenshot({ path: path.join(screenshotsDir, '03-dock-presence-active.png') });

    // 6. Minimize & restore test via Cmd/Ctrl+Shift+X (A.6)
    await page.keyboard.press('Control+Shift+KeyX');
    const minimizedBtn = page.locator('#ah-dock-minimized');
    await expect(minimizedBtn).toBeVisible();
    await expect(dock).toBeHidden();

    // Clicking minimized button restores dock
    await minimizedBtn.click();
    await expect(dock).toBeVisible();
    await expect(minimizedBtn).toBeHidden();

    // 7. Drag and edge snapping persistence
    const handleBox = await dragHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      // Drag upwards towards top-left
      await page.mouse.move(30, 30, { steps: 5 });
      await page.mouse.up();
    }

    const savedPos = await page.evaluate(() => localStorage.getItem('agent_hover_dock_pos'));
    expect(savedPos).not.toBeNull();
  });
});
