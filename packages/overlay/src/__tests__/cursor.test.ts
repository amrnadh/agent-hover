import { describe, it, expect } from 'vitest';
import { cursorCss, cursorSvg, DART_PATH, HOTSPOT } from '../lib/cursor.js';

describe('page cursor', () => {
  it('is the dock dart with a different badge per kind', () => {
    const kinds = ['inspect', 'comment', 'batch'] as const;
    for (const k of kinds) expect(cursorSvg(k)).toContain(DART_PATH);
    expect(new Set(kinds.map((k) => cursorSvg(k))).size).toBe(3);
    expect(cursorSvg(null)).not.toContain('<rect');
    expect(cursorSvg('inspect', 48)).toContain('width="48" height="48" viewBox="0 0 24 24"');
  });

  it('is a CSS value with the tip as hotspot and the crosshair as fallback', () => {
    const css = cursorCss('comment');
    expect(css.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(css.endsWith(`") ${HOTSPOT.x} ${HOTSPOT.y}, crosshair`)).toBe(true);
    // Colors and quotes are escaped, so the value survives inside url("…").
    const data = css.slice('url("data:image/svg+xml,'.length, css.lastIndexOf('")'));
    expect(data).not.toMatch(/[#"<>]/);
    expect(decodeURIComponent(data)).toBe(cursorSvg('comment'));
  });
});
