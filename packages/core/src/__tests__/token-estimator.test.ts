import { describe, it, expect } from 'vitest';
import { TokenEstimator } from '../token-estimator.js';
import type { ComponentContext } from '../types.js';

describe('TokenEstimator', () => {
  const estimator = new TokenEstimator();

  it('estimates token count for plain text strings', () => {
    const text = 'Hello world! This is a test for token estimation in Agent Hover.';
    const count = estimator.estimate(text);
    expect(count).toBeGreaterThan(0);
    expect(typeof count).toBe('number');
  });

  it('estimates token budgets across minimal, standard, and full context levels', () => {
    const mockContext: ComponentContext = {
      id: 'src/components/Button.tsx:Button:10',
      contextLevel: 'standard',
      component: {
        name: 'Button',
        type: 'function',
        exportType: 'default',
      },
      source: {
        file: 'src/components/Button.tsx',
        absolutePath: '/project/src/components/Button.tsx',
        startLine: 10,
        endLine: 25,
        code: 'export default function Button({ label }: { label: string }) {\n  return <button>{label}</button>;\n}',
      },
      tokens: {
        minimal: 0,
        standard: 0,
        full: 0,
        current: 0,
      },
      interface: {
        props: [{ name: 'label', type: 'string', required: true }],
        hooks: [],
        refs: [],
      },
      dependencies: {
        imports: [],
        hooks: [],
      },
      relationships: {
        children: [],
        siblings: [],
        usedBy: [],
      },
      styling: {
        approach: 'none',
      },
    };

    const estimates = estimator.estimateContext(mockContext);
    expect(estimates.minimal).toBeGreaterThan(0);
    expect(estimates.standard).toBeGreaterThan(0);
    expect(estimates.full).toBeGreaterThan(0);
    expect(estimates.standard).toBeGreaterThanOrEqual(estimates.minimal);
    expect(estimates.full).toBeGreaterThanOrEqual(estimates.standard);
    expect(estimates.current).toBe(estimates.standard);
  });
});
