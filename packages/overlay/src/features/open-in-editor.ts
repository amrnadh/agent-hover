import { readPref, writePref } from '../lib/ui.js';
import { EDITORS } from '../lib/agents.js';
import type { OverlayApp } from '../app/context.js';

export interface OpenTarget {
  file?: string;
  line?: number;
  component?: string;
  /** Visible text near the target; lets the bridge find the line when the file is unknown. */
  text?: string;
}

/** Open a file at a line in the preferred editor, through the bridge (no shell, F-01). */
export function setupOpenInEditor(app: OverlayApp) {
  const { BRIDGE, editor, fetch, state, api } = app;
  Object.assign(api, { openInEditor, setEditorPref });

  const fallback = EDITORS.some(([id]) => id === editor) ? editor : 'cursor';
  state.editorPref = readPref('agent-hover-pref-editor', fallback);

  function setEditorPref(id: string) {
    state.editorPref = id;
    writePref('agent-hover-pref-editor', id);
  }

  async function openInEditor(target: OpenTarget) {
    const name = EDITORS.find(([id]) => id === state.editorPref)?.[1] || 'your editor';
    try {
      const res = await fetch(BRIDGE + '/api/open-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, editor: state.editorPref }),
      });
      const data = await res.json();
      if (!res.ok || data.error) api.toast(`Couldn't open ${name}: ${data.error || 'unknown error'}`);
      else api.toast(`Opened ${(data.file || target.file || 'file').split('/').pop()}${data.line || target.line ? ':' + (data.line || target.line) : ''} in ${name}`);
    } catch {
      api.toast('Dev server unreachable');
    }
  }
}
