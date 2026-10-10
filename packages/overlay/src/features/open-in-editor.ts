// @ts-nocheck
import { ICONS } from '../icons.js';
import type { OverlayApp } from '../app/context.js';

/** Open the selected component in the preferred IDE. */
export function setupOpenInEditor(app: OverlayApp) {
  const { BRIDGE, editor, fetch, shadow, state, api } = app;
  Object.assign(api, { openInEditor });

  async function openInEditor() {
    // Priority 1: Check selectedTarget.source or leaf Fiber source
    let targetFile = state.selectedTarget?.source?.fileName || null;
    let targetLine = state.selectedTarget?.source?.lineNumber || null;
    let targetComp = state.selectedTarget && !state.selectedTarget.isDomElement ? state.selectedTarget.name : null;

    // If selectedTarget was a DOM element, check enclosing component in currentStack
    if (!targetFile && state.currentStack && state.currentStack.length > 1) {
      const comp = state.currentStack.find(c => !c.isDomElement && c.source?.fileName);
      if (comp) {
        targetFile = comp.source.fileName;
        targetLine = comp.source.lineNumber;
        if (!targetComp) targetComp = comp.name;
      }
    }

    // Priority 2: Use lastCopiedContext or lastResolved
    if (!targetFile && state.lastCopiedContext?.source) {
      targetFile = state.lastCopiedContext.source.file;
      targetLine = state.lastCopiedContext.source.startLine;
    } else if (!targetFile && state.lastResolved) {
      targetFile = state.lastResolved.file;
      targetLine = state.lastResolved.line;
    }

    const el = state.selectedElement || state.selectedTarget?.element || state.currentElement;
    const textSnippet = el && el.textContent ? el.textContent.trim().slice(0, 50) : '';

    const btn = shadow.getElementById('cp-editor-btn');
    const originalContent = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = 'Opening...';
    api.showCallout('Opening in IDE...', state.currentEditorPref || editor);

    try {
      const res = await fetch(BRIDGE + '/api/open-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: targetFile,
          line: targetLine,
          text: textSnippet,
          component: targetComp,
          editor: state.currentEditorPref || editor
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        api.showCallout('Failed to open editor: ' + (data.error || 'Unknown'), 'ERROR');
      } else {
        api.showCallout('Opened in IDE (L' + (data.line || targetLine || 1) + ')', 'IDE');
      }
    } catch(e) {
      console.error('[agent-hover] Failed to open editor:', e);
      api.showCallout('Bridge server connection failed', 'ERROR');
    } finally {
      if (btn) btn.innerHTML = originalContent || (ICONS.code + ' Open in IDE');
    }
  }

  shadow.getElementById('cp-editor-btn').onclick = openInEditor;
}
