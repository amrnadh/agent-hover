import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { ContextBuilder } from '../context-builder.js';

describe('ContextBuilder', () => {
  let tempDir: string;
  let sampleFilePath: string;
  let builder: ContextBuilder;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-hover-ctx-test-'));
    sampleFilePath = path.join(tempDir, 'Card.tsx');

    const componentCode = `import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';

interface CardProps {
  title: string;
  count?: number;
  isActive: boolean;
}

export function Card({ title, count = 0, isActive }: CardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    console.log('Mounted', title);
  }, [title]);

  return (
    <div className="card">
      <h3>{title}</h3>
      <span>{count}</span>
      <Icon name="chevron" />
    </div>
  );
}
`;
    await fs.writeFile(sampleFilePath, componentCode, 'utf-8');
    builder = new ContextBuilder(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('builds minimal context with resolved props interface', async () => {
    const ctx = await builder.getContext('Card.tsx', 12, 'minimal');

    expect(ctx.component.name).toBe('Card');
    expect(ctx.component.type).toBe('function');
    expect(ctx.component.exportType).toBe('named');
    expect(ctx.contextLevel).toBe('minimal');
    expect(ctx.source.startLine).toBe(10);

    const props = ctx.interface?.props || [];
    expect(props.length).toBe(3);

    const titleProp = props.find((p) => p.name === 'title');
    expect(titleProp).toBeDefined();
    expect(titleProp?.type).toBe('string');
    expect(titleProp?.required).toBe(true);

    const countProp = props.find((p) => p.name === 'count');
    expect(countProp).toBeDefined();
    expect(countProp?.type).toBe('number');
    expect(countProp?.defaultValue).toBe('0');

    expect(ctx.tokens.minimal).toBeGreaterThan(0);
  });

  it('builds standard context with source code, imports, and hooks', async () => {
    const ctx = await builder.getContext('Card.tsx', 12, 'standard');

    expect(ctx.contextLevel).toBe('standard');
    expect(ctx.source.code).toBeDefined();
    expect(ctx.source.code).toContain('export function Card');

    expect(ctx.imports).toBeDefined();
    expect(ctx.imports?.some((i) => i.name === 'Icon')).toBe(true);

    expect(ctx.interface?.hooks).toContain('useState');
    expect(ctx.interface?.hooks).toContain('useEffect');

    expect(ctx.tokens.standard).toBeGreaterThanOrEqual(ctx.tokens.minimal);
  });

  it('builds full context with child components and styling detection', async () => {
    const ctx = await builder.getContext('Card.tsx', 12, 'full');

    expect(ctx.contextLevel).toBe('full');
    expect(ctx.relationships?.children.some((c) => c.component === 'Icon')).toBe(true);
    expect(ctx.styling).toBeDefined();
    expect(ctx.tokens.full).toBeGreaterThanOrEqual(ctx.tokens.standard);
  });
});
