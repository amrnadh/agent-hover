import { anchorTo, esc, placeBox } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { prettyAgentName } from '../lib/task-status.js';
import { formatTalkRequest } from '../lib/prompt-format.js';
import type { OverlayApp } from '../app/context.js';

interface TalkItem { stack: any[]; index: number; name: string }

/** A held key starts and stops; a quick tap keeps listening until the next tap or Esc. */
const HOLD_MS = 350;

/**
 * Talk & point (0.3): talk, and click what you mean while you say it. Each click puts [1], [2]… into the sentence
 * where you were, with a numbered badge on the element, and Send makes one task like Batch.
 *
 * It uses the same mic and engine as Ask (features/voice.ts): click the mic in Ask and clicks on the page add
 * elements (the selection is [1]); or hold V in Agent Hover for a card of its own. Without speech recognition
 * (Firefox) V still opens the card: type, and clicks add the numbers where the cursor is.
 */
export function setupTalk(app: OverlayApp) {
  const { shadow, state, api } = app;
  Object.assign(api, { isTalking, talkAdd, openTalk, closeTalk, isTalkOpen: () => source === 'card', talkItemsFor, clearTalk, sendTalk, onInspectStart });

  const card = shadow.getElementById('ah-talk') as HTMLElement;
  const layer = shadow.getElementById('ah-layer-talk') as HTMLElement;
  const compInput = shadow.getElementById('ah-comp-input') as HTMLTextAreaElement;
  const compRefs = shadow.getElementById('ah-comp-refs') as HTMLElement | null;

  /** Elements in the current talk: in the card, or in Ask while its mic listens. */
  let source: 'card' | 'composer' | null = null;
  let items: TalkItem[] = [];
  let holding = false;
  let downAt = 0;
  let sending = false;

  const field = (): HTMLTextAreaElement | null =>
    source === 'card' ? (card.querySelector('#ah-talk-input') as HTMLTextAreaElement | null) : source === 'composer' ? compInput : null;

  // ---------- who gets clicks ----------

  /** Whether a click on the page adds an element to the talk instead of selecting it. */
  function isTalking(): boolean {
    if (source === 'card') return true;
    // Ask: only while its mic listens, or once elements were added that way.
    return !!api.isComposerOpen?.() && (api.voiceField?.() === compInput || (source === 'composer' && items.length > 0));
  }

  function sameItem(a: any, b: any): boolean {
    if (a === b) return true;
    if (!a || !b || a.isDomElement !== b.isDomElement) return false;
    if (a.isDomElement) return a.element === b.element;
    return a.name === b.name && !!a.fiber && (a.fiber === b.fiber || a.fiber === b.fiber?.alternate);
  }

  function talkAdd(stack: any[], index: number) {
    const item = stack[index];
    if (!item) return;
    if (source !== 'card') {
      // In Ask: the selected element is [1].
      if (source !== 'composer') { source = 'composer'; items = []; }
      if (!items.length && state.selectedTarget) items.push({ stack: state.currentStack, index: state.currentStackIndex, name: api.nameFor(state.selectedTarget) });
    }
    let n = items.findIndex((t) => sameItem(t.stack[t.index], item)) + 1;
    if (!n) {
      items.push({ stack, index, name: api.nameFor(item) });
      n = items.length;
    }
    const f = field();
    if (f && !api.markVoice?.(n)) insertToken(f, `[${n}]`);
    render();
  }

  /** Typing (no dictation): [n] goes where the cursor is, or at the end. */
  function insertToken(f: HTMLTextAreaElement, token: string) {
    const v = f.value;
    const focused = shadow.activeElement === f;
    const pos = focused ? f.selectionStart ?? v.length : v.length;
    const before = v.slice(0, pos).replace(/\s+$/, '');
    const after = v.slice(pos).replace(/^\s+/, '');
    f.value = [before, token, after].filter(Boolean).join(' ') + (after ? '' : ' ');
    const caret = (before ? before.length + 1 : 0) + token.length + 1;
    f.setSelectionRange?.(caret, caret);
    f.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function talkItemsFor(which: 'card' | 'composer'): TalkItem[] {
    return source === which ? items : [];
  }

  function clearTalk(which?: 'card' | 'composer') {
    if (which && source !== which) return;
    source = null;
    items = [];
    if (compRefs) { compRefs.hidden = true; compRefs.innerHTML = ''; }
    layer.innerHTML = '';
  }

  // ---------- the card ----------

  /** Opens a talk. While you talk the card stays out of the way and a caption follows the pointer. */
  function openTalk(listening = false) {
    if (source !== 'card') {
      api.closeComposer?.();
      api.placeEscape?.();
      api.closeCommentCard?.();
      api.closeTaskCard?.();
      api.deselect?.();
      clearTalk();
      source = 'card';
      card.hidden = false;
      renderCard();
    }
    card.hidden = listening;
    if (state.mode !== 'inspect') api.setMode('inspect');
  }

  function closeTalk() {
    if (source !== 'card') return;
    if (api.voiceField?.() === field()) api.stopVoice?.();
    card.hidden = true;
    hideCaption();
    clearTalk('card');
    api.requestLayout();
  }

  function renderCard() {
    if (source !== 'card') return;
    const keep = (card.querySelector('#ah-talk-input') as HTMLTextAreaElement | null)?.value || '';
    const d = api.destination();
    const voice = api.voiceEnabled?.();
    card.innerHTML = `
      <div class="head"><span class="status">Talk &amp; point</span><button class="ah-ibtn" data-act="close" aria-label="Close" title="Close (Esc)">${icon('x')}</button></div>
      <textarea id="ah-talk-input" aria-label="What should change" placeholder="${voice ? 'Talk, and click what you mean as you say it: make [1] match [2]' : 'Type, and click elements to add [1], [2]: make [1] match [2]'}"></textarea>
      <ol class="ah-talk-list"></ol>
      <div class="ah-actions"><button class="ah-ibtn mic" data-act="mic" title="Speak instead of typing" aria-label="Speak instead of typing" hidden>${icon('mic')}</button><span class="grow"></span><button class="ah-tbtn" data-act="close">Cancel</button><button class="ah-tbtn primary" data-act="send">${d.kind === 'agent' ? 'Send' : 'Copy'}</button></div>`;
    const ta = card.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = keep;
    api.attachVoice?.(ta, card.querySelector('[data-act=mic]') as HTMLElement);
    ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } };
    render();
  }

  /** The element list (card or Ask), the badges on the page, and where the card sits. */
  function render() {
    const rows = items.map((t, i) => `<li><span class="n">${i + 1}</span><span class="name">${esc(t.name)}</span><button class="ah-ibtn" data-remove="${i}" aria-label="Remove ${esc(t.name)}" title="Remove">${icon('x', 12)}</button></li>`).join('');
    if (source === 'card') {
      const list = card.querySelector('.ah-talk-list') as HTMLElement | null;
      if (list) { list.innerHTML = rows; list.hidden = !items.length; }
      const send = card.querySelector('[data-act=send]') as HTMLButtonElement | null;
      if (send) send.disabled = sending;
    }
    if (compRefs) {
      const show = source === 'composer' && items.length > 1;
      compRefs.hidden = !show;
      compRefs.innerHTML = show ? `<ol class="ah-talk-list">${rows}</ol>` : '';
    }
    api.requestLayout();
  }

  function renderMarks() {
    layer.innerHTML = '';
    if (!source || !items.length || (source === 'composer' && items.length < 2)) return;
    items.forEach((t, i) => {
      const r = api.rectOf(t.stack[t.index]);
      if (!r || (r.width === 0 && r.height === 0)) return;
      const o = document.createElement('div');
      o.className = 'ah-batch-outline';
      placeBox(o, r, 1);
      layer.appendChild(o);
      const n = document.createElement('div');
      n.className = 'ah-batch-num';
      n.textContent = String(i + 1);
      n.style.left = r.left - 9 + 'px';
      n.style.top = r.top - 9 + 'px';
      layer.appendChild(n);
    });
  }

  /** The card opens where you stopped talking (the pointer), next to what you pointed at. */
  function position() {
    if (card.hidden) return;
    anchorTo(card, { left: pointer.x, top: pointer.y, width: 1, height: 1 }, api.insets(), 14);
  }

  // ---------- the live caption at the pointer ----------
  const caption = shadow.getElementById('ah-caption') as HTMLElement;
  const inspectBtn = shadow.getElementById('ah-d-inspect') as HTMLElement | null;
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const chips = (t: string) => esc(t).replace(/\[(\d+)\]/g, '<span class="ah-chip">$1</span>');
  function renderCaption() {
    const f = field();
    const listening = source === 'card' && !!f && api.voiceField?.() === f;
    inspectBtn?.classList.toggle('talking', listening);
    if (!listening) { caption.hidden = true; return; }
    const text = f!.value.trim();
    caption.innerHTML = `<div class="lab"><span class="ah-dot pulse"></span>Listening · click what you mean · let go of <kbd>Space</kbd> when done</div><div class="txt"><span>${text ? chips(text) : '<span class="empty">Say what should change, and click what you mean</span>'}</span></div>`;
    caption.hidden = false;
    moveCaption();
  }
  function moveCaption() {
    if (caption.hidden) return;
    const w = caption.offsetWidth, h = caption.offsetHeight;
    let left = pointer.x + 18, top = pointer.y + 22;
    if (left + w > window.innerWidth - 12) left = pointer.x - w - 14;
    if (top + h > window.innerHeight - 70) top = pointer.y - h - 16;
    caption.style.left = Math.max(8, left) + 'px';
    caption.style.top = Math.max(8, top) + 'px';
  }
  function hideCaption() { caption.hidden = true; inspectBtn?.classList.remove('talking'); }
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; moveCaption(); }, true);
  card.addEventListener('input', () => { if (card.hidden) renderCaption(); });
  // Dictation ended (let go, tap, Esc, or the browser stopped): the caption becomes the card, right there.
  shadow.addEventListener('ah-voice-ended', () => {
    if (source !== 'card') return;
    hideCaption();
    if (card.hidden) { card.hidden = false; position(); (field() as HTMLTextAreaElement | null)?.focus(); }
  });

  /** The first time Inspect comes on in a session, say how to talk while pointing. */
  function onInspectStart() {
    try { if (sessionStorage.getItem('agent-hover-space-hint')) return; sessionStorage.setItem('agent-hover-space-hint', '1'); } catch { /* storage blocked: say it anyway */ }
    api.toast(api.voiceEnabled?.() ? 'Click to select · hold Space to talk while you point' : 'Click to select · hold Space to point at several things and type', { ms: 3200 });
  }
  api.onLayout(() => { renderMarks(); position(); });

  /** Removing [2] renumbers the rest, in the list and in the sentence. */
  function removeItem(i: number) {
    items.splice(i, 1);
    const f = field();
    // While dictating, the sentence is rebuilt from what was heard: take the marker out there.
    if (f && !(api.voiceField?.() === f && api.unmarkVoice?.(i + 1))) {
      f.value = f.value
        .replace(/\[(\d+)\]/g, (m, d) => { const n = Number(d); return n === i + 1 ? '' : n > i + 1 ? `[${n - 1}]` : m; })
        .replace(/\s{2,}/g, ' ')
        .trim();
      f.dispatchEvent(new Event('input', { bubbles: true }));
    }
    render();
  }

  const onListClick = (e: Event) => {
    const rm = (e.target as Element).closest('[data-remove]') as HTMLElement | null;
    if (rm) { e.stopPropagation(); removeItem(Number(rm.dataset.remove)); return true; }
    return false;
  };
  compRefs?.addEventListener('click', onListClick);
  card.addEventListener('click', (e) => {
    if (onListClick(e)) return;
    const b = (e.target as Element).closest('button') as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    if (b.dataset.act === 'close') closeTalk();
    if (b.dataset.act === 'send') send();
  });

  // ---------- send ----------

  async function sendTalk(text: string, dest: { kind: 'agent' | 'copy'; client?: string }, list: TalkItem[]) {
    const entries: Array<{ facts: any }> = [];
    for (const t of list) {
      const built = await api.buildFacts(t.stack, t.index);
      if (built) entries.push({ facts: built.facts });
    }
    if (!entries.length) { api.toast('Those elements are no longer on the page'); return null; }
    const prompt = formatTalkRequest(text, entries);
    const first = entries[0].facts;
    const result = await api.dispatchToAgent(
      prompt,
      {
        type: 'pinned-stack',
        instruction: text,
        goal: text,
        component: first.component?.name,
        file: first.element.source?.file || first.component?.file,
        line: first.element.source?.line ?? first.component?.startLine,
        selector: first.element.selector,
        label: `${entries.length} elements`,
        display: `Talk & point · ${entries.length} elements`,
        pins: entries.map((e) => ({ component: e.facts.component?.name || e.facts.element.label, file: e.facts.component?.file || '', role: 'TARGET' })),
        ...(dest.client ? { assignee: dest.client } : {}),
      },
      { quiet: true, destination: dest.kind },
    );
    if (result.task) {
      api.trackTask(result.task, list[0].stack[list[0].index]?.element);
      const who = dest.client ? prettyAgentName(dest.client) : null;
      api.toast(who ? `Sent to ${who}` : `Queued · no agent connected${result.copied ? ' · also copied' : ''}`, { action: 'View', onAction: () => api.openTaskCard(result.task.id) });
    } else {
      api.toast(result.copied ? `Copied ${entries.length} elements as one prompt` : 'Clipboard blocked by the browser');
    }
    return result;
  }

  async function send() {
    const f = field();
    const text = f?.value.trim() || '';
    if (!f || sending) return;
    if (!text) { f.classList.add('invalid'); f.focus(); return; }
    if (!items.length) { api.toast('Click the elements you mean first: they become [1], [2]…'); return; }
    api.stopVoice?.();
    sending = true;
    render();
    try {
      const result = await sendTalk(text, api.destination(), items);
      if (result) closeTalk();
    } finally {
      sending = false;
      render();
    }
  }

  // ---------- V: hold to talk, tap to toggle ----------

  function typingIn(): boolean {
    let el = document.activeElement as HTMLElement | null;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as HTMLElement;
    return !!el && (el.matches('input, textarea, select') || el.isContentEditable);
  }
  const inUse = () => state.mode === 'inspect' || source === 'card';

  /** Space while pointing (Inspect on); V works too. */
  const isTalkKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'v' || e.key === 'V';
  window.addEventListener('keydown', (e) => {
    if (!isTalkKey(e)) return;
    if (holding) { e.preventDefault(); e.stopPropagation(); return; } // key repeat while held
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || typingIn() || !inUse()) return;
    e.preventDefault();
    e.stopPropagation();
    const f = field();
    // A tap while listening stops.
    if (source === 'card' && f && api.voiceField?.() === f) { api.stopVoice(); return; }
    const voice = !!api.voiceEnabled?.();
    // The first time, the card shows so its note on where the audio goes can be read; after that it's caption only.
    let agreed = false;
    try { agreed = localStorage.getItem('agent_hover_voice_ok') === 'yes'; } catch { /* storage blocked */ }
    openTalk(voice && agreed);
    holding = true;
    downAt = Date.now();
    const ta = field();
    if (!ta) return;
    if (!voice) { position(); ta.focus(); return; }
    api.startVoice?.(ta, card.querySelector('[data-act=mic]') as HTMLElement, { focus: false }).then((ok: boolean) => {
      if (ok && card.hidden) { renderCaption(); return; }
      if (ok) return;
      card.hidden = false; position();
      if (!holding) ta.focus();
    });
  }, true);

  function release() {
    if (!holding) return;
    holding = false;
    const f = field();
    // Held: stop when the key comes up. Tapped: keep listening until the next tap or Esc.
    if (Date.now() - downAt >= HOLD_MS && f && api.voiceField?.() === f) api.stopVoice();
  }
  window.addEventListener('keyup', (e) => { if (isTalkKey(e) && holding) { e.preventDefault(); release(); } }, true);
  window.addEventListener('blur', release);

  // Ask's elements go once Ask closes.
  api.onSelectionChange?.((changed: boolean) => { if (changed && source === 'composer') clearTalk('composer'); });
}
