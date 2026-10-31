import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { bridge, openDemo, selectHost, shotsDir } from './helpers/overlay';

/**
 * The images that put the dock first, made from the real product so they stay true: the annotated dock and the Tasks
 * tab in the README, and the dock on the poster. Only runs for `npm run screenshots`, on a throwaway demo copy.
 */
test.skip(!process.env.AH_SCREENSHOTS, 'images only: npm run screenshots');
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3 });

type Theme = 'light' | 'dark';
const COLORS = {
  light: { fg: '#111214', sub: '#5f6064', line: '#c9c9c4' },
  dark: { fg: '#eeeff1', sub: '#b4b7bd', line: '#3a3c42' },
};
const dataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;

/** A connected agent, a change waiting for review (the Tasks dot) and two elements in the batch. */
async function liveDock(page: Page, request: APIRequestContext, theme: Theme) {
  const api = bridge(request);
  await page.emulateMedia({ colorScheme: theme });
  await openDemo(page);
  await api.post('/agent/presence', { client: 'claude-code' });
  const { task } = await api.post('/agent/tasks', {
    instruction: 'Make the button a little larger',
    target: { component: 'Hero', file: 'src/components/Hero.tsx', selector: 'button#hero-primary-cta' },
    payload: { display: '“Book a demo” button' },
  });
  expect(await api.takeTask(task.id)).toBeTruthy();
  await api.post(`/agent/tasks/${task.id}/claim`, { client: 'claude-code' });
  await api.post(`/agent/tasks/${task.id}/complete`, { summary: 'Made the button larger.', filesChanged: ['src/components/Hero.tsx'] });
  await expect(page.locator('#ah-d-tasks-dot')).toBeVisible();
  return task.id as string;
}

const dockParts = ['ah-dock', 'ah-d-mark', 'ah-d-inspect', 'ah-d-comment', 'ah-d-tasks', 'ah-d-batch', 'ah-d-more'];
type Rect = { x: number; y: number; width: number; height: number };

function dockRects(page: Page): Promise<Record<string, Rect>> {
  return page.evaluate((ids) => {
    const root = document.getElementById('agent-hover-root')!.shadowRoot!;
    return Object.fromEntries(ids.map((id) => {
      const r = root.getElementById(id)!.getBoundingClientRect();
      return [id, { x: r.x, y: r.y, width: r.width, height: r.height }];
    }));
  }, dockParts);
}

const LIFT = 120;

/** The dock alone on a transparent background, with its shadow unless the image draws its own (scaled up, a soft shadow bands). */
async function cutOutDock(page: Page, dock: Rect, pad: number, shadow = true): Promise<Buffer> {
  await page.addStyleTag({ content: 'html, body { background: transparent !important; } #root { visibility: hidden !important; }' });
  await page.evaluate(({ lift, shadow }) => {
    const root = document.getElementById('agent-hover-root')!.shadowRoot!;
    (root.activeElement as HTMLElement | null)?.blur();
    (document.activeElement as HTMLElement | null)?.blur();
    const style = document.createElement('style');
    // Lifted, so its shadow isn't cut off by the bottom of the viewport.
    style.textContent = `#ah-toast, #ah-dock-tip { display: none !important; } #ah-dock { translate: 0 -${lift}px; ${shadow ? '' : 'box-shadow: none !important;'} }`;
    root.appendChild(style);
  }, { lift: LIFT, shadow });
  await page.waitForTimeout(150);
  return page.screenshot({ omitBackground: true, clip: { x: dock.x - pad, y: dock.y - LIFT - pad, width: dock.width + pad * 2, height: dock.height + pad * 2 } });
}

async function compose(page: Page, html: string, size: { width: number; height: number }, out: string, opts: { transparent?: boolean; scale?: number } = {}) {
  const sheet = await page.context().browser()!.newPage({ viewport: size, deviceScaleFactor: opts.scale ?? 2 });
  await sheet.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"></head><body style="margin:0;background:transparent">${html}</body></html>`);
  await sheet.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  });
  await sheet.screenshot({ path: out, omitBackground: !!opts.transparent });
  await sheet.close();
}

// These tests share a demo copy: each starts with an empty task list.
test.beforeEach(async ({ request }) => {
  const api = bridge(request);
  const { tasks } = await api.get('/agent/tasks?limit=200');
  if (tasks.length) await api.post('/agent/tasks/remove', { ids: tasks.map((t: { id: string }) => t.id) });
});

