import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

function readDemoSession() {
  try {
    const sessionFile = path.resolve('demo/.agent-hover/session.json');
    if (fs.existsSync(sessionFile)) {
      return JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    }
  } catch {}
  return null;
}

test.describe('Agent Hover Baseline E2E Smoke Test (P0-02)', () => {
  let bridgeToken = '';
  let bridgePort = 9850;

  test.beforeEach(async () => {
    const session = readDemoSession();
    if (session) {
      bridgeToken = session.token;
      bridgePort = session.port;
    }
  });

  test('inspects component, clicks Send to Agent, asserts bridge task & pin stack', async ({ page, request }) => {
    // 1. Open demo app
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // If session was written during startup, ensure we have the latest token
    if (!bridgeToken) {
      const session = readDemoSession();
      if (session) {
        bridgeToken = session.token;
        bridgePort = session.port;
      }
    }

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
      const res = await request.get(`http://localhost:${bridgePort}/api/agent/latest`, {
        headers: bridgeToken ? { Authorization: `Bearer ${bridgeToken}` } : {},
      });
      if (!res.ok()) return null;
      const json = await res.json();
      return json.task?.prompt || json.task?.type;
    }, { timeout: 10000 }).toBeTruthy();

    // 7. Click dock pins tile to assert pin stack opens
    const dockPins = page.locator('#cp-dock-pins');
    await expect(dockPins).toBeVisible();
    await dockPins.click();

    const pinBar = page.locator('#cp-pin-bar');
    await expect(pinBar).toBeVisible();
  });

  test('dispatches pinned tasks stack to agent without ReferenceError (P0-08 / F-05)', async ({ page, request }) => {
    // 1. Open demo app
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Ensure session token is loaded
    if (!bridgeToken) {
      const session = readDemoSession();
      if (session) {
        bridgeToken = session.token;
        bridgePort = session.port;
      }
    }

    // 2. Add a pin via bridge API
    const pinRes = await request.post(`http://localhost:${bridgePort}/api/pins`, {
      headers: bridgeToken ? { Authorization: `Bearer ${bridgeToken}` } : {},
      data: {
        action: 'add',
        file: 'src/App.tsx',
        line: 10,
        task: 'Refactor hero section',
      },
    });
    expect(pinRes.ok()).toBe(true);

    // 3. Open pin stack via dock
    const dockPins = page.locator('#cp-dock-pins');
    await expect(dockPins).toBeVisible();
    await dockPins.click();

    const pinBar = page.locator('#cp-pin-bar');
    await expect(pinBar).toBeVisible();

    // 4. Fill overall goal
    const taskInput = page.locator('#cp-task-input');
    await expect(taskInput).toBeVisible();
    await taskInput.fill('Modernize theme styling');

    // 5. Click "Send Pinned Tasks to Agent"
    const pinSendAgentBtn = page.locator('#cp-pin-send-agent');
    await expect(pinSendAgentBtn).toBeVisible();
    await pinSendAgentBtn.click();

    // 6. Verify button shows sent confirmation
    await expect(pinSendAgentBtn).toContainText('Sent', { timeout: 5000 });

    // 7. Verify bridge received a pinned-stack task
    await expect.poll(async () => {
      const res = await request.get(`http://localhost:${bridgePort}/api/agent/latest`, {
        headers: bridgeToken ? { Authorization: `Bearer ${bridgeToken}` } : {},
      });
      if (!res.ok()) return null;
      const json = await res.json();
      return json.task?.type === 'pinned-stack' ? json.task : null;
    }, { timeout: 10000 }).toBeTruthy();
  });
});

