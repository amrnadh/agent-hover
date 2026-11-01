#!/usr/bin/env node
// The Agent Hover logo ("Lift"): a solid element hovering over its own dithered shadow.
// Generates every logo asset from one definition:
//   docs/brand/logo/            mark SVGs (theme-following, ink, light; fine and small), favicon.svg,
//                               PNG icons, wordmark lockups, social preview (2560×1280)
//   packages/overlay/src/brand/mark.svg   the dock mark (small version, currentColor)
// node docs/brand/make-logo.mjs   (needs Playwright for the PNGs: npx playwright install chromium)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const out = path.join(here, 'logo');
mkdirSync(out, { recursive: true });

export const INK = '#111214';
export const LIGHT = '#eeeff1';
export const GRAPHITE = '#141518';

// ---------- geometry (32-unit grid) ----------
const TOP = { x: 3, y: 3, w: 18, h: 18, r: 5 };
const SHADOW = { x: 9, y: 9, w: 20, h: 20, r: 6 };
const GAP = 1.6;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const clamp = (v) => Math.max(0, Math.min(1, v));

function sd(x, y, b) {
  const qx = Math.abs(x - (b.x + b.w / 2)) - (b.w / 2 - b.r);
  const qy = Math.abs(y - (b.y + b.h / 2)) - (b.h / 2 - b.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.r;
}

/** Shadow density: strongest just under the element's corner, fading outward and toward both tips. */
const tone = (x, y) => clamp(1.65 - (Math.hypot(x - 12, y - 12) / 17) * 1.3) * clamp(1.25 - Math.abs(x - y) / 15);

/** Ordered-dither cells of the shadow, without isolated pixels or hollow "+" crosses. */
function shadowCells(step) {
  const n = 32 / step;
  const on = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => {
    const x = (i + 0.5) * step, y = (j + 0.5) * step;
    return sd(x, y, SHADOW) <= 0 && sd(x, y, TOP) > GAP && tone(x, y) > (BAYER[j % 4][i % 4] + 0.5) / 16;
  }));
  const at = (i, j) => (on[j]?.[i] ? 1 : 0);
  let rects = '';
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (!on[j][i]) continue;
      const orth = at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1);
      const diag = at(i - 1, j - 1) + at(i + 1, j - 1) + at(i - 1, j + 1) + at(i + 1, j + 1);
      if (orth + diag === 0 || (orth === 4 && diag === 0)) continue;
      rects += `<rect x="${i * step}" y="${j * step}" width="${step}" height="${step}"/>`;
    }
  }
  return rects;
}

/** The mark's inner SVG. `small` uses 2-unit pixels (16×16 grid) so it stays crisp at 16–24px. */
export const markBody = (small = false) =>
  `<rect x="${TOP.x}" y="${TOP.y}" width="${TOP.w}" height="${TOP.h}" rx="${TOP.r}"/><g shape-rendering="crispEdges">${shadowCells(small ? 2 : 1)}</g>`;

export const markSvg = ({ small = false, color = 'currentColor', size, title = true } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${size ? ` width="${size}" height="${size}"` : ''}${color === 'currentColor' ? '' : ` color="${color}"`} fill="currentColor"${title ? ' role="img" aria-label="Agent Hover"' : ''}>${markBody(small)}</svg>`;

// ---------- SVG files ----------
const files = {
  'mark.svg': markSvg(),
  'mark-ink.svg': markSvg({ color: INK }),
  'mark-light.svg': markSvg({ color: LIGHT }),
  'mark-small.svg': markSvg({ small: true }),
  'mark-small-ink.svg': markSvg({ small: true, color: INK }),
  'mark-small-light.svg': markSvg({ small: true, color: LIGHT }),
  // Browser tab icon that follows the OS theme.
  'favicon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>svg{color:${INK}}@media (prefers-color-scheme: dark){svg{color:${LIGHT}}}</style><g fill="currentColor">${markBody(true)}</g></svg>`,
};
for (const [name, content] of Object.entries(files)) writeFileSync(path.join(out, name), content + '\n');

const dock = path.join(here, '..', '..', 'packages', 'overlay', 'src', 'brand', 'mark.svg');
mkdirSync(path.dirname(dock), { recursive: true });
writeFileSync(dock, markSvg({ small: true, title: false }) + '\n');

// ---------- PNGs (rendered with Playwright) ----------
const FONT = `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif`;
const page = (body, w, h, bg = 'transparent') => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${w}px;height:${h}px;background:${bg};overflow:hidden}
  body{display:grid;place-items:center;font-family:${FONT};-webkit-font-smoothing:antialiased}
