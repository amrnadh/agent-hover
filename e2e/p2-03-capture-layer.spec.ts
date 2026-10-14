import { test, expect } from '@playwright/test';
import { shotsDir } from './helpers/overlay';
import { pointClearOfPopover } from './helpers/bridge';
import fs from 'fs/promises';
import path from 'path';

test.describe('P2-03 Capture Layer & Wheel Forwarding', () => {
  test('handles inspect clicks, Shift passthrough, and wheel forwarding without polluting host', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const overlayRoot = page.locator('#agent-hover-root');
    await expect(overlayRoot).toBeAttached();

    // 1. Inject host interactive test elements
    await page.evaluate(() => {
      (window as any).__testClicks = 0;

      const testContainer = document.createElement('div');
      testContainer.id = 'p2-03-test-container';
      testContainer.style.position = 'fixed';
      testContainer.style.top = '100px';
      testContainer.style.left = '50px';
      testContainer.style.zIndex = '100';
      testContainer.style.padding = '16px';
      testContainer.style.background = '#ffffff';
      testContainer.style.border = '2px solid #333333';
      testContainer.style.borderRadius = '8px';
      testContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

      testContainer.innerHTML = `
        <h4 style="margin: 0 0 8px 0; color: #000;">P2-03 Host Test Fixture</h4>
        <button id="p2-03-counter-btn" style="padding: 6px 12px; margin-right: 8px; cursor: pointer;">
          Host Button (Clicks: <span id="p2-03-count">0</span>)
        </button>
        <input id="p2-03-input" type="text" placeholder="Type here..." style="padding: 6px 8px; margin-bottom: 12px;" />
        <div id="p2-03-scrollbox" style="width: 260px; height: 90px; overflow-y: auto; border: 1px solid #ccc; padding: 8px; background: #f9f9f9;">
          <div style="height: 350px; color: #333;">
            <p>Scrollable item 1</p>
            <p>Scrollable item 2</p>
            <p>Scrollable item 3</p>
            <p>Scrollable item 4</p>
            <p>Scrollable item 5</p>
            <p>End of scroll box</p>
          </div>
        </div>
      `;

      document.body.appendChild(testContainer);

      const btn = document.getElementById('p2-03-counter-btn')!;
      const countSpan = document.getElementById('p2-03-count')!;
      btn.addEventListener('click', () => {
        (window as any).__testClicks += 1;
        countSpan.textContent = String((window as any).__testClicks);
      });
    });

    const counterBtn = page.locator('#p2-03-counter-btn');
    const inputEl = page.locator('#p2-03-input');
    const scrollBox = page.locator('#p2-03-scrollbox');
    await expect(counterBtn).toBeVisible();

    // 2. With inspect mode OFF:
    // Clicking host button increments click count
    await counterBtn.click();
    let clicks = await page.evaluate(() => (window as any).__testClicks);
    expect(clicks).toBe(1);

    // Typing in host input works
    await inputEl.fill('Hello Host');
    await expect(inputEl).toHaveValue('Hello Host');

    // 3. Turn inspect mode ON:
    const dockToggle = page.locator('#ah-d-inspect');
    await dockToggle.click();

    // Verify #ah-capture-layer is active
    const captureLayerActive = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const layer = root?.shadowRoot?.querySelector('#ah-capture-layer');
      return layer?.classList.contains('is-active');
    });
    expect(captureLayerActive).toBe(true);

    // Click over the host button while inspecting
    await counterBtn.click({ force: true });

    // Verify the click was intercepted by the capture layer (host click count did NOT increment)
    clicks = await page.evaluate(() => (window as any).__testClicks);
    expect(clicks).toBe(1);

    // Verify the selection's action pill appears
    await expect(page.locator('#ah-pill')).toBeVisible();

    // Save screenshot of active inspection mode
    const screenshotsDir = shotsDir('P2-03');
    await fs.mkdir(screenshotsDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotsDir, '01-capture-layer-active.png') });

    // 4. Test Shift Passthrough:
    // Hold down Shift key
    await page.keyboard.down('Shift');

    const isPassthrough = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const layer = root?.shadowRoot?.querySelector('#ah-capture-layer');
      return layer?.classList.contains('is-passthrough');
    });
    expect(isPassthrough).toBe(true);

    // Click the host button while holding Shift
    await counterBtn.click();

    // Host click count should now increment because passthrough allowed the click to reach host
    clicks = await page.evaluate(() => (window as any).__testClicks);
    expect(clicks).toBe(2);

    await page.screenshot({ path: path.join(screenshotsDir, '02-shift-passthrough.png') });

    // Release Shift key
    await page.keyboard.up('Shift');

    const isPassthroughReleased = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const layer = root?.shadowRoot?.querySelector('#ah-capture-layer');
      return layer?.classList.contains('is-passthrough');
    });
    expect(isPassthroughReleased).toBe(false);

    // 5. Test Wheel Forwarding while inspecting (close the selection so its popover doesn't cover the small scroll box):
    await page.locator('#ah-pill-close').click();
    await expect(page.locator('#ah-pill')).toBeHidden();
    const initialScrollTop = await scrollBox.evaluate((el) => el.scrollTop);
    expect(initialScrollTop).toBe(0);

    const boxBounding = await scrollBox.boundingBox();
    expect(boxBounding).toBeTruthy();

    if (boxBounding) {
      const pt = await pointClearOfPopover(page, boxBounding);
      await page.mouse.move(pt.x, pt.y);
      await page.mouse.wheel(0, 80);
      await page.waitForTimeout(200);

      const scrolledTop = await scrollBox.evaluate((el) => el.scrollTop);
      expect(scrolledTop).toBeGreaterThan(0);
    }

    // 6. Turn inspect mode OFF:
    await dockToggle.click();
    const captureLayerOff = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const layer = root?.shadowRoot?.querySelector('#ah-capture-layer');
      return layer?.classList.contains('is-active');
    });
    expect(captureLayerOff).toBe(false);
  });
});
