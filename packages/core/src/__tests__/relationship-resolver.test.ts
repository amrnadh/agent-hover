import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { RelationshipResolver, extractImportSources } from '../relationship-resolver.js';
import type { PinEntry } from '../types.js';

describe('RelationshipResolver (F-04)', () => {
  let tempDir: string;
  let resolver: RelationshipResolver;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-hover-rel-test-'));
    resolver = new RelationshipResolver(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('extracts imports from multi-line destructured import statements', () => {
    const code = `
import React, {
  useState,
  useEffect,
} from 'react';
import {
  Button,
  Card,
  Modal as Dialog,
} from './components/UIComponents';
import type {
  UserProps,
  ThemeOptions,
} from './types';
`;
    const imports = extractImportSources(code);
    expect(imports).toContain('react');
    expect(imports).toContain('./components/UIComponents');
    expect(imports).toContain('./types');
  });

  it('extracts re-exports, dynamic imports, and side-effect imports', () => {
    const code = `
export { Widget } from './components/Widget';
export * from './utils/helpers';
import './globals.css';

async function loadFeature() {
  const mod = await import('./lazy/FeatureModule');
  return mod;
}
`;
    const imports = extractImportSources(code);
    expect(imports).toContain('./components/Widget');
    expect(imports).toContain('./utils/helpers');
    expect(imports).toContain('./globals.css');
    expect(imports).toContain('./lazy/FeatureModule');
  });

  it('builds import graph and finds component usages across multi-line imports', async () => {
    // Fixture: Button.tsx
    await fs.writeFile(
      path.join(tempDir, 'Button.tsx'),
      'export function Button() { return <button>Click</button>; }',
      'utf-8'
    );

    // Fixture: Page.tsx importing Button across multiple lines
    await fs.writeFile(
      path.join(tempDir, 'Page.tsx'),
      `import React from 'react';
import {
  Button
} from './Button';

export function Page() { return <Button />; }`,
      'utf-8'
    );

    const graph = await resolver.buildImportGraph();
    expect(graph.get('Page.tsx')).toBeDefined();
    expect(graph.get('Page.tsx')).toContain('./Button');

    const usages = await resolver.getUsages('Button.tsx');
    expect(usages.length).toBe(1);
    expect(usages[0].file).toBe('Page.tsx');
  });

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
