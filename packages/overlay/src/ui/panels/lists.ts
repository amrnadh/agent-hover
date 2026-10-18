import { esc, timeAgo } from '../../lib/ui.js';
import { icon } from '../../lib/icon.js';
import { describeTaskStatus, prettyAgentName } from '../../lib/task-status.js';
import { needsReview, reviewText } from '../../lib/review.js';
import type { OverlayApp } from '../../app/context.js';

const TONE: Record<string, string> = { neutral: '', working: 'warn pulse', success: 'ok', error: 'bad' };

/** Tasks, Comments and Batch tabs. */
export function setupListPanels(app: OverlayApp) {
  const { state, api } = app;
  let expanded: string | null = null;
  let commentFilter: 'all' | 'open' | 'resolved' = 'all';
  let batchGoal = '';
  let taskFilter: 'all' | 'review' | 'active' | 'done' = 'all';
  let confirmClear = false;
  let confirmRemove: string | null = null;

  // ---------- Tasks ----------
  api.registerPanel('tasks', {
    render(body: HTMLElement) {
      const tasks: any[] = api.taskList();
      const agent = state.connectedAgents?.[0]?.client;
      if (!tasks.length) {
        body.innerHTML = `<div class="ah-empty"><b>No tasks yet</b>Select an element, choose Ask, and describe the change. Tasks you send show up here with live status.
          ${agent ? `<span>Sending to <b style="font-size:13px">${esc(prettyAgentName(agent))}</b>. Run /agent-hover in it (or say “Listen for agent-hover tasks”) and it picks up each task.</span>` : '<span>No agent connected, so prompts go to your clipboard.</span><button class="ah-tbtn primary" data-act="connect">Connect an agent</button>'}</div>`;
        body.onclick = (e) => { if ((e.target as Element).closest('[data-act=connect]')) api.openSettings('agents'); };
        return;
      }
      const active = tasks.filter((t) => api.isTaskActive(t));
      const review = tasks.filter((t) => needsReview(t));
      const done = tasks.filter((t) => !api.isTaskActive(t) && !needsReview(t));
      const clearable = done.length;
      const row = (t: any) => {
        const view = describeTaskStatus(t, agent);
        const files: string[] = t.result?.filesChanged || [];
        const status = t.review ? `${view.text} · ${reviewText(t)}` : view.text;
        const open = expanded === t.id;
        const decide = api.renderReviewActions(t, 'decide');
        const more = api.renderReviewActions(t, 'more');
        return `<div class="ah-li task" data-id="${esc(t.id)}" role="button" tabindex="0" aria-expanded="${open}">
          <span class="ah-dot ${TONE[view.tone]}"></span><div class="t">${esc(t.instruction || api.taskLabel(t))}</div>
          <span class="end"><span class="time">${esc(timeAgo(t.createdAt))}</span>${api.isRemovable(t) ? `<button class="ah-ibtn rm" data-act="remove" title="Remove from list" aria-label="Remove from list">${icon('trash', 14)}</button>` : ''}</span>
          <div class="s"><span>${esc(api.taskLabel(t))}</span><span>${esc(status)}</span></div>
          ${open ? `<div class="more">
            ${view.detail ? `<div class="ah-summary">${esc(view.detail)}</div>` : ''}
            ${files.length ? `<div class="ah-files">${files.map((f) => `<button data-file="${esc(f)}">${icon('file', 14)}<span>${esc(f)}</span></button>`).join('')}</div>` : ''}
            ${decide ? `<div class="ah-actions">${decide}</div>` : ''}
            <div class="ah-actions tight">
              ${more}
              ${api.elementForTask(t) ? `<button class="ah-tbtn quiet" data-act="show">${icon('target', 14)}Show on page</button>` : ''}
              ${t.status === 'queued' || t.status === 'delivered' ? '<button class="ah-tbtn outline" data-act="cancel">Cancel task</button>' : ''}
            </div></div>` : ''}
        </div>`;
      };
      const shown = taskFilter === 'review' ? review : taskFilter === 'active' ? active : taskFilter === 'done' ? done : null;
      const counts: Record<string, number> = { all: tasks.length, review: review.length, active: active.length, done: done.length };
      const bar = `<div class="ah-filters">
          <div class="ah-seg" role="radiogroup" aria-label="Show">${([['all', 'All'], ['review', 'To review'], ['active', 'Active'], ['done', 'Done']] as const).map(([v, l]) => `<button data-filter="${v}" aria-pressed="${taskFilter === v}">${l}${counts[v] && v !== 'all' ? ` <span class="n">${counts[v]}</span>` : ''}</button>`).join('')}</div>
          <button class="ah-tbtn quiet" data-act="clear" style="margin-left:auto" ${clearable ? '' : 'disabled'} title="Remove finished tasks that have nothing left to decide">${confirmClear ? `Clear ${clearable}?` : 'Clear finished'}</button>
          ${confirmClear ? '<button class="ah-tbtn primary" data-act="clear-yes">Clear</button>' : ''}
        </div>`;
      const group = (title: string, list: any[]) => (list.length ? `<div class="ah-group">${title}</div><div class="ah-list">${list.map(row).join('')}</div>` : '');
      body.innerHTML = bar + (shown
        ? (shown.length ? `<div class="ah-list">${shown.map(row).join('')}</div>` : '<div class="ah-empty">Nothing here.</div>')
        : group('To review', review) + group('Active', active) + group('Done', done));
      body.onclick = (e) => {
        const f = (e.target as Element).closest('[data-filter]') as HTMLElement | null;
        if (f) { taskFilter = f.dataset.filter as any; confirmClear = false; api.renderSidebar('tasks'); return; }
        const top = (e.target as Element).closest('[data-act=clear], [data-act=clear-yes]') as HTMLElement | null;
        if (top?.dataset.act === 'clear') { confirmClear = !confirmClear; api.renderSidebar('tasks'); return; }
        if (top?.dataset.act === 'clear-yes') { confirmClear = false; api.clearFinished(); return; }
        const li = (e.target as Element).closest('.ah-li') as HTMLElement | null;
        if (!li) return;
        const t = state.tasks.get(li.dataset.id);
        const b = (e.target as Element).closest('button') as HTMLElement | null;
        if (b?.dataset.file) { api.openInEditor({ file: b.dataset.file, line: 1 }); return; }
        if (b?.dataset.act === 'remove') {
          // A change you haven't kept or undone loses its Undo when removed: ask once, on the row.
          if (needsReview(t) && t.checkpointId && confirmRemove !== t.id) { confirmRemove = t.id; b.classList.add('confirm'); b.title = "Click again to remove. Undo won't be possible"; api.toast("Click again to remove. Undo won't be possible for this change"); return; }
          confirmRemove = null;
          api.removeTasks([t.id]);
          return;
        }
        if (b?.dataset.act === 'show') {
          const el = api.elementForTask(t);
          el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setTimeout(() => { if (el) { api.selectElement(el); api.openTaskCard(t.id); } }, 350);
          return;
        }
        if (b?.dataset.act === 'cancel') { api.cancelTask(t.id); return; }
        if (b?.dataset.act === 'keep') { api.reviewTask(t.id, 'keep'); return; }
        if (b?.dataset.act === 'follow-up') { api.followUpTask(t); return; }
        if (b) { api.onTaskCardAction?.(b.dataset.act, t); return; }
        if ((e.target as Element).closest('.more')) return;
        expanded = expanded === t.id ? null : t.id;
        api.renderSidebar('tasks');
      };
    },
  });

  // ---------- Comments ----------
  api.registerPanel('comments', {
    render(body: HTMLElement) {
      const list: any[] = api.commentList();
      if (!list.length) {
        body.innerHTML = `<div class="ah-empty"><b>No comments yet</b>Press <kbd>C</kbd> or the comment button in the dock, then click anywhere on the page to leave a note. Send them to your agent one at a time or all at once.</div>`;
        return;
      }
      const open = list.filter((c) => !c.resolved);
      const shown = list.filter((c) => commentFilter === 'all' || (commentFilter === 'open' ? !c.resolved : c.resolved));
      body.innerHTML = `<div class="ah-filters">
          <div class="ah-seg" role="radiogroup" aria-label="Filter">${(['all', 'open', 'resolved'] as const).map((v) => `<button data-filter="${v}" aria-pressed="${commentFilter === v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
          <button class="ah-tbtn outline" data-act="send-all" style="margin-left:auto" ${open.length ? '' : 'disabled'}>${icon('send', 14)}Send ${open.length || ''} open</button>
        </div>
        <div class="ah-list">${shown.map((c) => {
          const el = api.commentElement(c);
          const label = el ? api.nameFor({ isDomElement: true, element: el }) : c.component ? `<${c.component} />` : 'Not on this page';
          return `<div class="ah-li" data-id="${esc(c.id)}" role="button" tabindex="0"><span class="ah-dot ${c.resolved ? 'ok' : ''}"></span><div class="t">${esc(c.text)}</div><span class="ah-cnum" aria-label="Comment ${list.indexOf(c) + 1}">${list.indexOf(c) + 1}</span><div class="s"><span>${esc(label)}</span><span>${esc(timeAgo(c.createdAt))}</span></div></div>`;
        }).join('') || '<div class="ah-empty">Nothing here.</div>'}</div>`;
      body.onclick = (e) => {
        const f = (e.target as Element).closest('[data-filter]') as HTMLElement | null;
        if (f) { commentFilter = f.dataset.filter as any; api.renderSidebar('comments'); return; }
        if ((e.target as Element).closest('[data-act=send-all]')) { api.sendComments(open); return; }
        const li = (e.target as Element).closest('.ah-li') as HTMLElement | null;
        if (!li) return;
        const c = list.find((x) => x.id === li.dataset.id);
        const el = c && api.commentElement(c);
        if (!el) { api.toast('That element is not on this page'); return; }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => api.openComment(c.id), 350);
      };
    },
  });

  // ---------- Batch ----------
  api.registerPanel('batch', {
    render(body: HTMLElement, foot: HTMLElement) {
      const items: any[] = api.batchItems();
      if (!items.length) {
        body.innerHTML = `<div class="ah-empty"><b>Batch is empty</b>Select elements and press <kbd>B</kbd> (or + Batch in the pill), or click them in Inspect while this tab is open, to collect several pieces of UI into one task, for example “make these three cards consistent”.</div>`;
        return;
      }
      const dest = api.destination?.() || { kind: 'copy' };
      const roles = [['change', 'Change'], ['reference', 'Reference'], ['keep', "Don't touch"]];
      body.innerHTML = `<p class="ah-hint-line">${items.length} element${items.length === 1 ? '' : 's'} · say what each one is for, then describe the goal.</p>
        <div class="ah-bitems">${items.map((b, i) => `
          <div class="ah-bitem" data-id="${b.id}">
            <span class="ah-batch-num" style="position:static;box-shadow:none">${i + 1}</span>
            <div class="who"><div class="t">${esc(b.name || b.label)}</div>${b.name ? `<div class="s ah-mono">${esc(b.label)}</div>` : ''}</div>
            <span class="tools">
              <button class="ah-ibtn" data-up="${b.id}" ${i ? '' : 'disabled'} aria-label="Move up">${icon('up', 14)}</button>
              <button class="ah-ibtn" data-down="${b.id}" ${i < items.length - 1 ? '' : 'disabled'} aria-label="Move down">${icon('down', 14)}</button>
              <button class="ah-ibtn rm" data-rm="${b.id}" aria-label="Remove from batch">${icon('x', 14)}</button>
            </span>
            <div class="ah-seg ah-roles" role="radiogroup" aria-label="Role for ${esc(b.name || b.label)}">${roles.map(([v, l]) => `<button data-role="${b.id}" data-v="${v}" aria-pressed="${b.role === v}">${l}</button>`).join('')}</div>
          </div>`).join('')}</div>`;
      foot.hidden = false;
      foot.classList.add('batch');
      foot.innerHTML = `<div class="ah-field" style="padding:0"><label for="ah-batch-goal">Goal</label><textarea id="ah-batch-goal" rows="2" placeholder="e.g. Make these cards use the same padding and heading size"></textarea></div>
        <div class="ah-actions"><button class="ah-tbtn quiet" data-act="copy">${icon('copy', 14)}Copy prompt</button><span class="grow"></span><button class="ah-tbtn primary" data-act="send">${icon('send', 14)}${dest.kind === 'agent' ? 'Send to ' + esc(prettyAgentName(dest.client)) : 'Copy prompt'}</button></div>`;
      const goal = foot.querySelector('#ah-batch-goal') as HTMLTextAreaElement;
      goal.value = batchGoal;
      goal.oninput = () => { batchGoal = goal.value; };
      goal.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); (foot.querySelector('[data-act=send]') as HTMLElement).click(); } };
      body.onclick = (e) => {
        const b = (e.target as Element).closest('button') as HTMLElement | null;
        if (!b) return;
        if (b.dataset.role) { api.setBatchRole(Number(b.dataset.role), b.dataset.v); api.renderSidebar('batch'); return; }
        if (b.dataset.rm) api.removeFromBatch(Number(b.dataset.rm));
        if (b.dataset.up) api.moveBatchItem(Number(b.dataset.up), -1);
        if (b.dataset.down) api.moveBatchItem(Number(b.dataset.down), 1);
      };
      foot.onclick = async (e) => {
        const b = (e.target as Element).closest('button') as HTMLElement | null;
        if (!b || (b.dataset.act !== 'copy' && b.dataset.act !== 'send')) return;
        const text = goal.value.trim();
        if (!text) { goal.placeholder = 'Describe the goal first'; goal.classList.add('invalid'); goal.focus(); return; }
        const result = await api.sendBatch(text, b.dataset.act === 'copy' || dest.kind !== 'agent' ? 'copy' : 'agent');
        if (result?.task) { batchGoal = ''; api.openSidebar('tasks'); }
      };
    },
  });
}
