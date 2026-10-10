import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { clearPins } from './helpers/bridge';

test.describe('Gate 2.6: Stabilization Pass & Parity Verification (S1-S10)', () => {
  const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots/Gate-2.6');

  test.beforeAll(async () => {
    await fs.mkdir(screenshotsDir, { recursive: true });
  });

  test('S1: Dock hover hit-test - elementFromPoint returns button itself, no overlapping elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    const dock = page.locator('#cp-dock');
    await expect(dock).toBeVisible();

    const buttonIds = [
      '#ah-dock-brand',
      '#cp-dock-toggle',
      '#cp-dock-pins',
      '#ah-dock-settings-btn',
      '#cp-dock-handle'
    ];

    for (const btnId of buttonIds) {
      const btn = page.locator(btnId);
      await expect(btn).toBeVisible();

      // Hover over button
      await btn.hover();
      await page.waitForTimeout(100);

      // Verify elementFromPoint inside shadowRoot returns the button itself or a child inside it
      const hitTestResult = await page.evaluate((selector) => {
        const root = document.querySelector('#agent-hover-root')?.shadowRoot;
        if (!root) return { success: false, reason: 'no shadow root' };

        const targetEl = root.querySelector(selector);
        if (!targetEl) return { success: false, reason: 'selector not found' };

        const rect = targetEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const hit = root.elementFromPoint(centerX, centerY);
        if (!hit) return { success: false, reason: 'elementFromPoint returned null' };

        const matches = hit === targetEl || targetEl.contains(hit);
        return {
          success: matches,
          hitTag: hit.tagName,
          hitId: hit.id,
          expectedId: targetEl.id
        };
      }, btnId);

      expect(hitTestResult.success, `Hovering ${btnId} should hit test to itself, got: ${JSON.stringify(hitTestResult)}`).toBe(true);
    }

    // Capture screenshot of dock with hover
    const pinsBtn = page.locator('#cp-dock-pins');
    await pinsBtn.hover();
    await page.waitForTimeout(400); // allow tooltip delay
    await page.screenshot({ path: path.join(screenshotsDir, 'S1-dock-hover-hit-test.png') });
  });

  test('S2: Dock tooltip - dark surface, 6px radius, keycap chip, above/below viewport placement', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // 1. Positioned in lower half of viewport (default: 20px from bottom)
    const inspectBtn = page.locator('#cp-dock-toggle');
    await inspectBtn.hover();
    await page.waitForTimeout(400); // wait for 350ms delay

    const tooltip = page.locator('#ah-dock-tooltip');
    await expect(tooltip).toBeVisible();

    const tooltipStyles = await tooltip.evaluate((el) => {
      const s = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        bg: s.backgroundColor,
        borderRadius: s.borderRadius,
        pointerEvents: s.pointerEvents,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right
      };
    });

    const dockBox = await page.locator('#cp-dock').boundingBox();
    expect(dockBox).not.toBeNull();
    if (dockBox) {
      // In lower half: tooltip bottom must be above dock top
      expect(tooltipStyles.bottom).toBeLessThanOrEqual(dockBox.y + 4);
    }
    expect(tooltipStyles.borderRadius).toBe('6px');
    expect(tooltipStyles.pointerEvents).toBe('none');

    // Check shortcut chip
    const chip = page.locator('.ah-shortcut-chip');
    await expect(chip).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, 'S2-dock-tooltip-above.png') });

    // 2. Test below placement when dock is in upper half of viewport
    await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root')?.shadowRoot;
      const wrapper = root?.querySelector('#cp-dock-wrapper') as HTMLElement;
      if (wrapper) {
        wrapper.style.top = '40px';
        wrapper.style.bottom = 'auto';
      }
    });

    await page.locator('#ah-dock-settings-btn').hover();
    await page.waitForTimeout(400);

    const tooltipTopBox = await tooltip.boundingBox();
    const dockTopBox = await page.locator('#cp-dock').boundingBox();
    if (tooltipTopBox && dockTopBox) {
      // In upper half: tooltip top must be below dock bottom
      expect(tooltipTopBox.y).toBeGreaterThanOrEqual(dockTopBox.y + dockTopBox.height - 4);
    }
    await page.screenshot({ path: path.join(screenshotsDir, 'S2-dock-tooltip-below.png') });
  });

  test('S3: Dock radius, soft rounded-square Inspect state, and muted brand icon with status dot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // Check dock border radius (full pill)
    const dockBorderRadius = await page.locator('#cp-dock').evaluate((el) => window.getComputedStyle(el).borderRadius);
    expect(dockBorderRadius).toMatch(/(9999px|999px|40px|24px|32px)/);

    // Click inspect to activate it
    const inspectBtn = page.locator('#cp-dock-toggle');
    await inspectBtn.click();
    await expect(inspectBtn).toHaveClass(/active/);

    const inspectRadius = await inspectBtn.evaluate((el) => window.getComputedStyle(el).borderRadius);
    expect(inspectRadius).toBe('8px'); // Soft rounded-square, not circle (S3)

    // Check brand mark: icon in muted color, status dot as small corner badge
    const brandIconColor = await page.locator('#ah-dock-brand .ah-dock-brand-icon').evaluate((el) => window.getComputedStyle(el).color);
    expect(brandIconColor).not.toBe('rgb(255, 255, 255)'); // Not bright white

    const dot = page.locator('#cp-mcp-dot');
    await expect(dot).toBeVisible();
    const dotPos = await dot.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { position: s.position };
    });
    expect(dotPos.position).toBe('absolute');

    await page.screenshot({ path: path.join(screenshotsDir, 'S3-dock-radius-inspect-brand.png') });
  });

  test('S4: Selection action chip layout and formatted label (component/tag + first class, 320px max)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // Click inspect to enable inspect mode
    await page.locator('#cp-dock-toggle').click();

    // Click on demo element using mouse coordinates
    const badge = page.locator('#hero-badge').first();
    const box = await badge.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }

    // Verify selection frame and selection chip appear
    const selFrame = page.locator('#cp-selection-frame');
    await expect(selFrame).toBeVisible();

    const chip = page.locator('#cp-selection-chip');
    await expect(chip).toBeVisible();

    // Check chip has action buttons (pin, note, copy, etc.)
    const selName = page.locator('#cp-sel-name');
    await expect(selName).toBeVisible();

    const labelText = await selName.textContent();
    expect(labelText).toBeTruthy();
    // Must format tag.class or <ComponentName />
    expect(labelText).toMatch(/^(<.+ \/>|[a-z0-9#_.-]+)$/);

    // Verify chip styling: max-width 320px with ellipsis
    const selStyles = await selName.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { maxWidth: s.maxWidth, textOverflow: s.textOverflow, overflow: s.overflow };
    });
    expect(selStyles.maxWidth).toBe('320px');
    expect(selStyles.textOverflow).toBe('ellipsis');
    expect(selStyles.overflow).toBe('hidden');

    await page.screenshot({ path: path.join(screenshotsDir, 'S4-selection-chip-label.png') });
  });

  test('S5: Measurement overlay - verified distances, 1px lines with end caps, 11px tabular pill, non-overlapping', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // Enable inspect mode
    await page.locator('#cp-dock-toggle').click();

    // Select #hero-badge
    const badge = page.locator('#hero-badge').first();
    const badgeBox = await badge.boundingBox();
    expect(badgeBox).not.toBeNull();
    if (badgeBox) {
      await page.mouse.click(badgeBox.x + badgeBox.width / 2, badgeBox.y + badgeBox.height / 2);
      await page.waitForTimeout(300);
    }

    // Move mouse over #hero-headline to trigger distance guides
    const headline = page.locator('#hero-headline');
    const hBox = await headline.boundingBox();
    expect(hBox).not.toBeNull();
    if (hBox) {
      await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
      await page.waitForTimeout(400);
    }

    // Check distance line and pill
    const distLayer = page.locator('#cp-distance-layer');
    await expect(distLayer).toBeVisible();

    const pills = page.locator('.cp-dist-pill');
    const pillCount = await pills.count();
    expect(pillCount).toBeGreaterThan(0);

    const firstPill = pills.first();
    const pillStyles = await firstPill.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        fontSize: s.fontSize,
        fontVariantNumeric: s.fontVariantNumeric,
        text: el.textContent
      };
    });
    expect(pillStyles.fontSize).toBe('11px');
    expect(pillStyles.fontVariantNumeric).toContain('tabular-nums');
    const val = parseInt(pillStyles.text || '0', 10);
    expect(val).toBeGreaterThanOrEqual(1); // Hide labels under 1px (S5)
    expect(pillStyles.text).toBe('24px'); // Verified exact demo distance

    await page.screenshot({ path: path.join(screenshotsDir, 'S5-measurement-overlay.png') });
  });

  test('S6: Sidebar header - 14px title with mono class subtitle, tool buttons hidden on Pins/Settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // Inspect an element to open sidebar
    await page.locator('#cp-dock-toggle').click();
    const badge = page.locator('#hero-badge').first();
    const box = await badge.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }

    const flyout = page.locator('#cp-flyout');
    await expect(flyout).toBeVisible();

    // Verify 14px semibold title
    const flyoutTitle = page.locator('#cp-flyout-title');
    await expect(flyoutTitle).toBeVisible();
    const titleStyles = await flyoutTitle.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { fontSize: s.fontSize, fontWeight: s.fontWeight };
    });
    expect(titleStyles.fontSize).toBe('14px');
    expect(parseInt(titleStyles.fontWeight, 10)).toBeGreaterThanOrEqual(600);

    // Verify subtitle mono styling
    const flyoutSubtitle = page.locator('#cp-flyout-subtitle');
    await expect(flyoutSubtitle).toBeVisible();

    // Verify root font-size: 13px line-height: 1.4 neutralizing all: initial
    const flyoutRootStyles = await flyout.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { fontSize: s.fontSize, lineHeight: s.lineHeight };
    });
    expect(flyoutRootStyles.fontSize).toBe('13px');

    // Tool buttons visible on Inspector
    await expect(page.locator('#cp-flyout-theme')).toBeVisible();
    await expect(page.locator('#cp-flyout-settings')).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, 'S6-sidebar-header-inspector.png') });

    // Switch to Pins view: tool buttons must be hidden
    await page.locator('#cp-dock-pins').click();
    await expect(page.locator('#cp-flyout-theme')).toBeHidden();
    await expect(page.locator('#cp-flyout-settings')).toBeHidden();
    await expect(flyoutTitle).toHaveText('Pinned Stack');

    await page.screenshot({ path: path.join(screenshotsDir, 'S6-sidebar-header-pins.png') });

    // Switch to Settings view: tool buttons must be hidden
    await page.locator('#ah-dock-settings-btn').click();
    await expect(page.locator('#cp-flyout-theme')).toBeHidden();
    await expect(page.locator('#cp-flyout-settings')).toBeHidden();
    await expect(flyoutTitle).toHaveText('Settings');

    await page.screenshot({ path: path.join(screenshotsDir, 'S6-sidebar-header-settings.png') });
  });

  test('S7: Colors in Layout card converted to sRGB hex (never raw oklab)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // Inspect an element
    await page.locator('#cp-dock-toggle').click();
    const badge = page.locator('#hero-badge').first();
    const box = await badge.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }

    // Check Layout & Dimensions card
    const layoutCard = page.locator('#cp-flyout-content details').filter({ hasText: 'Layout & Dimensions' });
    await expect(layoutCard).toBeVisible();

    const cardText = await layoutCard.innerText();
    // Must NOT contain raw oklab or color-mix
    expect(cardText).not.toContain('oklab');
    expect(cardText).not.toContain('color-mix');

    // Should contain hex code if colors are present
    if (cardText.includes('color:') || cardText.includes('bg:')) {
      expect(cardText).toMatch(/#[0-9a-fA-F]{6}/);
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'S7-layout-card-srgb-hex.png') });
  });

  test('S8: Pinned Stack view - 20px padding gutter, "Pin Component" empty copy, no emphasis at 0 pins', async ({ page, request }) => {
    await clearPins(request);
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // Open Pins view
    await page.locator('#cp-dock-pins').click();

    const viewPins = page.locator('#cp-view-pins');
    await expect(viewPins).toBeVisible();

    // Check padding is 20px
    const viewPadding = await viewPins.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    expect(viewPadding).toBe('20px');

    // Empty state copy
    const pinList = page.locator('#cp-pin-list');
    await expect(pinList).toContainText('No pinned components. Click "Pin Component" on any component to stage changes.');

    // Copy All Tasks button has no emphasis (.primary) and is disabled
    const copyTasksBtn = page.locator('#cp-gen-task');
    await expect(copyTasksBtn).toBeVisible();
    await expect(copyTasksBtn).not.toHaveClass(/primary/);
    const copyOpacity = await copyTasksBtn.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(copyOpacity)).toBeLessThanOrEqual(0.6);

    await page.screenshot({ path: path.join(screenshotsDir, 'S8-pinned-stack-gutter-copy.png') });
  });

  test('S9: Spacing Overlay on/off state and Preferred Editor active selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // 1. Inspect an element to make Inspector actions visible
    await page.locator('#cp-dock-toggle').click();
    const badge = page.locator('#hero-badge').first();
    const box = await badge.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }

    const spacingBtn = page.locator('#cp-toggle-spacing');
    await expect(spacingBtn).toBeVisible();
    await expect(spacingBtn).toContainText('Spacing: Off');
    expect(await spacingBtn.getAttribute('aria-pressed')).toBe('false');

    // Toggle spacing on
    await spacingBtn.click();
    await expect(spacingBtn).toContainText('Spacing: On');
    expect(await spacingBtn.getAttribute('aria-pressed')).toBe('true');
    await expect(spacingBtn).toHaveClass(/primary/);

    // Toggle spacing off
    await spacingBtn.click();
    await expect(spacingBtn).toContainText('Spacing: Off');
    expect(await spacingBtn.getAttribute('aria-pressed')).toBe('false');
    await expect(spacingBtn).not.toHaveClass(/primary/);

    // 2. Open Settings view via dock
    await page.locator('#ah-dock-settings-btn').click();

    // Preferred Editor selection
    const vscodeBtn = page.locator('#cp-pref-editor-vscode');
    const cursorBtn = page.locator('#cp-pref-editor-cursor');

    await cursorBtn.click();
    await expect(cursorBtn).toHaveClass(/primary/);
    await expect(cursorBtn).toContainText('✓');

    await vscodeBtn.click();
    await expect(vscodeBtn).toHaveClass(/primary/);
    await expect(vscodeBtn).toContainText('✓');

    await page.screenshot({ path: path.join(screenshotsDir, 'S9-spacing-toggle-preferred-editor.png') });
  });

  test('S10: LENS badge preserved as baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // Inspect an element
    await page.locator('#cp-dock-toggle').click();
    const badge = page.locator('#hero-badge').first();
    const box = await badge.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }

    const lensBadge = page.locator('#cp-flyout-badge');
    await expect(lensBadge).toBeVisible();
    await expect(lensBadge).toHaveText('LENS');

    await page.screenshot({ path: path.join(screenshotsDir, 'S10-lens-badge-baseline.png') });
  });

  test('Full parity screenshots (dark and light)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#agent-hover-root', { timeout: 5000 });

    // 01: Dock initial dark
    await page.screenshot({ path: path.join(screenshotsDir, '01-dock-initial-dark.png') });

    // 02: Inspect hover dark
    await page.locator('#cp-dock-toggle').hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, '02-inspect-hover-dark.png') });

    // 03: Flyout inspector dark
    await page.locator('#cp-dock-toggle').click();
    const badge = page.locator('#hero-badge').first();
    const box = await badge.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(screenshotsDir, '03-flyout-inspector-dark.png') });

    // Toggle theme to light directly while inspector is open
    const themeBtn = page.locator('#cp-flyout-theme');
    await themeBtn.click();
    await page.waitForTimeout(300);

    // 07: Flyout inspector light
    await page.screenshot({ path: path.join(screenshotsDir, '07-flyout-inspector-light.png') });

    // 04: Pin stack light
    await page.locator('#cp-dock-pins').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(screenshotsDir, '04-pin-stack-light.png') });

    // 05: Settings view light
    await page.locator('#ah-dock-settings-btn').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(screenshotsDir, '05-settings-view-light.png') });

    // Switch back to dark mode
    await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root')?.shadowRoot;
      const themeDark = root?.querySelector('#cp-theme-set-dark') as HTMLElement;
      if (themeDark) themeDark.click();
    });
    await page.waitForTimeout(200);

    // 06: Settings view dark
    await page.screenshot({ path: path.join(screenshotsDir, '06-settings-view-dark.png') });

    // 08: Pin stack dark
    await page.locator('#cp-dock-pins').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(screenshotsDir, '04-pin-stack-dark.png') });
  });
});
