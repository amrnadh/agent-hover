import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { bridge, openDemo, selectHost, startInspect, overlaps, shadowActiveId } from './helpers/overlay';

/** Main flow (docs/UX-NORTH-STAR.md steps 3–6): hover → select → pill → Ask → send → marker → done. */
test.describe('0.2 main flow', () => {
  const shots = path.resolve('docs/screenshots/v0.2');
  test.beforeAll(async () => { await fs.mkdir(shots, { recursive: true }); });

  test('hover shows a blue outline and label; click shows the pill, not a card', async ({ page }) => {
    await openDemo(page);
    await startInspect(page);
    const target = (await page.locator('#hero-primary-cta').boundingBox())!;
    await page.mouse.move(target.x + 10, target.y + 10);
    await expect(page.locator('#ah-hover')).toBeVisible();
    await expect(page.locator('#ah-hover')).toHaveCSS('border-top-color', 'rgb(13, 153, 255)');
    await expect(page.locator('#ah-hover-label')).toContainText(/button#hero-primary-cta\s*\d+ × \d+/);

    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    await expect(page.locator('#ah-sel-frame')).toBeVisible();
    await expect(page.locator('#ah-pill')).toBeVisible();
    await expect(page.locator('#ah-pill-name')).toHaveText('button#hero-primary-cta');
    await expect(page.locator('#ah-pill-file')).toHaveText(/Hero\.tsx:\d+/);
    await expect(page.locator('#ah-composer')).toBeHidden();
    await expect(page.locator('#ah-side')).toBeHidden();
    const pill = (await page.locator('#ah-pill').boundingBox())!;
    expect(overlaps(pill, target)).toBe(false);
    await page.screenshot({ path: path.join(shots, '01-pill.png') });
  });

  test('Ask opens the composer next to the selection, focused, without covering it', async ({ page }) => {
    await openDemo(page);
    const target = await selectHost(page, '#hero-primary-cta');
    await page.keyboard.press('Enter');
    const composer = page.locator('#ah-composer');
    await expect(composer).toBeVisible();
    await expect.poll(() => shadowActiveId(page)).toBe('ah-comp-input');
    expect(overlaps((await composer.boundingBox())!, target)).toBe(false);
    expect(overlaps((await composer.boundingBox())!, (await page.locator('#ah-pill').boundingBox())!)).toBe(false);
    // Empty send is refused.
    await page.locator('#ah-comp-send').click();
    await expect(page.locator('#ah-comp-input')).toHaveClass(/invalid/);
  });

  test('sending queues a task; the marker follows it through Seen, Working and Done', async ({ page, request }) => {
    const api = bridge(request);
    await openDemo(page);
    await api.post('/agent/presence', { client: 'claude-code' });
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    await expect(page.locator('#ah-comp-dest-label')).toHaveText('Claude Code');
    const instruction = `Make the CTA larger ${Date.now()}`;
    await page.locator('#ah-comp-input').fill(instruction);
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(page.locator('#ah-composer')).toBeHidden();
    await expect(page.locator('#ah-toast')).toContainText('Sent to Claude Code');
    let taskId = '';
    await expect.poll(async () => {
      const { tasks } = await api.get('/agent/tasks?limit=10');
      const t = tasks.find((x: any) => x.instruction === instruction);
      taskId = t?.id || '';
      return t?.target?.selector;
    }).toBe('button#hero-primary-cta');

    const marker = page.locator('.ah-marker');
    await expect(marker).toHaveCount(1);
    expect(await api.takeTask(taskId)).toBeTruthy();
    await expect(marker).toHaveAttribute('title', /Seen by Claude Code/);
    await api.post(`/agent/tasks/${taskId}/claim`, { client: 'claude-code' });
    await expect(marker.locator('.spin')).toBeVisible();

    await marker.click();
    const card = page.locator('#ah-task-card');
    await expect(card).toContainText(instruction);
    await expect(card.locator('.ah-timeline .on')).toHaveCount(3);

    await api.post(`/agent/tasks/${taskId}/complete`, { summary: 'Raised the CTA to h-12.', filesChanged: ['src/components/Hero.tsx'] });
    await expect(marker).toHaveClass(/done/);
    await expect(card.locator('.ah-summary')).toHaveText('Raised the CTA to h-12.');
    await expect(card.locator('.ah-files')).toContainText('src/components/Hero.tsx');
    await expect(page.locator('#ah-toast')).toContainText(/Done · .* · 1 file/);
    await page.screenshot({ path: path.join(shots, '02-task-done.png') });

    // The marker comes back after a reload (the task stores the element's selector).
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.locator('.ah-marker.done')).toHaveCount(1);
  });

  test('choosing Copy prompt copies a self-contained prompt instead of queueing', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openDemo(page);
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    await page.locator('#ah-comp-dest').click();
    await page.locator('#ah-dest-menu [data-v=copy]').click();
    await expect(page.locator('#ah-comp-send-label')).toHaveText('Copy');
    await page.locator('#ah-comp-input').fill('Tighten the spacing');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.locator('#ah-toast')).toContainText('Prompt copied');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('Tighten the spacing');
    expect(clip).toContain('Hero');
  });

  test('Escape closes the innermost thing first', async ({ page }) => {
    await openDemo(page);
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-more').click();
    await expect(page.locator('#ah-pill-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ah-pill-menu')).toBeHidden();
    await expect(page.locator('#ah-pill')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ah-pill')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ah-d-inspect')).toHaveAttribute('aria-pressed', 'false');
  });

  test('↑ selects the owning component; ⋯ menu offers parent and details', async ({ page }) => {
    await openDemo(page);
    await selectHost(page, '#hero-primary-cta');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#ah-pill-name')).not.toHaveText('button#hero-primary-cta');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#ah-pill-name')).toHaveText('button#hero-primary-cta');
    await page.locator('#ah-pill-more').click();
    await page.locator('#ah-pill-menu [data-act=details]').click();
    await expect(page.locator('#ah-side')).toBeVisible();
    await expect(page.locator('#ah-side [data-tab=inspect]')).toHaveAttribute('aria-selected', 'true');
  });

  test('letter shortcuts never fire while Agent Hover is idle, and never type into inputs', async ({ page }) => {
    await openDemo(page);
    await page.keyboard.press('t');
    await expect(page.locator('#ah-side')).toBeHidden();
    await selectHost(page, '#hero-primary-cta');
    await page.keyboard.press('c');
    const ta = page.locator('#ah-comment-input');
    await expect(ta).toBeVisible();
    await expect(ta).toHaveValue('');
  });
});
