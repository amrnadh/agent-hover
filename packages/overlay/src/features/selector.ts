import { buildHierarchyStack, getComponentBoundingRect, getComponentInfo } from '../lib/fiber.js';
import { CaptureLayer } from '../ui/capture-layer.js';
import { placeBox } from '../lib/ui.js';
import { cursorCss, type CursorKind } from '../lib/cursor.js';
import type { OverlayApp } from '../app/context.js';

export type Mode = 'inspect' | 'comment' | null;

export interface Rect { top: number; left: number; width: number; height: number; }

/** A source location for a stack item (React 18 `_debugSource`, or resolved through the bridge for React 19). */
export interface SourceRef { file: string; line: number; component: string; }

/**
 * The on-page selector: Inspect / Comment modes, hover outline + label, selection frame, the component
 * hierarchy (↑ parent, ↓ child), distances while ⌘/Ctrl is held, selection-change hooks, and one shared
 * layout loop that every floating surface hooks into so they follow scroll and resize together.
 */
export function setupSelector(app: OverlayApp) {
  const { shadow, state, api } = app;
  Object.assign(api, {
    setMode, renderCursor, select, selectElement, selectIndex, deselect, describe, labelFor, selectionRect, rectOf,
    sourceFor, ownerOf, projectOwner, isFrozen, onLayout, requestLayout, insets, onSelectionChange, findComponentElement,
  });

  const hoverBox = shadow.getElementById('ah-hover') as HTMLElement;
  const hoverLabel = shadow.getElementById('ah-hover-label') as HTMLElement;
  const frame = shadow.getElementById('ah-sel-frame') as HTMLElement;
  const measureLayer = shadow.getElementById('ah-layer-measure') as HTMLElement;
  const layoutHooks: Array<() => void> = [];
  const selectionHooks: Array<(changed: boolean) => void> = [];
  let hoverEl: Element | null = null;
  let hoverStack: any[] = [];

  state.mode = null as Mode;
  state.currentStack = [];
  state.currentStackIndex = -1;
  state.selectedTarget = null;
  state.selectedElement = null;

  // ---------- describe ----------
  function labelFor(item: any): string {
    if (!item) return '';
    if (!item.isDomElement) return `<${item.name} />`;
    const el = item.element as Element;
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id}`;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
    return cls ? `${tag}.${cls}` : tag;
  }

  function rectOf(item: any): Rect | null {
    if (!item) return null;
    if (item.isDomElement) {
      const el = item.element as Element;
      return el && el.isConnected ? el.getBoundingClientRect() : null;
    }
    return item.fiber ? getComponentBoundingRect(item.fiber) : null;
  }

  /** Nearest component at or above `index` in `stack` (the element's owner). */
  function ownerOf(stack: any[], index: number): any | null {
    for (let i = Math.max(0, index); i < stack.length; i++) if (!stack[i].isDomElement) return stack[i];
    return null;
  }

  /** Resolve one component to a project source file (cached on the item; null when it is not in the project). */
  async function resolveItem(stack: any[], item: any): Promise<SourceRef | null> {
    if (item._resolved !== undefined) return item._resolved;
    let ref: SourceRef | null = null;
    if (item.source?.fileName && !item.source.fileName.includes('node_modules')) {
      ref = { file: item.source.fileName, line: item.source.lineNumber, component: item.name };
    } else {
      const prev = state.currentStack;
      state.currentStack = stack; // resolveComponent reads ancestors from the current stack
      try {
        const r = await api.resolveComponent(item);
        if (r) ref = { file: r.file, line: r.line, component: item.name };
      } catch {}
      state.currentStack = prev;
    }
    item._resolved = ref;
    return ref;
  }

  /**
   * Source for the element: the nearest component at or above `index` that lives in the project.
   * Library wrappers (motion.div, providers, router links) have no project file and are skipped.
   */
  async function sourceFor(stack: any[], index: number): Promise<SourceRef | null> {
    let tries = 0;
    for (let i = Math.max(0, index); i < stack.length && tries < 6; i++) {
      if (stack[i].isDomElement) continue;
      tries++;
      const ref = await resolveItem(stack, stack[i]);
      if (ref) return ref;
    }
    return null;
  }

  /** The stack item for a resolved source (the component whose props and frozen state matter). */
  function projectOwner(stack: any[], index: number): any | null {
    for (let i = Math.max(0, index); i < stack.length; i++) {
      if (!stack[i].isDomElement && stack[i]._resolved) return stack[i];
    }
    return ownerOf(stack, index);
  }

  function describe(stack: any[], index: number) {
    const item = stack[index];
    const owner = ownerOf(stack, index);
    return { item, label: labelFor(item), owner, componentName: owner?.name || '' };
  }

  function isFrozen(componentName: string, file?: string): boolean {
    return (state.frozenEntries || []).some((f: any) => f.component === componentName && (!file || !f.file || file.endsWith(f.file) || f.file.endsWith(file)));
  }

  // ---------- modes ----------
  function setMode(mode: Mode) {
    state.mode = state.mode === mode ? null : mode;
    state.captureLayer?.setActive(!!state.mode);
    if (!state.mode) hideHover();
    renderCursor();
    api.renderDock?.();
    if (state.mode === 'comment') api.toast?.('Click anywhere on the page to leave a comment');
  }

  /** The page cursor says what a click does: select, comment, or (Batch tab open) add to the batch. */
  function renderCursor() {
    const layer = shadow.getElementById('ah-capture-layer');
    if (!layer || !state.mode) return;
    const kind: CursorKind = state.mode === 'comment' ? 'comment' : api.isCollecting?.() ? 'batch' : 'inspect';
    if (layer.dataset.cursor === kind) return;
    layer.dataset.cursor = kind;
    layer.style.cursor = cursorCss(kind);
  }

  // ---------- hover ----------
  function hideHover() {
    hoverBox.hidden = true;
    hoverLabel.hidden = true;
    measureLayer.innerHTML = '';
    hoverEl = null;
  }

  /** Which stack index a click/hover on `el` should mean: the component when `el` is its root node. */
  function preferredIndex(stack: any[]): number {
    if (stack.length > 1 && !stack[1].isDomElement) {
      const a = stack[0].element.getBoundingClientRect();
      const b = getComponentBoundingRect(stack[1].fiber);
      if (b && Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1) return 1;
    }
    return 0;
  }

  function onHover(el: Element | null, e: MouseEvent) {
    if (!state.mode || !el || el === document.body || el === document.documentElement) { hideHover(); return; }
    if (el !== hoverEl) {
      hoverEl = el;
      hoverStack = buildHierarchyStack(el);
    }
    const idx = preferredIndex(hoverStack);
    const item = hoverStack[idx];
    const r = rectOf(item);
    if (!r) { hideHover(); return; }
    const isSelected = state.selectedTarget && (state.selectedTarget === item || (state.selectedTarget.isDomElement === item.isDomElement && state.selectedTarget.element === item.element && state.selectedTarget.name === item.name));
    if (isSelected) {
      hoverBox.hidden = true;
      hoverLabel.hidden = true;
    } else {
      const owner = projectOwner(hoverStack, idx);
      const frozen = !!owner && isFrozen(owner.name);
      placeBox(hoverBox, r);
      hoverBox.classList.toggle('frozen', frozen);
      hoverBox.hidden = false;
      hoverLabel.classList.toggle('frozen', frozen);
      hoverLabel.textContent = (frozen ? 'Locked · ' : '') + labelFor(item);
      const dims = document.createElement('span');
      dims.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
      hoverLabel.appendChild(dims);
      hoverLabel.hidden = false;
      hoverLabel.style.left = Math.max(4, Math.min(r.left, window.innerWidth - hoverLabel.offsetWidth - 4)) + 'px';
      hoverLabel.style.top = (r.top > 26 ? r.top - 22 : r.top + r.height + 4) + 'px';
    }
    drawMeasure(e, r, isSelected);
  }

  // ---------- measure (hold ⌘/Ctrl) ----------
  function drawMeasure(e: MouseEvent, b: Rect, sameAsSelected: boolean) {
    measureLayer.innerHTML = '';
    if (!(e.metaKey || e.ctrlKey) || !state.selectedTarget || sameAsSelected) return;
    const a = selectionRect();
    if (!a) return;
    const add = (x: number, y: number, w: number, h: number, value: number, cx: number, cy: number) => {
      const line = document.createElement('div');
      line.className = 'ah-measure-line';
      Object.assign(line.style, { left: x + 'px', top: y + 'px', width: Math.max(1, w) + 'px', height: Math.max(1, h) + 'px' });
      const pill = document.createElement('div');
      pill.className = 'ah-measure-pill';
      pill.textContent = Math.round(value) + 'px';
      Object.assign(pill.style, { left: cx + 'px', top: cy + 'px' });
      measureLayer.append(line, pill);
    };
    const aB = a.top + a.height, bB = b.top + b.height, aR = a.left + a.width, bR = b.left + b.width;
    const midX = (Math.max(a.left, b.left) + Math.min(aR, bR)) / 2;
    const midY = (Math.max(a.top, b.top) + Math.min(aB, bB)) / 2;
    if (b.top >= aB) add(midX, aB, 1, b.top - aB, b.top - aB, midX, (aB + b.top) / 2);
    else if (a.top >= bB) add(midX, bB, 1, a.top - bB, a.top - bB, midX, (bB + a.top) / 2);
    if (b.left >= aR) add(aR, midY, b.left - aR, 1, b.left - aR, (aR + b.left) / 2, midY);
    else if (a.left >= bR) add(bR, midY, a.left - bR, 1, a.left - bR, (bR + a.left) / 2, midY);
  }
  window.addEventListener('keyup', (e) => { if (e.key === 'Meta' || e.key === 'Control') measureLayer.innerHTML = ''; });

  // ---------- selection ----------
  function onClick(el: Element, e: MouseEvent) {
    if (!el || el === document.body || el === document.documentElement) return;
    if (state.mode === 'comment') { api.addCommentAt?.(el, e.clientX, e.clientY); return; }
    const stack = el === hoverEl && hoverStack.length ? hoverStack : buildHierarchyStack(el);
    select(stack, preferredIndex(stack));
    if (api.isCollecting?.()) api.toggleBatch(state.selectedTarget, state.currentStack);
  }

  /** Select `stack[index]`. Surfaces that follow the selection subscribe with `api.onSelectionChange`. */
  function select(stack: any[], index: number) {
    if (!stack.length) return;
    const item = stack[Math.max(0, Math.min(index, stack.length - 1))];
    const changed = item !== state.selectedTarget;
    state.currentStack = stack;
    state.currentStackIndex = stack.indexOf(item);
    state.selectedTarget = item;
    state.selectedElement = item.element;
    if (changed) {
      // Context cached for the previous selection must never leak into Send/Copy.
      state.lastCopiedContext = null;
      state.lastResolved = null;
      state.lastComputedStyles = null;
    }
    hoverBox.hidden = true;
    hoverLabel.hidden = true;
    emitSelection(changed);
    requestLayout();
  }

  function selectElement(el: Element) {
    const stack = buildHierarchyStack(el);
    select(stack, preferredIndex(stack));
  }

  function selectIndex(index: number) {
    if (!state.currentStack.length || index < 0 || index >= state.currentStack.length) return;
    select(state.currentStack, index);
  }

  function deselect() {
    if (!state.selectedTarget) return;
    state.selectedTarget = null;
    state.selectedElement = null;
    state.currentStackIndex = -1;
    measureLayer.innerHTML = '';
    emitSelection(true);
    requestLayout();
  }

  function selectionRect(): Rect | null {
    return rectOf(state.selectedTarget);
  }

  /** Subscribe to selection changes; `changed` is false when the same item was re-selected. */
  function onSelectionChange(fn: (changed: boolean) => void) {
    selectionHooks.push(fn);
  }

  function emitSelection(changed: boolean) {
    for (const fn of selectionHooks) {
      try { fn(changed); } catch (err) { console.warn('[agent-hover] selection', err); }
    }
  }

  // ---------- layout loop ----------
  function onLayout(fn: () => void) {
    layoutHooks.push(fn);
  }

  function layoutSelection() {
    const r = selectionRect();
    if (!r || (r.width === 0 && r.height === 0)) { frame.hidden = true; return; }
    placeBox(frame, r, 1);
    const owner = projectOwner(state.currentStack, state.currentStackIndex);
    frame.classList.toggle('frozen', !!owner && isFrozen(owner.name));
    frame.hidden = false;
  }

  let raf = 0;
  function requestLayout() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      layoutSelection();
      for (const fn of layoutHooks) {
        try { fn(); } catch (err) { console.warn('[agent-hover] layout', err); }
      }
    });
  }
  window.addEventListener('scroll', () => { if (hoverEl) hideHover(); requestLayout(); }, { capture: true, passive: true });
  // The pill, cards, dock, sidebar, task markers and comment pins sit above the capture layer, so moving onto
  // them never updates the hover; clear it so no stale outline stays on the page behind them.
  shadow.addEventListener('pointerover', (e) => {
    if (hoverEl && (e.target as Element).closest?.('.ah-surface, #ah-side, .ah-marker, .ah-cpin')) hideHover();
  });
  window.addEventListener('resize', requestLayout, { passive: true });

  /** Space taken by the docked sidebar (right) and the dock when it sits at the bottom. */
  function insets() {
    const side = shadow.getElementById('ah-side') as HTMLElement;
    const right = side && !side.hidden && !side.classList.contains('float') && window.innerWidth > 560 ? side.offsetWidth : 0;
    const dock = shadow.getElementById('ah-dock') as HTMLElement;
    let bottom = 0;
    if (dock && !dock.hidden) {
      const d = dock.getBoundingClientRect();
      if (d.top > window.innerHeight * (2 / 3)) bottom = window.innerHeight - d.top + 4;
    }
    return { right, bottom };
  }

  /** First mounted element rendered by a component with this name (used by MCP screenshot requests). */
  function findComponentElement(componentName: string): Element | null {
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.id === 'agent-hover-root') continue;
      const info: any = getComponentInfo(el);
      if (info && info.name === componentName) return el;
    }
    return null;
  }

  // ---------- capture layer ----------
  const layerEl = shadow.getElementById('ah-capture-layer');
  if (layerEl) {
    state.captureLayer = new CaptureLayer(layerEl as HTMLElement, {
      shadowRoot: shadow,
      onHover: (el, e) => onHover(el, e),
      onSelect: (el, e) => onClick(el, e),
    });
  }
}
