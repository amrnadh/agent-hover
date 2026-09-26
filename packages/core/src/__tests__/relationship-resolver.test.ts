import { describe, it, expect } from 'vitest';
import { RelationshipResolver } from '../relationship-resolver.js';
import type { PinEntry } from '../types.js';

describe('RelationshipResolver', () => {
  const resolver = new RelationshipResolver(process.cwd());

  it('resolves parent-child relationships between pinned components', () => {
    const pins: PinEntry[] = [
      {
        id: 'pin-parent',
        context: {
          id: 'src/components/Dashboard.tsx:Dashboard:10',
          contextLevel: 'standard',
          component: { name: 'Dashboard', type: 'function', exportType: 'default' },
          source: { file: 'src/components/Dashboard.tsx', absolutePath: '/project/src/components/Dashboard.tsx', startLine: 10, endLine: 50 },
          imports: [
            { name: 'StatCard', source: './StatCard.js', isDefault: true, isLocal: true },
          ],
          tokens: { minimal: 50, standard: 100, full: 200, current: 100 },
        },
      },
      {
        id: 'pin-child',
        context: {
          id: 'src/components/StatCard.tsx:StatCard:5',
          contextLevel: 'standard',
          component: { name: 'StatCard', type: 'function', exportType: 'default' },
          source: { file: 'src/components/StatCard.tsx', absolutePath: '/project/src/components/StatCard.tsx', startLine: 5, endLine: 30 },
          imports: [],
          tokens: { minimal: 30, standard: 60, full: 120, current: 60 },
        },
      },
    ];

    const relationships = resolver.resolveRelationships(pins);
    expect(relationships.length).toBe(1);
    expect(relationships[0].pinId).toBe('pin-parent');
    expect(relationships[0].relation).toBe('parent of');
    expect(relationships[0].targetPinId).toBe('pin-child');
  });

  it('returns empty relationships array when no import connections exist', () => {
    const pins: PinEntry[] = [
      {
        id: 'pin-a',
        context: {
          id: 'src/components/Header.tsx:Header:1',
          contextLevel: 'standard',
          component: { name: 'Header', type: 'function', exportType: 'default' },
          source: { file: 'src/components/Header.tsx', absolutePath: '/project/src/components/Header.tsx', startLine: 1, endLine: 20 },
          imports: [],
          tokens: { minimal: 20, standard: 40, full: 80, current: 40 },
        },
      },
      {
        id: 'pin-b',
        context: {
          id: 'src/components/Footer.tsx:Footer:1',
          contextLevel: 'standard',
          component: { name: 'Footer', type: 'function', exportType: 'default' },
          source: { file: 'src/components/Footer.tsx', absolutePath: '/project/src/components/Footer.tsx', startLine: 1, endLine: 20 },
          imports: [],
          tokens: { minimal: 20, standard: 40, full: 80, current: 40 },
        },
      },
    ];

    const relationships = resolver.resolveRelationships(pins);
    expect(relationships.length).toBe(0);
  });
});
