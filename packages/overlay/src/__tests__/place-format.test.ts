import { describe, expect, it } from 'vitest';
import { formatPlaceRequest, placeBaseName, type PromptFacts, type Placement } from '../lib/prompt-format.js';

const facts: PromptFacts = {
  element: { label: 'div.card', tag: 'div', isComponent: false, selector: 'section > div.card', classes: ['card', 'p-4'], size: { width: 400, height: 200 } },
  component: { name: 'StatCard', file: 'src/components/StatCard.tsx', startLine: 6, endLine: 20, code: '' },
  hierarchy: ['App', 'StatCard', 'div.card'],
  notes: [],
  frozen: [],
  page: { path: '/', viewport: { width: 1280, height: 800 } },
  level: 'standard',
};

const png: Placement = {
  assetPath: '.agent-hover/place/1a2b3c4d.png',
  mime: 'image/png',
  fileName: 'Acme Logo (final).PNG',
  publicDir: 'public',
  width: 120,
  height: 40,
  natural: { width: 480, height: 160 },
  relation: 'on',
  offset: { x: 264, y: 16 },
  box: { width: 400, height: 200 },
  alt: 'Acme',
};

describe('formatPlaceRequest', () => {
  it('one image: the spot on the element, its size, and where to copy the file', () => {
    const p = formatPlaceRequest([{ facts, placement: { ...png, align: 'top right', rotation: 15 } }], 'Match the other logos.');
    expect(p.startsWith('# Place an image:')).toBe(true);
    expect(p).toContain('`.agent-hover/place/1a2b3c4d.png`');
    expect(p).toContain('`public/acme-logo-final.png`');
    expect(p).toContain("264px from the element's left and 16px from its top (66% across, 8% down)");
    expect(p).toContain('aligned top right on the element');
    expect(p).toContain('120×40px (30% of the element\'s width)');
    expect(p).toContain('The file itself is 480×160px');
    expect(p).toContain('Rotated 15° clockwise');
    expect(p).toContain('Alt text: “Acme”');
    expect(p).toContain('Match the other logos.');
    expect(p).toContain("Don't reference `.agent-hover/`");
    expect(p.indexOf('## What to do')).toBeLessThan(p.indexOf('## Where it goes'));
  });

  it('says when it sticks out of the element, and describes a spot below it', () => {
    const out = formatPlaceRequest([{ facts, placement: { ...png, offset: { x: -10, y: 180 } } }]);
    expect(out).toContain('10px past its left edge');
    expect(out).toContain('20px past its bottom edge');
    const below = formatPlaceRequest([{ facts, placement: { ...png, relation: 'below', offset: { x: 0, y: 24 } } }]);
    expect(below).toContain('in the space below the element, 24px under it');
  });

  it('several assets become one task, each with its own spot', () => {
    const p = formatPlaceRequest([
      { facts, placement: png },
      { facts, placement: { ...png, assetPath: '.agent-hover/place/9f.webm', mime: 'video/webm', fileName: 'loop.webm', video: { loop: true, muted: true, autoplay: true }, alt: '' } },
    ]);
    expect(p.startsWith('# Place 2 assets')).toBe(true);
    expect(p).toContain('## 1. Acme Logo (final).PNG');
    expect(p).toContain('## 2. loop.webm');
    expect(p).toContain('autoplay, loop, muted, playsInline');
  });

  it('SVGs get a safety note; no alt text means decorative', () => {
    const p = formatPlaceRequest([{ facts, placement: { ...png, mime: 'image/svg+xml', assetPath: '.agent-hover/place/ab.svg', publicDir: null, alt: undefined } }]);
    expect(p).toContain('check it before inlining');
    expect(p).toContain('decorative (alt="")');
    expect(p).toContain('where this project keeps its images');
  });
});

describe('placeBaseName', () => {
  it('makes a safe file name, falling back when there is none', () => {
    expect(placeBaseName('Hero Shot 2x.webp', 'x')).toBe('hero-shot-2x');
    expect(placeBaseName('...', 'fallback')).toBe('fallback');
    expect(placeBaseName(undefined, 'fallback')).toBe('fallback');
  });
});
