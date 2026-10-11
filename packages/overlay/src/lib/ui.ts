import { calculatePopoverPosition, type Rect } from './popover-position.js';

/** Escape text for innerHTML. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function pressed(el: Element | null | undefined, on: boolean) {
  el?.setAttribute('aria-pressed', on ? 'true' : 'false');
}

export interface Insets {
  right: number;
  bottom: number;
}

/**
 * Show `node` next to `target` without covering it (below, above, right, left), clear of the docked sidebar
 * and the dock. Uses the shared placement rules in popover-position.ts.
 */
export function anchorTo(node: HTMLElement, target: Rect, insets: Insets, gap = 8) {
  node.hidden = false;
  const pos = calculatePopoverPosition(
    target,
    { width: node.offsetWidth, height: node.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight, rightInset: insets.right, bottomInset: insets.bottom },
    12,
    gap,
  );
  node.style.left = Math.round(pos.left) + 'px';
  node.style.top = Math.round(pos.top) + 'px';
  node.dataset.placement = pos.placement;
}

/** Place a fixed box over a rect. */
export function placeBox(node: HTMLElement, r: { left: number; top: number; width: number; height: number }, pad = 0) {
  node.style.left = r.left - pad + 'px';
  node.style.top = r.top - pad + 'px';
  node.style.width = r.width + pad * 2 + 'px';
  node.style.height = r.height + pad * 2 + 'px';
}

/** "just now", "4m ago", "2h ago", "3d ago". */
export function timeAgo(iso: string | number): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}

/** Stable-enough CSS selector for re-finding an element after a reload (max 6 levels, stops at an id). */
export { buildCSSSelector } from './dom.js';

export function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
