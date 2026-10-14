import { expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { readDemoSession } from './bridge';

/** Authenticated bridge API for simulating an agent (presence, next, claim, complete) and checking state. */
export function bridge(request: APIRequestContext) {
  const session = readDemoSession();
  if (!session) throw new Error('No demo session file: is the demo dev server running?');
  const base = `http://localhost:${session.port}/api`;
  const headers = { Authorization: `Bearer ${session.token}` };
  return {
    get: (p: string) => request.get(base + p, { headers }).then((r) => r.json()),
    post: (p: string, data: unknown) => request.post(base + p, { headers, data }).then((r) => r.json()),
    /** Hand out queued tasks until `id` comes up (other specs may leave tasks queued). */
    async takeTask(id: string) {
      for (let i = 0; i < 60; i++) {
        const { task } = await request.get(base + '/agent/tasks/next', { headers }).then((r) => r.json());
        if (!task) return null;
        if (task.id === id) return task;
      }
      return null;
    },
  };
}

/** Open the demo with a clean overlay: no saved dock position, first-run hint dismissed, system theme. */
export async function openDemo(page: Page, opts: { hint?: boolean; viewport?: { width: number; height: number } } = {}) {
  await page.setViewportSize(opts.viewport || { width: 1280, height: 800 });
  await page.addInitScript((hint) => {
    try {
      // Once per test (reloads inside a test keep their state, so persistence can be checked).
      if (sessionStorage.getItem('ah-e2e-init')) return;
      sessionStorage.setItem('ah-e2e-init', '1');
      for (const k of Object.keys(localStorage)) if (k.startsWith('agent_hover') || k.startsWith('agent-hover')) localStorage.removeItem(k);
      if (!hint) localStorage.setItem('agent_hover_hint_dismissed', 'true');
    } catch {}
  }, !!opts.hint);
  await page.goto('/');
  await page.waitForSelector('#agent-hover-root');
  await expect(page.locator('#ah-dock')).toBeVisible();
  // Let the demo hero finish its entrance animation so rects are stable.
  await page.locator('#hero-primary-cta').waitFor();
  await page.waitForTimeout(900);
}

export async function startInspect(page: Page) {
  const btn = page.locator('#ah-d-inspect');
  if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
}

/** Click a host element through the capture layer (inspect or comment mode must be on). */
export async function clickHost(page: Page, selector: string, at: { fx?: number; fy?: number } = {}) {
  const box = (await page.locator(selector).first().boundingBox())!;
  await page.mouse.click(box.x + box.width * (at.fx ?? 0.5), box.y + box.height * (at.fy ?? 0.5));
  return box;
}

export async function selectHost(page: Page, selector: string) {
  await startInspect(page);
  const box = await clickHost(page, selector);
  await expect(page.locator('#ah-pill')).toBeVisible();
  return box;
}

export const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export async function shadowActiveId(page: Page) {
  return page.evaluate(() => document.querySelector('#agent-hover-root')!.shadowRoot!.activeElement?.id || null);
}

/**
 * Where a test saves its screenshots. By default the ignored test-results/ folder, so test runs don't rewrite
 * images in the repo; `npm run screenshots` sets AH_SCREENSHOTS=1 to refresh the README images in docs/screenshots/.
 */
export function shotsDir(name: string) {
  const dir = path.resolve(process.env.AH_SCREENSHOTS ? 'docs/screenshots' : 'test-results/screenshots', name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
