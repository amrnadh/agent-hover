// @ts-nocheck
import { getComponentBoundingRect } from '../lib/fiber.js';
import type { OverlayApp } from '../app/context.js';

/** Selection state, spacing-overlay toggle, and the persistent selection frame + chip. */
export function setupSelection(app: OverlayApp) {
  const { shadow, state, dom, api } = app;
  Object.assign(api, { clearSelection, updateSelectionFrame });

  state.showSpacingOverlay = false;
  const toggleSpacingBtn = shadow.getElementById('cp-toggle-spacing');
  if (toggleSpacingBtn) {
    toggleSpacingBtn.onclick = () => {
      state.showSpacingOverlay = !state.showSpacingOverlay;
      if (state.showSpacingOverlay) {
        toggleSpacingBtn.classList.add('primary');
        toggleSpacingBtn.setAttribute('aria-pressed', 'true');
        toggleSpacingBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Spacing: On';
        const target = state.selectedElement || (state.selectedTarget && state.selectedTarget.element) || state.currentElement;
        if (target) api.positionBands(target);
      } else {
        toggleSpacingBtn.classList.remove('primary');
        toggleSpacingBtn.setAttribute('aria-pressed', 'false');
        toggleSpacingBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="9" y1="21" x2="9" y2="9"/><line x1="3" y1="9" x2="21" y2="9"/></svg> Spacing: Off';
        api.hideBands();
      }
    };
  }

  state.lastCopiedContext = null;
  state.lastResolved = null;
  state.lastInfoName = null;
  state.lastComputedStyles = null;

  // Selection frame elements (Persistent selection & near-component chip)
  const selectionFrame = shadow.getElementById('cp-selection-frame');
  const selectionChip = shadow.getElementById('cp-selection-chip');

  state.selectedTarget = null;
  state.selectedElement = null;
  state.comments = [];
  state.editingComment = null;
  state.activeNoteMarker = null;
  state.pendingNoteTarget = null;
  state.pendingPinTarget = null;
  state.currentPins = [];

  function clearSelection() {
    state.selectedTarget = null;
    state.selectedElement = null;
    state.selectedRect = null;
    if (selectionFrame) selectionFrame.style.display = 'none';
    dom.highlight.classList.remove('selected');
    api.clearDistanceGuides();
  }

  function updateSelectionFrame() {
    if (!state.selectedTarget || !selectionFrame) {
      if (selectionFrame) selectionFrame.style.display = 'none';
      return;
    }
    let rect = null;
    if (state.selectedTarget.isDomElement && state.selectedTarget.element) {
      rect = state.selectedTarget.element.getBoundingClientRect();
    } else if (state.selectedTarget.fiber) {
      rect = getComponentBoundingRect(state.selectedTarget.fiber);
    } else if (state.selectedElement) {
      rect = state.selectedElement.getBoundingClientRect();
    }
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      selectionFrame.style.display = 'none';
      return;
    }
    selectionFrame.style.display = 'block';
    selectionFrame.style.top = rect.top + 'px';
    selectionFrame.style.left = rect.left + 'px';
    selectionFrame.style.width = rect.width + 'px';
    selectionFrame.style.height = rect.height + 'px';

    if (rect.top < 36) {
      selectionChip.classList.add('inside-top');
    } else {
      selectionChip.classList.remove('inside-top');
    }

    const sidebarActive = dom.flyout && dom.flyout.classList.contains('open') && dom.flyout.classList.contains('is-sidebar');
    const maxRight = sidebarActive ? (window.innerWidth - 440 - 12) : (window.innerWidth - 12);

    if (rect.left < 10) {
      selectionChip.style.left = '4px';
      selectionChip.style.right = 'auto';
    } else if (rect.left + 320 > maxRight) {
      selectionChip.style.left = 'auto';
      selectionChip.style.right = sidebarActive ? '452px' : '4px';
    } else {
      selectionChip.style.left = '-2px';
      selectionChip.style.right = 'auto';
    }
  }
}
