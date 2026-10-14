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
    if (await captureNow.isVisible().catch(() => false)) await captureNow.click();
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
});
