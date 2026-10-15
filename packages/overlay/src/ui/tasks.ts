import { anchorTo, esc, timeAgo } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { describeTaskStatus, prettyAgentName } from '../lib/task-status.js';
import { lockedChanges, needsReview, REVIEW_TTL_MS, reviewText } from '../lib/review.js';
import type { OverlayApp } from '../app/context.js';

const ACTIVE = new Set(['queued', 'delivered', 'in_progress']);
/** Finished tasks keep their marker on the page this long. */
const MARKER_TTL_MS = 30 * 60 * 1000;

/**
 * Tasks: the store (loaded from the bridge, kept live from WebSocket events), the marker on each element
 * with a recent task, and the task card (status timeline, agent summary, changed files). A finished change
 * waits on its element for review: Keep, Undo (verify.ts) or Follow up.
 */
export function setupTasks(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { refreshTasks, trackTask, onTaskEvent, openTaskCard, closeTaskCard, renderTaskCard: () => { if (openId) renderCard(); }, isTaskCardOpen: (id: string) => openId === id && !card.hidden, taskList, taskLabel, elementForTask, cancelTask, isTaskActive: (t: any) => ACTIVE.has(t.status), reviewTask, followUpTask, awaitingReview, lockedFor, renderReviewActions });

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

  const hasBox = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };

  /** The task's element on the page now: the one it was sent from, or a match for its selector. A hot update can
   * leave the old node behind with no box while the new one renders, so prefer a match that has a box. */
  function elementForTask(t: any): Element | null {
    const known = elements.get(t.id);
    if (known && known.isConnected && hasBox(known)) return known;
    const sel = t.target?.selector || t.payload?.selector;
    if (!sel) return known && known.isConnected ? known : null;
    try {
      const matches = Array.from(document.querySelectorAll(sel));
      const el = matches.find(hasBox) || matches[0] || null;
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
    settleMarkers();
  }

  // After a task changes or the list loads, the page is often still moving: an entrance animation, or a hot update
  // swapping the element the agent just edited. Place the markers again a few times while it settles. Drawn
  // directly, not on an animation frame, so it doesn't depend on the browser delivering frames during the update.
  let settleTimers: Array<ReturnType<typeof setTimeout>> = [];
  function settleMarkers() {
    settleTimers.forEach(clearTimeout);
    settleTimers = [400, 1500, 3000, 6000].map((ms) => setTimeout(renderMarkers, ms));
  }

  /** An unreviewed change recent enough to keep its marker (and the dock's dot). */
  function awaitingReview(t: any): boolean {
    return needsReview(t) && Date.now() - Date.parse(t.updatedAt) < REVIEW_TTL_MS;
  }

  /** Locked components this finished task changed anyway. */
  function lockedFor(t: any): string[] {
    return t.status === 'done' ? lockedChanges(t.result?.filesChanged, state.frozenEntries) : [];
  }

  async function reviewTask(id: string, action: 'keep' | 'follow-up', followUp?: string) {
    try {
      const res = await fetch(BRIDGE + `/api/agent/tasks/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, followUp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the review');
      onTaskEvent(data.task);
      if (action === 'keep') api.toast(`Kept · ${taskLabel(data.task)}`);
    } catch (err: any) {
      api.toast(err.message === 'Failed to fetch' ? 'Dev server unreachable' : err.message || 'Could not save the review');
    }
  }

  /** Ask again about the same element, with this task's request and result in the prompt. */
  function followUpTask(t: any) {
    const el = elementForTask(t);
    if (!el) { api.toast('That element is not on this page any more'); return; }
    closeTaskCard();
    el.scrollIntoView({ block: 'nearest' });
    api.selectElement(el);
    api.openComposer({ followUp: t });
  }

  /** Keep, then Compare and Undo (verify.ts), then Follow up. Shared by the task card and the Tasks tab. */
  function renderReviewActions(t: any): string {
    const verify = api.renderTaskVerifyActions ? api.renderTaskVerifyActions(t) : '';
    if (t.status !== 'done') return verify;
    const keep = needsReview(t) ? `<button class="ah-tbtn primary" data-act="keep">${icon('check', 14)}Keep</button>` : '';
    const follow = t.review?.state !== 'undone' && elementForTask(t) ? '<button class="ah-tbtn outline" data-act="follow-up">Follow up</button>' : '';
    return keep + verify + follow;
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
  function markerTasks(): { found: Array<{ task: any; el: Element }>; missing: number } {
    const seen = new Set<Element>();
    const found: Array<{ task: any; el: Element }> = [];
    let missing = 0;
    for (const t of taskList()) {
      if (!showsMarker(t)) continue;
      const el = elementForTask(t);
      // Not on the page yet, or there but without a box (mid-swap after a hot update): place it again later.
      if (!el || !hasBox(el)) { if (el || t.target?.selector || t.payload?.selector) missing++; continue; }
      if (seen.has(el)) continue;
      seen.add(el);
      found.push({ task: t, el });
    }
    return { found, missing };
  }

  /** Active tasks, changes waiting for review, and other recent results. A reviewed change has nothing left to do. */
  function showsMarker(t: any): boolean {
    if (ACTIVE.has(t.status)) return true;
    if (t.review) return false;
    if (needsReview(t)) return awaitingReview(t);
    return (t.status === 'done' || t.status === 'failed') && Date.now() - Date.parse(t.updatedAt) < MARKER_TTL_MS;
  }

  // A task's element may not be on the page yet (the app renders after the task list loads, it lives on another
  // route, or a hot update is swapping it). While any is missing, place markers again when the page's DOM, styles or
  // classes change (debounced); stop once all are found.
  let domWatch: MutationObserver | null = null;
  let domTimer: ReturnType<typeof setTimeout> | null = null;
  function watchForMissing(missing: number) {
    if (!missing) {
      domWatch?.disconnect();
      domWatch = null;
      return;
    }
    if (domWatch || !document.body) return;
    domWatch = new MutationObserver(() => {
      if (domTimer) return;
      domTimer = setTimeout(() => { domTimer = null; api.requestLayout(); }, 150);
    });
    domWatch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  }

  function renderMarkers() {
    markersLayer.innerHTML = '';
    const pill = shadow.getElementById('ah-pill') as HTMLElement | null;
    const ins = api.insets();
    const { found, missing } = markerTasks();
    watchForMissing(missing);
    for (const { task, el } of found) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || (r.width === 0 && r.height === 0)) continue;
      const m = document.createElement('button');
      const locked = lockedFor(task).length > 0;
      const review = needsReview(task);
      m.className = 'ah-marker' + (task.status === 'done' ? ' done' : task.status === 'failed' ? ' failed' : '') + (review ? ' review' : '') + (locked ? ' locked' : '');
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
      const extra = [review ? 'waiting for your review' : '', locked ? 'changed a locked component' : ''].filter(Boolean).join(' · ');
      m.title = `${taskLabel(task)} · ${view.text}${extra ? ' · ' + extra : ''}`;
      m.setAttribute('aria-label', `Task: ${view.text}${extra ? ', ' + extra : ''}`);
      m.innerHTML = task.status === 'in_progress' ? '<span class="spin"></span>'
        : locked ? icon('lock', 13)
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
    const files: string[] = t.result?.filesChanged || [];
    // A change gets a last step: waiting for your review, then what you decided.
    const reviewable = t.status === 'done' && (files.length > 0 || !!t.review);
    const steps = ['Sent', 'Seen', 'Working', 'Done', ...(reviewable ? [t.review ? reviewText(t) : 'Review'] : [])];
    const reached = t.status === 'queued' ? 0 : t.status === 'delivered' ? 1 : t.status === 'in_progress' ? 2 : t.status === 'done' ? (t.review ? 4 : 3) : -1;
    const locked = lockedFor(t);
    const tone = view.tone === 'success' ? 'ok' : view.tone === 'error' ? 'bad' : view.tone === 'working' ? 'warn pulse' : '';
    const cancellable = t.status === 'queued' || t.status === 'delivered';
    const el = elementForTask(t);
    card.innerHTML = `
      <div class="head"><span class="ah-dot ${tone}"></span><b>${esc(taskLabel(t))}</b><span class="ah-muted" style="font-size:12px;white-space:nowrap">${esc(t.claimedBy ? prettyAgentName(t.claimedBy) : view.text)}</span><button class="ah-ibtn" data-act="close" aria-label="Close">${icon('x')}</button></div>
      <div class="body">${esc(t.instruction || '')}</div>
      ${reached >= 0 ? `<div class="ah-timeline">${steps.map((s, i) => `<span class="${i <= reached ? 'on' : ''}">${s}</span>`).join(icon('chev-right', 12))}</div>` : `<div class="ah-timeline"><span class="on">${esc(view.text)}</span></div>`}
      ${view.detail ? `<div class="ah-summary">${esc(view.detail)}</div>` : ''}
      ${locked.length && t.review?.state !== 'undone' ? `<div class="ah-lockwarn">${icon('lock', 14)}<span>Changed ${locked.map((c) => `<b>&lt;${esc(c)} /&gt;</b>`).join(', ')}, which ${locked.length === 1 ? 'is' : 'are'} locked. Undo it, or unlock it if you meant to allow this.</span></div>` : ''}
      ${files.length ? `<div class="ah-files">${files.map((f) => `<button data-file="${esc(f)}" title="Open in editor">${icon('file', 14)}${esc(f)}</button>`).join('')}</div>` : ''}
      ${api.renderTaskVerifyPanel ? api.renderTaskVerifyPanel(t) : ''}
      <div class="ah-actions">
        ${renderReviewActions(t)}
        ${cancellable ? '<button class="ah-tbtn outline" data-act="cancel">Cancel task</button>' : ''}
        ${!el || needsReview(t) ? '' : '<button class="ah-tbtn" data-act="show">Show on page</button>'}
        <button class="ah-tbtn" data-act="tasks">View in Tasks</button>
      </div>
      <div class="ah-muted" style="font-size:11.5px">${esc(timeAgo(t.createdAt))}${t.review ? ` · ${esc(reviewText(t))} ${esc(timeAgo(t.review.at))}` : ''}</div>`;
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
    if (act === 'keep' && t) reviewTask(t.id, 'keep');
    if (act === 'follow-up' && t) { followUpTask(t); return; }
    if (act === 'show' && t) {
      const el = elementForTask(t);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => api.selectElement(el), 350); }
    }
    api.onTaskCardAction?.(act, t);
  };
}
