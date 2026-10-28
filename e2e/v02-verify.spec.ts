import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { bridge, openDemo, selectHost, shotsDir } from './helpers/overlay';

/** P3-01: before/after compare and Undo, with a scripted "agent" that really edits a demo file. */
test.describe('0.2 compare and undo', () => {
  const heroFile = path.resolve(process.env.AH_DEMO_DIR || 'demo', 'src/components/Hero.tsx');
  const shots = shotsDir('v0.2');
  let original = '';

  test.beforeAll(() => { original = fs.readFileSync(heroFile, 'utf8'); });
  // Never leave the demo modified, even when an assertion fails.
  test.afterAll(() => { fs.writeFileSync(heroFile, original); });

  test('agent edits a file; Compare shows before/after; Undo restores the exact file', async ({ page, request }) => {
    test.setTimeout(60000);
    const api = bridge(request);
    await openDemo(page);
    await api.post('/agent/presence', { client: 'claude-code' });

    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    const instruction = `Change the button label ${Date.now()}`;
    await page.locator('#ah-comp-input').fill(instruction);
    await page.keyboard.press('ControlOrMeta+Enter');

    let id = '';
    await expect.poll(async () => {
      const t = (await api.get('/agent/tasks?limit=10')).tasks.find((x: any) => x.instruction === instruction);
      id = t?.id || '';
      return id;
    }).not.toBe('');
    expect(await api.takeTask(id)).toBeTruthy();
    const claimed = await api.post(`/agent/tasks/${id}/claim`, { client: 'claude-code' });
    expect(claimed.task.checkpointId).toBe(id);

    // The "agent" edits the file; Vite HMR updates the page.
    fs.writeFileSync(heroFile, original.replace('Book a demo\n', 'Book a live demo\n'));
    await expect(page.locator('#hero-primary-cta')).toHaveText(/Book a live demo/, { timeout: 15000 });

    // Completing without a file list: the bridge reports what git saw change.
    const done = await api.post(`/agent/tasks/${id}/complete`, { summary: 'Changed the label.' });
    expect(done.task.result.filesChanged).toEqual(['src/components/Hero.tsx']);

    await page.locator('.ah-marker.done').click();
    const card = page.locator('#ah-task-card');
    await expect(card.locator('[data-act=compare]')).toBeVisible();
    await card.locator('[data-act=compare]').click();
    // The after image is captured once HMR settles; capture now if it is not there yet.
    const captureNow = card.locator('[data-act=capture-after]');
    // The automatic capture can finish (and replace the button) while we click: that's fine too.
    if (await captureNow.isVisible().catch(() => false)) await captureNow.click({ timeout: 5000 }).catch(() => {});
    await expect(card.locator('.ah-compare img')).toHaveCount(2, { timeout: 10000 });
    // The "After" label is a small tag in the corner, not a dark layer over the after image.
    const afterTag = (await card.locator('.ah-compare .tag.after').boundingBox())!;
    expect(afterTag.width).toBeLessThan(80);
    await page.screenshot({ path: path.join(shots, '06-compare.png') });

    await card.locator('[data-act=undo]').click();
    await expect(card.locator('.ah-undo li')).toHaveCount(1);
    await expect(card.locator('.ah-undo')).toContainText('src/components/Hero.tsx');
    await page.screenshot({ path: path.join(shots, '07-undo-confirm.png') });
    await card.locator('[data-act=undo-confirm]').click();
    await expect(page.locator('#ah-toast')).toContainText('Undid 1 file');
    expect(fs.readFileSync(heroFile, 'utf8')).toBe(original);
    await expect(page.locator('#hero-primary-cta')).toHaveText(/^Book a demo$/, { timeout: 15000 });
    await expect(card).toContainText('Undone');
  });

  test('a finished change waits for review: Follow up carries it forward, a locked file is flagged, Keep settles it', async ({ page, request }) => {
    test.setTimeout(60000);
    const api = bridge(request);
    // Start with nothing waiting for review (other specs finish tasks too).
    for (const t of (await api.get('/agent/tasks?limit=100')).tasks) {
      if (t.status === 'done' && !t.review && t.result?.filesChanged?.length) await api.post(`/agent/tasks/${t.id}/review`, { action: 'keep' });
    }
    await openDemo(page);
    await api.post('/agent/presence', { client: 'claude-code' });
    const ask = async (text: string) => {
      await page.locator('#ah-comp-input').fill(text);
      await page.keyboard.press('ControlOrMeta+Enter');
      let task: any = null;
      await expect.poll(async () => (task = (await api.get('/agent/tasks?limit=20')).tasks.find((x: any) => x.instruction === text)) && task.id).toBeTruthy();
      return task;
    };
    const finish = async (id: string) => {
      expect(await api.takeTask(id)).toBeTruthy();
      await api.post(`/agent/tasks/${id}/claim`, { client: 'claude-code' });
      await api.post(`/agent/tasks/${id}/complete`, { summary: 'Raised the CTA to h-12.', filesChanged: ['src/components/Hero.tsx'] });
    };

    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    const first = await ask(`Make the CTA larger ${Date.now()}`);
    await finish(first.id);

    const marker = page.locator('.ah-marker.review');
    await expect(marker).toHaveCount(1);
    await expect(page.locator('#ah-d-tasks-dot')).toBeVisible();
    await marker.click();
    const card = page.locator('#ah-task-card');
    await expect(card.locator('.ah-timeline span').last()).toHaveText('Review');
    await expect(card.locator('[data-act=keep]')).toBeVisible();

    // Follow up: same element, the earlier request and result go into the new prompt.
    await card.locator('[data-act=follow-up]').click();
    await expect(page.locator('#ah-composer')).toBeVisible();
    await expect(page.locator('#ah-comp-follow')).toContainText(first.instruction);
    const second = await ask(`A bit smaller ${Date.now()}`);
    expect(second.payload.followUpOf).toBe(first.id);
    expect(second.payload.prompt).toContain('## Previous attempt');
    expect(second.payload.prompt).toContain(`- Asked: ${first.instruction}`);
    await expect.poll(async () => (await api.get(`/agent/tasks/${first.id}`)).task.review?.state).toBe('followed-up');

    // The agent changes a locked component's file anyway: the marker and card say so.
    const lock = { file: 'src/components/Hero.tsx', component: 'Hero' };
    await api.post('/freeze', { action: 'add', ...lock });
    try {
      await finish(second.id);
      await expect(marker).toHaveClass(/locked/);
      await marker.click();
      await expect(card.locator('.ah-lockwarn')).toContainText('<Hero />');
      await page.screenshot({ path: path.join(shots, '09-lock-guard.png') });

      // Keep settles it: no marker, still settled after a reload.
      await card.locator('[data-act=keep]').click();
      await expect(page.locator('#ah-toast')).toContainText('Kept');
      await expect(marker).toHaveCount(0);
      await expect.poll(async () => (await api.get(`/agent/tasks/${second.id}`)).task.review?.state).toBe('kept');
      await page.reload();
      await page.waitForTimeout(1200);
      await expect(page.locator('.ah-marker.review')).toHaveCount(0);
    } finally {
      await api.post('/freeze', { action: 'remove', ...lock });
    }
  });

  test('tasks leave the list: from the card menu (asking first when Undo would go), or with Clear in History', async ({ page, request }) => {
    test.setTimeout(60000);
    const api = bridge(request);
    await api.post('/agent/tasks/remove', { finished: true });
    await openDemo(page);
    await api.post('/agent/presence', { client: 'claude-code' });
    const send = async (text: string) => {
      await selectHost(page, '#hero-primary-cta');
      await page.locator('#ah-pill-ask').click();
      await page.locator('#ah-comp-input').fill(text);
      await page.keyboard.press('ControlOrMeta+Enter');
      let id = '';
      await expect.poll(async () => (id = (await api.get('/agent/tasks?limit=20')).tasks.find((x: any) => x.instruction === text)?.id || '')).not.toBe('');
      expect(await api.takeTask(id)).toBeTruthy();
      await api.post(`/agent/tasks/${id}/claim`, { client: 'claude-code' });
      await api.post(`/agent/tasks/${id}/complete`, { summary: 'Done.', filesChanged: ['src/components/Hero.tsx'] });
      await page.keyboard.press('Escape');
      return id;
    };
    const exists = async (id: string) => (await api.get('/agent/tasks?limit=50')).tasks.some((t: any) => t.id === id);

    const keptText = `Keep me ${Date.now()}`;
    const kept = await send(keptText);
    await api.post(`/agent/tasks/${kept}/review`, { action: 'keep' });
    const pending = await send(`Remove me ${Date.now()}`);

    // Waiting for review: removing would lose Undo, so the menu asks once more.
    await page.locator('.ah-marker.review').click();
    const card = page.locator('#ah-task-card');
    await card.locator('[data-act=menu]').click();
    await card.locator('[data-act=remove-ask]').click();
    await expect(card.locator('[data-act=remove-confirm]')).toContainText("Undo won't be possible");
    await card.locator('[data-act=remove-confirm]').click();
    await expect(card).toBeHidden();
    await expect.poll(() => exists(pending)).toBe(false);
    await expect(page.locator('.ah-marker.review')).toHaveCount(0);

    // Clear (in the folded History group) takes the kept one.
    await page.keyboard.press('t');
    const side = page.locator('#ah-side');
    await side.locator('[data-act=history]').click();
    // Other specs leave active tasks and changes to review; Clear finished leaves those, and takes the kept one.
    const keptRow = side.locator('.ah-li.task', { hasText: keptText });
    await expect(keptRow).toHaveCount(1);
    await side.locator('[data-act=clear]').click();
    await side.locator('[data-act=clear-yes]').click();
    await expect(keptRow).toHaveCount(0);
    await expect.poll(() => exists(kept)).toBe(false);
  });
});
