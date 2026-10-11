import { anchorTo, esc } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { prettyAgentName } from '../lib/task-status.js';
import type { OverlayApp } from '../app/context.js';

/**
 * Composer: opens only from Ask (or Enter). Target, instruction, destination (connected agent or Copy),
 * Send ⌘↵. Closes after sending; the task's progress moves to the element marker and the Tasks tab.
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

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  kbd.textContent = isMac ? '⌘↵' : 'Ctrl↵';
  const drafts = new Map<unknown, string>();
  /** 'agent:<client>' or 'copy'. Null means: the first connected agent, else copy. */
  let chosen: string | null = null;

  function agents(): string[] {
    return (state.connectedAgents || []).map((a: any) => a.client).filter(Boolean);
  }

  function destination(): { kind: 'agent' | 'copy'; client?: string } {
    const list = agents();
    if (state.delivery === 'copy') return { kind: 'copy' };
    if (chosen === 'copy') return { kind: 'copy' };
    if (chosen?.startsWith('agent:') && list.includes(chosen.slice(6))) return { kind: 'agent', client: chosen.slice(6) };
    return list.length ? { kind: 'agent', client: list[0] } : { kind: 'copy' };
  }

  function renderDest() {
    const d = destination();
    destLabel.textContent = d.kind === 'agent' ? prettyAgentName(d.client) : 'Copy prompt';
    destDot.className = 'ah-dot' + (d.kind === 'agent' ? ' ok' : '');
    sendLabel.textContent = d.kind === 'agent' ? 'Send' : 'Copy';
    hint.hidden = agents().length > 0 || state.delivery === 'copy';
    hint.textContent = 'No agent connected. The prompt goes to your clipboard for any AI tool. Connect one in Settings › Agents.';
  }

  function openComposer() {
    if (!state.selectedTarget) return;
    api.closePillMenu?.();
    nameEl.textContent = api.labelFor(state.selectedTarget);
    fileEl.textContent = state.selectionSource ? state.selectionSource.file.split('/').pop() + ':' + state.selectionSource.line : '';
    input.value = drafts.get(state.selectedTarget) || '';
    input.classList.remove('invalid');
    renderDest();
    box.hidden = false;
    position();
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
    sendBtn.disabled = true;
    try {
      const built = await api.buildPrompt(stack, index, text);
      if (!built) return;
      const result = await api.dispatchToAgent(
        built.prompt,
        { type: 'component-context', instruction: text, component: built.component, file: built.file, line: built.line, selector: built.selector, hierarchy: built.hierarchy, label: built.label },
        { quiet: true, destination: dest.kind },
      );
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
    chosen = b.dataset.v || null;
    renderDest();
  };

  shadow.addEventListener('ah-presence-changed', () => { if (!box.hidden) renderDest(); });
}
