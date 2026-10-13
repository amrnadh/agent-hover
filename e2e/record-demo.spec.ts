import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { bridge, openDemo } from './helpers/overlay';

/**
 * The GitHub demo video, one scene per test. scripts/record-demo.mjs runs each scene on its own fresh demo copy
 * (so no markers, comments or locks carry over), cuts it with the marks the scene saves next to its video, and
 * joins the clips. A scripted agent claims each task and really edits the demo's files, so HMR, task statuses,
 * Compare and Undo are the real thing.
 * Only runs with AH_RECORD=1 (npm run record:demo), always on a throwaway demo copy.
 */
test.skip(!process.env.AH_RECORD || !process.env.AH_DEMO_DIR, 'recording only: npm run record:demo');
test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'light', video: { mode: 'on', size: { width: 1280, height: 800 } } });

const demoDir = process.env.AH_DEMO_DIR || '';
const pause = (page: Page, ms: number) => page.waitForTimeout(ms);
type Api = ReturnType<typeof bridge>;

/** Seconds into the video where the clip starts and ends (the video starts with the page). */
function recorder() {
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  return {
    mark: (name: string) => { marks[name] = (Date.now() - t0) / 1000; },
    save: () => fs.writeFileSync(test.info().outputPath('marks.json'), JSON.stringify(marks)),
  };
}

/** The scripted agent's file edits; every scene puts the files back when it ends. */
function demoFiles() {
  const originals = new Map<string, string>();
  return {
    edit(file: string, from: string, to: string) {
      const p = path.join(demoDir, file);
      const src = fs.readFileSync(p, 'utf8');
      if (!originals.has(p)) originals.set(p, src);
      if (!src.includes(from)) throw new Error(`record-demo: ${JSON.stringify(from.slice(0, 50))} is not in ${file}; update the scene`);
      fs.writeFileSync(p, src.replace(from, to));
    },
    restore() { for (const [p, src] of originals) fs.writeFileSync(p, src); },
  };
}

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

/** A short line at the top of the frame saying what the scene shows (part of the video, not of the demo app). */
async function caption(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById('rec-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rec-caption';
      el.style.cssText = 'position:fixed;left:50%;top:80px;transform:translateX(-50%);z-index:2147483646;pointer-events:none;white-space:nowrap;padding:9px 16px;border-radius:999px;background:#17181a;color:#fff;font:500 15px/1.2 Inter,system-ui,sans-serif;letter-spacing:-0.01em;box-shadow:0 10px 30px -10px rgba(0,0,0,.4);opacity:0;transition:opacity .25s';
      document.documentElement.appendChild(el);
    }
    const node = el;
    node.style.opacity = '0';
    setTimeout(() => { node.textContent = t; node.style.opacity = '1'; }, 150);
  }, text);
}

