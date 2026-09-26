import { describe, it, expect } from 'vitest';
import { formatContextMarkdown, formatPinSetMarkdown, formatTaskContext } from '../formatter.js';
import type { ComponentContext, PinSet } from '../types.js';

describe('Formatter', () => {
  const mockContext: ComponentContext = {
    id: 'src/components/Card.tsx:Card:5',
    contextLevel: 'standard',
    component: {
      name: 'Card',
      type: 'function',
      exportType: 'default',
    },
    source: {
      file: 'src/components/Card.tsx',
      absolutePath: '/project/src/components/Card.tsx',
      startLine: 5,
      endLine: 20,
      code: 'export default function Card({ title }: { title: string }) {\n  return <div className="p-4">{title}</div>;\n}',
    },
    tokens: {
      minimal: 50,
      standard: 120,
      full: 300,
      current: 120,
    },
    interface: {
      props: [{ name: 'title', type: 'string', required: true }],
      hooks: ['useState'],
      refs: [],
    },
    dependencies: {
      imports: [{ name: 'useState', source: 'react', isDefault: false, isLocal: false }],
      hooks: ['useState'],
    },
    relationships: {
      parent: { component: 'App', file: 'src/App.tsx', line: 15 },
      children: [],
      siblings: [],
      usedBy: [],
    },
    styling: {
      approach: 'tailwind',
      classes: ['p-4'],
    },
  };

  it('formats markdown at minimal, standard, and full levels', () => {
    const minimal = formatContextMarkdown(mockContext, 'minimal');
    expect(minimal).toContain('## Card');
    expect(minimal).toContain('**Source**: `src/components/Card.tsx:5-20`');
    expect(minimal).not.toContain('### Source Code');

    const standard = formatContextMarkdown(mockContext, 'standard');
    expect(standard).toContain('### Source Code');
    expect(standard).toContain('### Hooks');

    const full = formatContextMarkdown(mockContext, 'full');
    expect(full).toContain('### Parent');
    expect(full).toContain('### Styling');
    expect(full).toContain('Approach: tailwind');
  });

  it('formats pin sets and relationship summaries', () => {
    const mockPinSet: PinSet = {
      pins: [
        {
          id: 'pin-1',
          context: mockContext,
        },
      ],
      relationships: [
        {
          pinId: 'pin-1',
          targetPinId: 'pin-2',
          relation: 'parent',
        },
      ],
      totalTokens: {
        minimal: 50,
        standard: 120,
        full: 300,
        current: 120,
      },
    };

    const pinMd = formatPinSetMarkdown(mockPinSet);
    expect(pinMd).toContain('# Pinned Components');
    expect(pinMd).toContain('## Relationships');
    expect(pinMd).toContain('Pin pin-1 is parent Pin pin-2');
  });

  it('formats coordinated task context with user instruction', () => {
    const mockPinSet: PinSet = {
      pins: [
        {
          id: 'pin-1',
          task: 'Add rounded borders and shadow',
          context: mockContext,
        },
      ],
      relationships: [],
      totalTokens: {
        minimal: 50,
        standard: 120,
        full: 300,
        current: 120,
      },
    };

    const taskResult = formatTaskContext(mockPinSet, 'Unify card designs');
    expect(taskResult.context).toContain('# Coordinated Multi-Component Task Brief');
    expect(taskResult.context).toContain('**Goal**: Unify card designs');
    expect(taskResult.context).toContain('Add rounded borders and shadow');
  });
});
