import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { bridge, openDemo, restPointer, selectHost, shotsDir } from './helpers/overlay';

const demoDir = path.resolve(process.env.AH_DEMO_DIR || 'demo');
const samples = path.resolve('demo/samples');

/** Select an element further down the page: bring it into view first, as you would. */
async function selectInView(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  return selectHost(page, selector);
}

/** Drop a sample file on the page at the center of `selector`, the way a file dragged from Finder arrives. */
async function dropFile(page: Page, selector: string, file: string, mime: string) {
  const box = (await page.locator(selector).first().boundingBox())!;
  const b64 = fs.readFileSync(path.join(samples, file)).toString('base64');
  await page.evaluate(({ b64, name, mime, x, y }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], name, { type: mime }));
    const at = document.elementFromPoint(x, y) || document.body;
    at.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, clientX: x, clientY: y }));
    at.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, clientX: x, clientY: y }));
  }, { b64, name: file, mime, x: box.x + box.width / 2, y: box.y + box.height / 2 });
}

/** Tasks a test sent, removed afterwards so the next test (or browser) starts with no markers or queued tasks. */
const created: string[] = [];
test.afterEach(async ({ request }) => {
  if (created.length) await bridge(request).post('/agent/tasks/remove', { ids: created.splice(0) });
});

