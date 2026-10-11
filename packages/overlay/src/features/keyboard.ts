import type { OverlayApp } from '../app/context.js';

/**
 * Shortcuts. Escape closes the innermost thing first: menus → cards → composer → selection → sidebar → mode.
 * Nothing fires while typing in an input (including inside the overlay), and letter shortcuts only work while
 * Agent Hover is in use, so the host app's own shortcuts are never taken over. Alt and ⌘/Ctrl+Shift+X are global.
 */
export function setupKeyboard(app: OverlayApp) {
  const { shadow, state, api } = app;

  function activeElement(): Element | null {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }

  function isTyping(el: Element | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
  }

  const visible = (id: string) => {
    const el = shadow.getElementById(id);
    return !!el && !(el as HTMLElement).hidden;
  };
  const hide = (id: string) => { const el = shadow.getElementById(id); if (el) (el as HTMLElement).hidden = true; };

  function escape(): boolean {
    for (const id of ['ah-dest-menu', 'ah-pill-menu', 'ah-dock-menu', 'ah-conn']) {
      if (visible(id)) { hide(id); return true; }
    }
    if (visible('ah-comment-card')) { api.closeCommentCard(); return true; }
    if (visible('ah-task-card')) { api.closeTaskCard(); return true; }
    if (api.isComposerOpen?.()) { api.closeComposer(); return true; }
    if (state.selectedTarget) { api.deselect(); return true; }
    if (state.side?.open) { api.closeSidebar(); return true; }
    if (state.mode) { api.setMode(state.mode); return true; }
    return false;
  }

  window.addEventListener('keydown', (e) => {
    const active = activeElement();
    const typing = isTyping(active);

    if (e.key === 'Escape') {
      if (typing) {
        (active as HTMLElement).blur();
        // Escape in the composer closes it straight away (draft is kept).
        if (api.isComposerOpen?.() && shadow.contains(active)) api.closeComposer();
        return;
      }
      if (escape()) e.preventDefault();
      return;
    }
    if (typing || e.defaultPrevented) return;

    if (e.key === 'Alt' && !e.repeat) {
      e.preventDefault();
      api.setMode('inspect');
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      // ⌘/Ctrl+C copies the selection's context, but never steals a real text selection on the page.
      if (e.key.toLowerCase() === 'c' && state.selectedTarget && !String(window.getSelection() || '')) {
        e.preventDefault();
        api.copySelection();
      }
      return;
    }
    if (e.altKey || e.shiftKey && e.key !== '?') return;

    const sel = state.selectedTarget;
    // Zero interference: letter shortcuts only while Agent Hover is in use (a mode, a selection, or the sidebar).
    if (!state.mode && !sel && !state.side?.open) return;
    // Letter shortcuts open inputs; stop the key from also being typed into them.
    if (['c', 'C', 'b', 'B', 'o', 'O', 'd', 'D', 't', 'T', '?'].includes(e.key)) e.preventDefault();
    switch (e.key) {
      case 'Enter':
        if (sel) { e.preventDefault(); api.openComposer(); }
        break;
      case 'c':
      case 'C':
        if (sel && state.mode === 'inspect') {
          const r = api.selectionRect();
          if (r) api.addCommentAt(state.selectedElement, r.left + r.width - 8, r.top + r.height - 4);
        } else api.setMode('comment');
        break;
      case 'b':
      case 'B':
        if (sel) api.toggleBatch(sel, state.currentStack);
        else api.toggleSidebar('batch');
        break;
      case 'o':
      case 'O':
        if (sel) api.openSelectionInEditor();
        break;
      case 'd':
      case 'D':
        if (sel) api.openSidebar('inspect');
        break;
      case 't':
      case 'T':
        api.toggleSidebar('tasks');
        break;
      case '?':
        api.openSettings('keys');
        break;
      case 'ArrowUp':
        if (sel) { e.preventDefault(); api.selectIndex(state.currentStackIndex + 1); }
        break;
      case 'ArrowDown':
        if (sel) { e.preventDefault(); api.selectIndex(state.currentStackIndex - 1); }
        break;
    }
  });
}
