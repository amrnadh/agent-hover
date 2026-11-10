import { readPref, writePref } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

const ENABLED_KEY = 'agent_hover_voice';
const CONSENT_KEY = 'agent_hover_voice_ok';

/** Joins what was already typed with what was said, with one space between. */
export function joinTranscript(base: string, spoken: string): string {
  const said = spoken.replace(/\s+/g, ' ').trim();
  if (!said) return base;
  const before = base.replace(/\s+$/, '');
  return before ? `${before} ${said}` : said;
}

/**
 * Talk & point: an element you clicked while talking. `index` is the speech result that was being heard at that
 * moment (-1 before any) and `offset` how much of it had been heard, so the marker lands where you were in the
 * sentence.
 */
export interface VoiceMark { n: number; index: number; offset: number }

/**
 * The spoken text with [n] markers where you clicked. The browser keeps revising the result it is still hearing,
 * so a marker's offset is moved to the end of the word it fell in, and to the end of the result if the result got
 * shorter.
 */
export function mergeTranscript(results: string[], marks: VoiceMark[]): string {
  const sorted = [...marks].sort((a, b) => a.index - b.index || a.offset - b.offset || a.n - b.n);
  const tag = (m: VoiceMark) => `[${m.n}]`;
  const out: string[] = sorted.filter((m) => m.index < 0).map(tag);
  results.forEach((raw, i) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    const here = sorted.filter((m) => m.index === i);
    let pos = 0;
    let piece = '';
    for (const m of here) {
      // The heard text before the click, trimmed the same way, then on to the end of that word.
      const heard = raw.slice(0, m.offset).replace(/\s+/g, ' ').trimStart();
      let cut = Math.min(heard.length, text.length);
      if (cut > 0 && cut < text.length && text[cut] !== ' ' && text[cut - 1] !== ' ') {
        const space = text.indexOf(' ', cut);
        cut = space < 0 ? text.length : space;
      }
      cut = Math.max(cut, pos);
      piece += text.slice(pos, cut) + ` ${tag(m)} `;
      pos = cut;
    }
    piece += text.slice(pos);
    out.push(piece);
  });
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Voice (mic button in Ask, in a new comment, in Place and the Batch goal): speak instead of typing. Uses the
 * browser's own speech recognition. When the browser can do it on the device it does; otherwise the first use says
 * where the audio goes (Chrome and Edge: Google or Microsoft; Safari: Apple) and asks once. Agent Hover never
 * receives audio. Hidden where the browser has no speech recognition (Firefox) or when turned off in Settings.
 *
 * Talk & point builds on the same engine: `markVoice(n)` puts [n] into the sentence being dictated, where you were
 * when you clicked an element.
 */