</style>${body}`;

const icon = (size, { tile = false, small = size <= 48 } = {}) => {
  const markSize = tile ? Math.round(size * 0.62) : size;
  const mark = markSvg({ small, color: tile ? LIGHT : INK, size: markSize, title: false });
  return page(tile ? `<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.225)}px;background:${GRAPHITE};display:grid;place-items:center">${mark}</div>` : mark, size, size);
};

const lockup = (dark) => {
  const fg = dark ? LIGHT : INK;
  return page(`<div style="display:flex;align-items:center;gap:22px">${markSvg({ color: fg, size: 88, title: false })}
    <span style="font-weight:650;font-size:64px;letter-spacing:-0.035em;color:${fg}">Agent Hover</span></div>`, 640, 160);
};

// The logo's dither, coming in from the bottom-right corner behind the dock.
const socialDither = () => {
  const cell = 6;
  let d = '';
  for (let j = 0; j < 640 / cell; j++) {
    for (let i = 0; i < 1280 / cell; i++) {
      const tone = clamp(1.02 - Math.hypot((1280 - (i + 0.5) * cell) / 1.5, 640 - (j + 0.5) * cell) / 330);
      if (tone * 16 > BAYER[j % 4][i % 4] + 0.5) d += `M${i * cell} ${j * cell}h${cell}v${cell}h-${cell}z`;
    }
  }
  return `<svg width="1280" height="640" style="position:absolute;inset:0" shape-rendering="crispEdges"><path d="${d}" fill="${LIGHT}" fill-opacity=".2"/></svg>`;
};

// logo/dock.png is the real dock, 40px of padding around it, captured by e2e/media.spec.ts (npm run screenshots).
const dockPng = `data:image/png;base64,${readFileSync(path.join(out, 'dock.png')).toString('base64')}`;
const dockScale = 1.5, dockW = 240 * dockScale, dockH = 44 * dockScale, dockX = 1280 - 96 - dockW, dockCenter = 469;

const social = page(`<div style="width:1280px;height:640px;position:relative;background:${GRAPHITE};color:${LIGHT};overflow:hidden">
  ${socialDither()}
  <div style="position:absolute;left:96px;top:50%;transform:translateY(-50%)">
    <div style="display:flex;align-items:center;gap:28px">${markSvg({ color: LIGHT, size: 116, title: false })}
      <span style="font-weight:650;font-size:86px;letter-spacing:-0.035em">Agent Hover</span></div>
    <div style="margin-top:36px;font-size:50px;line-height:1.12;font-weight:600;letter-spacing:-0.025em">Can’t describe it? Point at it.</div>
    <div style="margin-top:14px;font-size:30px;font-weight:500;letter-spacing:-0.015em;color:#c9ccd2">Your coding agent gets the exact file, line and styles.</div>
    <div style="margin-top:40px;display:flex;align-items:center;gap:26px">
      <span style="font:500 26px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-0.02em;padding:13px 20px;border-radius:12px;background:#1f2126;box-shadow:inset 0 0 0 1px #33363d">npx agent-hover init</span>
      <span style="font-size:24px;color:#a2a7b0">Vite + React · Any MCP agent</span>
    </div>
  </div>
  <div style="position:absolute;left:${dockX + 10}px;top:${dockCenter - dockH / 2 + 22}px;width:${dockW - 20}px;height:${dockH - 6}px;border-radius:21px;background:rgba(0,0,0,.6);filter:blur(22px)"></div>
  <img src="${dockPng}" style="position:absolute;left:${dockX - 40 * dockScale}px;top:${dockCenter - dockH / 2 - 40 * dockScale}px;width:${(240 + 80) * dockScale}px">
</div>`, 1280, 640, GRAPHITE);

const pngs = [
  ['favicon-16.png', icon(16), 16, 16],
  ['favicon-32.png', icon(32), 32, 32],
  ['favicon-48.png', icon(48), 48, 48],
  ['apple-touch-icon.png', icon(180, { tile: true, small: false }), 180, 180],
  ['icon-512.png', icon(512, { tile: true, small: false }), 512, 512],
  ['lockup-ink.png', lockup(false), 640, 160],
  ['lockup-light.png', lockup(true), 640, 160],
  ['social.png', social, 1280, 640],
];

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('Playwright not found: wrote the SVGs only.');
}
if (chromium) {
  const browser = await chromium.launch();
  for (const [name, html, w, h] of pngs) {
    // Lockups and social are rendered at 2× for sharpness; icons at their exact pixel size.
    const scale = name.startsWith('lockup') || name.startsWith('social') ? 2 : 1;
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await p.setContent(html);
    await p.screenshot({ path: path.join(out, name), omitBackground: !name.startsWith('social') });
    await p.close();
  }
  await browser.close();
}
console.log(`wrote ${Object.keys(files).length} SVGs${chromium ? ` and ${pngs.length} PNGs` : ''} to docs/brand/logo, and the dock mark`);
