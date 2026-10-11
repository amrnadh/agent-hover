import { esc, timeAgo } from '../../lib/ui.js';
import { icon } from '../../lib/icon.js';
import { describeTaskStatus, prettyAgentName } from '../../lib/task-status.js';
import type { OverlayApp } from '../../app/context.js';

const TONE: Record<string, string> = { neutral: '', working: 'warn pulse', success: 'ok', error: 'bad' };

/** Tasks, Comments and Batch tabs. */
export function setupListPanels(app: OverlayApp) {
  const { state, api } = app;
  let expanded: string | null = null;
  let commentFilter: 'all' | 'open' | 'resolved' = 'all';
  let batchGoal = '';

  // ---------- Tasks ----------
  api.registerPanel('tasks', {
    render(body: HTMLElement) {
      const tasks: any[] = api.taskList();
      const agent = state.connectedAgents?.[0]?.client;
      if (!tasks.length) {
        body.innerHTML = `<div class="ah-empty"><b>No tasks yet</b>Select an element, choose Ask, and describe the change. Tasks you send show up here with live status.
          ${agent ? `<span>Sending to <b style="font-size:13px">${esc(prettyAgentName(agent))}</b>. Tell it “Listen for agent-hover tasks” once and it picks up each task.</span>` : '<span>No agent connected, so prompts go to your clipboard.</span><button class="ah-tbtn primary" data-act="connect">Connect an agent</button>'}</div>`;
        body.onclick = (e) => { if ((e.target as Element).closest('[data-act=connect]')) api.openSettings('agents'); };
        return;
      }
      const active = tasks.filter((t) => api.isTaskActive(t));
      const done = tasks.filter((t) => !api.isTaskActive(t));
      const row = (t: any) => {
        const view = describeTaskStatus(t, agent);
        const files: string[] = t.result?.filesChanged || [];
        const open = expanded === t.id;
        return `<div class="ah-li" data-id="${esc(t.id)}" role="button" tabindex="0" aria-expanded="${open}">
          <span class="ah-dot ${TONE[view.tone]}"></span><div class="t">${esc(t.instruction || api.taskLabel(t))}</div><span class="time">${esc(timeAgo(t.createdAt))}</span>
          <div class="s"><span class="ah-mono">${esc(api.taskLabel(t))}</span><span>${esc(view.text)}</span></div>
          ${open ? `<div class="more">
            ${view.detail ? `<div class="ah-summary">${esc(view.detail)}</div>` : ''}
            ${files.length ? `<div class="ah-files">${files.map((f) => `<button data-file="${esc(f)}">${icon('file', 14)}${esc(f)}</button>`).join('')}</div>` : ''}
            <div class="ah-actions">
              ${api.elementForTask(t) ? '<button class="ah-tbtn outline" data-act="show">Show on page</button>' : ''}
              ${api.renderTaskVerifyActions ? api.renderTaskVerifyActions(t) : ''}
              ${t.status === 'queued' || t.status === 'delivered' ? '<button class="ah-tbtn outline" data-act="cancel">Cancel</button>' : ''}
            </div></div>` : ''}
        </div>`;
      };
      body.innerHTML = (active.length ? `<div class="ah-group">Active</div><div class="ah-list">${active.map(row).join('')}</div>` : '')
        + (done.length ? `<div class="ah-group">Done</div><div class="ah-list">${done.map(row).join('')}</div>` : '');
      body.onclick = (e) => {
        const li = (e.target as Element).closest('.ah-li') as HTMLElement | null;
        if (!li) return;
        const t = state.tasks.get(li.dataset.id);
        const b = (e.target as Element).closest('button') as HTMLElement | null;
        if (b?.dataset.file) { api.openInEditor({ file: b.dataset.file, line: 1 }); return; }
        if (b?.dataset.act === 'show') {
          const el = api.elementForTask(t);
          el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setTimeout(() => { if (el) { api.selectElement(el); api.openTaskCard(t.id); } }, 350);
          return;
        }
        if (b?.dataset.act === 'cancel') { api.cancelTask(t.id); return; }
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
          const label = el ? api.labelFor({ isDomElement: true, element: el }) : c.component ? `<${c.component} />` : 'Not on this page';
          return `<div class="ah-li" data-id="${esc(c.id)}" role="button" tabindex="0"><span class="ah-dot ${c.resolved ? 'ok' : ''}"></span><div class="t">${esc(c.text)}</div><span class="time">#${list.indexOf(c) + 1}</span><div class="s"><span class="ah-mono">${esc(label)}</span><span>${esc(timeAgo(c.createdAt))}</span></div></div>`;
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
    render(body: HTMLElement) {
      const items: any[] = api.batchItems();
      if (!items.length) {
        body.innerHTML = `<div class="ah-empty"><b>Batch is empty</b>Select elements and press <kbd>B</kbd> (or + Batch in the pill) to collect several pieces of UI into one task, for example “make these three cards consistent”.</div>`;
        return;
      }
      const agent = state.connectedAgents?.[0]?.client;
      body.innerHTML = `<div class="ah-list">${items.map((b, i) => `
          <div class="ah-li" style="cursor:default" data-id="${b.id}">
            <span class="ah-batch-num" style="position:static;box-shadow:none">${i + 1}</span>
            <div class="t ah-mono" style="font-size:12.5px">${esc(b.label)}</div>
            <select class="ah-role" data-role="${b.id}" aria-label="Role for ${esc(b.label)}">
              ${[['change', 'Change'], ['reference', 'Reference'], ['keep', "Don't touch"]].map(([v, l]) => `<option value="${v}" ${b.role === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <div class="s"><button class="ah-tbtn" data-up="${b.id}" ${i ? '' : 'disabled'} style="height:22px;padding:0 6px" aria-label="Move up">${icon('up', 13)}</button><button class="ah-tbtn" data-down="${b.id}" ${i < items.length - 1 ? '' : 'disabled'} style="height:22px;padding:0 6px" aria-label="Move down">${icon('down', 13)}</button><button class="ah-tbtn" data-rm="${b.id}" style="height:22px;padding:0 6px">Remove</button></div>
          </div>`).join('')}</div>
        <div class="ah-field" style="padding-top:14px"><label for="ah-batch-goal">Goal</label><textarea id="ah-batch-goal" rows="3" placeholder="e.g. Make these cards use the same padding and heading size"></textarea></div>
        <div class="ah-actions" style="padding:0 16px 16px"><button class="ah-tbtn outline" data-act="copy">${icon('copy', 14)}Copy</button><button class="ah-tbtn primary" data-act="send" style="margin-left:auto">${icon('send', 14)}${agent ? 'Send to ' + esc(prettyAgentName(agent)) : 'Copy prompt'}</button></div>`;
      const goal = body.querySelector('#ah-batch-goal') as HTMLTextAreaElement;
      goal.value = batchGoal;
      goal.oninput = () => { batchGoal = goal.value; };
      body.onchange = (e) => {
        const s = e.target as HTMLSelectElement;
        if (s.dataset.role) api.setBatchRole(Number(s.dataset.role), s.value);
      };
      body.onclick = async (e) => {
        const b = (e.target as Element).closest('button') as HTMLElement | null;
        if (!b) return;
        if (b.dataset.rm) api.removeFromBatch(Number(b.dataset.rm));
        if (b.dataset.up) api.moveBatchItem(Number(b.dataset.up), -1);
        if (b.dataset.down) api.moveBatchItem(Number(b.dataset.down), 1);
        if (b.dataset.act === 'copy' || b.dataset.act === 'send') {
          const text = goal.value.trim();
          if (!text) { goal.placeholder = 'Describe the goal first'; goal.focus(); return; }
          const result = await api.sendBatch(text, b.dataset.act === 'copy' || !agent ? 'copy' : 'agent');
          if (result?.task) { batchGoal = ''; api.openSidebar('tasks'); }
        }
      };
    },
  });
}
