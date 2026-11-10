import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { bridge, clickHost, openDemo, restPointer, selectHost, shotsDir, startInspect } from './helpers/overlay';

/**
 * A stand-in for the browser's speech recognition that the test drives: `__say(text, final)` delivers what was
 * "heard" so far, revising the current result like real interim results do.
 */
async function scriptedSpeech(page: Page) {
  await page.addInitScript(() => {
    let current: any = null;
    const results: any[] = [];
    class FakeRecognition {
      lang = ''; continuous = false; interimResults = false;
      onresult: any = null; onend: any = null; onerror: any = null;
      start() { current = this; results.length = 0; }
      stop() { setTimeout(() => this.onend?.(), 10); current = null; }
    }
    (window as any).__say = (text: string, isFinal: boolean) => {
      const last = results[results.length - 1];
      const r = Object.assign([{ transcript: text }], { isFinal });
      if (last && !last.isFinal) results[results.length - 1] = r;
      else results.push(r);
      current?.onresult?.({ results: [...results] });
    };
    (window as any).SpeechRecognition = FakeRecognition;
    (window as any).webkitSpeechRecognition = FakeRecognition;
  });
}

const say = (page: Page, text: string, final = false) => page.evaluate(([t, f]) => (window as any).__say(t, f), [text, final] as const);

/** Agreed once already: where the audio goes. */
const consented = (page: Page) => page.evaluate(() => localStorage.setItem('agent_hover_voice_ok', 'yes'));

async function findTask(api: ReturnType<typeof bridge>, match: (t: any) => boolean) {
  let task: any = null;
  await expect.poll(async () => {
    task = (await api.get('/agent/tasks?limit=20')).tasks.find(match);
    return !!task;
  }).toBe(true);
  created.push(task.id);
  return task;
}

/** Tasks a test sent, removed afterwards so the next test (or browser) starts with no markers or queued tasks. */
const created: string[] = [];
test.afterEach(async ({ request }) => {
  if (created.length) await bridge(request).post('/agent/tasks/remove', { ids: created.splice(0) });
});

test.describe('0.3 Talk & point', () => {
  test('hold V, talk, click two elements: the sentence gets [1] and [2] where you clicked, and Send makes one task', async ({ page, request }) => {
    await scriptedSpeech(page);
    await openDemo(page);
    await consented(page);
    const api = bridge(request);
    await api.post('/agent/presence', { client: 'claude-code' });
    await startInspect(page);
    await restPointer(page);

    await page.keyboard.down('v');
    const card = page.locator('#ah-talk');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-act=mic]')).toHaveAttribute('aria-pressed', 'true');
    await say(page, 'make');
    await clickHost(page, '#hero-secondary-cta');
    await say(page, 'make this look like');
    await clickHost(page, '#hero-primary-cta');
    await say(page, 'make this look like that one', true);
    await page.waitForTimeout(400);
    await page.keyboard.up('v');

    const input = card.locator('#ah-talk-input');
    await expect(input).toHaveValue('make [1] this look like [2] that one');
    await expect(card.locator('[data-act=mic]')).toHaveAttribute('aria-pressed', 'false');
    await expect(card.locator('.ah-talk-list li')).toHaveCount(2);
    await expect(page.locator('#ah-layer-talk .ah-batch-num')).toHaveCount(2);
    // Holding V never typed a "v" anywhere.
    expect(await input.inputValue()).not.toContain('v ');
    // A click while talking adds, it doesn't select.
    await expect(page.locator('#ah-pill')).toBeHidden();
    await page.screenshot({ path: path.join(shotsDir('v0.3'), '02-talk-and-point.png') });

    await card.locator('[data-act=send]').click();
    await expect(card).toBeHidden();
    await expect(page.locator('#ah-layer-talk .ah-batch-num')).toHaveCount(0);
    const task = await findTask(api, (t) => t.payload?.display === 'Talk & point · 2 elements' && t.instruction === 'make [1] this look like [2] that one');
    expect(task.type).toBe('pinned-stack');
    expect(task.payload.prompt).toContain('[1] is element 1');
    // Element 1 is the first one clicked, element 2 the second.
    const p: string = task.payload.prompt;
    const [one, two] = [p.indexOf('## [1] '), p.indexOf('## [2] ')];
    expect(one).toBeGreaterThan(0);
    expect(p.slice(one, two)).toContain('hero-secondary-cta');
    expect(p.slice(two)).toContain('hero-primary-cta');
  });

  test('the mic in Ask: the selection is [1], clicks while it listens add [2]; the 0.2.1 mic is otherwise unchanged', async ({ page, request }) => {
    await scriptedSpeech(page);
    await openDemo(page);
    await consented(page);
    const api = bridge(request);
    await api.post('/agent/presence', { client: 'claude-code' });
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    await page.locator('#ah-comp-mic').click();
    await say(page, 'make this match');
    await clickHost(page, '#hero-secondary-cta');
    await say(page, 'make this match that', true);

    const input = page.locator('#ah-comp-input');
    await expect(input).toHaveValue('make this match [2] that');
    await expect(page.locator('#ah-composer')).toBeVisible();
    await expect(page.locator('#ah-comp-refs li')).toHaveCount(2);
    await expect(page.locator('#ah-pill-name')).toContainText('Book a demo');

    // Removing [2] takes it out of the sentence too.
    await page.locator('#ah-comp-refs [data-remove="1"]').click();
    await expect(input).toHaveValue('make this match that');
    await expect(page.locator('#ah-comp-refs')).toBeHidden();

    await clickHost(page, '#hero-secondary-cta');
    await expect(input).toHaveValue('make this match that [2]');
    await page.locator('#ah-comp-mic').click(); // stop
    await page.locator('#ah-comp-send').click();
    const task = await findTask(api, (t) => t.payload?.display === 'Talk & point · 2 elements' && /^make this match .*\[2\]/.test(t.instruction || ''));
    const p: string = task.payload.prompt;
    expect(p.slice(p.indexOf('## [1] '), p.indexOf('## [2] '))).toContain('hero-primary-cta');
  });

  test('without speech recognition, V opens the card for typing and clicks add the numbers', async ({ page, request }) => {
    await page.addInitScript(() => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
    });
    await openDemo(page);
    const api = bridge(request);
    await api.post('/agent/presence', { client: 'claude-code' });
    await startInspect(page);
    await restPointer(page);
    await page.keyboard.press('v');
    const card = page.locator('#ah-talk');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-act=mic]')).toBeHidden();
    await clickHost(page, '#hero-primary-cta');
    await clickHost(page, '#hero-secondary-cta');
    const input = card.locator('#ah-talk-input');
    await expect(input).toHaveValue('[1] [2] ');
    await input.fill('swap [1] and [2]');
    await card.locator('[data-act=send]').click();
    await findTask(api, (t) => t.instruction === 'swap [1] and [2]');
    await page.keyboard.press('v');
    await expect(card).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
  });
});
