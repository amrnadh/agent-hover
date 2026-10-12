#!/usr/bin/env node
// Generates the logo concept SVGs in docs/brand/concepts/ and a preview page (docs/brand/concepts.html).
// Same geometry everywhere: a selected element (rounded square) with a pointer cut out of it.
// node docs/brand/make-concepts.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const out = path.join(here, 'concepts');
mkdirSync(out, { recursive: true });

const CURSOR = 'M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z';
const SQ = { x: 2, y: 3, w: 20, h: 19, r: 6.5 };
const VB = '-4 -4 40 40';

const COLORS = {
  blue: { light: '#7cc8ff', base: '#0d99ff', deep: '#0067d6', glow: '#0d99ff' },
  lavender: { light: '#dcd6fd', base: '#a99df6', deep: '#7466e8', glow: '#8f84f2' },
};

/** Distance-based test: is (x, y) inside the rounded square? */
function inSquare(x, y, inset = 0) {
  const { x: sx, y: sy, w, h, r } = SQ;
  const cx = Math.min(Math.max(x, sx + r), sx + w - r);
  const cy = Math.min(Math.max(y, sy + r), sy + h - r);
  return Math.hypot(x - cx, y - cy) <= r - inset && x >= sx + inset && x <= sx + w - inset && y >= sy + inset && y <= sy + h - inset;
}

/** 0..1 tone across the square: full at the bottom-left, fading toward the pointer at the top-right. */
function tone(x, y) {
  const u = (x - SQ.x) / SQ.w;
  const v = (y - SQ.y) / SQ.h;
  const diag = 1 - (u * 0.6 + (1 - v) * 0.4);
  const tip = Math.hypot(x - 13, y - 12) / 9; // light pools around the pointer tip
  return Math.max(0, Math.min(1, diag * 0.75 + Math.min(1, tip) * 0.35 - 0.05));
}

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

const id = (() => { let n = 0; return (p) => `${p}${++n}`; })();

/** The pointer (crisp) plus the mask that cuts a gap for it out of whatever is underneath. */
function pointerParts(cursorColor) {
  const mask = id('cut');
  return {
    mask,
    defs: `<mask id="${mask}" maskUnits="userSpaceOnUse" x="-4" y="-4" width="40" height="40"><rect x="-4" y="-4" width="40" height="40" fill="#fff"/><path transform="translate(8.5 7.5)" d="${CURSOR}" fill="#000" stroke="#000" stroke-width="3.2" stroke-linejoin="round"/></mask>`,
    pointer: `<path transform="translate(8.5 7.5)" d="${CURSOR}" fill="${cursorColor}" stroke="${cursorColor}" stroke-width="1" stroke-linejoin="round"/>`,
  };
}

const square = (fill, extra = '') => `<rect x="${SQ.x}" y="${SQ.y}" width="${SQ.w}" height="${SQ.h}" rx="${SQ.r}" fill="${fill}" ${extra}/>`;

