import { describe, expect, it } from 'vitest';
import { formatPlaceRequest, placeBaseName, type PromptFacts, type Placement } from '../lib/prompt-format.js';

const facts: PromptFacts = {
  element: {
    label: 'div.logos',
    tag: 'div',
    isComponent: false,
    selector: 'section#customers > div.logos',
    classes: ['logos', 'flex', 'gap-8'],
    size: { width: 800, height: 48 },
  },
  component: { name: 'Customers', file: 'src/components/Customers.tsx', startLine: 3, endLine: 20, code: '' },
  hierarchy: ['App', 'Customers', 'div.logos'],
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
  position: 'inside-end',
  width: 120,
  height: 40,
  natural: { width: 480, height: 160 },
  targetWidth: 800,
  alt: 'Acme',
};

describe('formatPlaceRequest', () => {
  it('says what to add, where, at what size, and where to copy it', () => {
    const p = formatPlaceRequest(facts, png, 'Match the other logos.');
    expect(p.startsWith('# Place an image:')).toBe(true);
    expect(p).toContain('`.agent-hover/place/1a2b3c4d.png`');
    expect(p).toContain('inside the element, as its last child');
    expect(p).toContain('`public/acme-logo-final.png`');
    expect(p).toContain('120×40px (15% of the element\'s width)');
    expect(p).toContain('480×160px, image/png');
    expect(p).toContain('Alt text: “Acme”');
    expect(p).toContain('Match the other logos.');
    expect(p).toContain("Don't reference `.agent-hover/`");
    expect(p).toContain('src/components/Customers.tsx');
    // The request comes before the element facts.
    expect(p.indexOf('## What to do')).toBeLessThan(p.indexOf('## Where'));
  });

  it('gives offsets for Over and video attributes for a video', () => {
    const p = formatPlaceRequest(facts, {
      ...png,
      assetPath: '.agent-hover/place/9f.webm',
      mime: 'video/webm',
      position: 'over',
      offset: { x: 0.25, y: 0.5 },
      video: { loop: true, muted: true, autoplay: true },
      alt: '',
    });
    expect(p.startsWith('# Place a video:')).toBe(true);
    expect(p).toContain('25% from the element\'s left and 50% from its top');
    expect(p).toContain('autoplay, loop, muted, playsInline');
    expect(p).not.toContain('of the element\'s width');
    expect(p).not.toContain('decorative');
  });

  it('without a public folder, asks to follow the project pattern; SVGs get a safety note', () => {
    const p = formatPlaceRequest(facts, { ...png, mime: 'image/svg+xml', assetPath: '.agent-hover/place/ab.svg', publicDir: null, alt: undefined });
    expect(p).toContain('where this project keeps its images');
    expect(p).toContain('check it before inlining');
    expect(p).toContain('decorative (alt="")');
  });
});

describe('placeBaseName', () => {
  it('makes a safe file name, falling back when there is none', () => {
    expect(placeBaseName('Hero Shot 2x.webp', 'x')).toBe('hero-shot-2x');
    expect(placeBaseName('...', 'fallback')).toBe('fallback');
    expect(placeBaseName(undefined, 'fallback')).toBe('fallback');
  });
});
