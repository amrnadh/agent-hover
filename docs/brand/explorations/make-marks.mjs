#!/usr/bin/env node
// Exploration archive: the monochrome dithered mark concepts that led to the final logo (Lift, see
// ../make-logo.mjs). Builds the two preview pages only: marks.html and marks-pointer.html.
// One colour that follows the theme: currentColor in the overlay, ink or near-white in the README.
// Each mark has a fine version (large sizes) and a coarse one (dock, favicon). Everything sits on a 32-unit grid.
// node docs/brand/explorations/make-marks.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;

const INK = '#111214';
const LIGHT = '#eeeff1';
const FINE = 1;
const COARSE = 2;

// 4×4 Bayer matrix, thresholds 0..15.
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const clamp = (v) => Math.max(0, Math.min(1, v));

/** Signed distance from (x, y) to a rounded rectangle (negative inside). */
function sd(x, y, b) {
  const qx = Math.abs(x - (b.x + b.w / 2)) - (b.w / 2 - b.r);
  const qy = Math.abs(y - (b.y + b.h / 2)) - (b.h / 2 - b.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.r;
}
const inside = (x, y, b) => sd(x, y, b) <= 0;
const rr = (b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.r}"/>`;

/** Dither `tone(x, y)` (0..1) over cells of size `step` wherever `where(x, y)`. */
function dither(step, where, tone) {
  let cells = '';
  for (let j = 0, y = 0; y < 32; y += step, j++) {
    for (let i = 0, x = 0; x < 32; x += step, i++) {
      const cx = x + step / 2, cy = y + step / 2;
      if (where(cx, cy) && tone(cx, cy) > (BAYER[j % 4][i % 4] + 0.5) / 16) cells += `<rect x="${x}" y="${y}" width="${step}" height="${step}"/>`;
    }
  }
  return cells;
}

// Mask and clip ids stay unique across every SVG generated in one run (the preview page inlines them all).
let clipN = 0;
const clipped = (b, body) => { const id = `ahc${++clipN}`; return `<clipPath id="${id}">${rr(b)}</clipPath><g clip-path="url(#${id})">${body}</g>`; };

const MARKS = {
  lift: {
    note: 'A solid element hovering over its own dithered shadow.',
    draw(step) {
      const top = { x: 3, y: 3, w: 18, h: 18, r: 5 };
      const shadow = { x: 9, y: 9, w: 20, h: 20, r: 6 };
      return rr(top) + dither(step, (x, y) => inside(x, y, shadow) && sd(x, y, top) > 1.4, (x, y) => clamp(1.45 - (Math.hypot(x - 12, y - 12) / 17) * 1.25));
    },
  },
  float: {
    note: 'An element hovering above its shadow on the ground.',
    draw(step) {
      const el = { x: 6, y: 3, w: 20, h: 16, r: 5 };
      const e = (x, y) => Math.hypot((x - 16) / 10.5, (y - 27) / 2.6);
      return rr(el) + dither(step, (x, y) => e(x, y) <= 1, (x, y) => clamp(1.45 - e(x, y) * 1.25));
    },
  },
  select: {
    note: 'The selection box: solid handles, dashed edges, the element inside.',
    draw(step) {
      const h = 6, a = 2, b = 30 - h;
      const handles = [[a, a], [b, a], [a, b], [b, b]].map(([x, y]) => rr({ x, y, w: h, h, r: 1.6 })).join('');
      let dashes = '';
      for (let t = 10; t < 22; t += 4) dashes += `<rect x="${t}" y="4" width="2" height="2"/><rect x="${t}" y="26" width="2" height="2"/><rect x="4" y="${t}" width="2" height="2"/><rect x="26" y="${t}" width="2" height="2"/>`;
      const el = { x: 9, y: 9, w: 14, h: 14, r: 3.5 };
      return handles + dashes + dither(step, (x, y) => inside(x, y, el), (x, y) => clamp(1.45 - ((x - 9) + (y - 9)) / 28 * 1.2));
    },
  },
  halo: {
    note: 'An element glowing while it is hovered.',
    draw(step) {
      const el = { x: 9, y: 9, w: 14, h: 14, r: 4 };
      const box = { x: 2, y: 2, w: 28, h: 28, r: 9 };
      return rr(el) + dither(step, (x, y) => sd(x, y, el) > 2.2 && inside(x, y, box), (x, y) => clamp(0.95 - (sd(x, y, el) - 2.2) / 7.5));
    },
  },
  decode: {
    note: 'A piece of UI that turns into lines of code: the agent gets the context.',
    draw(step) {
      const box = { x: 3, y: 3, w: 26, h: 26, r: 7 };
      const rows = [[4.5, 19, 28], [9.5, 22, 27], [14.5, 22, 29], [19.5, 19, 25], [24.5, 19, 27]];
      const inRow = (y) => rows.some(([r]) => y >= r && y < r + 3);
      const bars = rows.map(([y, start, end]) => `<rect x="${start}" y="${y}" width="${end - start}" height="3" rx="${step === FINE ? 1 : 0}"/>`).join('');
      const cells = dither(step, (x, y) => x >= 12 && x < 19 && inside(x, y, box), (x, y) => clamp((1 - (x - 12) / 7) * (inRow(y) ? 1.15 : 0.7)));
      return clipped(box, `<rect x="3" y="3" width="9" height="26"/>${cells}`) + bars;
    },
  },
  pin: {
    note: 'An element with a task marker on its corner, like the markers on the page.',
    draw(step) {
      const el = { x: 3, y: 7, w: 22, h: 22, r: 6 };
      const pin = { cx: 23.5, cy: 8.5, r: 6 };
      return `<circle cx="${pin.cx}" cy="${pin.cy}" r="${pin.r}"/>` + dither(step,
        (x, y) => inside(x, y, el) && Math.hypot(x - pin.cx, y - pin.cy) > pin.r + 1.8,
        (x, y) => clamp(1.35 - ((x - 3) / 22) * 0.55 - ((29 - y) / 22) * 0.55));
    },
  },
  scan: {
    note: 'An element read line by line: solid at the top, scanlines thinning out.',
    draw(step) {
      const box = { x: 3, y: 3, w: 26, h: 26, r: 7 };
      const period = 4;
      let bars = '';
      for (let y = 3; y < 29; y += period) {
        const f = clamp(1.12 - ((y - 3) / 26) * 0.95);
        const h = Math.max(step === FINE ? 0.8 : 1.4, period * f);
        bars += `<rect x="3" y="${y}" width="26" height="${h.toFixed(2)}"/>`;
      }
      return clipped(box, bars);
    },
  },
  dissolve: {
    note: 'One element that dissolves into dither from corner to corner.',
    draw(step) {
      const sq = { x: 3, y: 3, w: 26, h: 26, r: 7 };
      return dither(step, (x, y) => inside(x, y, sq), (x, y) => clamp(1.25 - ((x - 3) + (y - 3)) / 52 * 1.35));
    },
  },
};


// ---------- pointer marks ----------
const CURSOR = 'M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z';
// The pointer outline (local 24-unit coordinates) for inside / distance tests.
const PTR = [[4.2, 4.2], [20.7, 10.6], [20.6, 11.5], [14.5, 13.06], [13.06, 14.5], [11.5, 20.6], [10.55, 20.7]];

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** A pointer placed at (tx, ty) with scale s: its path, a signed distance test, its tip, and a gap mask. */
function pointer(tx, ty, s) {
  return {
    tip: [tx + 4.2 * s, ty + 4.2 * s],
    path: (attrs = '') => `<path transform="translate(${tx} ${ty}) scale(${s})" d="${CURSOR}" stroke="currentColor" stroke-width="1" stroke-linejoin="round" ${attrs}/>`,
    sd(x, y) {
      const lx = (x - tx) / s, ly = (y - ty) / s;
      let d = Infinity;
      for (let i = 0; i < PTR.length; i++) d = Math.min(d, segDist(lx, ly, PTR[i], PTR[(i + 1) % PTR.length]));
      return ((inPoly(lx, ly, PTR) ? -d : d) - 0.5) * s;
    },
    /** A mask that hides everything within `gap` of the pointer (gap 0 = exactly the pointer). */
    mask(gap) {
      const id = `ahm${++clipN}`;
      const w = 1 + (2 * gap) / s;
      return { id, defs: `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="#fff"/><path transform="translate(${tx} ${ty}) scale(${s})" d="${CURSOR}" fill="#000" stroke="#000" stroke-width="${w}" stroke-linejoin="round"/></mask>` };
    },
  };
}
const masked = (m, body) => `<defs>${m.defs}</defs><g mask="url(#${m.id})">${body}</g>`;

const POINTER_MARKS = {
  point: {
    note: 'The original concept in monochrome: a dithered element with a solid pointer on it.',
    draw(step) {
      const sq = { x: 2, y: 3, w: 20, h: 19, r: 6.5 };
      const p = pointer(8.5, 7.5, 1);
      const cells = dither(step, (x, y) => inside(x, y, sq), (x, y) => {
        const u = (x - 2) / 20, v = (y - 3) / 19;
        return clamp(((1 - (u * 0.6 + (1 - v) * 0.4)) * 0.75 + Math.min(1, Math.hypot(x - 13, y - 12) / 9) * 0.35 - 0.05) * 1.3);
      });
      return masked(p.mask(1.6), cells) + p.path();
    },
  },
  ghost: {
    note: 'The pointer itself, solid at the tip and dissolving toward the tail.',
    draw(step) {
      const p = pointer(-0.6, -0.6, 1.35);
      const [tx, ty] = p.tip;
      return dither(step, (x, y) => p.sd(x, y) <= 0, (x, y) => clamp(1.75 - (Math.hypot(x - tx, y - ty) / 24) * 1.9));
    },
  },
  trail: {
    note: 'A pointer moving, with a dithered motion trail behind it.',
    draw(step) {
      const p = pointer(9, 4.5, 1);
      const cells = dither(step, (x) => x > 0.5, (x, y) => {
        for (let t = 1; t <= 13; t += 0.5) if (p.sd(x + t, y - 0.3 * t) <= 0) return clamp(1.05 - t / 13);
        return 0;
      });
      return masked(p.mask(1.3), cells) + p.path();
    },
  },
  hover: {
    note: 'A pointer floating over its own dithered shadow.',
    draw(step) {
      const p = pointer(-0.5, -0.5, 0.92);
      const sh = pointer(8, 8, 0.92);
      const [sx, sy] = sh.tip;
      const cells = dither(step, (x, y) => sh.sd(x, y) <= 0, (x, y) => clamp(1.5 - (Math.hypot(x - sx, y - sy) / 24) * 1.2));
      return masked(p.mask(1.3), cells) + p.path();
    },
  },
  tile: {
    note: 'An app-tile shape with the pointer cut out, dissolving at one corner.',
    draw(step) {
      const sq = { x: 3, y: 3, w: 26, h: 26, r: 7 };
      const p = pointer(7.4, 7.2, 0.68);
      const cells = dither(step, (x, y) => inside(x, y, sq), (x, y) => clamp(2.5 - (((x - 3) + (29 - y)) / 52) * 2.4));
      return masked(p.mask(0), cells);
    },
  },
  click: {
    note: 'A pointer with dithered click ripples around its tip.',
    draw(step) {
      const p = pointer(8.5, 8.5, 1);
      const [tx, ty] = p.tip;
      const cells = dither(step, (x, y) => x > 1 && y > 1 && x < 31 && y < 31, (x, y) => {
        const r = Math.hypot(x - tx, y - ty);
        return r >= 3.5 && r < 6.5 ? 0.95 : r >= 8.5 && r < 11 ? 0.55 : r >= 13 && r < 15 ? 0.25 : 0;
      });
      return masked(p.mask(1.4), cells) + p.path();
    },
  },
  selectpoint: {
    note: 'The selection box, with the pointer that made it.',
    draw(step) {
      const h = 5, a = 2, b = 19;
      const handles = [[a, a], [b, a], [a, b], [b, b]].map(([x, y]) => rr({ x, y, w: h, h, r: 1.4 })).join('');
      let dashes = '';
      for (let t = 9; t < 18; t += 4) dashes += `<rect x="${t}" y="3.5" width="2" height="2"/><rect x="${t}" y="20.5" width="2" height="2"/><rect x="3.5" y="${t}" width="2" height="2"/><rect x="20.5" y="${t}" width="2" height="2"/>`;
      const el = { x: 8, y: 8, w: 10, h: 10, r: 2.5 };
      const p = pointer(11.5, 11.5, 0.88);
      const cells = dither(step, (x, y) => inside(x, y, el), (x, y) => clamp(1.5 - ((x - 8) + (y - 8)) / 20));
      return masked(p.mask(1.3), handles + dashes + cells) + p.path();
    },
  },
  codepoint: {
    note: 'A pointer pointing at lines of code: the UI you point at, as code for the agent.',
    draw(step) {
      const rows = [[4, 27], [9, 18], [14, 23], [19, 13], [24, 17]];
      const inBar = (x, y) => rows.some(([ry, end]) => y >= ry && y < ry + 3 && x >= 3 && x < end);
      const p = pointer(11, 9.5, 0.95);
      const cells = dither(step, inBar, (x) => clamp(1.7 - ((x - 3) / 24) * 1.5));
      return masked(p.mask(1.4), cells) + p.path();
    },
  },
};
for (const m of Object.values(POINTER_MARKS)) m.group = 'pointer';
Object.assign(MARKS, POINTER_MARKS);

const svg = (body, fill, size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${size ? ` width="${size}" height="${size}"` : ''}${fill === 'currentColor' ? '' : ` color="${fill}"`} fill="currentColor" shape-rendering="crispEdges">${body}</svg>`;

// Real dock icons (packages/overlay/src/lib/icon.ts) for the mock-up, so clashes show.
const ICON = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a7acb4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const DOCK_ICONS = [
  '<path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.13 1.58a2 2 0 0 0-1.43 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z"/>',
  '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
].map(ICON).join('');

const cards = { element: '', pointer: '' };
for (const [name, m] of Object.entries(MARKS)) {
  const big = (fill) => svg(m.draw(FINE), fill, 112);
  const small = (fill) => [32, 20, 16].map((s) => svg(m.draw(COARSE), fill, s)).join('');
  cards[m.group || 'element'] += `<div class="card"><div class="h"><b>${name[0].toUpperCase() + name.slice(1)}</b><span>${m.note}</span></div>
    <div class="row"><div class="t">${big(INK)}</div><div class="t dark">${big(LIGHT)}</div>
      <div class="col"><div class="s">${small(INK)}</div><div class="s dark">${small(LIGHT)}</div></div></div>
    <div class="row"><div class="dock">${svg(m.draw(COARSE), LIGHT, 20)}<i></i>${DOCK_ICONS}</div>
      <div class="dock light">${svg(m.draw(COARSE), INK, 20)}<i></i>${DOCK_ICONS}</div></div>
    <div class="word">${svg(m.draw(FINE), INK, 30)}<em>Agent Hover</em></div></div>`;
}

const PAGE_CSS = `<style>
body{margin:0;padding:24px;background:#f4f5f6;font:12.5px -apple-system,system-ui,sans-serif;color:#4b5058}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.card{background:#fff;border-radius:16px;padding:16px;display:grid;gap:12px}
.h b{color:#111214;font-size:14px;margin-right:8px}.h span{color:#80858e}
.row{display:flex;gap:12px;align-items:center}
.t{width:128px;height:128px;border-radius:14px;display:grid;place-items:center;background:#fafafa}.t.dark,.s.dark{background:#141518}
.col{display:grid;gap:8px}.s{display:flex;gap:14px;align-items:center;justify-content:center;width:120px;height:56px;border-radius:12px;background:#fafafa}
.dock{display:flex;align-items:center;gap:14px;height:42px;padding:0 14px;border-radius:14px;background:#141518;border:1px solid rgba(255,255,255,.15)}
.dock.light{background:#fff;border-color:rgba(17,18,20,.16)}.dock i{width:1px;height:18px;background:rgba(127,127,127,.35)}
.word{display:flex;align-items:center;gap:9px;white-space:nowrap}.word em{font:600 22px -apple-system,system-ui,sans-serif;font-style:normal;letter-spacing:-.02em;color:#111214}
</style>`;
for (const [group, file] of [['element', 'marks.html'], ['pointer', 'marks-pointer.html']]) {
  writeFileSync(path.join(here, file), `<!doctype html><meta charset="utf-8"><title>Agent Hover marks</title>${PAGE_CSS}<div class="grid">${cards[group]}</div>`);
}

console.log('wrote marks.html and marks-pointer.html');
