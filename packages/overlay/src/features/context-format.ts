// @ts-nocheck
import type { OverlayApp } from '../app/context.js';
import { firstAppFrame, isSharedFile } from '../lib/stack-frames.js';

/** Resolve a component or element to its source file through the bridge. Prompts are built in features/prompt.ts. */
export function setupContextFormat(app: OverlayApp) {
  const { BRIDGE, fetch, state, api } = app;
  Object.assign(api, { resolveComponent, escapeHtml, exactSource, exactElementSource });

  /**
   * React 19: where a selected element is written. When that is inside a shared UI block (ui/button.tsx), the place
   * the block is used instead (<Button> in Hero.tsx), up to a few levels. Null before React 19 or without a match.
   */
  async function exactElementSource(item) {
    if (!item?.isDomElement || typeof item.creationStacks !== 'function') return null;
    let first = null;
    for (const stack of item.creationStacks()) {
      const loc = await exactSource(stack);
      if (!loc) continue;
      if (!isSharedFile(loc.file)) return loc;
      first = first || loc;
    }
    return first;
  }

  const exact = new Map();
  /**
   * React 19: the file and line from a creation stack (`_debugStack`), mapped by the bridge through the dev
   * server's source maps. Null when there is no app frame or the bridge can't map it (then callers fall back).
   */
  async function exactSource(stack) {
    const frame = firstAppFrame(stack);
    if (!frame) return null;
    const key = `${frame.url}:${frame.line}:${frame.column}`;
    if (exact.has(key)) return exact.get(key);
    let found = null;
    try {
      const res = await fetch(BRIDGE + '/api/source-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frame),
      });
      if (res.ok) {
        const d = await res.json();
        if (d && typeof d.file === 'string' && typeof d.line === 'number') found = { file: d.file, line: d.line, column: d.column };
      }
    } catch {}
    exact.set(key, found);
    return found;
  }

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
