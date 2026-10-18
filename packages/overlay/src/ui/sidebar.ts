import { readPref, writePref } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

export type Tab = 'inspect' | 'tasks' | 'comments' | 'batch';

export interface PanelRenderer {
  /** Fill `body` (and optionally `foot`, which starts hidden) for the current state. */
  render(body: HTMLElement, foot: HTMLElement): void;
}

const WIDTH_KEY = 'agent-hover-side-w';
const FLOAT_KEY = 'agent-hover-side-float';
const MIN_W = 320, MAX_W = 520, DEFAULT_W = 380;

/**
 * Sidebar shell: tabs (Inspect · Tasks · Comments · Batch), Settings (gear), float/dock toggle, close,
 * and a resize rail (320–520px, double-click resets). Each tab's content comes from a registered panel.
 */
export function setupSidebar(app: OverlayApp) {
  const { shadow, state, api } = app;
  Object.assign(api, { openSidebar, closeSidebar, toggleSidebar, openSettings, renderSidebar, registerPanel, isSidebarOpen: () => state.side.open });

  const side = shadow.getElementById('ah-side') as HTMLElement;
  const tabs = shadow.getElementById('ah-tabs') as HTMLElement;
  const body = shadow.getElementById('ah-s-body') as HTMLElement;
  const foot = shadow.getElementById('ah-s-foot') as HTMLElement;
  const gear = shadow.getElementById('ah-s-gear') as HTMLElement;
  const floatBtn = shadow.getElementById('ah-s-float') as HTMLElement;
  const panels = new Map<string, PanelRenderer>();

  state.side = {
    open: false,
    tab: 'inspect' as Tab,
    settings: false,
    settingsFocus: '' as string,
    float: readPref(FLOAT_KEY, '') === '1',
    width: Math.min(MAX_W, Math.max(MIN_W, parseInt(readPref(WIDTH_KEY, String(DEFAULT_W)), 10) || DEFAULT_W)),
  };

  function registerPanel(name: string, panel: PanelRenderer) {
    panels.set(name, panel);
  }

  function openSidebar(tab?: Tab) {
    state.side.open = true;
    state.side.settings = false;
    if (tab) state.side.tab = tab;
    renderSidebar();
  }

  function openSettings(focus = '') {
    state.side.open = true;
    state.side.settings = true;
    state.side.settingsFocus = focus;
    renderSidebar();
  }

  function closeSidebar() {
    if (!state.side.open) return;
    state.side.open = false;
    renderSidebar();
  }

  function toggleSidebar(tab: Tab) {
    if (state.side.open && !state.side.settings && state.side.tab === tab) closeSidebar();
    else openSidebar(tab);
  }

  /** Re-render. With `onlyTab`, skip the work unless that tab is what the sidebar is showing. */
  function renderSidebar(onlyTab?: string) {
    if (onlyTab && !(state.side.open && !state.side.settings && state.side.tab === onlyTab)) {
      updateCounts();
      return;
    }
    side.hidden = !state.side.open;
    side.classList.toggle('float', state.side.float);
    side.style.setProperty('--ah-side-w', state.side.width + 'px');
    floatBtn.setAttribute('aria-pressed', String(state.side.float));
    floatBtn.title = state.side.float ? 'Dock sidebar' : 'Float sidebar';
    floatBtn.setAttribute('aria-label', floatBtn.title);
    gear.setAttribute('aria-pressed', String(state.side.settings));
    tabs.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(!state.side.settings && b.dataset.tab === state.side.tab)));
    // On a narrow sidebar the tab row scrolls: keep the open tab in view.
    const cur = tabs.querySelector<HTMLElement>('[aria-selected="true"]');
    if (cur) {
      const row = tabs.getBoundingClientRect();
      const r = cur.getBoundingClientRect();
      if (r.left < row.left) tabs.scrollLeft -= row.left - r.left + 4;
      else if (r.right > row.right) tabs.scrollLeft += r.right - row.right + 4;
    }
    updateCounts();
    api.renderDock?.();
    api.renderCursor?.();
    api.requestLayout?.();
    if (!state.side.open) return;
    const scroll = body.scrollTop;
    const key = state.side.settings ? 'settings' : state.side.tab;
    foot.hidden = true;
    foot.innerHTML = '';
    foot.onclick = null;
    foot.classList.remove('batch');
    panels.get(key)?.render(body, foot);
    if (body.dataset.panel === key) body.scrollTop = scroll;
    body.dataset.panel = key;
  }

  function updateCounts() {
    const tasks = state.tasks ? [...state.tasks.values()] : [];
    const active = tasks.filter((t: any) => api.isTaskActive?.(t)).length;
    setCount('ah-n-tasks', active || '');
    setCount('ah-n-comments', (state.comments || []).filter((c: any) => !c.resolved).length || '');
    setCount('ah-n-batch', (state.batch || []).length || '');
  }

  function setCount(id: string, value: number | string) {
    const el = shadow.getElementById(id);
    if (el) el.textContent = String(value);
  }

  tabs.onclick = (e) => {
    const b = (e.target as Element).closest('[data-tab]') as HTMLElement | null;
    if (b) openSidebar(b.dataset.tab as Tab);
  };
  gear.onclick = () => (state.side.settings ? openSidebar() : openSettings());
  floatBtn.onclick = () => {
    state.side.float = !state.side.float;
    writePref(FLOAT_KEY, state.side.float ? '1' : '');
    renderSidebar();
  };
  (shadow.getElementById('ah-s-close') as HTMLElement).onclick = closeSidebar;

  // Follow the selection while Inspect is showing.
  api.onSelectionChange(() => renderSidebar('inspect'));

  // ---------- resize rail ----------
  const rail = shadow.getElementById('ah-side-rail') as HTMLElement;
  let resizing = false;
  rail.addEventListener('mousedown', (e) => {
    resizing = true;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    state.side.width = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX));
    side.style.setProperty('--ah-side-w', state.side.width + 'px');
    api.requestLayout();
  });
  window.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    writePref(WIDTH_KEY, String(state.side.width));
  });
  rail.addEventListener('dblclick', () => {
    state.side.width = DEFAULT_W;
    writePref(WIDTH_KEY, String(DEFAULT_W));
    renderSidebar();
  });
}
