import { test, expect, type Page } from '@playwright/test';
import { bridge, openDemo, selectHost } from './helpers/overlay';

/** What the Tasks tab and card offer for each outcome: withdraw a waiting task, Send again, Try again, and a dev server that needs a restart. */
test.describe('0.2 task flow', () => {
  async function ask(page: Page, text: string) {
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    await page.locator('#ah-comp-input').fill(text);
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.locator('#ah-composer')).toBeHidden();
    await page.keyboard.press('Escape');
  }

  test('a waiting task can be withdrawn from the list; a cancelled one sent again', async ({ page, request }) => {
    const api = bridge(request);
    await openDemo(page);
    const find = async (text: string) => (await api.get('/agent/tasks?limit=50')).tasks.find((t: any) => t.instruction === text);

    const waiting = `Withdraw me ${Date.now()}`;
    await ask(page, waiting);
    await expect.poll(async () => (await find(waiting))?.status).toBe('queued');
    await page.keyboard.press('t');
    const side = page.locator('#ah-side');
    const row = side.locator('.ah-li.task', { hasText: waiting });
    await row.hover();
    await row.locator('[data-act=remove]').click();
    await expect(row).toHaveCount(0);
    await expect.poll(async () => !!(await find(waiting))).toBe(false);

    const again = `Send me again ${Date.now()}`;
    await ask(page, again);
    let first: any;
    await expect.poll(async () => (first = await find(again))?.status).toBe('queued');
    await api.post(`/agent/tasks/${first.id}/cancel`, {});
    // Cancelled: in the folded History group, with Send again.
    await page.keyboard.press('t');
    await page.keyboard.press('t');
    await side.locator('[data-act=history]').click();
    const old = side.locator('.ah-li.task', { hasText: again });
    await old.click();
    await old.locator('[data-act=retry]').click();
    await expect.poll(async () => {
      const t = await find(again);
      return t && t.id !== first.id ? t.payload.retryOf : null;
    }).toBe(first.id);
    await expect(side.locator('.ah-li.task', { hasText: again })).toHaveCount(1);
  });

  test('a failed task needs you: badge, Try again, and no Undo when nothing changed', async ({ page, request }) => {
    const api = bridge(request);
    await openDemo(page);
    await api.post('/agent/presence', { client: 'claude-code' });
    const text = `Fail on purpose ${Date.now()}`;
    await ask(page, text);
    let id = '';
    await expect.poll(async () => (id = (await api.get('/agent/tasks?limit=20')).tasks.find((t: any) => t.instruction === text)?.id || '')).not.toBe('');
    expect(await api.takeTask(id)).toBeTruthy();
    await api.post(`/agent/tasks/${id}/claim`, { client: 'claude-code' });
    await api.post(`/agent/tasks/${id}/complete`, { status: 'failed', error: 'Could not find the button' });

    await page.keyboard.press('t');
    const side = page.locator('#ah-side');
    await expect(side.locator('#ah-n-tasks')).not.toHaveText('');
    const row = side.locator('.ah-li.task', { hasText: text });
    await row.click();
    await expect(row.locator('[data-act=retry]')).toHaveText(/Try again/);
    await expect(row.locator('[data-act=undo]')).toHaveCount(0);
    await expect(row).toContainText('Could not find the button');
    // R in the open card sends it again.
    await page.locator('.ah-marker.failed').first().click();
    await expect(page.locator('#ah-task-card')).toContainText('Try again');
    await page.keyboard.press('r');
    await expect.poll(async () => (await api.get('/agent/tasks?limit=50')).tasks.some((t: any) => t.payload?.retryOf === id)).toBe(true);
  });

  test('a dev server still running the old bridge after an update asks for a restart', async ({ page }) => {
    // The bridge answers like one from before 0.2.1: no API level.
    await page.route('**/api/health', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      delete body.api;
      await route.fulfill({ response: res, json: body });
    });
    await openDemo(page);
    await page.keyboard.press('Alt');
    await page.keyboard.press('t');
    await expect(page.locator('#ah-side .ah-banner')).toContainText('Restart your dev server');
    await page.locator('#ah-d-mark').click();
    await expect(page.locator('#ah-conn')).toContainText('Restart your dev server');
  });
});
