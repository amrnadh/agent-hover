import { describe, it, expect } from 'vitest';
import { isWrapperName, nounFor, plainLabel } from '../lib/labels.js';

describe('plain labels', () => {
  it('names an element by what it says and what it is', () => {
    expect(plainLabel({ tag: 'button', text: 'Book a demo' })).toBe('“Book a demo” button');
    expect(plainLabel({ tag: 'a', text: 'New  Recurring invoices\nfor retainers' })).toBe('“New Recurring invoices for reta…” link');
    expect(plainLabel({ tag: 'img', alt: 'Team photo', text: '' })).toBe('“Team photo” image');
    expect(plainLabel({ tag: 'button', ariaLabel: 'Close', text: '×' })).toBe('“Close” button');
    expect(plainLabel({ tag: 'input', type: 'email', placeholder: 'you@work.com' })).toBe('“you@work.com” field');
  });

  it('falls back to the kind of thing when there is nothing short to call it', () => {
    expect(plainLabel({ tag: 'section', text: 'x'.repeat(200) })).toBe('Section');
    expect(plainLabel({ tag: 'div' })).toBe('Box');
    expect(plainLabel({ tag: 'svg' })).toBe('Graphic');
    expect(nounFor({ tag: 'div', role: 'button' })).toBe('button');
    expect(nounFor({ tag: 'input', type: 'checkbox' })).toBe('checkbox');
  });

  it('knows library wrappers are not what you meant', () => {
    for (const n of ['motion.a', 'Primitive.button', 'Slot', 'AppProvider', 'div']) expect(isWrapperName(n)).toBe(true);
    for (const n of ['StatCard', 'Hero', 'InvoiceSketch']) expect(isWrapperName(n)).toBe(false);
  });
});
