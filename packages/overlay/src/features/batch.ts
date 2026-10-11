import { placeBox } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

export type BatchRole = 'change' | 'reference' | 'keep';

export interface BatchItem {
  id: number;
  stack: any[];
  index: number;
  label: string;
  role: BatchRole;
}

const ROLE_TEXT: Record<BatchRole, string> = {
  change: 'Change this',
  reference: 'Reference only: read for context, do not modify',
  keep: "Don't touch: must not be modified",
};

/**
 * Batch: collect several elements (B or + Batch), give each a role, and send them as one task with one goal.
 * Selected items get numbered badges on the page.
 */
export function setupBatch(app: OverlayApp) {
  const { shadow, state, api } = app;
  Object.assign(api, { toggleBatch, isInBatch, removeFromBatch, setBatchRole, moveBatchItem, sendBatch, batchItems: () => state.batch as BatchItem[] });

  const layer = shadow.getElementById('ah-layer-batch') as HTMLElement;
  state.batch = [] as BatchItem[];
  let nextId = 1;

  function isInBatch(item: any): boolean {
    return !!item && state.batch.some((b: BatchItem) => b.stack[b.index] === item);
  }

  function toggleBatch(item: any, stack: any[]) {
    if (!item || !stack) return;
    const existing = state.batch.findIndex((b: BatchItem) => b.stack[b.index] === item);
    if (existing >= 0) {
      state.batch.splice(existing, 1);
      api.toast('Removed from batch');
    } else {
      state.batch.push({ id: nextId++, stack, index: stack.indexOf(item), label: api.labelFor(item), role: 'change' });
      api.toast(`Added to batch · ${state.batch.length}`, { action: 'Open', onAction: () => api.openSidebar('batch') });
    }
    changed();
  }

  function removeFromBatch(id: number) {
    state.batch = state.batch.filter((b: BatchItem) => b.id !== id);
    changed();
  }

  function setBatchRole(id: number, role: BatchRole) {
    const b = state.batch.find((x: BatchItem) => x.id === id);
    if (b) b.role = role;
  }

  function moveBatchItem(id: number, delta: number) {
    const i = state.batch.findIndex((b: BatchItem) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= state.batch.length) return;
    const [b] = state.batch.splice(i, 1);
    state.batch.splice(j, 0, b);
    changed();
  }

  function changed() {
    const pillBtn = shadow.getElementById('ah-pill-batch');
    pillBtn?.setAttribute('aria-pressed', String(isInBatch(state.selectedTarget)));
    api.renderDock?.();
    api.renderSidebar?.('batch');
    api.requestLayout();
  }

  function renderMarks() {
    layer.innerHTML = '';
    state.batch.forEach((b: BatchItem, i: number) => {
      const item = b.stack[b.index];
      const r = api.rectOf(item);
      if (!r || (r.width === 0 && r.height === 0)) return;
      if (item !== state.selectedTarget) {
        const o = document.createElement('div');
        o.className = 'ah-batch-outline';
        placeBox(o, r, 1);
        layer.appendChild(o);
      }
      const n = document.createElement('div');
      n.className = 'ah-batch-num';
      n.textContent = String(i + 1);
      n.style.left = r.left - 9 + 'px';
      n.style.top = r.top - 9 + 'px';
      layer.appendChild(n);
    });
  }
  api.onLayout(renderMarks);

  /** One prompt: the goal, the list with roles, then each element's context. */
  async function sendBatch(goal: string, destination: 'agent' | 'copy' = 'agent') {
    const items: BatchItem[] = state.batch;
    if (!items.length) return null;
    const built: any[] = [];
    for (const b of items) built.push(await api.buildPrompt(b.stack, b.index, b.role === 'change' ? goal : ''));
    const list = items.map((b, i) => `${i + 1}. ${b.label}${built[i]?.file ? ` (${built[i].file}${built[i].line ? ':' + built[i].line : ''})` : ''}: ${ROLE_TEXT[b.role]}`).join('\n');
    const prompt = `# Batch task\n\n**Goal**: ${goal}\n\n## Elements\n${list}\n\n` + items
      .map((b, i) => `---\n\n## ${i + 1}. ${b.label} · ${ROLE_TEXT[b.role]}\n\n${built[i]?.prompt || ''}`)
      .join('\n\n');
    const first = built.find(Boolean);
    const result = await api.dispatchToAgent(
      prompt,
      {
        type: 'pinned-stack',
        instruction: goal,
        goal,
        component: first?.component,
        file: first?.file,
        line: first?.line,
        selector: first?.selector,
        label: `${items.length} elements`,
        pins: items.map((b, i) => ({ component: built[i]?.component || b.label, file: built[i]?.file || '', role: b.role === 'change' ? 'TARGET' : b.role === 'reference' ? 'REFERENCE' : 'FROZEN' })),
      },
      { quiet: true, destination },
    );
    if (result.task) {
      api.trackTask(result.task, items[0].stack[items[0].index]?.element);
      state.batch = [];
      changed();
      api.toast(`Sent batch of ${items.length} to your agent`, { action: 'View', onAction: () => api.openTaskCard(result.task.id) });
    } else {
      api.toast(result.copied ? `Copied ${items.length} elements as one prompt` : 'Clipboard blocked by the browser');
    }
    return result;
  }
}
