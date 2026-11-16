import { describe, it, expect } from 'vitest';
import { PageErrorLog, cleanMessage, formatPageErrors, describeArgs } from '../lib/page-errors.js';
import { formatChangeRequest, type PromptFacts } from '../lib/prompt-format.js';

describe('page errors', () => {
  it('folds repeats, keeps the newest 20, and lists the newest last', () => {
    const log = new PageErrorLog();
    log.add('console', 'Warning: Each child in a list should have a unique "key" prop.', 1);
    log.add('console', 'Warning: Each child in a list should have a unique "key" prop.', 2);
    for (let i = 0; i < 25; i++) log.add('request', `GET /api/item/${i} → 500`, 10 + i);
    const list = log.list();
    expect(list).toHaveLength(20);
    expect(list.at(-1)!.message).toBe('GET /api/item/24 → 500');
    expect(formatPageErrors(list, 2)).toEqual(['- Failed request: GET /api/item/23 → 500', '- Failed request: GET /api/item/24 → 500']);
    const log2 = new PageErrorLog();
    log2.add('exception', 'TypeError: x is undefined');
    log2.add('exception', 'TypeError: x is undefined');
    expect(formatPageErrors(log2.list())).toEqual(['- Uncaught: TypeError: x is undefined (×2)']);
  });

  it('keeps one line and hides tokens in URLs', () => {
    expect(cleanMessage('GET https://api.example.com/v1?id=3&token=abc123&x=1 → 401')).toBe('GET https://api.example.com/v1?id=3&token=…&x=1 → 401');
    expect(cleanMessage('Error: boom\n    at a (x.js:1)\n    at b (y.js:2)')).toBe('Error: boom · at a (x.js:1)');
    expect(cleanMessage('Authorization: Bearer eyJhbGc.abc')).toBe('Authorization: Bearer …');
    expect(describeArgs(['Failed:', new TypeError('nope'), { code: 7 }])).toBe('Failed: TypeError: nope {"code":7}');
  });

  it('goes into the prompt as "On this page", before the constraints', () => {
    const f: PromptFacts = {
      element: { label: 'button#pay', tag: 'button', isComponent: false, selector: 'button#pay' },
      hierarchy: [],
      level: 'standard',
      pageErrors: ['- Failed request: POST /api/pay → 500'],
    };
    const p = formatChangeRequest(f, 'Fix the pay button');
    expect(p).toContain('## On this page');
    expect(p).toContain('POST /api/pay → 500');
    expect(p.indexOf('## On this page')).toBeLessThan(p.indexOf('## Constraints'));
    expect(formatChangeRequest({ ...f, pageErrors: undefined }, 'x')).not.toContain('On this page');
  });

  it('a shared component: "this one" or "all of them" in the constraints', () => {
    const f: PromptFacts = {
      element: { label: 'div.stat', tag: 'div', isComponent: false, selector: 'div.stat' },
      component: { name: 'StatCard', file: 'src/StatCard.tsx' },
      hierarchy: [],
      level: 'standard',
    };
    expect(formatChangeRequest({ ...f, scope: { mode: 'instance', component: 'StatCard', count: 4 } }, 'x')).toContain('used in 4 places on this page: change only this one. Leave the other 3');
    expect(formatChangeRequest({ ...f, scope: { mode: 'component', component: 'StatCard', count: 4 } }, 'x')).toContain('change the component itself, so every one of them');
  });
});
