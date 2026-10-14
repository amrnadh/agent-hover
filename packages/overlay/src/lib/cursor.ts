/**
 * Page cursors while Agent Hover is in use: the dock's Inspect dart, filled, with a small badge that says what a
 * click will do. Inspect selects (framed square), Comment drops a pin (bubble), Batch collects (+).
 * Drawn on a 24px grid; the dart's tip at (4, 4) is the hotspot. Browsers that refuse the image use the crosshair.
 */
export type CursorKind = 'inspect' | 'comment' | 'batch';

export const DART_PATH = 'M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.13 1.58a2 2 0 0 0-1.43 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z';
export const HOTSPOT = { x: 4, y: 4 };

const INK = '#111214';
const WHITE = '#ffffff';
const BLUE = '#0d99ff'; // the selector blue: the cursor is part of the on-page selector

const BADGES: Record<CursorKind, string> = {
  inspect: `<rect x="14.5" y="14.5" width="8" height="8" rx="2" fill="${WHITE}"/><rect x="15.75" y="15.75" width="5.5" height="5.5" rx="1.2" fill="none" stroke="${BLUE}" stroke-width="1.6"/>`,
  comment: `<path d="M16.6 14.4h4.1a2 2 0 0 1 2 2v2.3a2 2 0 0 1-2 2h-2.9l-2.5 2.1v-2.2a2 2 0 0 1-.7-1.5v-2.7a2 2 0 0 1 2-2z" fill="${WHITE}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`,
  batch: `<rect x="14.5" y="14.5" width="8" height="8" rx="2" fill="${BLUE}" stroke="${WHITE}" stroke-width="1.2"/><path d="M18.5 16.4v4.2M16.4 18.5h4.2" stroke="${WHITE}" stroke-width="1.5" stroke-linecap="round"/>`,
};

/** The cursor as standalone SVG markup, without a badge when `kind` is null (the demo recorder draws these). */
export function cursorSvg(kind: CursorKind | null, size = 24): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">`
    + `<path d="${DART_PATH}" fill="${INK}" stroke="${WHITE}" stroke-width="1.6" stroke-linejoin="round" paint-order="stroke"/>`
    + `${kind ? BADGES[kind] : ''}</svg>`;
}

/** A CSS `cursor` value for `kind`, falling back to the crosshair. */
export function cursorCss(kind: CursorKind): string {
  return `url("data:image/svg+xml,${encodeURIComponent(cursorSvg(kind))}") ${HOTSPOT.x} ${HOTSPOT.y}, crosshair`;
}
