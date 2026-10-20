import { anchorTo, esc, timeAgo } from '../lib/ui.js';
import { isCovered } from '../lib/dom.js';
import { icon } from '../lib/icon.js';
import { describeTaskStatus, prettyAgentName } from '../lib/task-status.js';
import { lockedChanges, needsReview, REVIEW_TTL_MS, reviewText } from '../lib/review.js';
import type { OverlayApp } from '../app/context.js';

const ACTIVE = new Set(['queued', 'delivered', 'in_progress']);
/** Didn't happen: can be sent again as a new task. */
const RETRYABLE = new Set(['failed', 'expired', 'cancelled', 'superseded']);
/** Finished tasks keep their marker on the page this long. */
const MARKER_TTL_MS = 30 * 60 * 1000;

/**
 * Tasks: the store (loaded from the bridge, kept live from WebSocket events), the marker on each element
 * with a recent task, and the task card (status timeline, agent summary, changed files). A finished change
 * waits on its element for review: Keep, Undo (verify.ts) or Follow up.
 */
export function setupTasks(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { refreshTasks, trackTask, onTaskEvent, openTaskCard, closeTaskCard, renderTaskCard: () => { if (openId) renderCard(); }, isTaskCardOpen: (id: string) => openId === id && !card.hidden, taskList, taskLabel, elementForTask, cancelTask, isTaskActive: (t: any) => ACTIVE.has(t.status), reviewTask, followUpTask, awaitingReview, lockedFor, renderReviewActions, removeTasks, clearFinished, onTasksRemoved, isRemovable, retryTask, copyTaskPrompt, needsYou, taskWhere, taskCardKey });

  const markersLayer = shadow.getElementById('ah-layer-markers') as HTMLElement;
  const card = shadow.getElementById('ah-task-card') as HTMLElement;
  state.tasks = new Map<string, any>();
  const elements = new Map<string, Element>();
  let openId: string | null = null;
  let menuOpen = false;
  let confirmRemove: string | null = null;

  function taskList(): any[] {
    return [...state.tasks.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  function taskLabel(t: any): string {
    return t.payload?.display || t.payload?.label || (t.target?.component ? `<${t.target.component} />` : t.type === 'pinned-stack' || t.type === 'batch' ? 'Batch' : 'Task');
  }

  /** What and where: “Book a demo” button · Hero.tsx:54. */
  function taskWhere(t: any): string {
    const file = (t.target?.file || '').split('/').pop();
    return [taskLabel(t), file ? file + (t.target?.lineStart ? ':' + t.target.lineStart : '') : ''].filter(Boolean).join(' · ');
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
      api.toast(text, { action: needsReview(task) ? 'Review' : 'View', onAction: () => openTaskCard(task.id) });
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

  /** What needs you: changes waiting for review, and failed tasks nobody has sent again. */
  function needsYou(t: any): boolean {
    return needsReview(t) || (t.status === 'failed' && !retried(t));
  }
  const retried = (t: any) => [...state.tasks.values()].some((x: any) => x.payload?.retryOf === t.id);

  async function reviewTask(id: string, action: 'keep' | 'follow-up', followUp?: string) {
    try {
      const data = await api.bridgePost(`/api/agent/tasks/${encodeURIComponent(id)}/review`, { action, followUp }, 'Could not save the review');
      onTaskEvent(data.task);
      if (action === 'keep') api.toast(`Kept · ${taskLabel(data.task)}`);
    } catch (err: any) {
      api.toast(err.message);
    }
  }

  /** Send a failed or never-picked-up task again: same request, same element, same agent. */
  async function retryTask(t: any) {
    try {
      const data = await api.bridgePost(`/api/agent/tasks/${encodeURIComponent(t.id)}/retry`, undefined, 'Could not send it again');
      const el = elementForTask(t);
      const wasOpen = openId === t.id;
      onTasksRemoved(data.removed || []);
      trackTask(data.task, el);
      if (wasOpen) openTaskCard(data.task.id);
      const who = state.connectedAgents?.length ? prettyAgentName(data.task.assignee || state.connectedAgents[0].client) : null;
      api.toast(who ? `Sent again to ${who}` : 'Queued again · no agent connected yet');
    } catch (err: any) {
      api.toast(err.message);
    }
  }

  /** The prompt the agent would get, for pasting into any AI tool. */
  async function copyTaskPrompt(t: any) {
    let text: string = t.payload?.prompt || '';
    if (!text) {
      try { text = (await (await fetch(BRIDGE + `/api/agent/tasks/${encodeURIComponent(t.id)}`)).json()).prompt || ''; } catch { /* below */ }
    }
    if (!text) { api.toast('No prompt saved for this task'); return; }
    api.toast((await api.copyText(text)) ? 'Prompt copied · paste it into any AI tool' : 'Clipboard blocked by the browser');
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

  /**
   * The decision first (Keep and Undo for a change; Try again or Send again when it didn't happen), the rest quieter.
   * The card puts them on one row; the Tasks tab (narrower) asks for `part` 'decide' and 'more' separately.
   */
  function renderReviewActions(t: any, part: 'all' | 'decide' | 'more' = 'all'): string {
    const undo = api.renderUndoAction?.(t, 'outline') || '';
    const compare = api.renderCompareAction?.(t, 'quiet') || '';
    const keep = t.status === 'done' && needsReview(t) ? `<button class="ah-tbtn primary" data-act="keep" title="Keep (K)">${icon('check', 14)}Keep</button>` : '';
    const follow = t.status === 'done' && t.review?.state !== 'undone' && elementForTask(t) ? `<button class="ah-tbtn quiet" data-act="follow-up" title="Follow up (F)">${icon('follow-up', 14)}Follow up</button>` : '';
    const again = RETRYABLE.has(t.status) && !retried(t)
      ? `<button class="ah-tbtn primary" data-act="retry" title="${t.status === 'failed' ? 'Try again' : 'Send again'} (R)">${icon('send', 14)}${t.status === 'failed' ? 'Try again' : 'Send again'}</button>` : '';
    const copy = RETRYABLE.has(t.status) ? `<button class="ah-tbtn quiet" data-act="copy-prompt">${icon('copy', 14)}Copy prompt</button>` : '';
    if (part === 'decide') return again + keep + undo;
    if (part === 'more') return compare + follow + copy;
    if (!again && !keep && !undo && !compare && !follow && !copy) return '';
    return `${again}${keep}${undo}<span class="grow"></span>${compare}${follow}${copy}`;
  }

  /** Anything but a task an agent is working on can leave the list; a waiting one is withdrawn. */
  function isRemovable(t: any): boolean {
    return t.status !== 'in_progress';
  }

  async function removeTasks(ids: string[]) {
    try {
      const data = await api.bridgePost('/api/agent/tasks/remove', { ids }, 'Could not remove');
      onTasksRemoved(data.removed);
      api.toast(data.removed.length === 1 ? 'Removed from the list' : `Removed ${data.removed.length} tasks`);
    } catch (err: any) {
      api.toast(err.message);
    }
  }

  /** Every finished task with nothing left to decide; changes waiting for your review stay. */
  async function clearFinished() {
    try {
      const data = await api.bridgePost('/api/agent/tasks/remove', { finished: true }, 'Could not clear');
      onTasksRemoved(data.removed);
      api.toast(data.removed.length ? `Cleared ${data.removed.length} finished task${data.removed.length === 1 ? '' : 's'}` : 'Nothing to clear');
    } catch (err: any) {
      api.toast(err.message);
    }
  }

  /** Called for the bridge's task.removed event too (another tab, or an agent). */
  function onTasksRemoved(ids: string[]) {
    let any = false;
    for (const id of ids) {
      any = state.tasks.delete(id) || any;
      elements.delete(id);
      if (openId === id) closeTaskCard();
    }
    if (any) changed();
  }

  async function cancelTask(id: string) {
    try {
      const data = await api.bridgePost(`/api/agent/tasks/${encodeURIComponent(id)}/cancel`, undefined, 'Could not cancel');
      if (data.task) onTaskEvent(data.task);
      api.toast('Task cancelled');
    } catch (err: any) {
      api.toast(err.message);
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

  /**
   * Where a marker goes: the element's corner, or for a block of text (a heading as wide as the page) the corner of
   * the text itself, so the marker sits on what you pointed at instead of floating in empty space.
   */
  function markerBox(el: Element): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
    const r = el.getBoundingClientRect();
    if (el.children.length > 3 || !(el.textContent || '').trim()) return r;
    const range = document.createRange();
    range.selectNodeContents(el);
    const t = range.getBoundingClientRect();
    return t.width > 0 && t.width < r.width - 24 ? { left: t.left, top: r.top, right: t.right, bottom: r.bottom, width: t.width, height: r.height } : r;
  }

  const tip = document.createElement('div');
  tip.className = 'ah-tip ah-marker-tip';
  tip.hidden = true;
  markersLayer.insertAdjacentElement('afterend', tip);

  function renderMarkers() {
    markersLayer.innerHTML = '';
    tip.hidden = true;
    const pill = shadow.getElementById('ah-pill') as HTMLElement | null;
    const ins = api.insets();
    const { found, missing } = markerTasks();
    watchForMissing(missing);
    for (const { task, el } of found) {
      const r = markerBox(el);
      if (r.bottom < 0 || r.top > window.innerHeight || (r.width === 0 && r.height === 0)) continue;
      // Under the app's own dialog or a sticky header: the marker would float over something else.
      if (isCovered(el, app.container)) continue;
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
      m.setAttribute('aria-label', `Task: ${task.instruction || taskLabel(task)}. ${view.text}${extra ? ', ' + extra : ''}`);
      // Hover says what the marker is about before you open it.
      m.onmouseenter = () => {
        tip.innerHTML = `<b>${esc(task.instruction || taskLabel(task))}</b><span>${esc(view.text)}${extra ? ' · ' + esc(extra) : ''}</span>`;
        anchorTo(tip, m.getBoundingClientRect(), api.insets(), 6);
      };
      m.onmouseleave = () => { tip.hidden = true; };
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
    if (openId !== id) { menuOpen = false; confirmRemove = null; }
    openId = id;
    api.closeComposer?.();
    api.closeCommentCard?.();
    renderCard();
  }

  function closeTaskCard() {
    openId = null;
    menuOpen = false;
    confirmRemove = null;
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
    const head = t.status === 'done' && needsReview(t) ? `${view.text} · waiting for you` : view.text;
    // While an agent works, how long it has been at it (ticks while the card is open); otherwise when it was sent.
    const time = t.status === 'in_progress' ? elapsed(t.updatedAt) : timeAgo(t.createdAt);
    const removable = isRemovable(t);
    const losesUndo = needsReview(t) && !!t.checkpointId;
    const file = (t.target?.file || '').split('/').pop();
    card.innerHTML = `
      <div class="head"><span class="ah-dot ${tone}"></span><span class="status">${esc(head)}</span><span class="time">${esc(time)}</span>
        <button class="ah-ibtn" data-act="menu" aria-label="More" title="More" aria-haspopup="menu" aria-expanded="${menuOpen}">${icon('more')}</button><button class="ah-ibtn" data-act="close" aria-label="Close" title="Close (Esc)">${icon('x')}</button></div>
      <div class="title">${esc(t.instruction || taskLabel(t))}</div>
      <div class="sub">${esc(taskLabel(t))}${file ? ` · <span class="ah-mono">${esc(file + (t.target?.lineStart ? ':' + t.target.lineStart : ''))}</span>` : ''}</div>
      ${t.status === 'expired' ? `<div class="ah-summary">No agent picked this up within 30 minutes. Send it again once your agent is listening (run /agent-hover in it), or copy the prompt into any AI tool.</div>` : ''}
      ${reached >= 0 ? `<div class="ah-timeline">${steps.map((s, i) => `<span class="${i <= reached ? 'on' : ''}">${s}</span>`).join(icon('chev-right', 12))}</div>` : ''}
      ${locked.length && t.review?.state !== 'undone' ? `<div class="ah-lockwarn">${icon('lock', 14)}<span>Changed ${locked.map((c) => `<b>&lt;${esc(c)} /&gt;</b>`).join(', ')}, which ${locked.length === 1 ? 'is' : 'are'} locked. Undo it, or unlock it if you meant to allow this.</span></div>` : ''}
      ${view.detail ? `<div class="ah-summary">${esc(view.detail)}</div>` : ''}
      ${files.length ? `<div class="ah-files">${files.map((f) => `<button data-file="${esc(f)}" title="Open in editor">${icon('file', 14)}<span>${esc(f)}</span></button>`).join('')}</div>` : ''}
      ${api.renderTaskVerifyPanel ? api.renderTaskVerifyPanel(t) : ''}
      ${cancellable ? '<div class="ah-actions"><button class="ah-tbtn outline" data-act="cancel">Cancel task</button></div>' : (() => { const a = renderReviewActions(t); return a ? `<div class="ah-actions">${a}</div>` : ''; })()}
      ${menuOpen ? `<div class="ah-card-menu ah-menu ah-surface" role="menu">
        <button role="menuitem" data-act="tasks">${icon('tasks', 14)}View in Tasks</button>
        ${el ? `<button role="menuitem" data-act="show">${icon('target', 14)}Show on page</button>` : ''}
        ${RETRYABLE.has(t.status) ? '' : `<button role="menuitem" data-act="copy-prompt">${icon('copy', 14)}Copy prompt</button>`}
        ${cancellable ? `<button role="menuitem" data-act="cancel">${icon('x', 14)}Cancel task</button>` : ''}
        ${removable ? (confirmRemove === t.id
          ? `<button role="menuitem" class="danger" data-act="remove-confirm">${icon('trash', 14)}Remove · Undo won't be possible</button>`
          : `<button role="menuitem" class="danger" data-act="${losesUndo ? 'remove-ask' : 'remove'}">${icon('trash', 14)}${cancellable ? 'Withdraw and remove' : 'Remove from list'}</button>`) : ''}
      </div>` : ''}`;
    card.hidden = false;
    positionCard();
  }

  function elapsed(since: string): string {
    const s = Math.max(0, Math.round((Date.now() - Date.parse(since)) / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  }
  setInterval(() => {
    const t = openId && !card.hidden ? state.tasks.get(openId) : null;
    if (t?.status === 'in_progress') { const el = card.querySelector('.head .time'); if (el) el.textContent = elapsed(t.updatedAt); }
  }, 1000);

  /** Keys for the open card's main actions. Returns whether the key did something. */
  function taskCardKey(key: string): boolean {
    const act = ({ k: 'keep', u: 'undo', f: 'follow-up', r: 'retry' } as Record<string, string>)[key];
    const b = act && !card.hidden ? card.querySelector<HTMLButtonElement>(`.ah-actions [data-act="${act}"]`) : null;
    if (!b || b.disabled) return false;
    b.click();
    return true;
  }

  function positionCard() {
    if (card.hidden || !openId) return;
    const t = state.tasks.get(openId);
    const el = t && elementForTask(t);
    const ins = api.insets();
    if (el) {
      // Next to the whole element (right-aligned with it) so the card never covers what it is about, nor the action
      // pill when the element is selected.
      let r: { left: number; top: number; right: number; bottom: number } = el.getBoundingClientRect();
      const pill = shadow.getElementById('ah-pill') as HTMLElement | null;
      if (pill && !pill.hidden) {
        const p = pill.getBoundingClientRect();
        r = { left: Math.min(r.left, p.left), top: Math.min(r.top, p.top), right: Math.max(r.right, p.right), bottom: Math.max(r.bottom, p.bottom) };
      }
      anchorTo(card, { left: Math.max(12, r.right - card.offsetWidth), top: r.top, width: Math.min(r.right - r.left, card.offsetWidth), height: r.bottom - r.top }, ins, 10);
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
    if (act === 'menu') { menuOpen = !menuOpen; confirmRemove = null; renderCard(); return; }
    if (act === 'remove-ask') { confirmRemove = openId; renderCard(); return; }
    if (act === 'remove' || act === 'remove-confirm') { removeTasks([openId]); return; }
    if (menuOpen && act !== 'compare' && act !== 'undo') menuOpen = false;
    if (act === 'close') closeTaskCard();
    if (act === 'cancel') cancelTask(openId);
    if (act === 'tasks') { closeTaskCard(); api.openSidebar('tasks'); }
    if (act === 'keep' && t) reviewTask(t.id, 'keep');
    if (act === 'follow-up' && t) { followUpTask(t); return; }
    if (act === 'retry' && t) { retryTask(t); return; }
    if (act === 'copy-prompt' && t) { copyTaskPrompt(t); api.renderTaskCard(); return; }
    if (act === 'show' && t) {
      const el = elementForTask(t);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => api.selectElement(el), 350); }
    }
    api.onTaskCardAction?.(act, t);
  };
}
