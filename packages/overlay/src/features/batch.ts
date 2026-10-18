import { placeBox } from '../lib/ui.js';
import { formatBatchRequest } from '../lib/prompt-format.js';
import type { OverlayApp } from '../app/context.js';

export type BatchRole = 'change' | 'reference' | 'keep';

export interface BatchItem {
  id: number;
  stack: any[];
  index: number;
  /** Code name (button#cta), for prompts. */
  label: string;
  /** Plain name (“Book a demo” button), for the Batch tab. */
  name?: string;
  role: BatchRole;
}

/**
 * Batch: collect several elements (B, + Batch, or clicks in Inspect while the Batch tab is open), give each a role, and send them as one task with one goal.
 * Selected items get numbered badges on the page.
 */
export function setupBatch(app: OverlayApp) {
  const { shadow, state, api } = app;
  Object.assign(api, { toggleBatch, isInBatch, isCollecting, removeFromBatch, setBatchRole, moveBatchItem, sendBatch, batchItems: () => state.batch as BatchItem[] });

  const layer = shadow.getElementById('ah-layer-batch') as HTMLElement;
  state.batch = [] as BatchItem[];
  let nextId = 1;

  /** Inspecting with the Batch tab open: a click adds the element to the batch (or takes it out). */
  function isCollecting(): boolean {
    const side = state.side || {};
    return state.mode === 'inspect' && !!side.open && !side.settings && side.tab === 'batch';
  }

  /** Stacks are rebuilt on every click, so items match by what they point at, not by object identity. */
  function sameItem(a: any, b: any): boolean {
    if (a === b) return true;
    if (!a || !b || a.isDomElement !== b.isDomElement) return false;
    if (a.isDomElement) return a.element === b.element;
    return a.name === b.name && !!a.fiber && (a.fiber === b.fiber || a.fiber === b.fiber?.alternate);
  }

  function isInBatch(item: any): boolean {
    return !!item && state.batch.some((b: BatchItem) => sameItem(b.stack[b.index], item));
  }

  function toggleBatch(item: any, stack: any[]) {
    if (!item || !stack) return;
    const existing = state.batch.findIndex((b: BatchItem) => sameItem(b.stack[b.index], item));
    if (existing >= 0) {
      state.batch.splice(existing, 1);
      api.toast('Removed from batch');
    } else {
      state.batch.push({ id: nextId++, stack, index: stack.indexOf(item), label: api.labelFor(item), name: api.nameFor(item), role: 'change' });
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

  /** One prompt: the goal, the elements with roles, each element's context, then sources once per file. */
  async function sendBatch(goal: string, destination: 'agent' | 'copy' = 'agent') {
    const items: BatchItem[] = state.batch;
    if (!items.length) return null;
    const entries: Array<{ facts: any; role: BatchRole }> = [];
    for (const b of items) {
      const built = await api.buildFacts(b.stack, b.index);
      if (built) entries.push({ facts: built.facts, role: b.role });
    }
    if (!entries.length) { api.toast('Those elements are no longer on the page'); return null; }
    const prompt = formatBatchRequest(goal, entries);
    const first = entries[0].facts;
    const result = await api.dispatchToAgent(
      prompt,
      {
        type: 'pinned-stack',
        instruction: goal,
        goal,
        component: first.component?.name,
        file: first.component?.file,
        line: first.component?.startLine,
        selector: first.element.selector,
        label: `${items.length} elements`,
        display: `Batch · ${items.length} elements`,
        pins: entries.map((e) => ({ component: e.facts.component?.name || e.facts.element.label, file: e.facts.component?.file || '', role: e.role === 'change' ? 'TARGET' : e.role === 'reference' ? 'REFERENCE' : 'FROZEN' })),
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
