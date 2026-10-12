import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { bridge, openDemo } from './helpers/overlay';

/**
 * Records the README GIF: select → Ask → the agent works → Done → Compare. A scripted agent claims the task
 * and really edits the demo's Hero.tsx, so the page updates through HMR.
 * Only runs with AH_RECORD=1 (scripts/record-demo.mjs), always on a throwaway demo copy.
 */
test.skip(!process.env.AH_RECORD || !process.env.AH_DEMO_DIR, 'recording only: npm run record:demo');
test.use({ viewport: { width: 1280, height: 800 }, video: { mode: 'on', size: { width: 1280, height: 800 } } });

/** Playwright videos have no mouse pointer; draw one. */
async function showCursor(page: Page) {
  await page.addInitScript(() => {
    const draw = () => {
      const c = document.createElement('div');
      c.id = 'rec-cursor';
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.13 1.58a2 2 0 0 0-1.43 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>';
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-3px,-3px);transition:transform .02s';
      document.documentElement.appendChild(c);
      window.addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
      window.addEventListener('mousedown', () => { c.style.transform = 'translate(-3px,-3px) scale(.85)'; }, true);
      window.addEventListener('mouseup', () => { c.style.transform = 'translate(-3px,-3px)'; }, true);
    };
    if (document.documentElement) draw(); else document.addEventListener('DOMContentLoaded', draw);
  });
}

async function glide(page: Page, x: number, y: number, steps = 25) {
  await page.mouse.move(x, y, { steps });
}

async function center(page: Page, selector: string) {
  const b = (await page.locator(selector).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('record the README demo', async ({ page, request }) => {
  test.setTimeout(120000);
  const heroFile = path.join(process.env.AH_DEMO_DIR!, 'src/components/Hero.tsx');
  const original = fs.readFileSync(heroFile, 'utf8');
  const api = bridge(request);
  await showCursor(page);
  await openDemo(page);
  await api.post('/agent/presence', { client: 'claude-code' });
  // A still background keeps the GIF small (every changed pixel costs bytes).
  await page.evaluate(() => document.querySelectorAll('video').forEach((v) => { v.pause(); v.currentTime = 1; }));
  await page.mouse.move(900, 500);
  await page.waitForTimeout(800);

  // Inspect on, hover a few things.
  const inspect = await center(page, '#ah-d-inspect');
  await glide(page, inspect.x, inspect.y, 30);
  await page.mouse.click(inspect.x, inspect.y);
  await page.waitForTimeout(400);
  for (const sel of ['#hero-badge', 'h1', '#hero-play-button']) {
    const p = await center(page, sel);
    await glide(page, p.x, p.y, 20);
    await page.waitForTimeout(650);
  }
  const cta = await center(page, '#hero-primary-cta');
  await glide(page, cta.x, cta.y, 15);
  await page.waitForTimeout(400);
  await page.mouse.click(cta.x, cta.y);
  await expect(page.locator('#ah-pill')).toBeVisible();
  await page.waitForTimeout(900);

  // Ask.
  const ask = await center(page, '#ah-pill-ask');
  await glide(page, ask.x, ask.y, 15);
  await page.mouse.click(ask.x, ask.y);
  await page.waitForTimeout(300);
  const instruction = 'Make this button larger and add an arrow';
  await page.keyboard.type(instruction, { delay: 45 });
  await page.waitForTimeout(500);
  const send = await center(page, '#ah-comp-send');
  await glide(page, send.x, send.y, 12);
  await page.mouse.click(send.x, send.y);
  await expect(page.locator('#ah-toast')).toContainText('Sent to Claude Code');
  // Rest the pointer on the dock (Agent Hover's own UI shows no hover outline).
  const rest = await center(page, '#ah-d-grip');
  await glide(page, rest.x, rest.y, 25);

  // The agent picks it up and works.
  let id = '';
  await expect.poll(async () => {
    id = (await api.get('/agent/tasks?limit=10')).tasks.find((t: any) => t.instruction === instruction)?.id || '';
    return id;
  }).not.toBe('');
  await page.waitForTimeout(700);
  await api.takeTask(id);
  await page.waitForTimeout(900);
  await api.post(`/agent/tasks/${id}/claim`, { client: 'claude-code' });
  await page.waitForTimeout(1800);
  fs.writeFileSync(heroFile, original
    .replace('rounded-full px-6 py-5 text-sm font-medium', 'rounded-full px-8 py-6 text-base font-semibold')
    .replace('            Book a demo\n', '            Book a demo →\n'));
  await expect(page.locator('#hero-primary-cta')).toContainText('→', { timeout: 15000 });
  await api.post(`/agent/tasks/${id}/complete`, { summary: 'Made the hero CTA larger (px-8 py-6, text-base, semibold) and added an arrow. Only this usage of <Button> changed.' });
  await expect(page.locator('.ah-marker.done')).toHaveCount(1);
  await page.waitForTimeout(2200); // the "after" image is taken once HMR settles

  // Open the task: summary, files, Compare.
  const marker = await center(page, '.ah-marker.done');
  await glide(page, marker.x, marker.y, 20);
  await page.mouse.click(marker.x, marker.y);
  await page.waitForTimeout(1300);
  const compare = await center(page, '#ah-task-card [data-act=compare]');
  await glide(page, compare.x, compare.y, 15);
  await page.mouse.click(compare.x, compare.y);
  await expect(page.locator('#ah-task-card .ah-compare img')).toHaveCount(2, { timeout: 10000 });
  await page.waitForTimeout(600);
  const slider = (await page.locator('#ah-task-card .ah-compare').boundingBox())!;
  const y = slider.y + slider.height / 2;
  await glide(page, slider.x + slider.width / 2, y, 10);
  await page.mouse.down();
  for (const fx of [0.15, 0.85, 0.5]) await page.mouse.move(slider.x + slider.width * fx, y, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(1800);

  fs.writeFileSync(heroFile, original);
});
