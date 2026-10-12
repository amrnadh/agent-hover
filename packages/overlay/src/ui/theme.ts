import { readPref, writePref } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

export type ThemeMode = 'system' | 'dark' | 'light';

/** Overlay theme: system (default), dark or light. Applied as the `light-mode` class on the shadow host. */
export function setupTheme(app: OverlayApp) {
  const { shadow, state, api } = app;
  Object.assign(api, { setTheme, getTheme: () => state.theme });

  state.theme = readPref('agent-hover-theme', 'system') as ThemeMode;
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function apply() {
    const light = state.theme === 'light' || (state.theme === 'system' && !!media && !media.matches);
    (shadow.host as HTMLElement).classList.toggle('light-mode', light);
  }

  function setTheme(mode: ThemeMode) {
    state.theme = mode;
    writePref('agent-hover-theme', mode);
    apply();
  }

  media?.addEventListener?.('change', () => {
    if (state.theme === 'system') apply();
  });
  apply();
}
