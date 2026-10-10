// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Global keyboard shortcuts. */
export function setupKeyboard(app: OverlayApp) {
  const { state, dom, api } = app;

  // --- Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

    if (e.key === 'Alt') {
      if (isTyping) return;
      e.preventDefault();
      api.togglePointerMode();
      return;
    }

    if (e.key === 'Escape') {
      if (state.textEditorVisible) {
        api.closeTextEditor();
        return;
      }
      if (isTyping && activeEl && activeEl.blur) {
        activeEl.blur();
        return;
      }
      api.setSidebarTab(null);
      if (typeof api.clearSelection === 'function') api.clearSelection();
      return;
    }

    if (isTyping) return;

    // Ancestry navigation: ArrowUp goes to parent, ArrowDown goes to child
    if ((state.isPointerMode || dom.flyout.classList.contains('open')) && state.currentStack && state.currentStack.length > 1) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.currentStackIndex < state.currentStack.length - 1) {
          state.currentStackIndex++;
          if (dom.flyout.classList.contains('open')) {
            api.renderFlyoutForStackIndex(state.currentStackIndex);
          } else {
            api.highlightComponent(state.currentStack[state.currentStackIndex], true);
          }
        }
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.currentStackIndex > 0) {
          state.currentStackIndex--;
          if (dom.flyout.classList.contains('open')) {
            api.renderFlyoutForStackIndex(state.currentStackIndex);
          } else {
            api.highlightComponent(state.currentStack[state.currentStackIndex], state.currentStackIndex > 0);
          }
        }
      }
    }
  });
}
