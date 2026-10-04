import { test, expect } from '@playwright/test';

test.describe('Agent Hover Baseline E2E Smoke Test (P0-02)', () => {
  test('inspects component, clicks Send to Agent, asserts bridge task & pin stack', async ({ page, request }) => {
    // 1. Open demo app
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify overlay root exists
    const overlayRoot = page.locator('#agent-hover-root');
    await expect(overlayRoot).toBeAttached();

    // 2. Enable inspect mode via dock toggle
    const dockToggle = page.locator('#cp-dock-toggle');
    await expect(dockToggle).toBeVisible();
    await dockToggle.click();

    // 3. Select a component on the host page (e.g. hero section or headline)
    const hostElement = page.locator('h1').first();
    await expect(hostElement).toBeVisible();
    await hostElement.click();

    // 4. Verify flyout inspector opens
    const flyout = page.locator('#cp-flyout');
    await expect(flyout).toBeVisible();

    // Click component card if rendered inside a component
    const parentCompCard = page.locator('#cp-parent-comp-card');
    if (await parentCompCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await parentCompCard.click();
    }

    // 5. Click "Send to Agent" button
    const sendBtn = page.locator('#cp-send-agent-btn');
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // Verify button shows sent confirmation
    await expect(sendBtn).toContainText('Sent', { timeout: 5000 });

    // 6. Assert bridge received the task via bridge API
    await expect.poll(async () => {
      const res = await request.get('http://localhost:9850/api/agent/latest');
      if (!res.ok()) return null;
      const json = await res.json();
      return json.task?.prompt || json.task?.type;
    }, { timeout: 10000 }).toBeDefined();

    // 7. Click dock pins tile to assert pin stack opens
    const dockPins = page.locator('#cp-dock-pins');
    await expect(dockPins).toBeVisible();
    await dockPins.click();

    const pinBar = page.locator('#cp-pin-bar');
    await expect(pinBar).toBeVisible();
  });
});
