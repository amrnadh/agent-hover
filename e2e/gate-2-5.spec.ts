import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

test.describe('Gate 2.5: Dock & Overlay Comprehensive Verification', () => {
  const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots/Gate-2.5');

  test.beforeAll(async () => {
    await fs.mkdir(screenshotsDir, { recursive: true });
  });

  // --- B. First Run Tests ---
  test('First Run: loads at bottom-center on 1280x720 and 390x844 with hint', async ({ page }) => {
    // 1. Desktop viewport 1280x720
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const dock = page.locator('#cp-dock');
    await expect(dock).toBeVisible();

    const boxDesktop = await dock.boundingBox();
    expect(boxDesktop).not.toBeNull();
    if (boxDesktop) {
      // Centered horizontally: midpoint close to 640
      const midX = boxDesktop.x + boxDesktop.width / 2;
      expect(Math.abs(midX - 640)).toBeLessThan(15);
      // Near bottom (20px margin, 40px height -> bottom around 700)
      expect(boxDesktop.y + boxDesktop.height).toBeGreaterThan(690);
      expect(boxDesktop.y + boxDesktop.height).toBeLessThanOrEqual(710);
    }

    // First-run hint is displayed
    const hint = page.locator('#ah-first-run-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Press Alt to inspect · drag to move');

    // Hint text does not intercept pointer events
    const hintTextPe = await page.locator('.ah-hint-text').evaluate((el) => window.getComputedStyle(el).pointerEvents);
    expect(hintTextPe).toBe('none');

    // Dismiss button works
    const hintDismiss = page.locator('#ah-hint-dismiss');
    await hintDismiss.click();
    await expect(hint).toBeHidden();

    // 2. Mobile viewport 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const dockMobile = page.locator('#cp-dock');
    await expect(dockMobile).toBeVisible();

    const boxMobile = await dockMobile.boundingBox();
    expect(boxMobile).not.toBeNull();
    if (boxMobile) {
      const midX = boxMobile.x + boxMobile.width / 2;
      expect(Math.abs(midX - 195)).toBeLessThan(15);
      expect(boxMobile.y + boxMobile.height).toBeGreaterThan(810);
      expect(boxMobile.y + boxMobile.height).toBeLessThanOrEqual(835);
    }
  });

  // --- A & D. Interaction Matrix Tests ---
  test('Interaction Matrix: single-click responses, tab switching, minimize, reset, and keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const dock = page.locator('#cp-dock');
    const toggleBtn = page.locator('#cp-dock-toggle');
    const pinsBtn = page.locator('#cp-dock-pins');
    const settingsBtn = page.locator('#ah-dock-settings-btn');
    const flyout = page.locator('#cp-flyout');
    const viewPins = page.locator('#cp-view-pins');
    const viewSettings = page.locator('#cp-view-settings');

    // 1. Inspect toggle: 1st click turns on, 2nd click turns off
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleBtn).toHaveClass(/active/);

    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(toggleBtn).not.toHaveClass(/active/);

    // 2. Pins button: 1st click opens Pins tab, 2nd click closes sidebar
    await expect(flyout).not.toHaveClass(/open/);
    await pinsBtn.click();
    await expect(flyout).toHaveClass(/open/);
    await expect(pinsBtn).toHaveClass(/active/);
    await expect(viewPins).toBeVisible();

    // Clicking highlighted Pins button closes sidebar (A.1)
    await pinsBtn.click();
    await expect(flyout).not.toHaveClass(/open/);
    await expect(pinsBtn).not.toHaveClass(/active/);

    // 3. Settings button: opens Settings tab; clicking Pins switches tab directly without cycling
    await settingsBtn.click();
    await expect(flyout).toHaveClass(/open/);
    await expect(settingsBtn).toHaveClass(/active/);
    await expect(viewSettings).toBeVisible();

    // Switch from Settings directly to Pins
    await pinsBtn.click();
    await expect(flyout).toHaveClass(/open/);
    await expect(pinsBtn).toHaveClass(/active/);
    await expect(settingsBtn).not.toHaveClass(/active/);
    await expect(viewPins).toBeVisible();

    // Switch back to Settings directly
    await settingsBtn.click();
    await expect(flyout).toHaveClass(/open/);
    await expect(settingsBtn).toHaveClass(/active/);
    await expect(viewSettings).toBeVisible();

    // 4. Minimize dock from Settings tab
    const minimizeBtn = page.locator('#ah-settings-minimize-btn');
    await expect(minimizeBtn).toBeVisible();
    await minimizeBtn.click();

    const minimizedBtn = page.locator('#ah-dock-minimized');
    await expect(minimizedBtn).toBeVisible();
    await expect(dock).toBeHidden();

    // Click minimized button restores dock
    await minimizedBtn.click();
    await expect(dock).toBeVisible();
    await expect(minimizedBtn).toBeHidden();

    // 5. Reset dock position from Settings tab
    if (!await viewSettings.isVisible()) {
      await settingsBtn.click();
      await expect(viewSettings).toBeVisible();
    }
    const resetPosBtn = page.locator('#ah-settings-reset-pos-btn');
    await expect(resetPosBtn).toBeVisible();
    await resetPosBtn.click();

    const dockBox = await dock.boundingBox();
    expect(dockBox).not.toBeNull();
    if (dockBox) {
      const midX = dockBox.x + dockBox.width / 2;
      expect(Math.abs(midX - 640)).toBeLessThan(15);
    }

    // 6. Keyboard accessibility: Enter & Space activate controls
    await page.keyboard.press('Escape'); // close sidebar
    await expect(flyout).not.toHaveClass(/open/);

    await toggleBtn.focus();
    await page.keyboard.press('Enter');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Space');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

    // 7. Drag threshold: movement < 4px is a click, >= 4px is a drag
    const handle = page.locator('#cp-dock-handle');
    const hBox = await handle.boundingBox();
    expect(hBox).not.toBeNull();
    if (hBox) {
      const startX = hBox.x + hBox.width / 2;
      const startY = hBox.y + hBox.height / 2;

      // Move 2px (below 4px threshold) -> should not drag
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 2, startY + 2);
      await page.mouse.up();

      const savedPos1 = await page.evaluate(() => localStorage.getItem('agent_hover_dock_pos'));
      expect(savedPos1).toBeNull();

      // Move 50px (exceeds 4px threshold) -> drags and persists
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - 100, startY - 100, { steps: 5 });
      await page.mouse.up();

      const savedPos2 = await page.evaluate(() => localStorage.getItem('agent_hover_dock_pos'));
      expect(savedPos2).not.toBeNull();
    }
  });

  // --- C. Spacing Overlay & Measure Mode Tests ---
  test('Spacing Overlay & Measure Mode: margin/padding bands and distance guides render with non-zero size', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Turn on inspect mode
    const toggleBtn = page.locator('#cp-dock-toggle');
    await toggleBtn.click();
    await expect(toggleBtn).toHaveClass(/active/);

    // Select the Hero Badge element (which has px-4 py-1.5 mb-6)
    const badge = page.locator('#hero-badge').first();
    await expect(badge).toBeVisible();
    await badge.click({ force: true });

    const flyout = page.locator('#cp-flyout');
    await expect(flyout).toBeVisible();

    // 1. Toggle Spacing Overlay
    const spacingBtn = page.locator('#cp-toggle-spacing');
    await expect(spacingBtn).toBeVisible();
    await spacingBtn.click();

    // Verify margin and padding bands are displayed with non-zero dimensions
    const bandsState = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root')?.shadowRoot;
      const mb = root?.querySelector('#cp-margin-band') as HTMLElement;
      const pb = root?.querySelector('#cp-padding-band') as HTMLElement;
      const axis = root?.querySelector('#cp-axis-guides') as HTMLElement;
      const rMb = mb ? mb.getBoundingClientRect() : null;
      const rPb = pb ? pb.getBoundingClientRect() : null;
      const axisLines = axis ? axis.querySelectorAll('.cp-axis-line') : [];

      return {
        mbDisplay: mb ? window.getComputedStyle(mb).display : 'none',
        pbDisplay: pb ? window.getComputedStyle(pb).display : 'none',
        mbRect: rMb ? { width: rMb.width, height: rMb.height } : null,
        pbRect: rPb ? { width: rPb.width, height: rPb.height } : null,
        mbBorderBottom: mb ? window.getComputedStyle(mb).borderBottomWidth : '',
        pbBorderLeft: pb ? window.getComputedStyle(pb).borderLeftWidth : '',
        axisLineCount: axisLines.length,
      };
    });

    // Verify margin band rendered with non-zero dimensions and expected 24px bottom margin
    expect(bandsState.mbDisplay).toBe('block');
    expect(bandsState.mbRect?.width).toBeGreaterThan(0);
    expect(bandsState.mbBorderBottom).toBe('24px');

    // Verify padding band rendered with non-zero dimensions and expected 16px horizontal padding
    expect(bandsState.pbDisplay).toBe('block');
    expect(bandsState.pbRect?.width).toBeGreaterThan(0);
    expect(bandsState.pbBorderLeft).toBe('16px');

    // Verify axis projection lines rendered
    expect(bandsState.axisLineCount).toBeGreaterThanOrEqual(4);

    // 2. Measure Mode / Distance Guides:
    // Hovering over headline while badge is selected renders distance lines and pills
    const h1 = page.locator('#hero-headline');
    const h1Box = await h1.boundingBox();
    if (h1Box) {
      await page.mouse.move(h1Box.x + h1Box.width / 2, h1Box.y + h1Box.height / 2);
      await page.waitForTimeout(300);

      const distanceGuidesState = await page.evaluate(() => {
        const root = document.querySelector('#agent-hover-root')?.shadowRoot;
        const layer = root?.querySelector('#cp-distance-layer') as HTMLElement;
        const lines = layer ? Array.from(layer.querySelectorAll('.cp-dist-line')) : [];
        const pills = layer ? Array.from(layer.querySelectorAll('.cp-dist-pill')) : [];
        return {
          lineCount: lines.length,
          pillCount: pills.length,
          pills: pills.map((pill) => ({
            text: pill.textContent,
            rect: pill.getBoundingClientRect(),
            color: window.getComputedStyle(pill).color,
            bg: window.getComputedStyle(pill).backgroundColor,
          })),
        };
      });

      expect(distanceGuidesState.lineCount).toBeGreaterThan(0);
      expect(distanceGuidesState.pillCount).toBeGreaterThan(0);
      expect(distanceGuidesState.pills[0].text).toMatch(/\d+px/);
      expect(distanceGuidesState.pills[0].rect.width).toBeGreaterThan(0);
    }
  });

  // --- E. Visual Screenshots (Dark and Light) ---
  test('Visual Screenshots: capture all required states in dark and light themes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const dock = page.locator('#cp-dock');
    const toggleBtn = page.locator('#cp-dock-toggle');
    const pinsBtn = page.locator('#cp-dock-pins');
    const settingsBtn = page.locator('#ah-dock-settings-btn');
    const handle = page.locator('#cp-dock-handle');
    const flyout = page.locator('#cp-flyout');
    const viewSettings = page.locator('#cp-view-settings');

    const setTheme = async (mode: 'dark' | 'light') => {
      await page.evaluate((m) => {
        const root = document.querySelector('#agent-hover-root');
        if (root) {
          root.classList.remove('dark-mode', 'light-mode');
          root.classList.add(m === 'dark' ? 'dark-mode' : 'light-mode');
        }
      }, mode);
      await page.waitForTimeout(200);
    };

    for (const theme of ['dark', 'light'] as const) {
      await setTheme(theme);

      // 1. Idle state
      await page.screenshot({ path: path.join(screenshotsDir, `01-dock-idle-${theme}.png`) });

      // 2. Hover state
      await toggleBtn.hover();
      await page.screenshot({ path: path.join(screenshotsDir, `02-dock-hover-${theme}.png`) });

      // 3. Tooltip state (after 350ms delay)
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotsDir, `03-dock-tooltip-${theme}.png`) });

      // 4. Pressed / Active inspect state
      await toggleBtn.click();
      await page.screenshot({ path: path.join(screenshotsDir, `04-dock-inspect-on-${theme}.png`) });
      await toggleBtn.click(); // turn inspect off

      // 5. Pins panel lit
      await pinsBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, `05-dock-pins-lit-${theme}.png`) });
      await pinsBtn.click(); // close

      // 6. Settings panel lit
      await settingsBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, `06-dock-settings-lit-${theme}.png`) });

      // 7. Badge states at 1, 9, 10+
      for (const count of [1, 9, 12]) {
        await page.evaluate((cnt) => {
          const root = document.querySelector('#agent-hover-root')?.shadowRoot;
          const badge = root?.querySelector('#cp-dock-pin-badge') as HTMLElement;
          if (badge) {
            badge.textContent = cnt > 9 ? '9+' : String(cnt);
            badge.style.display = 'inline-flex';
          }
        }, count);
        await page.screenshot({ path: path.join(screenshotsDir, `07-dock-badge-${count}-${theme}.png`) });
      }

      // Hide badge
      await page.evaluate(() => {
        const root = document.querySelector('#agent-hover-root')?.shadowRoot;
        const badge = root?.querySelector('#cp-dock-pin-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      });

      // 8. Minimized state
      if (!await viewSettings.isVisible()) {
        await settingsBtn.click();
        await page.waitForTimeout(200);
      }
      const minimizeBtn = page.locator('#ah-settings-minimize-btn');
      await minimizeBtn.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, `08-dock-minimized-${theme}.png`) });

      // 9. Restored state
      const restoredBtn = page.locator('#ah-dock-minimized');
      await restoredBtn.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, `09-dock-restored-${theme}.png`) });

      // 10. Mid-drag state
      const hBox = await handle.boundingBox();
      if (hBox) {
        await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(hBox.x - 60, hBox.y - 40, { steps: 5 });
        await page.screenshot({ path: path.join(screenshotsDir, `10-dock-mid-drag-${theme}.png`) });
        await page.mouse.up();
      }

      // Reset position back to center
      if (!await viewSettings.isVisible()) {
        await settingsBtn.click();
        await page.waitForTimeout(200);
      }
      const resetBtn = page.locator('#ah-settings-reset-pos-btn');
      await resetBtn.click();
      await page.keyboard.press('Escape');

      // 11. Spacing overlay on
      await toggleBtn.click();
      const heroBadge = page.locator('#hero-badge').first();
      await heroBadge.click({ force: true });
      const spacingBtn = page.locator('#cp-toggle-spacing');
      await spacingBtn.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, `11-spacing-overlay-on-${theme}.png`) });

      // 12. Measure mode on
      const h1El = page.locator('#hero-headline');
      const h1Box = await h1El.boundingBox();
      if (h1Box) {
        await page.mouse.move(h1Box.x + h1Box.width / 2, h1Box.y + h1Box.height / 2);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(screenshotsDir, `12-measure-mode-on-${theme}.png`) });
      }

      // Clean up for next theme iteration
      await page.keyboard.press('Escape');
      await toggleBtn.click();
    }
  });
});