export function setupVoice(app: OverlayApp) {
  const { shadow, api } = app;
  Object.assign(api, {
    voiceSupported, voiceEnabled, setVoiceEnabled, attachVoice, startVoice, stopVoice, markVoice, unmarkVoice,
    isVoiceActive: () => !!active, voiceField: () => active?.field || null,
  });

  const Recognition: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  interface Active { rec: any; button: HTMLElement | null; field: HTMLTextAreaElement; placeholder: string; base: string; results: string[]; marks: VoiceMark[] }
  let active: Active | null = null;

  function voiceSupported(): boolean {
    return typeof Recognition === 'function';
  }
  function voiceEnabled(): boolean {
    return voiceSupported() && readPref(ENABLED_KEY, 'on') !== 'off';
  }
  function setVoiceEnabled(on: boolean) {
    writePref(ENABLED_KEY, on ? 'on' : 'off');
    if (!on) stopVoice();
    refreshButtons();
  }
  /** The language you speak: your browser's (en-US, en-GB, en-IN…). */
  function voiceLanguage(): string {
    return navigator.language || 'en-US';
  }

  const buttons = new Set<HTMLElement>();
  function refreshButtons() {
    for (const b of buttons) {
      if (!b.isConnected) { buttons.delete(b); continue; }
      b.hidden = !voiceEnabled();
    }
  }

  /** Whether this browser transcribes on the device for `lang` (no audio leaves the machine). */
  async function onDevice(lang: string): Promise<boolean> {
    try {
      if (typeof Recognition.available === 'function') return (await Recognition.available({ langs: [lang], processLocally: true })) === 'available';
    } catch { /* older browsers */ }
    return false;
  }

  /** A one-time note next to the text box: where the audio goes. Resolves true to go ahead. */
  function askConsent(field: HTMLTextAreaElement): Promise<boolean> {
    return new Promise((resolve) => {
      field.parentElement?.querySelector('.ah-voice-note')?.remove();
      const note = document.createElement('div');
      note.className = 'ah-voice-note';
      note.innerHTML = `<p>Your browser turns speech into text. Chrome and Edge send the audio to Google or Microsoft for this, Safari to Apple. Agent Hover never receives or stores audio.</p>
        <div class="ah-actions" style="justify-content:flex-end"><button class="ah-tbtn" data-voice="no">Not now</button><button class="ah-tbtn primary" data-voice="ok">Use voice</button></div>`;
      field.insertAdjacentElement('beforebegin', note);
      note.onclick = (e) => {
        const b = (e.target as Element).closest('[data-voice]') as HTMLElement | null;
        if (!b) return;
        note.remove();
        const ok = b.dataset.voice === 'ok';
        if (ok) writePref(CONSENT_KEY, 'yes');
        resolve(ok);
        api.requestLayout?.();
      };
      api.requestLayout?.();
    });
  }

  /** Mic `button` dictates into `field`: click to start, click again (or close the card) to stop. */
  function attachVoice(field: HTMLTextAreaElement, button: HTMLElement) {
    buttons.add(button);
    button.hidden = !voiceEnabled();
    button.setAttribute('aria-pressed', 'false');
    button.onclick = async (e) => {
      e.preventDefault();
      if (active?.button === button) { stopVoice(); return; }
      await startVoice(field, button);
    };
  }

  /**
   * Start dictating into `field` (Talk & point's V key, or a mic button). Asks once where the audio goes when the
   * browser can't transcribe on the device. `focus: false` leaves the keyboard where it is (a held key). Resolves
   * whether it started.
   */
  async function startVoice(field: HTMLTextAreaElement, button: HTMLElement | null = null, opts: { focus?: boolean } = {}): Promise<boolean> {
    if (!voiceEnabled()) return false;
    stopVoice();
    const lang = voiceLanguage();
    const local = await onDevice(lang);
    if (!local && readPref(CONSENT_KEY, '') !== 'yes' && !(await askConsent(field))) return false;
    start(field, button, lang, local, opts.focus !== false);
    return true;
  }

  /** While the mic is on: the mic button breathes, and an empty text box says it's listening. Nothing else moves. */
  function showListening(field: HTMLTextAreaElement, button: HTMLElement | null): string {
    const placeholder = field.placeholder;
    field.placeholder = 'Listening…';
    button?.classList.add('rec');
    return placeholder;
  }

  function hideListening(a: Active) {
    a.field.placeholder = a.placeholder;
    a.button?.classList.remove('rec', 'hearing');
  }

  function write(a: Active) {
    a.field.value = joinTranscript(a.base, mergeTranscript(a.results, a.marks));
    a.field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function start(field: HTMLTextAreaElement, button: HTMLElement | null, lang: string, local: boolean, focus: boolean) {
    const rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    if (local) rec.processLocally = true;
    const placeholder = showListening(field, button);
    const a: Active = { rec, button, field, placeholder, base: field.value, results: [], marks: [] };
    // A little livelier while the browser hears speech.
    rec.onspeechstart = () => button?.classList.add('hearing');
    rec.onspeechend = () => button?.classList.remove('hearing');
    rec.onresult = (e: any) => {
      a.results = Array.from({ length: e.results.length }, (_, i) => String(e.results[i][0].transcript || ''));
      write(a);
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') api.toast('Microphone blocked: allow it for this site in the browser, then try again');
      else if (e.error === 'no-speech') api.toast('Didn’t catch that. Click the mic and speak again');
      else if (e.error !== 'aborted') api.toast('Voice input stopped');
    };
    rec.onend = () => {
      if (active !== a) return;
      hideListening(a);
      active = null;
      button?.setAttribute('aria-pressed', 'false');
      if (button) button.title = button.getAttribute('aria-label') || '';
      shadow.dispatchEvent(new CustomEvent('ah-voice-ended'));
    };
    active = a;
    if (button) {
      button.title = 'Stop listening (Esc)';
      button.setAttribute('aria-pressed', 'true');
    }
    if (focus) field.focus();
    try { rec.start(); } catch { rec.onend(); }
  }

  /** Put [n] into the sentence being dictated, where it is now. False when nothing is being dictated. */
  function markVoice(n: number): boolean {
    const a = active;
    if (!a) return false;
    const index = a.results.length - 1;
    a.marks.push({ n, index, offset: index >= 0 ? a.results[index].length : 0 });
    write(a);
    return true;
  }

  /** Take [n] out of the sentence being dictated and renumber the ones after it. False when nothing is dictated. */
  function unmarkVoice(n: number): boolean {
    const a = active;
    if (!a) return false;
    a.marks = a.marks.filter((m) => m.n !== n).map((m) => (m.n > n ? { ...m, n: m.n - 1 } : m));
    write(a);
    return true;
  }

  function stopVoice() {
    const a = active;
    if (!a) return;
    active = null;
    hideListening(a);
    a.button?.setAttribute('aria-pressed', 'false');
    if (a.button) a.button.title = a.button.getAttribute('aria-label') || '';
    try { a.rec.stop(); } catch { /* already stopped */ }
    shadow.dispatchEvent(new CustomEvent('ah-voice-ended'));
  }

  const compMic = shadow.getElementById('ah-comp-mic') as HTMLElement | null;
  const compInput = shadow.getElementById('ah-comp-input') as HTMLTextAreaElement | null;
  if (compMic && compInput) attachVoice(compInput, compMic);
}
