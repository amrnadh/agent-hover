import { anchorTo, esc, timeAgo } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { describeTaskStatus, prettyAgentName } from '../lib/task-status.js';
import type { OverlayApp } from '../app/context.js';

const ACTIVE = new Set(['queued', 'delivered', 'in_progress']);
/** Finished tasks keep their marker on the page this long. */
const MARKER_TTL_MS = 30 * 60 * 1000;

/**
 * Tasks: the store (loaded from the bridge, kept live from WebSocket events), the marker on each element
 * with a recent task, and the task card (status timeline, agent summary, changed files).
 */
export function setupTasks(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { refreshTasks, trackTask, onTaskEvent, openTaskCard, closeTaskCard, renderTaskCard: () => { if (openId) renderCard(); }, isTaskCardOpen: (id: string) => openId === id && !card.hidden, taskList, taskLabel, elementForTask, cancelTask, isTaskActive: (t: any) => ACTIVE.has(t.status) });

  const markersLayer = shadow.getElementById('ah-layer-markers') as HTMLElement;
  const card = shadow.getElementById('ah-task-card') as HTMLElement;
  state.tasks = new Map<string, any>();
  const elements = new Map<string, Element>();
  let openId: string | null = null;

  function taskList(): any[] {
    return [...state.tasks.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  function taskLabel(t: any): string {
    return t.payload?.label || (t.target?.component ? `<${t.target.component} />` : t.type === 'pinned-stack' || t.type === 'batch' ? 'Batch' : 'Task');
  }

  function elementForTask(t: any): Element | null {
    const known = elements.get(t.id);
    if (known && known.isConnected) return known;
    const sel = t.target?.selector || t.payload?.selector;
    if (!sel) return null;
    try {
      const el = document.querySelector(sel);
      if (el) elements.set(t.id, el);
      return el;
    } catch {
      return null;
    }
  }

  async function refreshTasks() {
    try {
      const res = await fetch(BRIDGE + '/api/agent/tasks?limit=50');
      const data = await res.json();
      state.tasks = new Map((data.tasks || []).map((t: any) => [t.id, t]));
      changed();
    } catch {}
  }

  function trackTask(task: any, el?: Element | null) {
    if (el) {
      elements.set(task.id, el);
      api.captureBefore?.(task.id, el);
    }
    state.tasks.set(task.id, task);
    changed();
  }

  /** Called by the WebSocket sync for task.created / task.updated. */
  function onTaskEvent(task: any) {
    if (!task?.id) return;
    const prev = state.tasks.get(task.id);
    state.tasks.set(task.id, task);
    if (prev && prev.status !== task.status && (task.status === 'done' || task.status === 'failed')) {
      api.onTaskFinished?.(task);
      const files = task.result?.filesChanged?.length || 0;
      const text = task.status === 'done'
        ? `Done · ${taskLabel(task)}${files ? ` · ${files} file${files === 1 ? '' : 's'}` : ''}`
        : `Failed · ${taskLabel(task)}`;
      api.toast(text, { action: 'View', onAction: () => openTaskCard(task.id) });
    }
    changed();
  }

  function changed() {
    api.renderDock?.();
    api.renderSidebar?.('tasks');
    if (openId) renderCard();
    api.requestLayout();
  }

  async function cancelTask(id: string) {
    try {
      const res = await fetch(BRIDGE + `/api/agent/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.task) onTaskEvent(data.task);
      api.toast('Task cancelled');
    } catch {
      api.toast('Dev server unreachable');
    }
  }

  // ---------- markers ----------
  function markerTasks(): Array<{ task: any; el: Element }> {
    const seen = new Set<Element>();
    const out: Array<{ task: any; el: Element }> = [];
    for (const t of taskList()) {
      const recent = ACTIVE.has(t.status) || ((t.status === 'done' || t.status === 'failed') && Date.now() - Date.parse(t.updatedAt) < MARKER_TTL_MS);
      if (!recent) continue;
      const el = elementForTask(t);
      if (!el || seen.has(el)) continue;
      seen.add(el);
      out.push({ task: t, el });
    }
    return out;
  }

  function renderMarkers() {
    markersLayer.innerHTML = '';
    const pill = shadow.getElementById('ah-pill') as HTMLElement | null;
    const ins = api.insets();
    for (const { task, el } of markerTasks()) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || (r.width === 0 && r.height === 0)) continue;
      const m = document.createElement('button');
      m.className = 'ah-marker' + (task.status === 'done' ? ' done' : task.status === 'failed' ? ' failed' : '');
      const left = Math.min(r.right - 11, window.innerWidth - ins.right - 26);
      let top = Math.max(4, r.top - 11);
      // Don't sit on the action pill: use the bottom corner instead.
      if (pill && !pill.hidden) {
        const p = pill.getBoundingClientRect();
        if (left < p.right && left + 22 > p.left && top < p.bottom && top + 22 > p.top) top = r.bottom - 11;
      }
      m.style.left = left + 'px';
      m.style.top = top + 'px';
      const view = describeTaskStatus(task, state.connectedAgents?.[0]?.client);
      m.title = `${taskLabel(task)} · ${view.text}`;
      m.setAttribute('aria-label', `Task: ${view.text}`);
      m.innerHTML = task.status === 'in_progress' ? '<span class="spin"></span>'
        : task.status === 'done' ? icon('check', 14)
        : task.status === 'failed' ? icon('alert', 14)
        : '<span class="ah-dot pulse"></span>';
      m.onclick = (e) => { e.stopPropagation(); openTaskCard(task.id); };
      markersLayer.appendChild(m);
    }
  }
  api.onLayout(renderMarkers);

  // ---------- task card ----------
  function openTaskCard(id: string) {
    openId = id;
    api.closeComposer?.();
    api.closeCommentCard?.();
    renderCard();
  }

  function closeTaskCard() {
    openId = null;
    card.hidden = true;
  }

  function renderCard() {
    const t = openId ? state.tasks.get(openId) : null;
    if (!t) { closeTaskCard(); return; }
    const view = describeTaskStatus(t, state.connectedAgents?.[0]?.client);
    const steps = ['Sent', 'Seen', 'Working', 'Done'];
    const reached = t.status === 'queued' ? 0 : t.status === 'delivered' ? 1 : t.status === 'in_progress' ? 2 : t.status === 'done' ? 3 : -1;
    const tone = view.tone === 'success' ? 'ok' : view.tone === 'error' ? 'bad' : view.tone === 'working' ? 'warn pulse' : '';
    const files: string[] = t.result?.filesChanged || [];
    const cancellable = t.status === 'queued' || t.status === 'delivered';
    const el = elementForTask(t);
    card.innerHTML = `
      <div class="head"><span class="ah-dot ${tone}"></span><b>${esc(taskLabel(t))}</b><span class="ah-muted" style="font-size:12px;white-space:nowrap">${esc(t.claimedBy ? prettyAgentName(t.claimedBy) : view.text)}</span><button class="ah-ibtn" data-act="close" aria-label="Close">${icon('x')}</button></div>
      <div class="body">${esc(t.instruction || '')}</div>
      ${reached >= 0 ? `<div class="ah-timeline">${steps.map((s, i) => `<span class="${i <= reached ? 'on' : ''}">${s}</span>`).join(icon('chev-right', 12))}</div>` : `<div class="ah-timeline"><span class="on">${esc(view.text)}</span></div>`}
      ${view.detail ? `<div class="ah-summary">${esc(view.detail)}</div>` : ''}
      ${files.length ? `<div class="ah-files">${files.map((f) => `<button data-file="${esc(f)}" title="Open in editor">${icon('file', 14)}${esc(f)}</button>`).join('')}</div>` : ''}
      ${api.renderTaskVerifyPanel ? api.renderTaskVerifyPanel(t) : ''}
      <div class="ah-actions">
        ${api.renderTaskVerifyActions ? api.renderTaskVerifyActions(t) : ''}
        ${cancellable ? '<button class="ah-tbtn outline" data-act="cancel">Cancel task</button>' : ''}
        ${!el ? '' : '<button class="ah-tbtn" data-act="show">Show on page</button>'}
        <button class="ah-tbtn" data-act="tasks">View in Tasks</button>
      </div>
      <div class="ah-muted" style="font-size:11.5px">${esc(timeAgo(t.createdAt))}</div>`;
    card.hidden = false;
    positionCard();
  }

  function positionCard() {
    if (card.hidden || !openId) return;
    const t = state.tasks.get(openId);
    const el = t && elementForTask(t);
    const ins = api.insets();
    if (el) {
      // Next to the whole element (right-aligned with it) so the card never covers what it is about.
      const r = el.getBoundingClientRect();
      anchorTo(card, { left: Math.max(12, r.right - card.offsetWidth), top: r.top, width: Math.min(r.width, card.offsetWidth), height: r.height }, ins, 10);
    } else {
      anchorTo(card, { left: window.innerWidth - ins.right - card.offsetWidth - 12, top: 12, width: 1, height: 1 }, ins, 4);
    }
  }
  api.onLayout(positionCard);

  card.onclick = (e) => {
    const b = (e.target as Element).closest('button') as HTMLElement | null;
    if (!b || !openId) return;
    const t = state.tasks.get(openId);
    if (b.dataset.file) { api.openInEditor({ file: b.dataset.file, line: 1 }); return; }
    const act = b.dataset.act;
    if (act === 'close') closeTaskCard();
    if (act === 'cancel') cancelTask(openId);
    if (act === 'tasks') { closeTaskCard(); api.openSidebar('tasks'); }
    if (act === 'show' && t) {
      const el = elementForTask(t);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => api.selectElement(el), 350); }
    }
    api.onTaskCardAction?.(act, t);
  };
}
