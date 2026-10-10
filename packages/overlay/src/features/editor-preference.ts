// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Preferred IDE selection (Cursor / VS Code / Windsurf). */
export function setupEditorPreference(app: OverlayApp) {
  const { editor, state, dom, api } = app;

  // Editor preference
  state.currentEditorPref = 'cursor';
  try {
    state.currentEditorPref = localStorage.getItem('agent-hover-pref-editor') || editor || 'cursor';
  } catch(e) {}

  function updateEditorPrefUI() {
    const editors = [
      { id: 'cursor', btn: dom.prefEditorCursor, label: 'Cursor (cursor://)' },
      { id: 'vscode', btn: dom.prefEditorVscode, label: 'VS Code (vscode://)' },
      { id: 'windsurf', btn: dom.prefEditorWindsurf, label: 'Windsurf (windsurf://)' },
    ];
    editors.forEach((ed) => {
      if (!ed.btn) return;
      if (state.currentEditorPref === ed.id) {
        ed.btn.classList.add('primary');
        ed.btn.setAttribute('aria-selected', 'true');
        ed.btn.innerHTML = `<span style="color:var(--accent,#0d99ff); font-weight:700; margin-right:6px;">✓</span> ${ed.label}`;
      } else {
        ed.btn.classList.remove('primary');
        ed.btn.setAttribute('aria-selected', 'false');
        ed.btn.innerHTML = ed.label;
      }
    });
  }
  updateEditorPrefUI();

  if (dom.prefEditorCursor) {
    dom.prefEditorCursor.onclick = () => {
      state.currentEditorPref = 'cursor';
      try { localStorage.setItem('agent-hover-pref-editor', 'cursor'); } catch(e) {}
      updateEditorPrefUI();
      api.showCallout('Editor: Cursor', 'SET');
    };
  }
  if (dom.prefEditorVscode) {
    dom.prefEditorVscode.onclick = () => {
      state.currentEditorPref = 'vscode';
      try { localStorage.setItem('agent-hover-pref-editor', 'vscode'); } catch(e) {}
      updateEditorPrefUI();
      api.showCallout('Editor: VS Code', 'SET');
    };
  }
  if (dom.prefEditorWindsurf) {
    dom.prefEditorWindsurf.onclick = () => {
      state.currentEditorPref = 'windsurf';
      try { localStorage.setItem('agent-hover-pref-editor', 'windsurf'); } catch(e) {}
      updateEditorPrefUI();
      api.showCallout('Editor: Windsurf', 'SET');
    };
  }
}
