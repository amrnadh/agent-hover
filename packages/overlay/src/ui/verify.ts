import { esc, timeAgo } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import type { OverlayApp } from '../app/context.js';

interface Size { w: number; h: number }
interface Shots { before?: string; after?: string; beforeSize?: Size; afterSize?: Size }
interface FileChange { path: string; display: string; status: 'modified' | 'added' | 'deleted'; additions?: number; deletions?: number; reported: boolean }
interface Changes { available: boolean; reason?: string; files: FileChange[]; undoneAt?: string }

const SETTLE_MS = 1500;
/** Width available for the comparison inside the card (440px card minus padding). */
const COMPARE_WIDTH = 410;
const STORE_KEY = 'agent-hover-shots:';

/**
 * Verify (P3-01): a "before" image of the element when a task is sent, an "after" image once the agent is done
 * and HMR has settled, a before/after compare slider, and Undo of the files the agent changed (git checkpoint
 * taken by the bridge at claim time).
 */
export function setupVerify(app: OverlayApp) {
  const { BRIDGE, fetch, api } = app;
  Object.assign(api, { captureBefore, renderTaskVerifyActions, renderTaskVerifyPanel, onTaskCardAction });

  const shots = new Map<string, Shots>();
  const changes = new Map<string, Changes>();
  let panel: { id: string; kind: 'compare' | 'undo' } | null = null;
  let busy = false;
  const isPanel = (id: string, kind: 'compare' | 'undo') => !!panel && panel.id === id && panel.kind === kind;

  // ---------- images ----------
  function load(id: string): Shots {
    if (!shots.has(id)) {
      try { shots.set(id, JSON.parse(sessionStorage.getItem(STORE_KEY + id) || '{}')); } catch { shots.set(id, {}); }
    }
    return shots.get(id)!;
  }

  function save(id: string, s: Shots) {
    shots.set(id, s);
    try { sessionStorage.setItem(STORE_KEY + id, JSON.stringify(s)); } catch { /* too large for session storage: memory only */ }
  }

  function inViewport(el: Element) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
  }

  async function capture(id: string, el: Element | null | undefined, which: 'before' | 'after', allowScroll: boolean) {
    if (!el || !el.isConnected || (!allowScroll && !inViewport(el))) return false;
    try {
      const r = el.getBoundingClientRect();
      const url = await api.captureElement(el);
      if (!url) return false;
      save(id, { ...load(id), [which]: url, [which + 'Size']: { w: Math.round(r.width), h: Math.round(r.height) } });
      return true;
    } catch {
      return false;
    }
  }

  /** Called when a task is sent from the page: remember how the element looks now. */
  function captureBefore(taskId: string, el: Element | null | undefined) {
    capture(taskId, el, 'before', false);
  }

  // After the agent finishes, wait for HMR to settle, then capture the same element again.
  api.onTaskFinished = (task: any) => {
    if (task.status !== 'done') return;
    changes.delete(task.id);
    setTimeout(() => {
      if (!load(task.id).before) return;
      capture(task.id, api.elementForTask(task), 'after', false).then((ok) => { if (ok && panel?.id === task.id) api.renderTaskCard?.(); });
    }, SETTLE_MS);
  };

  async function loadChanges(id: string): Promise<Changes> {
    try {
      const res = await fetch(BRIDGE + `/api/agent/tasks/${encodeURIComponent(id)}/changes`);
      const data = await res.json();
      changes.set(id, data);
      return data;
    } catch {
      return { available: false, reason: 'Dev server unreachable.', files: [] };
    }
  }

  // ---------- task card / Tasks tab ----------
  function renderTaskVerifyActions(t: any): string {
    if (t.status !== 'done' && t.status !== 'failed') return '';
    const s = load(t.id);
    const ch = changes.get(t.id);
    const compare = s.before ? `<button class="ah-tbtn outline" data-act="compare" aria-pressed="${isPanel(t.id, 'compare')}">${icon('panel', 14)}Compare</button>` : '';
    const undo = t.checkpointId && !ch?.undoneAt ? `<button class="ah-tbtn outline" data-act="undo" aria-pressed="${isPanel(t.id, 'undo')}">Undo</button>` : '';
    return compare + undo;
  }

  function renderTaskVerifyPanel(t: any): string {
    if (!panel || panel.id !== t.id) {
      const done = changes.get(t.id)?.undoneAt;
      return done ? `<div class="ah-summary">Undone ${esc(timeAgo(done))}. The files are back to how they were before the agent started.</div>` : '';
    }
    if (panel.kind === 'compare') {
      const s = load(t.id);
      if (!s.after) {
        return `<div class="ah-compare-empty">No “after” image yet.<button class="ah-tbtn outline" data-act="capture-after">Capture now</button></div>`;
      }
      // Both images at one scale, top-left aligned, so unchanged parts line up and size changes show.
      const b = s.beforeSize;
      const a = s.afterSize;
      let box = '';
      let bw = '';
      let aw = '';
      if (b && a && b.w && a.w) {
        const k = Math.min(2, COMPARE_WIDTH / Math.max(b.w, a.w));
        box = `;width:${Math.round(Math.max(b.w, a.w) * k)}px;height:${Math.round(Math.max(b.h, a.h) * k)}px`;
        bw = ` style="width:${Math.round(b.w * k)}px"`;
        aw = ` style="width:${Math.round(a.w * k)}px"`;
      }
      return `<div class="ah-compare${box ? ' sized' : ''}" style="--pos:50%${box}">
          <img src="${s.before}" alt="Before"${bw}>
          <div class="after"><img src="${s.after}" alt="After"${aw}></div>
          <span class="tag before">Before</span><span class="tag after">After</span>
          <input type="range" min="0" max="100" value="50" aria-label="Compare before and after" data-compare-range>
        </div>`;
    }
    const ch = changes.get(t.id);
    if (!ch) return '<div class="ah-summary">Checking which files changed…</div>';
    if (!ch.available) return `<div class="ah-summary">${esc(ch.reason || 'Undo is not available for this task.')}</div>`;
    if (!ch.files.length) return '<div class="ah-summary">No files have changed since the agent started.</div>';
    const rows = ch.files.map((f) => {
      const counts = f.additions !== undefined ? ` <span class="ah-muted">+${f.additions} −${f.deletions}</span>` : '';
      const label = f.status === 'added' ? 'delete' : f.status === 'deleted' ? 'restore' : 'revert';
      return `<li><span class="ah-mono">${esc(f.display)}</span>${counts} <span class="ah-muted">· ${label}</span>${f.reported ? '' : ' <span class="ah-warn-text">· not listed by the agent, you may have edited it</span>'}</li>`;
    }).join('');
    return `<div class="ah-undo">
        <div>Undo puts these files back to how they were when the agent started:</div>
        <ul>${rows}</ul>
        <div class="ah-actions" style="justify-content:flex-end"><button class="ah-tbtn" data-act="undo-cancel">Cancel</button><button class="ah-tbtn primary" data-act="undo-confirm" ${busy ? 'disabled' : ''}>Undo ${ch.files.length} file${ch.files.length === 1 ? '' : 's'}</button></div>
      </div>`;
  }

  async function onTaskCardAction(act: string | undefined, t: any) {
    if (!t || !act) return;
    if (act === 'compare' || act === 'undo') {
      if (!api.isTaskCardOpen?.(t.id)) api.openTaskCard(t.id);
      panel = isPanel(t.id, act) ? null : { id: t.id, kind: act };
      api.renderTaskCard?.();
      if (panel?.kind === 'undo') {
        await loadChanges(t.id);
        api.renderTaskCard?.();
      }
      return;
    }
    if (act === 'capture-after') {
      const el = api.elementForTask(t);
      if (!el) { api.toast('That element is not on this page any more'); return; }
      await capture(t.id, el, 'after', true);
      api.renderTaskCard?.();
      return;
    }
    if (act === 'undo-cancel') { panel = null; api.renderTaskCard?.(); return; }
    if (act === 'undo-confirm') {
      const ch = changes.get(t.id);
      if (!ch?.files.length || busy) return;
      busy = true;
      api.renderTaskCard?.();
      try {
        const res = await fetch(BRIDGE + `/api/agent/tasks/${encodeURIComponent(t.id)}/undo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: ch.files.map((f) => f.path) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Undo failed');
        const n = data.restored.length + data.removed.length;
        changes.set(t.id, { ...ch, files: [], undoneAt: new Date().toISOString() });
        panel = null;
        api.toast(data.errors.length ? `Undid ${n} file${n === 1 ? '' : 's'}; ${data.errors.length} could not be restored` : `Undid ${n} file${n === 1 ? '' : 's'}`);
      } catch (err: any) {
        api.toast(err.message || 'Undo failed');
      } finally {
        busy = false;
        api.renderTaskCard?.();
        api.renderSidebar?.('tasks');
      }
    }
  }

  // Comparison images load after the card is placed: re-place it so it stays on screen.
  app.shadow.addEventListener('load', (e) => {
    if ((e.target as Element).closest?.('.ah-compare')) api.requestLayout();
  }, true);

  // Compare slider (delegated; the card re-renders often).
  app.shadow.addEventListener('input', (e) => {
    const range = e.target as HTMLInputElement;
    if (!range.matches?.('[data-compare-range]')) return;
    (range.closest('.ah-compare') as HTMLElement)?.style.setProperty('--pos', range.value + '%');
  });

}
