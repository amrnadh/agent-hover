import { readPref, writePref } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

const ENABLED_KEY = 'agent_hover_voice';
const CONSENT_KEY = 'agent_hover_voice_ok';
const LANG_KEY = 'agent_hover_voice_lang';

/** Joins what was already typed with what was said, with one space between. */
export function joinTranscript(base: string, spoken: string): string {
  const said = spoken.replace(/\s+/g, ' ').trim();
  if (!said) return base;
  const before = base.replace(/\s+$/, '');
  return before ? `${before} ${said}` : said;
}

/**
 * Voice (mic button in Ask and in a new comment): speak instead of typing. Uses the browser's own speech
 * recognition. When the browser can do it on the device it does; otherwise the first use says where the audio
 * goes (Chrome and Edge: Google or Microsoft; Safari: Apple) and asks once. Agent Hover never receives audio.
 * Hidden where the browser has no speech recognition (Firefox) or when turned off in Settings.
 */
export function setupVoice(app: OverlayApp) {
  const { shadow, api } = app;
  Object.assign(api, { voiceSupported, voiceEnabled, setVoiceEnabled, voiceLanguage, setVoiceLanguage, attachVoice, stopVoice, isVoiceActive: () => !!active });

  const Recognition: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  let active: { rec: any; button: HTMLElement; field: HTMLTextAreaElement; strip: HTMLElement; placeholder: string } | null = null;

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
  function voiceLanguage(): string {
    return readPref(LANG_KEY, '') || document.documentElement.lang || navigator.language || 'en-US';
  }
  function setVoiceLanguage(lang: string) {
    writePref(LANG_KEY, lang.trim());
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
      stopVoice();
      const lang = voiceLanguage();
      const local = await onDevice(lang);
      if (!local && readPref(CONSENT_KEY, '') !== 'yes' && !(await askConsent(field))) return;
      start(field, button, lang, local);
    };
  }

  /**
   * While the mic is on: a strip above the text box (moving bars, "Listening…", how to stop), a pulsing mic and a
   * red-edged text box. The bars move faster while the browser hears speech.
   */
  function showListening(field: HTMLTextAreaElement): HTMLElement {
    field.parentElement?.querySelector('.ah-listening')?.remove();
    const strip = document.createElement('div');
    strip.className = 'ah-listening';
    strip.setAttribute('role', 'status');
    strip.innerHTML = `<span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="lbl">Listening…</span><span class="hint">Mic or Esc to stop</span>`;
    field.insertAdjacentElement('beforebegin', strip);
    field.classList.add('listening');
    api.requestLayout?.();
    return strip;
  }

  function hearing(strip: HTMLElement, on: boolean) {
    strip.classList.toggle('hearing', on);
    const lbl = strip.querySelector('.lbl');
    if (lbl) lbl.textContent = on ? 'Hearing you…' : 'Listening…';
  }

  function hideListening(a: { field: HTMLTextAreaElement; strip: HTMLElement; placeholder: string }) {
    a.strip.remove();
    a.field.classList.remove('listening');
    a.field.placeholder = a.placeholder;
    api.requestLayout?.();
  }

  function start(field: HTMLTextAreaElement, button: HTMLElement, lang: string, local: boolean) {
    const rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    if (local) rec.processLocally = true;
    const base = field.value;
    const strip = showListening(field);
    const placeholder = field.placeholder;
    field.placeholder = 'Speak now…';
    rec.onspeechstart = () => hearing(strip, true);
    rec.onspeechend = () => hearing(strip, false);
    rec.onresult = (e: any) => {
      hearing(strip, true);
      let said = '';
      for (let i = 0; i < e.results.length; i++) said += ' ' + e.results[i][0].transcript;
      field.value = joinTranscript(base, said);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') api.toast('Microphone blocked: allow it for this site in the browser, then try again');
      else if (e.error === 'no-speech') api.toast('Didn’t catch that. Click the mic and speak again');
      else if (e.error !== 'aborted') api.toast('Voice input stopped');
    };
    rec.onend = () => {
      if (active?.rec !== rec) return;
      hideListening(active);
      active = null;
      button.setAttribute('aria-pressed', 'false');
      button.classList.remove('rec');
      button.title = button.getAttribute('aria-label') || '';
    };
    active = { rec, button, field, strip, placeholder };
    button.title = 'Stop listening (Esc)';
    button.setAttribute('aria-pressed', 'true');
    button.classList.add('rec');
    field.focus();
    try { rec.start(); } catch { rec.onend(); }
  }

  function stopVoice() {
    const a = active;
    if (!a) return;
    active = null;
    hideListening(a);
    a.button.setAttribute('aria-pressed', 'false');
    a.button.classList.remove('rec');
    a.button.title = a.button.getAttribute('aria-label') || '';
    try { a.rec.stop(); } catch { /* already stopped */ }
  }

  const compMic = shadow.getElementById('ah-comp-mic') as HTMLElement | null;
  const compInput = shadow.getElementById('ah-comp-input') as HTMLTextAreaElement | null;
  if (compMic && compInput) attachVoice(compInput, compMic);
}