async function pointAt(target: Locator, fx = 0.5, fy = 0.5) {
  const b = (await target.first().boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
}

async function glide(page: Page, target: Locator, fx = 0.5, fy = 0.5, steps = 20) {
  const p = await pointAt(target, fx, fy);
  await page.mouse.move(p.x, p.y, { steps });
  return p;
}

async function glideClick(page: Page, target: Locator, fx = 0.5, fy = 0.5, steps = 20) {
  const p = await glide(page, target, fx, fy, steps);
  await page.mouse.click(p.x, p.y);
}

/** Waits for the task the page sent, then plays the agent: Seen, Working (Undo checkpoint), the edit, Done. */
async function agent(page: Page, api: Api, find: (task: any) => boolean, work: () => Promise<void>, summary: string) {
  let id = '';
  await expect.poll(async () => {
    id = (await api.get('/agent/tasks?limit=20')).tasks.find(find)?.id || '';
    return id;
  }, { timeout: 15000 }).not.toBe('');
  await pause(page, 500);
  await api.takeTask(id);
  await pause(page, 700);
  await api.post(`/agent/tasks/${id}/claim`, { client: 'claude-code' });
  await pause(page, 1300);
  await work();
  await pause(page, 700);
  await api.post(`/agent/tasks/${id}/complete`, { summary });
}

async function startScene(page: Page, api: Api, scrollTo?: (page: Page) => Promise<void>) {
  await showCursor(page);
  await openDemo(page);
  await api.post('/agent/presence', { client: 'claude-code' });
  if (scrollTo) await scrollTo(page);
  await page.mouse.move(1000, 560);
  await pause(page, 400);
}

const scrollToStats = (page: Page) => page.evaluate(() => window.scrollTo(0, 330));
const scrollToInvoices = (page: Page) => page.evaluate(() => document.getElementById('recent-invoices')!.scrollIntoView({ block: 'center' }));

function card(body: string) {
  const mark = fs.readFileSync(path.resolve('docs/brand/logo/mark-ink.svg'), 'utf8');
  return `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
  <style>
    html,body{margin:0;height:100%;background:#fff;color:#17181a;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;animation:in .5s ease-out both}
    .mark svg{width:72px;height:72px}
    h1{margin:6px 0 0;font-size:52px;font-weight:600;letter-spacing:-0.035em}
    p{margin:0;font-size:22px;color:#63645d;letter-spacing:-0.01em}
    code{font:500 22px ui-monospace,SFMono-Regular,Menlo,monospace;background:#17181a;color:#fff;padding:12px 20px;border-radius:12px}
    small{font-size:16px;color:#63645d}
    @keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  </style></head><body><main><div class="mark">${mark}</div>${body}</main></body></html>`;
}

test('scene-00 title', async ({ page }) => {
  const rec = recorder();
  await page.setContent(card('<h1>Agent Hover</h1><p>Point at your UI. Your agent understands it.</p>'));
  await page.evaluate(() => document.fonts.ready);
  rec.mark('start');
  await pause(page, 2800);
  rec.mark('end');
  rec.save();
});

test('scene-01 point at it', async ({ page, request }) => {
  test.setTimeout(120000);
  const rec = recorder();
  const api = bridge(request);
  const files = demoFiles();
  const instruction = 'Make this thinner and lighter';
  const squiggle = page.locator('#hero-headline svg');
  try {
    await startScene(page, api);
    rec.mark('start');
    await caption(page, 'Don’t know what it’s called? Point at it.');
    await pause(page, 1200);
    await glideClick(page, page.locator('#ah-d-inspect'), 0.5, 0.5, 30);
    await pause(page, 300);
    for (const target of [page.locator('#hero-badge'), page.locator('#hero-headline')]) {
      await glide(page, target);
      await pause(page, 650);
    }
    await glide(page, squiggle, 0.5, 0.2, 15);
    await expect(page.locator('#ah-hover-label')).toContainText('<Squiggle />');
    await pause(page, 900);
    await glideClick(page, squiggle, 0.5, 0.2, 2);
    await expect(page.locator('#ah-pill-name')).toHaveText('<Squiggle />');
    await pause(page, 900);
    await glideClick(page, page.locator('#ah-pill-ask'), 0.5, 0.5, 15);
    await pause(page, 300);
    await page.keyboard.type(instruction, { delay: 45 });
    await pause(page, 500);
    await glideClick(page, page.locator('#ah-comp-send'), 0.5, 0.5, 12);
    await expect(page.locator('#ah-toast')).toContainText('Sent to Claude Code');
    await pause(page, 500);
    await page.keyboard.press('Escape'); // deselect, so the pill doesn't hide the change
    await glide(page, page.locator('#ah-d-grip'), 0.5, 0.5, 25);

    await agent(page, api, (t) => t.instruction === instruction, async () => {
      files.edit('src/components/ui/Squiggle.tsx', 'strokeWidth="6"', 'strokeWidth="3"\n        strokeOpacity="0.5"');
      await expect(squiggle.locator('path')).toHaveAttribute('stroke-width', '3', { timeout: 15000 });
    }, 'Made the underline in <Squiggle /> thinner (3px) and lighter (50% opacity).');
    await expect(page.locator('.ah-marker.done')).toHaveCount(1);
    await pause(page, 2200); // the "after" image is taken once HMR settles

    await glideClick(page, page.locator('.ah-marker.done'), 0.5, 0.5, 20);
    await pause(page, 1300);
    const taskCard = page.locator('#ah-task-card');
    await glideClick(page, taskCard.locator('[data-act=compare]'), 0.5, 0.5, 15);
    const captureNow = taskCard.locator('[data-act=capture-after]');
    if (await captureNow.isVisible().catch(() => false)) await captureNow.click();
    await expect(taskCard.locator('.ah-compare img')).toHaveCount(2, { timeout: 10000 });
    await pause(page, 600);
    const slider = (await taskCard.locator('.ah-compare').boundingBox())!;
    const y = slider.y + slider.height / 2;
    await page.mouse.move(slider.x + slider.width / 2, y, { steps: 10 });
    await page.mouse.down();
    for (const fx of [0.15, 0.85, 0.5]) await page.mouse.move(slider.x + slider.width * fx, y, { steps: 25 });
    await page.mouse.up();
    await pause(page, 1200);
    rec.mark('gifEnd');

    await caption(page, 'Not quite right? Undo puts the file back.');
    await pause(page, 1200);
    await glideClick(page, taskCard.locator('[data-act=undo]'), 0.5, 0.5, 15);
    await pause(page, 1200);
    await glideClick(page, taskCard.locator('[data-act=undo-confirm]'), 0.5, 0.5, 12);
    await expect(page.locator('#ah-toast')).toContainText('Undid 1 file');
    await expect(squiggle.locator('path')).toHaveAttribute('stroke-width', '6', { timeout: 15000 });
    await pause(page, 2000);
    rec.mark('end');
  } finally {
    files.restore();
    rec.save();
  }
});

test('scene-02 like this not that', async ({ page, request }) => {
  test.setTimeout(120000);
  const rec = recorder();
  const api = bridge(request);
  const files = demoFiles();
  const goal = 'Make the first one match the second';
  const tiles = page.locator('#overview-stats > *');
  try {
    await startScene(page, api, scrollToStats);
    rec.mark('start');
    await caption(page, 'Like this, not that: point at both.');
    await pause(page, 1200);
    await glideClick(page, page.locator('#ah-d-inspect'), 0.5, 0.5, 30);
    await pause(page, 300);

    await glide(page, tiles.nth(3), 0.05, 0.5);
    await expect(page.locator('#ah-hover-label')).toContainText('div.rounded-md');
    await pause(page, 800);
    await glideClick(page, tiles.nth(3), 0.05, 0.5, 2);
    await pause(page, 500);
    await page.keyboard.press('b');
    await pause(page, 700);
    await glide(page, tiles.nth(0), 0.04, 0.5, 30);
    await expect(page.locator('#ah-hover-label')).toContainText('<StatCard />');
    await pause(page, 800);
    await glideClick(page, tiles.nth(0), 0.04, 0.5, 2);
    await pause(page, 500);
    await page.keyboard.press('b');
    await expect(page.locator('#ah-d-batch-count')).toHaveText('2');
    await pause(page, 700);

    await glideClick(page, page.locator('#ah-d-batch'), 0.5, 0.5, 20);
    const side = page.locator('#ah-side');
    await pause(page, 700);
    await glide(page, side.locator('select.ah-role').nth(1), 0.5, 0.5, 20);
    await side.locator('select.ah-role').nth(1).selectOption('reference');
    await pause(page, 700);
    await glideClick(page, side.locator('#ah-batch-goal'), 0.5, 0.5, 15);
    await page.keyboard.type(goal, { delay: 45 });
    await pause(page, 500);
    await glideClick(page, side.locator('[data-act=send]'), 0.5, 0.5, 15);
    await expect(page.locator('.ah-batch-num')).toHaveCount(0);
    await pause(page, 800);
    await glideClick(page, page.locator('#ah-s-close'), 0.5, 0.5, 15);
    await page.keyboard.press('Escape');
    await glide(page, page.locator('#ah-d-grip'), 0.5, 0.5, 25);

    await agent(page, api, (t) => t.instruction === goal, async () => {
      files.edit('src/components/ProductPreview.tsx',
        `            <div className="rounded-md bg-surface px-4 py-3">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Avg. days to pay</p>
              <p className="mt-1 text-xl font-semibold">9.4 days</p>
              <p className="text-xs text-brand">Down from 15.2</p>
            </div>`,
        '            <StatCard label="Average days to pay" value="9.4" detail="Down from 15.2" tone="positive" />');
      await expect(tiles.nth(3)).toContainText('Average days to pay', { timeout: 15000 });
    }, 'Replaced the one-off tile with <StatCard>, so it matches the other three.');
    await expect(page.locator('.ah-marker.done')).toHaveCount(1);
    await pause(page, 1000);
    await caption(page, 'Now it’s a <StatCard /> like the others.');
    await glide(page, tiles.nth(3), 0.04, 0.5, 25);
    await expect(page.locator('#ah-hover-label')).toContainText('<StatCard />');
    await pause(page, 2600);
    rec.mark('end');
  } finally {
    files.restore();
    rec.save();
  }
});

test('scene-03 notes where they belong', async ({ page, request }) => {
  test.setTimeout(120000);
  const rec = recorder();
  const api = bridge(request);
  const files = demoFiles();
  const amountHeader = page.locator('#recent-invoices th', { hasText: 'Amount' });
  const oddDate = page.locator('#recent-invoices td', { hasText: '2026-09-29' });
  try {
    await startScene(page, api, scrollToInvoices);
    rec.mark('start');
    await caption(page, 'Small things? Leave a note right where they are.');
    await pause(page, 1200);
    await glideClick(page, page.locator('#ah-d-comment'), 0.5, 0.5, 30);
    await pause(page, 500);

    for (const [target, note] of [[amountHeader, 'Line this up with the amounts'], [oddDate, 'Same date format as the other rows']] as const) {
      await glideClick(page, target, 0.3, 0.5, 25);
      await expect(page.locator('#ah-comment-card')).toBeVisible();
      await page.locator('#ah-comment-input').focus();
      await page.keyboard.type(note, { delay: 40 });
      await pause(page, 300);
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(page.locator('#ah-comment-card')).toContainText(note);
      await pause(page, 800);
    }
    await page.keyboard.press('Escape');
    await pause(page, 400);

    await caption(page, 'Send them all as one task.');
    await glideClick(page, page.locator('#ah-d-more'), 0.5, 0.5, 20);
    await pause(page, 400);
    await glideClick(page, page.locator('#ah-dock-menu [data-act=sidebar]'), 0.5, 0.5, 10);
    await pause(page, 500);
    const side = page.locator('#ah-side');
    await glideClick(page, side.locator('[data-tab=comments]'), 0.5, 0.5, 20);
    await pause(page, 900);
    await glideClick(page, side.locator('[data-act=send-all]'), 0.5, 0.5, 20);
    await pause(page, 900);
    await glideClick(page, page.locator('#ah-s-close'), 0.5, 0.5, 15);
    await glide(page, page.locator('#ah-d-grip'), 0.5, 0.5, 25);

    await agent(page, api, (t) => t.type === 'note', async () => {
      files.edit('src/components/product/InvoiceTable.tsx',
        '<th className="px-4 py-2 font-medium">Amount</th>',
        '<th className="px-4 py-2 text-right font-medium">Amount</th>');
      files.edit('src/data/invoices.ts', 'due: "2026-09-29"', 'due: "Sep 29"');
      await expect(page.locator('#recent-invoices td', { hasText: 'Sep 29' })).toHaveCount(1, { timeout: 15000 });
    }, 'Right-aligned the Amount header over the amounts and changed 2026-09-29 to Sep 29 like the other rows.');
    await caption(page, 'Both fixed from one task.');
    await pause(page, 2800);
    rec.mark('end');
  } finally {
    files.restore();
    rec.save();
  }
});

test('scene-04 add what is missing', async ({ page, request }) => {
  test.setTimeout(120000);
  const rec = recorder();
  const api = bridge(request);
  const files = demoFiles();
  const instruction = 'Add an Export CSV button here';
  const header = page.locator('#recent-invoices > div').first();
  try {
    await startScene(page, api, scrollToInvoices);
    rec.mark('start');
    await caption(page, 'Not just styling: ask for what’s missing.');
    await pause(page, 1200);
    await glideClick(page, page.locator('#ah-d-inspect'), 0.5, 0.5, 30);
    await pause(page, 300);
    await glide(page, header, 0.6, 0.9, 25);
    await expect(page.locator('#ah-hover-label')).toContainText('div.flex');
    await pause(page, 800);
    await glideClick(page, header, 0.6, 0.9, 2);
    await pause(page, 800);
    await glideClick(page, page.locator('#ah-pill-ask'), 0.5, 0.5, 15);
    await pause(page, 300);
    await page.keyboard.type(instruction, { delay: 45 });
    await pause(page, 500);
    await glideClick(page, page.locator('#ah-comp-send'), 0.5, 0.5, 12);
    await expect(page.locator('#ah-toast')).toContainText('Sent to Claude Code');
    await pause(page, 500);
    await page.keyboard.press('Escape'); // deselect, so the pill doesn't hide the change
    await glide(page, page.locator('#ah-d-grip'), 0.5, 0.5, 25);

    await agent(page, api, (t) => t.instruction === instruction, async () => {
      files.edit('src/components/product/InvoiceTable.tsx',
        'import { StatusBadge } from "./StatusBadge";\n',
        'import { StatusBadge } from "./StatusBadge";\nimport { Button } from "../ui/button";\nimport { Download } from "lucide-react";\n');
      files.edit('src/components/product/InvoiceTable.tsx',
        '          })}\n        </div>\n      </div>\n',
        '          })}\n        </div>\n        <Button variant="outline" size="sm">\n          <Download className="size-3.5" />\n          Export CSV\n        </Button>\n      </div>\n');
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible({ timeout: 15000 });
    }, 'Added an Export CSV button after the filters (outline, small, with a download icon).');
    await expect(page.locator('.ah-marker.done')).toHaveCount(1);
    await pause(page, 3000);
    rec.mark('end');
  } finally {
    files.restore();
    rec.save();
  }
});

test('scene-05 keep agents off it', async ({ page, request }) => {
  test.setTimeout(90000);
  const rec = recorder();
  const api = bridge(request);
  const logo = page.locator('a[aria-label="Sorrel home"] > span');
  try {
    await startScene(page, api);
    rec.mark('start');
    await caption(page, 'Finished something? Keep agents off it.');
    await pause(page, 1200);
    await glideClick(page, page.locator('#ah-d-inspect'), 0.5, 0.5, 30);
    await pause(page, 300);
    await glide(page, logo, 0.75, 0.5, 30);
    await expect(page.locator('#ah-hover-label')).toContainText('<Logo />');
    await pause(page, 800);
    await glideClick(page, logo, 0.75, 0.5, 2);
    await expect(page.locator('#ah-pill-name')).toHaveText('<Logo />');
    await pause(page, 800);
    await glideClick(page, page.locator('#ah-pill-more'), 0.5, 0.5, 15);
    await pause(page, 600);
    await glideClick(page, page.locator('#ah-pill-menu [data-act=freeze]'), 0.5, 0.5, 12);
    await pause(page, 900);
    await page.keyboard.press('Escape');
    await page.mouse.move(640, 300, { steps: 20 });
    await pause(page, 500);
    await glide(page, logo, 0.75, 0.5, 25);
    await expect(page.locator('#ah-hover-label')).toContainText('Locked');
    await caption(page, 'Every prompt tells the agent not to change <Logo />.');
    await pause(page, 3000);
    rec.mark('end');
  } finally {
    rec.save();
  }
});

test('scene-06 end', async ({ page }) => {
  const rec = recorder();
  await page.setContent(card('<p>Try it in your Vite + React app</p><code>npx agent-hover init</code><small>Claude Code · Cursor · Codex · any MCP agent &nbsp;·&nbsp; github.com/Arc-coder07/agent-hover</small>'));
  await page.evaluate(() => document.fonts.ready);
  rec.mark('start');
  await pause(page, 3500);
  rec.mark('end');
  rec.save();
});
