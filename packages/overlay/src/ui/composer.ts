import { anchorTo, esc } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { prettyAgentName } from '../lib/task-status.js';
import type { OverlayApp } from '../app/context.js';

/**
 * Composer: opens only from Ask (or Enter). Target, instruction, destination (connected agent or Copy),
 * Send ⌘↵. Closes after sending; the task's progress moves to the element marker and the Tasks tab.
 * Follow up (task card) opens it with an earlier task, whose request and result go into the prompt.
 */
export function setupComposer(app: OverlayApp) {
  const { shadow, state, api } = app;
  Object.assign(api, { openComposer, closeComposer, isComposerOpen: () => !box.hidden });

  const box = shadow.getElementById('ah-composer') as HTMLElement;
  const input = shadow.getElementById('ah-comp-input') as HTMLTextAreaElement;
  const nameEl = shadow.getElementById('ah-comp-name') as HTMLElement;
  const fileEl = shadow.getElementById('ah-comp-file') as HTMLElement;
  const destBtn = shadow.getElementById('ah-comp-dest') as HTMLButtonElement;
  const destDot = shadow.getElementById('ah-comp-dest-dot') as HTMLElement;
  const destLabel = shadow.getElementById('ah-comp-dest-label') as HTMLElement;
  const sendBtn = shadow.getElementById('ah-comp-send') as HTMLButtonElement;
  const sendLabel = shadow.getElementById('ah-comp-send-label') as HTMLElement;
  const hint = shadow.getElementById('ah-comp-hint') as HTMLElement;
  const destMenu = shadow.getElementById('ah-dest-menu') as HTMLElement;
  const kbd = shadow.getElementById('ah-comp-kbd') as HTMLElement;
  const followEl = shadow.getElementById('ah-comp-follow') as HTMLElement;
  /** The finished task this request follows up on, if any. */
  let followUp: any = null;

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  kbd.textContent = isMac ? '⌘↵' : 'Ctrl↵';
  const drafts = new Map<unknown, string>();

  function agents(): string[] {
    return (state.connectedAgents || []).map((a: any) => a.client).filter(Boolean);
  }

  /** The destination is shared (bridge/dispatch.ts), so comments and Batch go where Ask goes. */
  const destination = (): { kind: 'agent' | 'copy'; client?: string } => api.destination();

  function renderDest() {
    const d = destination();
    destLabel.textContent = d.kind === 'agent' ? prettyAgentName(d.client) : 'Copy prompt';
    destDot.className = 'ah-dot' + (d.kind === 'agent' ? ' ok' : '');
    sendLabel.textContent = d.kind === 'agent' ? 'Send' : 'Copy';
    hint.hidden = agents().length > 0 || state.delivery === 'copy';
    hint.textContent = 'No agent connected. The prompt goes to your clipboard for any AI tool. Connect one in Settings › Agents.';
  }

  function openComposer(opts: { followUp?: any } = {}) {
    if (!state.selectedTarget) return;
    followUp = opts.followUp || null;
    followEl.hidden = !followUp;
    followEl.textContent = followUp ? `Follow-up to “${followUp.instruction || api.taskLabel(followUp)}”` : '';
    api.closePillMenu?.();
    // One card at a time: the composer replaces an open comment or task card.
    api.closeCommentCard?.();
    api.closeTaskCard?.();
    nameEl.textContent = api.nameFor(state.selectedTarget);
    // The same place the pill names: the element's own line when React knows it, the component's otherwise.
    const at = state.selectionAt || state.selectionSource;
    fileEl.textContent = at ? at.file.split('/').pop() + ':' + at.line : '';
    input.value = drafts.get(state.selectedTarget) || '';
    input.classList.remove('invalid');
    renderDest();
    box.hidden = false;
    position();
    api.precaptureBefore?.(state.selectedTarget.element);
    input.focus();
  }

  function closeComposer(keepDraft = true) {
    if (box.hidden) return;
    if (keepDraft && state.selectedTarget) {
      if (input.value.trim()) drafts.set(state.selectedTarget, input.value);
      else drafts.delete(state.selectedTarget);
    }
    box.hidden = true;
    destMenu.hidden = true;
    followUp = null;
    api.stopVoice?.();
    box.querySelector('.ah-voice-note')?.remove();
  }

  function position() {
    if (box.hidden) return;
    // Anchor to the selection and its pill together so the card never covers either.
    const sel = api.selectionRect();
    if (!sel) return;
    const pill = shadow.getElementById('ah-pill') as HTMLElement;
    let anchor = sel;
    if (pill && !pill.hidden) {
      const p = pill.getBoundingClientRect();
      const top = Math.min(sel.top, p.top), left = Math.min(sel.left, p.left);
      anchor = { top, left, width: Math.max(sel.left + sel.width, p.right) - left, height: Math.max(sel.top + sel.height, p.bottom) - top };
    }
    anchorTo(box, anchor, api.insets(), 8);
    if (!destMenu.hidden) anchorTo(destMenu, destBtn.getBoundingClientRect(), api.insets(), 6);
  }
  api.onLayout(position);

  api.onSelectionChange((changed: boolean) => {
    if (changed) closeComposer();
  });

  async function send() {
    const text = input.value.trim();
    if (!text) {
      input.classList.add('invalid');
      input.placeholder = 'Type what should change first';
      input.focus();
      return;
    }
    if (sendBtn.disabled) return;
    const target = state.selectedTarget;
    const stack = state.currentStack;
    const index = state.currentStackIndex;
    const dest = destination();
    const previous = followUp;
    sendBtn.disabled = true;
    try {
      const built = await api.buildPrompt(stack, index, text, previous
        ? { instruction: previous.instruction || '', summary: previous.result?.summary, files: previous.result?.filesChanged }
        : undefined);
      if (!built) return;
      const result = await api.dispatchToAgent(
        built.prompt,
        { type: 'component-context', instruction: text, component: built.component, file: built.file, line: built.line, selector: built.selector, hierarchy: built.hierarchy, label: built.label, display: api.nameFor(target), ...(dest.client ? { assignee: dest.client } : {}), ...(previous ? { followUpOf: previous.id } : {}) },
        { quiet: true, destination: dest.kind },
      );
      // The earlier change is now settled: this task carries it forward.
      if (previous && result.task && previous.status === 'done' && !previous.review) api.reviewTask?.(previous.id, 'follow-up', result.task.id);
      drafts.delete(target);
      input.value = '';
      closeComposer(false);
      if (result.task) {
        api.trackTask(result.task, target?.element);
        const who = dest.client ? prettyAgentName(dest.client) : null;
        api.toast(who ? `Sent to ${who}` : `Queued · no agent connected${result.copied ? ' · also copied' : ''}`, { action: 'View', onAction: () => api.openTaskCard(result.task.id) });
      } else {
        api.toast(result.copied ? 'Prompt copied · paste it into any AI tool' : 'Clipboard blocked by the browser');
      }
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.onclick = send;
  (shadow.getElementById('ah-comp-cancel') as HTMLElement).onclick = () => closeComposer();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener('input', () => {
    input.classList.remove('invalid');
    input.style.height = 'auto';
    input.style.height = Math.min(200, input.scrollHeight + 2) + 'px';
    position();
  });

  destBtn.onclick = () => {
    if (!destMenu.hidden) { destMenu.hidden = true; return; }
    const d = destination();
    const rows = agents().map((c) => ({ v: 'agent:' + c, label: prettyAgentName(c), sub: 'Connected agent', on: d.kind === 'agent' && d.client === c, dot: 'ok' }));
    rows.push({ v: 'copy', label: 'Copy prompt', sub: 'For ChatGPT, Claude.ai, v0, Lovable…', on: d.kind === 'copy', dot: '' });
    destMenu.innerHTML = rows.map((r) => `<button data-v="${esc(r.v)}" role="menuitemradio" aria-checked="${r.on}"><span class="ah-dot ${r.dot}"></span><span>${esc(r.label)}<span class="sub">${esc(r.sub)}</span></span>${r.on ? `<span style="margin-left:auto">${icon('check', 14)}</span>` : ''}</button>`).join('')
      + `<hr><button data-v="setup" role="menuitem">${icon('gear')}Connect another agent…</button>`;
    anchorTo(destMenu, destBtn.getBoundingClientRect(), api.insets(), 6);
  };
  destMenu.onclick = (e) => {
    const b = (e.target as Element).closest('button') as HTMLElement | null;
    if (!b) return;
    destMenu.hidden = true;
    if (b.dataset.v === 'setup') { api.openSettings('agents'); return; }
    api.chooseDestination(b.dataset.v || null);
    renderDest();
  };

  shadow.addEventListener('ah-presence-changed', () => { if (!box.hidden) renderDest(); });
}
