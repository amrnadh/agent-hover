import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/** WCAG 2.1 relative luminance of an sRGB hex color. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = fs.readFileSync(path.resolve(__dirname, '../styles/ui.css'), 'utf8');

/** The custom properties declared in the first block matching `selector`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {');
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(Array.from(block.matchAll(/(--ui-[\w-]+):\s*([^;]+);/g), (m) => [m[1], m[2].trim()]));
}

describe('UI tokens (ui.css)', () => {
  const dark = tokens(':host');
  const light = { ...dark, ...tokens(':host(.light-mode)') };

  for (const [name, t] of [['dark', dark], ['light', light]] as const) {
    it(`${name} theme text meets WCAG AA (4.5:1) on every surface`, () => {
      for (const bg of ['--ui-bg', '--ui-bg-2']) {
        for (const fg of ['--ui-fg', '--ui-fg-2', '--ui-fg-3']) {
          expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(t['--ui-on-ink'], t['--ui-ink']), 'primary button text').toBeGreaterThanOrEqual(4.5);
    });
  }

  it('keeps blue for the on-page selector only', () => {
    expect(dark['--ui-select'].toLowerCase()).toBe('#0d99ff');
    const uses = css.split('\n').filter((l) => l.includes('var(--ui-select)'));
    // On-page layers (hover, selection, batch, comment pins) and focus rings only.
    expect(uses.every((l) => /#ah-hover|#ah-sel-frame|ah-batch|ah-cpin|focus-visible/.test(l))).toBe(true);
  });

  it('respects prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
