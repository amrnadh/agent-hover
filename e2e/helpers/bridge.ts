import { test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * The folder of the app under test: the project's `metadata.demoDir` (the Vite demo or the Next.js demo, see
 * playwright.config.ts). Call it inside a test or hook.
 */
export function demoDir(): string {
  try {
    const dir = test.info().project.metadata?.demoDir;
    if (typeof dir === 'string' && dir) return dir;
  } catch { /* outside a test */ }
  return path.resolve(process.env.AH_DEMO_DIR || 'demo');
}

/** Whether the app under test is the Next.js demo. */
export function isNext(): boolean {
  try { return test.info().project.metadata?.framework === 'next'; } catch { return false; }
}

/** Bridge session written by the demo dev server (port + token). */
export function readDemoSession(): { port: number; token: string } | null {
  try {
    const sessionFile = path.resolve(demoDir(), '.agent-hover/session.json');
    if (fs.existsSync(sessionFile)) {
      return JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    }
  } catch {}
  return null;
}

/**
 * Remove all pins on the bridge. Pins live in the dev server's memory, so they survive between
 * specs when Playwright reuses a running dev server; specs that assert on the pin stack call this first.
 */
export async function clearPins(request: APIRequestContext): Promise<void> {
  const session = readDemoSession();
  if (!session) return;
  const base = `http://localhost:${session.port}/api/pins`;
  const headers = { Authorization: `Bearer ${session.token}` };
  const res = await request.get(base, { headers });
  if (!res.ok()) return;
  const { pins = [] } = await res.json();
  for (const pin of pins) {
    await request.delete(base, { headers, data: { id: pin.id } });
  }
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * A point inside `target` that no overlay surface (pill, composer) covers, so hover/wheel actions reach the
 * host element. Falls back to the target's center when nothing is covered.
 */
export async function pointClearOfPopover(page: Page, target: Box): Promise<{ x: number; y: number }> {
  const covers: Box[] = [];
  for (const sel of ['#ah-pill', '#ah-composer']) {
    const loc = page.locator(sel);
    if (await loc.isVisible().catch(() => false)) {
      const b = await loc.boundingBox();
      if (b) covers.push(b);
    }
  }
  const inside = (p: { x: number; y: number }, b: Box) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
  const candidates = [0.5, 0.15, 0.85].flatMap((fy) =>
    [0.5, 0.1, 0.9].map((fx) => ({ x: target.x + target.width * fx, y: target.y + target.height * fy })),
  );
  return candidates.find((p) => !covers.some((b) => inside(p, b))) ?? candidates[0];
}
