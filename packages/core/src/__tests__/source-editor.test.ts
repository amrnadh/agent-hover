import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { SourceEditor } from '../source-editor.js';

describe('SourceEditor', () => {
  let tempDir: string;
  let sampleFilePath: string;
  let editor: SourceEditor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-hover-test-'));
    sampleFilePath = path.join(tempDir, 'Button.tsx');
    const initialContent = `import React from 'react';

export function Button({ label = 'Click Me' }: { label?: string }) {
  return (
    <button className="btn-primary" title="Action Button">
      <span>Submit Order</span>
    </button>
  );
}
`;
    await fs.writeFile(sampleFilePath, initialContent, 'utf-8');
    editor = new SourceEditor(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('replaces static JSX text correctly', async () => {
    const result = await editor.editSourceText({
      projectRoot: tempDir,
      file: 'Button.tsx',
      component: 'Button',
      originalText: 'Submit Order',
      newText: 'Confirm Payment',
    });

    expect(result.success).toBe(true);
    expect(result.oldText).toBe('Submit Order');
    expect(result.newText).toBe('Confirm Payment');

    const updated = await fs.readFile(sampleFilePath, 'utf-8');
    expect(updated).toContain('<span>Confirm Payment</span>');
    expect(updated).not.toContain('<span>Submit Order</span>');
  });

  it('replaces JSX attribute string literals correctly', async () => {
    const result = await editor.editSourceText({
      projectRoot: tempDir,
      file: 'Button.tsx',
      component: 'Button',
      originalText: 'Action Button',
      newText: 'Checkout Now',
    });

    expect(result.success).toBe(true);
    const updated = await fs.readFile(sampleFilePath, 'utf-8');
    expect(updated).toContain('title="Checkout Now"');
  });

  it('records undo stack and reverts edits successfully', async () => {
    await editor.editSourceText({
      projectRoot: tempDir,
      file: 'Button.tsx',
      component: 'Button',
      originalText: 'Submit Order',
      newText: 'Pay Now',
    });

    let currentCode = await fs.readFile(sampleFilePath, 'utf-8');
    expect(currentCode).toContain('<span>Pay Now</span>');

    const undoStack = editor.getUndoStack();
    expect(undoStack.length).toBe(1);
    expect(undoStack[0].file).toBe('Button.tsx');

    const undoResult = await editor.undo();
    expect(undoResult.success).toBe(true);

    const revertedCode = await fs.readFile(sampleFilePath, 'utf-8');
    expect(revertedCode).toContain('<span>Submit Order</span>');
    expect(revertedCode).not.toContain('<span>Pay Now</span>');
  });

  it('returns failure when text is not found', async () => {
    const result = await editor.editSourceText({
      projectRoot: tempDir,
      file: 'Button.tsx',
      component: 'Button',
      originalText: 'Non-existent text',
      newText: 'Replaced',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
