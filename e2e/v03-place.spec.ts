import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { bridge, openDemo, restPointer, shotsDir } from './helpers/overlay';

const demoDir = path.resolve(process.env.AH_DEMO_DIR || 'demo');
const samples = path.resolve('demo/samples');

/** Tasks a test sent, removed afterwards so the next test (or browser) starts with no markers or queued tasks. */
const created: string[] = [];
test.afterEach(async ({ request }) => {
  if (created.length) await bridge(request).post('/agent/tasks/remove', { ids: created.splice(0) });
});

/** Drop a sample file at a point, the way a file dragged from Finder arrives. */
async function dropFile(page: Page, at: { x: number; y: number }, file: string, mime: string) {
  const b64 = fs.readFileSync(path.join(samples, file)).toString('base64');
  await page.evaluate(({ b64, name, mime, x, y }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], name, { type: mime }));
    const target = document.elementFromPoint(x, y) || document.body;
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, clientX: x, clientY: y }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, clientX: x, clientY: y }));
  }, { b64, name: file, mime, x: at.x, y: at.y });
}
const center = async (page: Page, sel: string) => { const b = (await page.locator(sel).first().boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

test.describe('0.3 Place', () => {
  const testimonial = path.join(demoDir, 'src/components/Testimonial.tsx');
  const placed = path.join(demoDir, 'public/priya-nair.png');
  let original = '';
  test.beforeAll(() => { original = fs.readFileSync(testimonial, 'utf8'); });
  test.afterAll(() => { fs.writeFileSync(testimonial, original); fs.rmSync(placed, { force: true }); });

  test('drop images anywhere, move with guides, align, rotate, remove one, send; the agent builds it; Mock and Built; Undo', async ({ page, request }) => {
    test.setTimeout(90000);
    const api = bridge(request);
    await openDemo(page);
    await api.post('/agent/presence', { client: 'claude-code' });
    await page.locator('#testimonial-avatar').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);

    await page.locator('#ah-d-place').click();
    const pal = page.locator('#ah-d-pal');
    await expect(pal).toBeVisible();
    await expect(pal).toContainText('Add image');

    // Drop the photo right on the avatar: it lands there, selected, with its frame and a tag saying where it sits.
    const avatar = await center(page, '#testimonial-avatar');
    await dropFile(page, avatar, 'priya-nair.png', 'image/png');
    const item = page.locator('.ah-ph');
    await expect(item).toHaveCount(1);
    await expect(page.locator('#ah-place-frame')).toBeVisible();
    await expect(page.locator('#ah-place-tag')).toContainText('On ');
    const ib = (await item.boundingBox())!;
    expect(Math.abs(ib.x + ib.width / 2 - avatar.x)).toBeLessThan(3);

    // Drag it: smart guides show while it snaps to what's around it.
    await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
    await page.mouse.down();
    await page.mouse.move(ib.x + ib.width / 2 + 40, ib.y + ib.height / 2 + 2, { steps: 6 });
    await expect(page.locator('#ah-guide-v, #ah-guide-h').first()).toBeAttached();
    await page.mouse.up();

    // Resize from a corner.
    const se = (await page.locator('#ah-place-frame i[data-c=se]').boundingBox())!;
    await page.mouse.move(se.x + 4, se.y + 4);
    await page.mouse.down();
    await page.mouse.move(se.x - 180, se.y + 4, { steps: 6 });
    await page.mouse.up();
    const small = (await item.boundingBox())!;
    expect(small.width).toBeLessThan(ib.width);

    // Align it on the element under it, then rotate.
    await pal.locator('[data-a=align]').click();
    await page.locator('#ah-pal-pop [data-al=mc]').click();
    await expect(page.locator('#ah-place-tag')).toContainText('center');
    await pal.locator('[data-a=rotate]').click();
    await expect(page.locator('#ah-place-tag')).toContainText('rotated 90°');
    await pal.locator('[data-a=alt]').click();
    await page.locator('#ah-place-alt').fill('Priya Nair');
    await page.keyboard.press('Enter');
    await restPointer(page);
    await page.screenshot({ path: path.join(shotsDir('v0.3'), '01-place.png') });

    // A second image elsewhere; then Delete removes the selected one.
    // Dropped on the selected image it would be another version of it; anywhere else it's a new one.
    await dropFile(page, { x: 90, y: 120 }, 'copperleaf.svg', 'image/svg+xml');
    await expect(item).toHaveCount(2);
    await expect(pal).toContainText('2 placed');
    await page.keyboard.press('Delete');
    await expect(item).toHaveCount(1);
    await expect(pal).toContainText('1 placed');

    await pal.locator('[data-a=send]').click();
    await expect(item).toHaveCount(0);
    let task: any = null;
    await expect.poll(async () => {
      task = (await api.get('/agent/tasks?limit=20')).tasks.find((t: any) => t.type === 'place' && t.status === 'queued');
      return !!task;
    }).toBe(true);
    created.push(task.id);
    expect(task.payload.place).toHaveLength(1);
    const asset = task.payload.place[0].assetPath as string;
    expect(asset).toMatch(/^\.agent-hover\/place\/.+\.png$/);
    expect(fs.existsSync(path.join(demoDir, asset))).toBe(true);
    expect(task.payload.prompt).toContain(asset);
    expect(task.payload.prompt).toContain('It was aligned center');
    expect(task.payload.prompt).toContain('Rotated 90° clockwise');
    expect(task.payload.prompt).toContain('Alt text: “Priya Nair”');
    expect(task.payload.prompt).toContain('`public/priya-nair.png`');

    // The "agent": claim (checkpoint), copy the file in, add the image, complete.
    expect(await api.takeTask(task.id)).toBeTruthy();
    await api.post(`/agent/tasks/${task.id}/claim`, { client: 'claude-code' });
    fs.copyFileSync(path.join(demoDir, asset), placed);
    fs.writeFileSync(testimonial, original
      .replace('>PN</span>', '>PN<img src="/priya-nair.png" alt="Priya Nair" className="absolute inset-0 size-full rounded-full object-cover rotate-90" /></span>')
      .replace('id="testimonial-avatar" className="', 'id="testimonial-avatar" className="relative overflow-hidden '));
    await expect(page.locator('#testimonial-avatar img[alt="Priya Nair"]')).toBeVisible({ timeout: 15000 });
    const done = await api.post(`/agent/tasks/${task.id}/complete`, { summary: 'Added the photo.' });
    expect(done.task.result.filesChanged.sort()).toEqual(['public/priya-nair.png', 'src/components/Testimonial.tsx']);

    await page.locator('.ah-marker.done').first().click();
    const card = page.locator('#ah-task-card');
    await card.locator('[data-act=compare]').click();
    const captureNow = card.locator('[data-act=capture-after]');
    if (await captureNow.isVisible().catch(() => false)) await captureNow.click({ timeout: 5000 }).catch(() => {});
    await expect(card.locator('.ah-compare img')).toHaveCount(2, { timeout: 10000 });
    await expect(card.locator('.ah-compare .tag.before')).toHaveText('Mock');
    await expect(card.locator('.ah-compare .tag.after')).toHaveText('Built');

    await card.locator('[data-act=undo]').click();
    await expect(card.locator('.ah-undo li')).toHaveCount(2);
    await card.locator('[data-act=undo-confirm]').click();
    await expect(page.locator('#ah-toast')).toContainText('Undid 2 files');
    expect(fs.existsSync(placed)).toBe(false);
    expect(fs.readFileSync(testimonial, 'utf8')).toBe(original);
  });

  test('a file that is not an image or video is refused; Esc leaves the image, then closes the palette', async ({ page }) => {
    await openDemo(page);
    await page.locator('#ah-d-place').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['<html></html>'], 'page.html', { type: 'text/html' }));
      document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 300, clientY: 300 }));
    });
    await expect(page.locator('#ah-toast')).toContainText('Place takes PNG, JPG, WebP, GIF, SVG, MP4 and WebM');
    await dropFile(page, { x: 400, y: 300 }, 'priya-nair.png', 'image/png');
    await expect(page.locator('#ah-place-frame')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ah-place-frame')).toBeHidden();
    await expect(page.locator('.ah-ph')).toHaveCount(1);
    // The × on the frame removes it too.
    const b = (await page.locator('.ah-ph').boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.locator('#ah-place-frame .del').click();
    await expect(page.locator('.ah-ph')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ah-d-pal')).toBeHidden();
  });
});
