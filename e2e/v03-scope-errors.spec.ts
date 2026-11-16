import { test, expect, type Page } from '@playwright/test';
import { bridge, openDemo, selectHost } from './helpers/overlay';

async function findTask(api: ReturnType<typeof bridge>, instruction: string) {
  let task: any = null;
  await expect.poll(async () => {
    task = (await api.get('/agent/tasks?limit=30')).tasks.find((t: any) => t.instruction === instruction);
    return !!task;
  }).toBe(true);
  created.push(task.id);
  return task;
}

/** Tasks a test sent, removed afterwards so the next test (or browser) starts with no markers or queued tasks. */
const created: string[] = [];
test.afterEach(async ({ request }) => {
  if (created.length) await bridge(request).post('/agent/tasks/remove', { ids: created.splice(0) });
});

async function ask(page: Page, text: string) {
  await page.locator('#ah-pill-ask').click();
  await page.locator('#ah-comp-input').fill(text);
}

test.describe('0.3 scope and page errors', () => {
  test('a shared component: Ask says how many there are, outlines them on hover, and sends the choice', async ({ page, request }) => {
    await openDemo(page);
    const api = bridge(request);
    await api.post('/agent/presence', { client: 'claude-code' });
    // The amount inside the second <StatCard />.
    await selectHost(page, 'text=$3,150');
    const text = `Make the amount red ${Date.now()}`;
    await ask(page, text);
    const scope = page.locator('#ah-comp-scope');
    await expect(scope).toBeVisible();
    await expect(scope).toContainText('<StatCard /> is used 3 times here');
    await expect(scope.locator('[data-scope=instance]')).toHaveAttribute('aria-pressed', 'true');
    await scope.hover();
    await expect(page.locator('#ah-layer-scope .ah-batch-outline')).toHaveCount(3);
    await scope.locator('[data-scope=component]').click();
    await page.locator('#ah-comp-send').click();
    const task = await findTask(api, text);
    expect(task.scope).toBe('component');
    expect(task.target.instanceCount).toBe(3);
    expect(task.payload.prompt).toContain('change the component itself, so every one of them gets the change');
    await expect(page.locator('#ah-layer-scope .ah-batch-outline')).toHaveCount(0);
  });

  test('an element used once has no scope choice', async ({ page }) => {
    await openDemo(page);
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    await expect(page.locator('#ah-comp-scope')).toBeHidden();
  });

  test('console errors and failed requests on the page go into the prompt, and Settings turns it off', async ({ page, request }) => {
    await openDemo(page);
    const api = bridge(request);
    await api.post('/agent/presence', { client: 'claude-code' });
    await page.evaluate(async () => {
      console.error('Invoice total is NaN for client 7');
      await fetch('http://127.0.0.1:9/invoices?token=secret123').catch(() => {});
    });
    await selectHost(page, '#hero-primary-cta');
    const text = `Fix the total ${Date.now()}`;
    await ask(page, text);
    await page.locator('#ah-comp-send').click();
    const task = await findTask(api, text);
    expect(task.payload.prompt).toContain('## On this page');
    expect(task.payload.prompt).toContain('Console error: Invoice total is NaN for client 7');
    expect(task.payload.prompt).toMatch(/Failed request: GET http:\/\/127\.0\.0\.1:9\/invoices\?token=… → \S/);
    expect(task.payload.prompt).not.toContain('secret123');

    await page.locator('#ah-d-more').click();
    await page.locator('#ah-dock-menu [data-act=settings]').click();
    await page.locator('[data-seg=page-errors] [data-v=off]').click();
    await page.keyboard.press('Escape');
    await selectHost(page, '#hero-secondary-cta');
    const text2 = `Fix it again ${Date.now()}`;
    await ask(page, text2);
    await page.locator('#ah-comp-send').click();
    expect((await findTask(api, text2)).payload.prompt).not.toContain('On this page');
  });
});