const TREATMENTS = {
  /** Soft, smoky edges and a faint haze, like the original concept. */
  haze(c, cursor) {
    const p = pointerParts(cursor);
    const g = id('g'), f = id('smoke'), h = id('haze');
    return `<defs>${p.defs}
      <radialGradient id="${g}" cx="0.3" cy="0.25" r="0.95"><stop offset="0" stop-color="${c.light}"/><stop offset="0.55" stop-color="${c.base}"/><stop offset="1" stop-color="${c.deep}"/></radialGradient>
      <filter id="${f}" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="1.3" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="0.28"/></filter>
      <filter id="${h}" x="-60%" y="-60%" width="220%" height="220%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="9" xChannelSelector="R" yChannelSelector="B"/><feGaussianBlur stdDeviation="2.2"/></filter>
    </defs>
    <g mask="url(#${p.mask})">${square(c.glow, `opacity="0.4" transform="translate(-1 1)" filter="url(#${h})"`)}${square(`url(#${g})`, `filter="url(#${f})"`)}</g>${p.pointer}`;
  },
  /** Crisp square, soft glow beneath, a light edge on top. */
  glow(c, cursor) {
    const p = pointerParts(cursor);
    const g = id('g'), f = id('blur'), e = id('edge');
    return `<defs>${p.defs}
      <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="0.5" stop-color="${c.base}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient>
      <linearGradient id="${e}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.4"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <filter id="${f}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <g mask="url(#${p.mask})">${square(c.glow, `opacity="0.45" transform="translate(1.5 2.5)" filter="url(#${f})"`)}${square(`url(#${g})`)}${square('none', `stroke="url(#${e})" stroke-width="0.6"`)}</g>${p.pointer}`;
  },
  /** Ordered (Bayer) dither: pixels thin out toward the pointer. */
  dither(c, cursor) {
    const p = pointerParts(cursor);
    const step = 0.8;
    let cells = '';
    for (let y = SQ.y; y < SQ.y + SQ.h; y += step) {
      for (let x = SQ.x; x < SQ.x + SQ.w; x += step) {
        const cx = x + step / 2, cy = y + step / 2;
        if (!inSquare(cx, cy)) continue;
        const i = Math.round((x - SQ.x) / step) % 8, j = Math.round((y - SQ.y) / step) % 8;
        if (Math.min(1, tone(cx, cy) * 1.15) > (BAYER[j][i] + 0.5) / 64) cells += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${step * 0.86}" height="${step * 0.86}"/>`;
      }
    }
    return `<defs>${p.defs}</defs><g mask="url(#${p.mask})" fill="${cursor === '#ffffff' ? c.light : c.base}">${cells}</g>${p.pointer}`;
  },
  /** Halftone dots that shrink toward the pointer. */
  halftone(c, cursor) {
    const p = pointerParts(cursor);
    const step = 1.05;
    let dots = '';
    for (let row = 0, y = SQ.y + step / 2; y < SQ.y + SQ.h; y += step * 0.866, row++) {
      for (let x = SQ.x + step / 2 + (row % 2 ? step / 2 : 0); x < SQ.x + SQ.w; x += step) {
        if (!inSquare(x, y, 0.2)) continue;
        const r = (step / 2) * Math.sqrt(tone(x, y)) * 1.08;
        if (r > 0.06) dots += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(3)}"/>`;
      }
    }
    return `<defs>${p.defs}</defs><g mask="url(#${p.mask})" fill="${c.base}">${dots}</g>${p.pointer}`;
  },
  /** Gradient with film grain, like a shader render. */
  grain(c, cursor) {
    const p = pointerParts(cursor);
    const g = id('g'), r = id('r'), n = id('noise'), clip = id('clip');
    return `<defs>${p.defs}
      <linearGradient id="${g}" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="0.45" stop-color="${c.base}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient>
      <radialGradient id="${r}" cx="0.75" cy="0.2" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <filter id="${n}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" seed="11" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.05"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <clipPath id="${clip}">${square('#000')}</clipPath>
    </defs>
    <g mask="url(#${p.mask})"><g clip-path="url(#${clip})">${square(`url(#${g})`)}${square(`url(#${r})`)}<rect x="2" y="3" width="20" height="19" fill="#000" opacity="0.28" filter="url(#${n})"/></g></g>${p.pointer}`;
  },
};

const LABELS = {
  haze: ['Haze', 'Smoky edges and a faint haze, closest to your original'],
  glow: ['Glow', 'Crisp shape, soft glow beneath, light top edge'],
  dither: ['Dither', 'Ordered pixel dither that thins toward the pointer'],
  halftone: ['Halftone', 'Print-style dots that shrink toward the pointer'],
  grain: ['Grain', 'Gradient with film grain, like a shader render'],
};

const svg = (body, size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}"${size ? ` width="${size}" height="${size}"` : ''}>${body}</svg>`;
const flat = (c, cursor) => { const p = pointerParts(cursor); return `<defs>${p.defs}</defs><g mask="url(#${p.mask})">${square(c.base)}</g>${p.pointer}`; };

let rows = '';
for (const [key, fn] of Object.entries(TREATMENTS)) {
  for (const [cname, c] of Object.entries(COLORS)) {
    writeFileSync(path.join(out, `${key}-${cname}.svg`), svg(fn(c, '#111214')) + '\n');
    writeFileSync(path.join(out, `${key}-${cname}-dark.svg`), svg(fn(c, '#ffffff')) + '\n');
  }
  const [title, note] = LABELS[key];
  const cell = (file, cls = '') => `<div class="t ${cls}"><img src="concepts/${file}.svg" width="168" height="168"></div>`;
  rows += `<section><div class="h"><b>${title}</b><span>${note}</span></div><div class="row">
    ${cell(`${key}-blue`)}${cell(`${key}-blue-dark`, 'dark')}${cell(`${key}-lavender`)}${cell(`${key}-lavender-dark`, 'dark')}
    <div class="small">${svg(flat(COLORS.blue, '#111214'), 32)}${svg(flat(COLORS.blue, '#111214'), 16)}<span>small sizes stay flat</span></div></div></section>`;
}

writeFileSync(path.join(here, 'concepts.html'), `<!doctype html><meta charset="utf-8"><title>Agent Hover logo concepts</title><style>
body{margin:0;padding:28px 32px;background:#f4f5f6;font:13px -apple-system,system-ui,sans-serif;color:#4b5058}
section{background:#fff;border-radius:16px;padding:16px 20px;margin-bottom:14px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.h{display:flex;gap:10px;align-items:baseline;margin-bottom:10px}.h b{font-size:14px;color:#111214}.h span{color:#80858e}
.row{display:flex;gap:14px;align-items:center}
.t{width:184px;height:184px;border-radius:14px;display:grid;place-items:center;background:#fafafa}
.t.dark{background:#141518}
.small{display:grid;justify-items:center;gap:10px;margin-left:10px;color:#9aa0a6;font-size:11px;text-align:center;width:90px}
.cols{display:flex;gap:14px;margin:0 0 8px 20px;color:#80858e;font-size:11px;letter-spacing:.08em;text-transform:uppercase}.cols span{width:184px;text-align:center}
</style><div class="cols"><span>Blue · light</span><span>Blue · dark</span><span>Lavender · light</span><span>Lavender · dark</span></div>${rows}`);
console.log('wrote', Object.keys(TREATMENTS).length * 4, 'SVGs and concepts.html');