test.describe('0.3 Place', () => {
  const testimonial = path.join(demoDir, 'src/components/Testimonial.tsx');
  const placed = path.join(demoDir, 'public/priya-nair.png');
  let original = '';

  test.beforeAll(() => { original = fs.readFileSync(testimonial, 'utf8'); });
  test.afterAll(() => {
    fs.writeFileSync(testimonial, original);
    fs.rmSync(placed, { force: true });
  });

  test('drop a photo on the avatar, place it over, send; the agent builds it; Compare shows Mock and Built; Undo removes it', async ({ page, request }) => {
    test.setTimeout(90000);
    const api = bridge(request);
    await openDemo(page);
    await api.post('/agent/presence', { client: 'claude-code' });

    await selectInView(page, '#testimonial-avatar');
    await dropFile(page, '#testimonial-avatar', 'priya-nair.png', 'image/png');
    const card = page.locator('#ah-place');
    await expect(card).toBeVisible();
    await expect(card.locator('.thumb[data-variant="0"]')).toBeVisible();

    // The mock is a real image in the page, next to the avatar by default.
    const mock = page.locator('[data-ah-place]');
    await expect(mock).toHaveCount(1);
    expect(await mock.evaluate((el) => el.previousElementSibling?.id)).toBe('testimonial-avatar');

    // Over: inside the avatar, positioned on it; the frame to drag it appears.
    await card.locator('[data-pos="over"]').click();
    expect(await mock.evaluate((el) => el.parentElement?.id)).toBe('testimonial-avatar');
    await expect(page.locator('.ah-place-handle')).toBeVisible();
    await card.locator('#ah-place-alt').fill('Priya Nair');
    await card.locator('#ah-place-note').fill('Make it a round photo that fills the avatar');
    await restPointer(page);
    await page.screenshot({ path: path.join(shotsDir('v0.3'), '01-place-card.png') });

    await card.locator('[data-act=send]').click();
    await expect(card).toBeHidden();
    // The mock leaves the page once sent, so the built image never shows twice.
    await expect(mock).toHaveCount(0);

    let task: any = null;
    await expect.poll(async () => {
      task = (await api.get('/agent/tasks?limit=20')).tasks.find((t: any) => t.type === 'place' && t.payload?.place?.position === 'over');
      return !!task;
    }).toBe(true);
    created.push(task.id);
    const asset = task.payload.place.assetPath as string;
    expect(asset).toMatch(/^\.agent-hover\/place\/.+\.png$/);
    expect(fs.existsSync(path.join(demoDir, asset))).toBe(true);
    expect(task.payload.prompt).toContain(asset);
    expect(task.payload.prompt).toContain('on top of the element');
    expect(task.payload.prompt).toContain('`public/priya-nair.png`');
    expect(task.payload.prompt).toContain('Alt text: “Priya Nair”');
    // The selector was read before the mock went in, and still finds the avatar.
    expect(await page.evaluate((sel) => document.querySelector(sel)?.id, task.target.selector)).toBe('testimonial-avatar');

    // The "agent": claim (checkpoint), copy the file in, add the image, complete.
    expect(await api.takeTask(task.id)).toBeTruthy();
    await api.post(`/agent/tasks/${task.id}/claim`, { client: 'claude-code' });
    fs.copyFileSync(path.join(demoDir, asset), placed);
    fs.writeFileSync(testimonial, original.replace(
      '>PN</span>',
      '>PN<img src="/priya-nair.png" alt="Priya Nair" className="absolute inset-0 size-full rounded-full object-cover" /></span>',
    ).replace('id="testimonial-avatar" className="', 'id="testimonial-avatar" className="relative overflow-hidden '));
    await expect(page.locator('#testimonial-avatar img[alt="Priya Nair"]')).toBeVisible({ timeout: 15000 });
    const done = await api.post(`/agent/tasks/${task.id}/complete`, { summary: 'Added the photo.' });
    expect(done.task.result.filesChanged.sort()).toEqual(['public/priya-nair.png', 'src/components/Testimonial.tsx']);

    await page.locator('.ah-marker.done').last().click();
    const taskCard = page.locator('#ah-task-card');
    await taskCard.locator('[data-act=compare]').click();
    const captureNow = taskCard.locator('[data-act=capture-after]');
    if (await captureNow.isVisible().catch(() => false)) await captureNow.click({ timeout: 5000 }).catch(() => {});
    await expect(taskCard.locator('.ah-compare img')).toHaveCount(2, { timeout: 10000 });
    await expect(taskCard.locator('.ah-compare .tag.before')).toHaveText('Mock');
    await expect(taskCard.locator('.ah-compare .tag.after')).toHaveText('Built');

    // Undo removes the copied file too: it appeared after the checkpoint.
    await taskCard.locator('[data-act=undo]').click();
    await expect(taskCard.locator('.ah-undo li')).toHaveCount(2);
    await taskCard.locator('[data-act=undo-confirm]').click();
    await expect(page.locator('#ah-toast')).toContainText('Undid 2 files');
    expect(fs.existsSync(placed)).toBe(false);
    expect(fs.readFileSync(testimonial, 'utf8')).toBe(original);
  });

  test('variants, sizes and Esc: the mock follows the choice and leaves the page on close', async ({ page }) => {
    await openDemo(page);
    await selectInView(page, '#logo-cloud');
    await page.keyboard.press('p');
    const card = page.locator('#ah-place');
    await expect(card).toBeVisible();
    // Each file dropped on the open card is another variant; the newest shows on the page.
    await dropFile(page, '#ah-place', 'copperleaf.svg', 'image/svg+xml');
    await dropFile(page, '#ah-place', 'priya-nair.png', 'image/png');
    await expect(card.locator('.thumb[data-variant]')).toHaveCount(2);
    const mock = page.locator('[data-ah-place]');
    await expect(mock).toHaveCount(1);
    const src1 = await mock.getAttribute('src');
    await card.locator('.thumb[data-variant="0"]').click();
    await expect(mock).not.toHaveAttribute('src', src1!);

    await card.locator('[data-pos="inside-start"]').click();
    await card.locator('[data-size="custom"]').click();
    const width = card.locator('input[data-field=width]');
    await width.fill('64');
    await expect.poll(() => mock.evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(64);
    await card.locator('[data-size="fit"]').click();
    const room = await page.locator('#logo-cloud').evaluate((el) => {
      const cs = getComputedStyle(el);
      return Math.round(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    });
    await expect.poll(() => mock.evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(room);

    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect(mock).toHaveCount(0);
  });

  test('a file that is not an image or video is refused', async ({ page }) => {
    await openDemo(page);
    await selectInView(page, '#testimonial-avatar');
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['<html></html>'], 'page.html', { type: 'text/html' }));
      document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 10, clientY: 10 }));
    });
    await expect(page.locator('#ah-toast')).toContainText('Place takes PNG, JPG, WebP, GIF, SVG, MP4 and WebM');
    await expect(page.locator('#ah-place')).toBeHidden();
  });
});
