// @ts-nocheck
import { extractComputedStyles } from '../lib/computed-styles.js';
import type { OverlayApp } from '../app/context.js';

/** Selection chip actions (send, copy, note, pin, snap, IDE) and context-level selector. */
export function setupSelectionActions(app: OverlayApp) {
  const { shadow, state, dom, api } = app;

  const selSendBtn = shadow.getElementById('cp-sel-send-btn');
  const selSendLabel = shadow.getElementById('cp-sel-send-label');
  if (selSendBtn) {
    selSendBtn.onclick = async (e) => {
      e.stopPropagation();
      let promptText = '';
      let compName = '';
      let filePath = '';
      if (state.lastCopiedContext) {
        promptText = api.formatContextForAiPrompt(state.lastCopiedContext, state.currentStack);
        compName = state.lastCopiedContext.component?.name || '';
        filePath = state.lastCopiedContext.source?.file || '';
      } else if (state.selectedTarget) {
        promptText = api.formatDomElementPrompt(state.selectedTarget, state.lastComputedStyles || extractComputedStyles(state.selectedTarget.element || state.selectedElement), state.currentStack);
        compName = state.selectedTarget.name || '';
      }
      if (!promptText) {
        api.showCallout('Select a component first', 'TIP', 2000);
        return;
      }
      if (selSendLabel) selSendLabel.textContent = 'Sent!';
      setTimeout(() => { if (selSendLabel) selSendLabel.textContent = 'Send'; }, 1600);
      await api.dispatchToAgent(promptText, { type: 'selection', component: compName, file: filePath });
    };
  }

  if (dom.selNoteBtn) {
    dom.selNoteBtn.onclick = (e) => {
      e.stopPropagation();
      const compName = state.selectedTarget?.name || (state.lastCopiedContext ? state.lastCopiedContext.component.name : '');
      const file = state.lastResolved?.file || state.lastCopiedContext?.source?.file || '';
      const existing = state.comments.find(c => (compName && c.component === compName) || (file && c.file === file));
      api.openNotePopover(state.selectedTarget, existing || null);
    };
  }

  if (dom.selSnapBtn) {
    dom.selSnapBtn.onclick = async (e) => {
      e.stopPropagation();
      await api.handleSnapMode('component');
    };
  }

  if (dom.selIdeBtn) {
    dom.selIdeBtn.onclick = (e) => {
      e.stopPropagation();
      api.openInEditor();
    };
  }

  if (dom.selPinBtn) {
    dom.selPinBtn.onclick = async (e) => {
      e.stopPropagation();
      const targetToPin = state.selectedTarget?.isDomElement && state.currentStack.length > 1 ? state.currentStack[1] : state.selectedTarget;
      const resolved = state.lastResolved || (targetToPin ? await api.resolveComponent(targetToPin) : null);
      if (resolved) {
        api.openPinDialog(targetToPin, resolved);
      } else {
        api.showCallout('Could not resolve file', 'ERROR');
      }
    };
  }

  shadow.getElementById('cp-context-level').addEventListener('change', async () => {
    api.refreshState();
    if (dom.flyout.classList.contains('open') && state.lastResolved && state.lastInfoName) {
      await api.loadComponentContext(state.lastInfoName, state.lastResolved, state.lastComputedStyles);
    }
  });

  // Dedicated Copy for AI Prompt Action
  const copyAiBtn = shadow.getElementById('cp-copy-ai');
  if (copyAiBtn) {
    copyAiBtn.onclick = async () => {
      if (state.lastCopiedContext) {
        const promptText = api.formatContextForAiPrompt(state.lastCopiedContext, state.currentStack);
        await navigator.clipboard.writeText(promptText);
        const originalHtml = copyAiBtn.innerHTML;
        copyAiBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
        api.showCallout('AI Prompt Copied (' + (state.lastCopiedContext.tokens?.current || '?') + ' tok)', 'COPIED');
        setTimeout(() => { copyAiBtn.innerHTML = originalHtml; }, 1600);
      } else if (state.selectedTarget) {
        const promptText = api.formatDomElementPrompt(state.selectedTarget, state.lastComputedStyles || extractComputedStyles(state.selectedTarget.element || state.selectedElement), state.currentStack);
        await navigator.clipboard.writeText(promptText);
        const originalHtml = copyAiBtn.innerHTML;
        copyAiBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
        api.showCallout('Element Prompt Copied', 'COPIED');
        setTimeout(() => { copyAiBtn.innerHTML = originalHtml; }, 1600);
      } else {
        api.showCallout('Select a component first', 'TIP');
      }
    };
  }
}
