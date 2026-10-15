import { anchorTo } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

/**
 * Action pill: appears on the selection's top edge after a click. Identity (opens the editor), Ask,
 * Comment, + Batch, Copy, ⋯ (editor, screenshot, protect from agents, parent/child, details), close.
 */
export function setupActionPill(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { copySelection, toggleFreezeSelection, openSelectionInEditor, closePillMenu: () => { menu.hidden = true; } });

  const pill = shadow.getElementById('ah-pill') as HTMLElement;
  const nameEl = shadow.getElementById('ah-pill-name') as HTMLElement;
  const fileEl = shadow.getElementById('ah-pill-file') as HTMLElement;
  const menu = shadow.getElementById('ah-pill-menu') as HTMLElement;
  const btn = (id: string) => shadow.getElementById(id) as HTMLButtonElement;
  let sourceToken = 0;

  // ---------- follow the selection ----------
  api.onSelectionChange((changed: boolean) => {
    if (!state.selectedTarget) { pill.hidden = true; menu.hidden = true; return; }
    if (changed) {
      menu.hidden = true;
      nameEl.textContent = api.labelFor(state.selectedTarget);
      fileEl.textContent = '';
      const token = ++sourceToken;
      Promise.all([api.sourceFor(state.currentStack, state.currentStackIndex), exactFor(state.selectedTarget)]).then(([src, exact]: any[]) => {
        if (token !== sourceToken || !src) return;
        // Show the element's own line when React says where it is (React 19); the component's otherwise.
        const at = exact || src;
        fileEl.textContent = at.file.split('/').pop() + ':' + at.line;
        fileEl.title = at.file + ':' + at.line;
        state.selectionSource = src;
        renderLock();
        api.requestLayout();
      });
    }
    renderLock();
    btn('ah-pill-batch').setAttribute('aria-pressed', String(!!api.isInBatch?.(state.selectedTarget)));
  });

  function renderLock() {
    const owner = api.projectOwner(state.currentStack, state.currentStackIndex);
    const frozen = !!owner && api.isFrozen(owner.name, state.selectionSource?.file);
    nameEl.classList.toggle('lock', frozen);
    nameEl.title = frozen ? 'Agents are told not to change this component' : '';
  }

  api.onLayout(() => {
    const r = api.selectionRect();
    if (!state.selectedTarget || !r || (r.width === 0 && r.height === 0)) { pill.hidden = true; return; }
    pill.hidden = false;
    const ins = api.insets();
    const h = pill.offsetHeight, w = pill.offsetWidth;
    let top = r.top - h - 8;
    if (top < 8) top = r.top + r.height + 8;
    if (top + h > window.innerHeight - ins.bottom - 8) top = Math.max(8, r.top + 8); // tall selection: tuck inside the top edge
    const left = Math.max(12, Math.min(r.left, window.innerWidth - ins.right - w - 12));
    pill.style.top = Math.round(top) + 'px';
    pill.style.left = Math.round(left) + 'px';
    if (!menu.hidden) anchorTo(menu, btn('ah-pill-more').getBoundingClientRect(), ins, 6);
  });

  // ---------- actions ----------
  async function copySelection() {
    if (!state.selectedTarget) return;
    const built = await api.buildPromptForSelection('');
    if (!built) return;
    const ok = await api.copyText(built.prompt);
    api.toast(ok ? (built.tokens ? `Copied context · ${built.tokens.toLocaleString()} tokens` : 'Copied context') + ' · paste into any AI tool' : 'Clipboard blocked by the browser');
  }

  /** The selected element's exact JSX location (React 19), or null. */
  function exactFor(item: any): Promise<{ file: string; line: number } | null> {
    return api.exactElementSource?.(item) ?? Promise.resolve(null);
  }

  async function openSelectionInEditor() {
    const [src, exact] = await Promise.all([api.sourceFor(state.currentStack, state.currentStackIndex), exactFor(state.selectedTarget)]);
    if (!src && !exact) { api.toast('No source file found for this element'); return; }
    const at = exact || src;
    api.openInEditor({ file: at.file, line: at.line, component: src?.component, text: (state.selectedElement?.textContent || '').trim().slice(0, 50) });
  }

  async function toggleFreezeSelection() {
    const src = await api.sourceFor(state.currentStack, state.currentStackIndex);
    if (!src) { api.toast('Only components with a source file can be protected'); return; }
    const frozen = api.isFrozen(src.component, src.file);
    try {
      const res = await fetch(BRIDGE + '/api/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: frozen ? 'remove' : 'add', file: src.file, component: src.component, line: src.line }),
      });
      const data = await res.json();
      if (data.frozenEntries) state.frozenEntries = data.frozenEntries;
      else if (frozen) state.frozenEntries = state.frozenEntries.filter((f: any) => f.component !== src.component);
      else state.frozenEntries = [...state.frozenEntries, { component: src.component, file: src.file, line: src.line }];
    } catch {
      api.toast('Dev server unreachable');
      return;
    }
    api.toast(frozen ? `${src.component} can be changed by agents again` : `Agents are told not to change ${src.component}`);
    renderLock();
    api.requestLayout();
  }

  btn('ah-pill-who').onclick = openSelectionInEditor;
  btn('ah-pill-ask').onclick = () => api.openComposer();
  btn('ah-pill-comment').onclick = () => {
    const r = api.selectionRect();
    if (r) api.addCommentAt(state.selectedElement, r.left + r.width - 8, r.top + r.height - 4);
  };
  btn('ah-pill-batch').onclick = () => api.toggleBatch(state.selectedTarget, state.currentStack);
  btn('ah-pill-copy').onclick = copySelection;
  btn('ah-pill-close').onclick = () => api.deselect();
  btn('ah-pill-more').onclick = () => {
    if (!menu.hidden) { menu.hidden = true; return; }
    const owner = api.projectOwner(state.currentStack, state.currentStackIndex);
    (shadow.getElementById('ah-freeze-label') as HTMLElement).textContent =
      owner && api.isFrozen(owner.name, state.selectionSource?.file) ? 'Allow agents to change this' : "Don't let agents change this";
    anchorTo(menu, btn('ah-pill-more').getBoundingClientRect(), api.insets(), 6);
  };
  menu.onclick = (e) => {
    const b = (e.target as Element).closest('button') as HTMLElement | null;
    if (!b) return;
    menu.hidden = true;
    const act = b.dataset.act;
    if (act === 'editor') openSelectionInEditor();
    if (act === 'shot') api.handleSnapMode('component');
    if (act === 'freeze') toggleFreezeSelection();
    if (act === 'parent') api.selectIndex(state.currentStackIndex + 1);
    if (act === 'child') api.selectIndex(state.currentStackIndex - 1);
    if (act === 'details') api.openSidebar('inspect');
  };
}
