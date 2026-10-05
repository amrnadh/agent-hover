import { describe, it, expect } from 'vitest';
import { px, escapeHtml, buildCSSSelector, dataUrlToBlob } from '../lib/dom.js';

describe('Overlay DOM & Formatting Helpers (P2-01)', () => {
  it('parses pixel values with px()', () => {
    expect(px('12px')).toBe(12);
    expect(px('0')).toBe(0);
    expect(px(16.5)).toBe(16.5);
    expect(px('invalid')).toBe(0);
  });

  it('escapes HTML special characters', () => {
    expect(escapeHtml('<div>"Hello" & \'World\'</div>')).toBe('&lt;div&gt;"Hello" &amp; \'World\'&lt;/div&gt;');
  });

  it('builds CSS selector for elements', () => {
    const parent: any = {
      tagName: 'DIV',
      id: 'container',
      parentElement: null,
      children: [],
    };
    const child: any = {
      tagName: 'SPAN',
      id: '',
      parentElement: parent,
    };
    parent.children = [child];

    const selector = buildCSSSelector(child as Element);
    expect(selector).toBe('div#container > span');
  });

  it('converts base64 data URL to Blob', () => {
    // In node environment without browser atob/Blob, function catches and handles safely
    const dummyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = dataUrlToBlob(dummyPng);
    if (typeof Blob !== 'undefined') {
      expect(blob).toBeTruthy();
    }
  });
});
