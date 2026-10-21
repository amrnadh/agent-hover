import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { bridge, openDemo, selectHost, shotsDir } from './helpers/overlay';

/** A stand-in for the browser's speech recognition: "hears" a sentence in two steps, like real interim results. */
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = ''; continuous = false; interimResults = false;
      onresult: any = null; onend: any = null; onerror: any = null;
      start() {
        const result = (text: string, isFinal: boolean) => Object.assign([{ transcript: text }], { isFinal });
        setTimeout(() => this.onresult?.({ results: [result('make the button', false)] }), 50);
        setTimeout(() => this.onresult?.({ results: [result('make the button bigger', true)] }), 120);
      }
      stop() { setTimeout(() => this.onend?.(), 10); }
    }
    (window as any).SpeechRecognition = FakeRecognition;
    (window as any).webkitSpeechRecognition = FakeRecognition;
  });
}

test.describe('0.2 voice', () => {
  test('the mic in Ask fills the text box from speech, after saying once where audio goes', async ({ page, request }) => {
    await fakeSpeech(page);
    await openDemo(page);
    await bridge(request).post('/agent/presence', { client: 'claude-code' });
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    const mic = page.locator('#ah-comp-mic');
    await expect(mic).toBeVisible();
    await mic.click();
    // Not on the device: ask once.
    await expect(page.locator('#ah-composer .ah-voice-note')).toContainText('Agent Hover never receives or stores audio');
    await page.screenshot({ path: path.join(shotsDir('v0.2'), '10-voice.png') });
    await page.locator('#ah-composer [data-voice=ok]').click();
    await expect(page.locator('#ah-comp-input')).toHaveValue('make the button bigger');
    await expect(mic).toHaveAttribute('aria-pressed', 'true');
    // While the mic is on, a strip says so (and that the browser hears you).
    const strip = page.locator('#ah-composer .ah-listening');
    await expect(strip).toContainText('Hearing you');
    await page.screenshot({ path: path.join(shotsDir('v0.2'), '10b-voice-listening.png') });
    await mic.click();
    await expect(mic).toHaveAttribute('aria-pressed', 'false');
    await expect(strip).toHaveCount(0);

    // Remembered: the next time it starts straight away and adds to what is typed.
    await page.locator('#ah-comp-input').fill('Also');
    await mic.click();
    await expect(page.locator('#ah-composer .ah-voice-note')).toHaveCount(0);
    await expect(page.locator('#ah-comp-input')).toHaveValue('Also make the button bigger');
    // Esc stops listening first and keeps Ask open with what was said.
    await page.keyboard.press('Escape');
    await expect(mic).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#ah-composer')).toBeVisible();
    await expect(page.locator('#ah-comp-input')).toHaveValue('Also make the button bigger');
    await page.keyboard.press('Escape');
  });

  test('no mic where the browser has no speech recognition, and Settings says so', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
    });
    await openDemo(page);
    await selectHost(page, '#hero-primary-cta');
    await page.locator('#ah-pill-ask').click();
    await expect(page.locator('#ah-comp-mic')).toBeHidden();
    await page.keyboard.press('Escape'); // close Ask, keep the selection so shortcuts work
    await page.keyboard.press('?');
    await expect(page.locator('#ah-set-voice')).toContainText('This browser has no speech recognition');
    await expect(page.locator('#ah-set-voice')).toContainText('press Fn twice on macOS');
  });
});
