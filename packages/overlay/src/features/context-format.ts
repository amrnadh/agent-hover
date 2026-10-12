// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Resolve a component to its source file through the bridge. Prompts are built in features/prompt.ts. */
export function setupContextFormat(app: OverlayApp) {
  const { BRIDGE, fetch, state, api } = app;
  Object.assign(api, { resolveComponent, escapeHtml });

  async function resolveComponent(info) {
    if (info.source && info.source.fileName) {
      const fn = info.source.fileName.split('/').pop().replace(/\.[jt]sx?$/, '');
      if (fn.toLowerCase() === info.name.toLowerCase()) {
        return { file: info.source.fileName, line: info.source.lineNumber };
      }
    }
    try {
      // Send ancestor names so bridge can prefer the right file
      const ancestorNames = state.currentStack.map(c => c.name).filter(n => n !== info.name);
      const res = await fetch(BRIDGE + '/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentName: info.name, ancestors: ancestorNames })
      });
      const data = await res.json();
      if (data.resolved) return { file: data.file, line: data.line };
    } catch(e) {}
    return null;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
