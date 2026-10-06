import { test, expect } from '@playwright/test';

test.describe('P2-02 Isolation, Popover Mounting & Modal Dialog Inert Fallback', () => {
  test('overlay remains isolated against hostile host CSS, top-layer z-index, and modal dialog inertness', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const overlayRoot = page.locator('#agent-hover-root');
    await expect(overlayRoot).toBeAttached();

    // 1. Host CSS Isolation Test: Inject hostile global styles
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'hostile-styles';
      style.textContent = `
        * { letter-spacing: 12px !important; }
        body { text-transform: uppercase !important; }
      `;
      document.head.appendChild(style);
    });

    // Verify shadow DOM elements are unaffected by hostile text-transform or extreme letter-spacing
    const dockBrandCase = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const textEl = root?.shadowRoot?.querySelector('#cp-callout-text');
      if (!textEl) return null;
      const cs = window.getComputedStyle(textEl);
      return {
        textTransform: cs.textTransform,
        letterSpacing: cs.letterSpacing,
      };
    });

    expect(dockBrandCase).toBeTruthy();
    expect(dockBrandCase?.textTransform).not.toBe('uppercase');
    expect(dockBrandCase?.letterSpacing).not.toBe('12px');

    // 2. High Z-Index Host Element
    await page.evaluate(() => {
      const blocker = document.createElement('div');
      blocker.id = 'host-zindex-blocker';
      blocker.style.position = 'fixed';
      blocker.style.inset = '0';
      blocker.style.zIndex = '2147483646';
      blocker.style.pointerEvents = 'none';
      document.body.appendChild(blocker);
    });

    const dockToggle = page.locator('#cp-dock-toggle');
    await expect(dockToggle).toBeVisible();

    // 3. Native <dialog>.showModal() Inertness & Fallback Test
    // Create and open a modal dialog using showModal()
    await page.evaluate(() => {
      const dialog = document.createElement('dialog');
      dialog.id = 'host-modal-dialog';
      dialog.innerHTML = `
        <h3>Host Modal Dialog</h3>
        <p>This modal dialog is active with showModal()</p>
        <button id="modal-close-btn">Close Modal</button>
      `;
      document.body.appendChild(dialog);
      dialog.showModal();
    });

    // Verify overlay host is reparented inside the active modal dialog to defeat inertness
    const isInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('#host-modal-dialog');
      const root = document.querySelector('#agent-hover-root');
      return dialog ? dialog.contains(root) : false;
    });
    expect(isInsideDialog).toBe(true);

    // Verify dock toggle inside the shadow root remains clickable and responds
    await dockToggle.click();
    const isActive = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const toggle = root?.shadowRoot?.querySelector('#cp-dock-toggle');
      return toggle?.classList.contains('active') ?? false;
    });
    expect(isActive).toBe(true);

    // Close the dialog and assert overlay is restored to document.body
    await page.evaluate(() => {
      const dialog = document.querySelector('#host-modal-dialog') as HTMLDialogElement | null;
      dialog?.close();
    });
    await page.waitForTimeout(100);

    // Save visual verification screenshots for P2-02
    const fs = await import('fs');
    const path = await import('path');
    const screenshotDir = path.resolve('docs/screenshots/P2-02');
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, '01-isolation-hostile-css.png'), fullPage: false });

    // Open modal again and capture screenshot of overlay floating inside active dialog
    await page.evaluate(() => {
      const dialog = document.querySelector('#host-modal-dialog') as HTMLDialogElement | null;
      dialog?.showModal();
    });
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(screenshotDir, '02-modal-dialog-reparenting.png'), fullPage: false });

    // Close dialog
    await page.evaluate(() => {
      const dialog = document.querySelector('#host-modal-dialog') as HTMLDialogElement | null;
      dialog?.close();
    });
    await page.waitForTimeout(100);

    const isBackInBody = await page.evaluate(() => {
      const root = document.querySelector('#agent-hover-root');
      const dialog = document.querySelector('#host-modal-dialog');
      return document.body.contains(root) && (!dialog || !dialog.contains(root));
    });
    expect(isBackInBody).toBe(true);

    // 4. Zero pollution assertion: assert nothing added to document.head
    const cursorStyle = await page.evaluate(() => document.getElementById('cp-inspector-cursor'));
    expect(cursorStyle).toBeNull();
  });
});
