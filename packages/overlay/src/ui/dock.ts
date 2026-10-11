import { anchorTo, esc, readPref, writePref } from '../lib/ui.js';
import { prettyAgentName } from '../lib/task-status.js';
import type { OverlayApp } from '../app/context.js';

const POS_KEY = 'agent_hover_dock_pos_v2';
const MIN_KEY = 'agent_hover_dock_minimized';
const HINT_KEY = 'agent_hover_hint_dismissed';
const ORIENT_KEY = 'agent-hover-dock-orient';

/**
 * Dock: always-on pill. Status mark (connection popover), Inspect, Comment, Tasks, Batch, ⋯ menu, grip.
 * Draggable (4px threshold, grip or empty padding), snaps back to bottom-center near it, remembers its
 * position, can be vertical (Settings) and minimized to a round button (⌘/Ctrl+Shift+X).
 */
export function setupDock(app: OverlayApp) {
  const { port, shadow, state, api } = app;
  Object.assign(api, { renderDock, setDockVertical, resetDockPosition, setDockMinimized });

  const dock = shadow.getElementById('ah-dock') as HTMLElement;
  const minBtn = shadow.getElementById('ah-dock-min') as HTMLElement;
  const tip = shadow.getElementById('ah-dock-tip') as HTMLElement;
  const menu = shadow.getElementById('ah-dock-menu') as HTMLElement;
  const conn = shadow.getElementById('ah-conn') as HTMLElement;
  const hint = shadow.getElementById('ah-hint') as HTMLElement;
  const $ = (id: string) => shadow.getElementById(id) as HTMLElement;

  state.dockVertical = readPref(ORIENT_KEY, 'horizontal') === 'vertical';

  // Compatibility with modules that call the 0.1 controller (connection.ts, startup.ts).
  state.dockController = { updatePresence: () => renderDock(), setPinCount: () => renderDock() };

  // ---------- render ----------
  function renderDock() {
    const agents = state.connectedAgents || [];
    const online = !!state.isBridgeConnected;
    const dotClass = 'ah-dot ' + (agents.length ? 'ok' : online ? 'warn' : '');
    $('ah-d-mark-dot').className = dotClass;
    $('ah-dock-min-dot').className = dotClass;
    $('ah-d-mark').dataset.tip = agents.length
      ? `Agent Hover · ${prettyAgentName(agents[0].client)} connected`
      : online ? 'Agent Hover · no agent connected' : 'Agent Hover · dev server offline';
    pressed('ah-d-inspect', state.mode === 'inspect');
    pressed('ah-d-comment', state.mode === 'comment');
    const side = state.side || {};
    pressed('ah-d-tasks', !!side.open && !side.settings && side.tab === 'tasks');
    pressed('ah-d-batch', !!side.open && !side.settings && side.tab === 'batch');
    const tasks = state.tasks ? [...state.tasks.values()] : [];
    $('ah-d-tasks-dot').hidden = !tasks.some((t: any) => api.isTaskActive?.(t));
    const count = (state.batch || []).length;
    $('ah-d-batch-count').hidden = !count;
    $('ah-d-batch-count').textContent = String(count);
    if (!conn.hidden) renderConn();
  }

  function pressed(id: string, on: boolean) {
    $(id).setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ---------- buttons ----------
  $('ah-d-inspect').onclick = () => api.setMode('inspect');
  $('ah-d-comment').onclick = () => api.setMode('comment');
  $('ah-d-tasks').onclick = () => api.toggleSidebar('tasks');
  $('ah-d-batch').onclick = () => api.toggleSidebar('batch');
  $('ah-d-more').onclick = () => {
    conn.hidden = true;
    if (!menu.hidden) { menu.hidden = true; return; }
    openNear(menu, $('ah-d-more'));
  };
  $('ah-d-mark').onclick = () => {
    menu.hidden = true;
    if (!conn.hidden) { conn.hidden = true; return; }
    renderConn();
    openNear(conn, $('ah-d-mark'));
  };
  menu.onclick = (e) => {
    const b = (e.target as Element).closest('button') as HTMLElement | null;
    if (!b) return;
    menu.hidden = true;
    const act = b.dataset.act;
    if (act === 'sidebar') api.openSidebar(state.side?.tab || 'inspect');
    if (act === 'shot') api.handleSnapMode('viewport');
    if (act === 'shotfull') api.handleSnapMode('fullpage');
    if (act === 'settings') api.openSettings();
    if (act === 'keys') api.openSettings('keys');
    if (act === 'minimize') setDockMinimized(true);
  };

  function renderConn() {
    const agents = state.connectedAgents || [];
    conn.innerHTML = agents.length
      ? `${agents.map((a: any) => `<div class="row"><span class="ah-dot ok"></span><b>${esc(prettyAgentName(a.client))}</b><span class="ah-muted" style="margin-left:auto;font-size:12px">connected</span></div>`).join('')}
         <p>Tasks you send go to ${esc(prettyAgentName(agents[0].client))}. Tip: tell it "Listen for agent-hover tasks" once and it picks up each one. Bridge on port ${port}.</p>
         <button class="ah-tbtn outline" data-act="agents">Manage agents</button>`
      : state.isBridgeConnected
        ? `<div class="row"><span class="ah-dot warn"></span><b>No agent connected</b></div>
           <p>Ask and Comment still work: prompts go to your clipboard for any AI tool. Connect Claude Code, Cursor, Codex, Windsurf or another MCP agent to send tasks directly.</p>
           <button class="ah-tbtn primary" data-act="agents">Connect an agent</button>`
        : `<div class="row"><span class="ah-dot"></span><b>Dev server offline</b></div>
           <p>Agent Hover talks to your coding agent through the Vite dev server. Start it again (npm run dev) and this page reconnects.</p>`;
  }
  conn.onclick = (e) => {
    if ((e.target as Element).closest('[data-act=agents]')) { conn.hidden = true; api.openSettings('agents'); }
  };

  function openNear(panel: HTMLElement, btn: HTMLElement) {
    const r = btn.getBoundingClientRect();
    anchorTo(panel, { left: r.left + r.width / 2 - panel.offsetWidth / 2, top: r.top, width: panel.offsetWidth, height: r.height }, { right: 0, bottom: 0 }, 10);
  }

  // Close dock popovers on outside clicks.
  shadow.addEventListener('mousedown', (e) => {
    const t = e.target as Node;
    for (const [panel, trigger] of [[menu, $('ah-d-more')], [conn, $('ah-d-mark')]] as const) {
      if (!panel.hidden && !panel.contains(t) && !trigger.contains(t)) panel.hidden = true;
    }
  });

  // ---------- tooltips ----------
  let tipTimer: ReturnType<typeof setTimeout> | null = null;
  dock.addEventListener('mouseover', (e) => {
    const b = (e.target as Element).closest('[data-tip]') as HTMLElement | null;
    if (tipTimer) clearTimeout(tipTimer);
    if (!b || dragging) { tip.hidden = true; return; }
    tipTimer = setTimeout(() => {
      tip.innerHTML = esc(b.dataset.tip) + (b.dataset.key ? `<kbd>${esc(b.dataset.key)}</kbd>` : '');
      tip.hidden = false;
      const r = b.getBoundingClientRect();
      if (state.dockVertical) {
        const leftSide = r.left > window.innerWidth / 2;
        tip.style.left = (leftSide ? r.left - tip.offsetWidth - 10 : r.right + 10) + 'px';
        tip.style.top = r.top + r.height / 2 - tip.offsetHeight / 2 + 'px';
      } else {
        const above = r.top > 60;
        tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 8)) + 'px';
        tip.style.top = (above ? r.top - tip.offsetHeight - 10 : r.bottom + 10) + 'px';
      }
    }, 350);
  });
  dock.addEventListener('mouseleave', () => {
    if (tipTimer) clearTimeout(tipTimer);
    tip.hidden = true;
  });

  // ---------- position: drag, snap, persist ----------
  let pointerDown = false;
  let dragging = false;
  let startX = 0, startY = 0, originLeft = 0, originTop = 0;

  function applyDefaultPosition() {
    dock.style.transform = '';
    if (state.dockVertical) {
      Object.assign(dock.style, { left: 'auto', right: '16px', top: '50%', bottom: 'auto', transform: 'translateY(-50%)' });
    } else {
      Object.assign(dock.style, { left: '50%', right: 'auto', top: 'auto', bottom: '', transform: 'translateX(-50%)' });
    }
  }

  function setFixed(left: number, top: number) {
    Object.assign(dock.style, { left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto', transform: 'none' });
  }

  function clampToViewport(left: number, top: number) {
    const w = dock.offsetWidth, h = dock.offsetHeight;
    return {
      left: Math.max(12, Math.min(left, window.innerWidth - w - 12)),
      top: Math.max(12, Math.min(top, window.innerHeight - h - 12)),
    };
  }

  dock.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest('button') && !target.closest('.grip')) return;
    pointerDown = true;
    dragging = false;
    startX = e.clientX;
    startY = e.clientY;
    const r = dock.getBoundingClientRect();
    originLeft = r.left;
    originTop = r.top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!pointerDown) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) < 4) return;
      dragging = true;
      dock.classList.add('dragging');
      tip.hidden = true;
      dismissHint();
    }
    const p = clampToViewport(originLeft + dx, originTop + dy);
    setFixed(p.left, p.top);
    api.requestLayout();
  });
  window.addEventListener('mouseup', () => {
    if (!pointerDown) return;
    pointerDown = false;
    if (!dragging) return;
    dragging = false;
    dock.classList.remove('dragging');
    const r = dock.getBoundingClientRect();
    const nearBottomCenter = !state.dockVertical && window.innerHeight - r.bottom < 60 && Math.abs(r.left + r.width / 2 - window.innerWidth / 2) < 120;
    if (nearBottomCenter) {
      resetDockPosition(false);
    } else {
      // Snap to an edge when close to it.
      let { left, top } = { left: r.left, top: r.top };
      if (left < 50) left = 16;
      if (window.innerWidth - r.right < 50) left = window.innerWidth - r.width - 16;
      if (top < 50) top = 16;
      if (window.innerHeight - r.bottom < 50) top = window.innerHeight - r.height - 18;
      setFixed(left, top);
      writePref(POS_KEY, JSON.stringify({ left, top, vertical: state.dockVertical }));
    }
    api.requestLayout();
  });
  window.addEventListener('resize', () => {
    if (dock.style.transform !== 'none') return;
    const r = dock.getBoundingClientRect();
    const p = clampToViewport(r.left, r.top);
    if (p.left !== r.left || p.top !== r.top) setFixed(p.left, p.top);
  });

  function restorePosition() {
    try {
      const raw = readPref(POS_KEY, '');
      if (!raw) { applyDefaultPosition(); return; }
      const pos = JSON.parse(raw);
      if (!!pos.vertical !== !!state.dockVertical) { applyDefaultPosition(); return; }
      const p = clampToViewport(pos.left, pos.top);
      setFixed(p.left, p.top);
    } catch {
      applyDefaultPosition();
    }
  }

  function resetDockPosition(announce = true) {
    writePref(POS_KEY, '');
    applyDefaultPosition();
    api.requestLayout();
    if (announce) api.toast('Dock moved back to its default place');
  }

  function setDockVertical(vertical: boolean) {
    state.dockVertical = vertical;
    dock.classList.toggle('vertical', vertical);
    writePref(ORIENT_KEY, vertical ? 'vertical' : 'horizontal');
    resetDockPosition(false);
  }

  // ---------- minimize ----------
  function placeMinButton(left: number, top: number) {
    minBtn.style.left = Math.round(Math.max(12, Math.min(left, window.innerWidth - 52))) + 'px';
    minBtn.style.top = Math.round(Math.max(12, Math.min(top, window.innerHeight - 52))) + 'px';
  }

  function setDockMinimized(min: boolean) {
    // Already in that state: nothing to do. (A second "Minimize" used to measure the hidden dock as 0,0.)
    if (min === dock.hidden && min === !minBtn.hidden) return;
    if (min) {
      const r = dock.getBoundingClientRect();
      if (r.width && r.height) placeMinButton(r.left + r.width / 2 - 20, r.top + r.height / 2 - 20);
      else placeMinButton(window.innerWidth / 2 - 20, window.innerHeight - 70);
    }
    dock.hidden = min;
    minBtn.hidden = !min;
    tip.hidden = true;
    menu.hidden = true;
    conn.hidden = true;
    writePref(MIN_KEY, min ? '1' : '');
    api.requestLayout();
  }
  // The round button can be dragged too; a click (under 4px of movement) restores the dock.
  let minDrag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
  minBtn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const r = minBtn.getBoundingClientRect();
    minDrag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!minDrag) return;
    const dx = e.clientX - minDrag.x, dy = e.clientY - minDrag.y;
    if (!minDrag.moved && Math.hypot(dx, dy) < 4) return;
    minDrag.moved = true;
    placeMinButton(minDrag.left + dx, minDrag.top + dy);
  });
  window.addEventListener('mouseup', () => {
    if (!minDrag) return;
    const wasClick = !minDrag.moved;
    minDrag = null;
    if (wasClick) setDockMinimized(false);
  });
  window.addEventListener('resize', () => {
    if (!minBtn.hidden) placeMinButton(parseFloat(minBtn.style.left) || 0, parseFloat(minBtn.style.top) || 0);
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyX') {
      e.preventDefault();
      setDockMinimized(!dock.hidden);
    }
  });

  // ---------- first-run hint ----------
  function dismissHint() {
    if (hint.hidden) return;
    hint.hidden = true;
    writePref(HINT_KEY, 'true');
  }
  ($('ah-hint-close')).onclick = dismissHint;
  function positionHint() {
    if (hint.hidden || dock.hidden) return;
    const r = dock.getBoundingClientRect();
    hint.style.left = Math.max(12, Math.min(r.left + r.width / 2 - hint.offsetWidth / 2, window.innerWidth - hint.offsetWidth - 12)) + 'px';
    hint.style.top = (r.top > 80 ? r.top - hint.offsetHeight - 10 : r.bottom + 10) + 'px';
  }
  api.onLayout(positionHint);
  api.onSelectionChange(() => dismissHint());

  // ---------- init ----------
  dock.classList.toggle('vertical', state.dockVertical);
  restorePosition();
  if (readPref(MIN_KEY, '') === '1') setDockMinimized(true);
  if (readPref(HINT_KEY, '') !== 'true') {
    hint.hidden = false;
    setTimeout(dismissHint, 12000);
  }
  renderDock();
}
