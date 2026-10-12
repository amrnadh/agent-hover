import { test, expect, type Page } from '@playwright/test';
import { openDemo, selectHost, startInspect } from './helpers/overlay';

/**
 * Performance budget for the overlay itself:
 * - idle: no animation-frame loops when nothing changes (with and without a selection);
 * - hover: the work done per pointer move stays small.
 * The overlay runs as an inline script in the page, so its frames are told apart from the app's by URL.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.__ahFrames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      // Inline <script> frames have the document URL with no path; the app's modules come from /src or /node_modules.
      const caller = (new Error().stack || '').split('\n').slice(2).find((l) => /https?:\/\//.test(l)) || '';
      if (/https?:\/\/[^/]+\/:\d+/.test(caller) || /https?:\/\/[^/]+\/\)?$/.test(caller)) w.__ahFrames++;
      return raf(cb);
    };
  });
});

async function framesWhileIdle(page: Page, ms: number) {
  await page.evaluate(() => { (window as any).__ahFrames = 0; });
  await page.waitForTimeout(ms);
  return page.evaluate(() => (window as any).__ahFrames as number);
}

test('the overlay schedules no frames while idle', async ({ page }) => {
  await openDemo(page);
  await startInspect(page);
  // Sanity check: hovering does schedule overlay frames, so the counter sees them.
  for (let i = 0; i < 10; i++) await page.mouse.move(200 + i * 60, 300 + (i % 3) * 40);
  expect(await page.evaluate(() => (window as any).__ahFrames as number)).toBeGreaterThan(0);

  await page.mouse.move(5, 400);
  await page.waitForTimeout(600);
  expect(await framesWhileIdle(page, 2000)).toBe(0);

  await selectHost(page, '#hero-primary-cta');
  await page.mouse.move(5, 400);
  await page.waitForTimeout(600);
  // A selection is kept in place on scroll/resize, not by polling every frame.
  expect(await framesWhileIdle(page, 2000)).toBe(0);
});

/** Main-thread script time (ms) spent while the pointer moves over the page. */
async function scriptTimeWhileMoving(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const read = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'ScriptDuration')!.value * 1000;
  const before = await read();
  for (let i = 0; i < 120; i++) await page.mouse.move(60 + ((i * 37) % 1100), 80 + ((i * 53) % 600));
  const after = await read();
  await cdp.detach();
  return (after - before) / 120;
}

test('hovering costs little per pointer move', async ({ page }) => {
  await openDemo(page);
  const baseline = await scriptTimeWhileMoving(page);
  await startInspect(page);
  const inspecting = await scriptTimeWhileMoving(page);
  const overlay = inspecting - baseline;
  console.log(`hover: ${inspecting.toFixed(2)} ms script per move while inspecting, ${baseline.toFixed(2)} ms without (overlay ≈ ${overlay.toFixed(2)} ms)`);
  expect(overlay).toBeLessThan(2);
});