for (const theme of ['light', 'dark'] as const) {
  test(`annotated dock, ${theme}`, async ({ page, request }) => {
    const c = COLORS[theme];
    await liveDock(page, request, theme);
    await selectHost(page, '#hero-primary-cta');
    await page.keyboard.press('b');
    await page.keyboard.press('Escape');
    await selectHost(page, '#hero-headline');
    await page.keyboard.press('b');
    await page.keyboard.press('Escape');
    await page.locator('#ah-d-inspect').click(); // back to resting
    await page.mouse.move(640, 300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const rects = await dockRects(page);
    const dock = rects['ah-dock'];
    const pad = 40;
    const png = await cutOutDock(page, dock, pad);

    const scale = 3;
    const w = 1200, h = 460;
    const left = (w - (dock.width + pad * 2) * scale) / 2;
    const top = (h - (dock.height + pad * 2) * scale) / 2;
    const labels: Array<[string, string, string, 'up' | 'down']> = [
      ['ah-d-mark', 'Agent connected', 'Green when it’s on', 'down'],
      ['ah-d-inspect', 'Inspect', 'Point at any element', 'up'],
      ['ah-d-comment', 'Comment', 'A note on the page', 'down'],
      ['ah-d-tasks', 'Tasks', 'What needs you', 'up'],
      ['ah-d-batch', 'Batch', 'Many elements, one task', 'down'],
      ['ah-d-more', 'More', 'Sidebar and settings', 'up'],
    ];
    const notes = labels.map(([id, title, text, dir]) => {
      const r = rects[id];
      const cx = left + (r.x - dock.x + pad + r.width / 2) * scale;
      const edge = top + pad * scale + (dir === 'up' ? -6 : dock.height * scale + 6);
      const stem = 30;
      const lineTop = dir === 'up' ? edge - stem : edge;
      const textTop = dir === 'up' ? edge - stem - 52 : edge + stem + 6;
      return `<div style="position:absolute;left:${cx}px;top:${lineTop}px;width:1px;height:${stem}px;background:${c.line}"></div>
        <div style="position:absolute;left:${cx - 95}px;top:${textTop}px;width:190px;text-align:center">
          <div style="font:600 18px Inter,system-ui,sans-serif;letter-spacing:-0.01em;color:${c.fg}">${title}</div>
          <div style="margin-top:3px;font:400 14px Inter,system-ui,sans-serif;color:${c.sub}">${text}</div>
        </div>`;
    }).join('');
    await compose(page, `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden">
        <img src="${dataUrl(png)}" style="position:absolute;left:${left}px;top:${top}px;width:${(dock.width + pad * 2) * scale}px">
        ${notes}</div>`, { width: w, height: h }, path.join(shotsDir('v0.2'), theme === 'dark' ? '00-dock-dark.png' : '00-dock.png'), { transparent: true });
  });
}

test.describe('poster', () => {
  test.use({ deviceScaleFactor: 4 });

  // docs/brand/make-logo.mjs places this on the poster.
  test('dock for the poster', async ({ page, request }) => {
    await liveDock(page, request, 'light');
    await page.mouse.move(640, 300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const dock = (await dockRects(page))['ah-dock'];
    fs.writeFileSync(path.resolve('docs/brand/logo/dock.png'), await cutOutDock(page, dock, 40, false));
  });
});

test.describe('README', () => {
  test.use({ deviceScaleFactor: 2 });

  test('Tasks tab', async ({ page, request }) => {
    test.setTimeout(60000);
    const api = bridge(request);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'light' });
    await api.post('/agent/presence', { client: 'claude-code' });
    const hero = 'src/components/Hero.tsx';
    const make = async (instruction: string, selector: string, display: string, line: number) =>
      (await api.post('/agent/tasks', { instruction, target: { component: 'Hero', file: hero, lineStart: line, selector }, payload: { display, prompt: instruction }, assignee: 'claude-code' })).task.id as string;
    const finish = async (id: string, result: Record<string, unknown>) => {
      await api.takeTask(id);
      await api.post(`/agent/tasks/${id}/claim`, { client: 'claude-code' });
      await api.post(`/agent/tasks/${id}/complete`, result);
    };
    await finish(await make('Explain what this badge does', '#hero-badge', 'Link “New Recurring invoices”', 22), { summary: 'It links to the retainers page.' });
    const kept = await make('Tighten the spacing under the heading', '#hero-headline', 'Heading', 30);
    await finish(kept, { summary: 'Reduced the gap.', filesChanged: [hero] });
    await api.post(`/agent/tasks/${kept}/review`, { action: 'keep' });
    await finish(await make('Make the secondary button outlined', 'a[href="#pricing"]', '“Start free trial” button', 61), { status: 'failed', error: 'Could not find a secondary button style in the theme' });
    await finish(await make('Make the arrow white', '#hero-primary-cta', '“Book a demo” button', 54), { summary: 'Set the arrow color to white and added a hover state.', filesChanged: [hero, 'src/index.css'] });
    const working = await make('Add a subtle shadow to the nav', 'header', 'Navigation', 8);
    await api.takeTask(working);
    await api.post(`/agent/tasks/${working}/claim`, { client: 'claude-code' });

    await openDemo(page);
    await page.waitForTimeout(800);
    await page.locator('#ah-d-tasks').click();
    const side = page.locator('#ah-side');
    await side.locator('.ah-li.task', { hasText: 'arrow white' }).click();
    await side.locator('[data-act=history]').click();
    await page.mouse.move(300, 300);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shotsDir('v0.2'), '10-tasks.png') });
  });
});
