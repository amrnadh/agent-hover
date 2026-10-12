export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Space taken on the right by a docked sidebar; the popover stays left of it. */
  rightInset?: number;
  /** Space taken at the bottom (e.g. the dock); the popover stays above it. */
  bottomInset?: number;
}

export type Placement = 'bottom' | 'top' | 'right' | 'left' | 'fallback';

export interface PopoverPosition {
  top: number;
  left: number;
  placement: Placement;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Place a popover next to a target without covering it (UX principle 1, spec P2-07).
 * Tries bottom → top → right → left; each side must fit entirely inside the viewport (minus `margin`).
 * When no side fits (the target fills the screen), it docks to the viewport's bottom edge.
 */
export function calculatePopoverPosition(
  target: Rect,
  size: { width: number; height: number },
  viewport: Viewport,
  margin = 12,
  gap = 8,
): PopoverPosition {
  const right = viewport.width - (viewport.rightInset ?? 0) - margin;
  const bottom = viewport.height - (viewport.bottomInset ?? 0) - margin;
  const minLeft = margin;
  const minTop = margin;
  const alignedLeft = clamp(target.left, minLeft, right - size.width);
  const alignedTop = clamp(target.top, minTop, bottom - size.height);

  const below = target.top + target.height + gap;
  if (below + size.height <= bottom) return { top: below, left: alignedLeft, placement: 'bottom' };

  const above = target.top - gap - size.height;
  if (above >= minTop) return { top: above, left: alignedLeft, placement: 'top' };

  const toRight = target.left + target.width + gap;
  if (toRight + size.width <= right) return { top: alignedTop, left: toRight, placement: 'right' };

  const toLeft = target.left - gap - size.width;
  if (toLeft >= minLeft) return { top: alignedTop, left: toLeft, placement: 'left' };

  return { top: bottom - size.height, left: alignedLeft, placement: 'fallback' };
}
