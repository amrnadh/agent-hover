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
    expect(result.error).toContain('Could not locate');
  });

  describe('F-03 Replacement token security and edge cases', () => {
    it('preserves $1 in newText without corrupting to empty backreference', async () => {
      const result = await editor.editSourceText({
        projectRoot: tempDir,
        file: 'Button.tsx',
        component: 'Button',
        originalText: 'Submit Order',
        newText: 'Get $100 Off',
      });

      expect(result.success).toBe(true);
      const updated = await fs.readFile(sampleFilePath, 'utf-8');
      expect(updated).toContain('<span>Get $100 Off</span>');
    });

    it('preserves $& in newText without repeating matched text', async () => {
      const result = await editor.editSourceText({
        projectRoot: tempDir,
        file: 'Button.tsx',
        component: 'Button',
        originalText: 'Submit Order',
        newText: 'Save & Buy ($& discount)',
      });

      expect(result.success).toBe(true);
      const updated = await fs.readFile(sampleFilePath, 'utf-8');
      expect(updated).toContain('<span>Save & Buy ($& discount)</span>');
      expect(updated).not.toContain('Submit Order discount');
    });

    it('preserves $$ in newText without collapsing to single $', async () => {
      const result = await editor.editSourceText({
        projectRoot: tempDir,
        file: 'Button.tsx',
        component: 'Button',
        originalText: 'Submit Order',
        newText: 'Cost: $$50',
      });

      expect(result.success).toBe(true);
      const updated = await fs.readFile(sampleFilePath, 'utf-8');
      expect(updated).toContain('<span>Cost: $$50</span>');
    });

    it("preserves $' in newText without inserting post-match string", async () => {
      const result = await editor.editSourceText({
        projectRoot: tempDir,
        file: 'Button.tsx',
        component: 'Button',
        originalText: 'Submit Order',
        newText: "Price: $'",
      });

      expect(result.success).toBe(true);
      const updated = await fs.readFile(sampleFilePath, 'utf-8');
      expect(updated).toContain("<span>Price: $'</span>");
    });

    it('handles multi-line text replacements', async () => {
      const multiLineFile = path.join(tempDir, 'Card.tsx');
      const content = `export function Card() {
  return (
    <div>
      <p>
        Line One
        Line Two
      </p>
    </div>
  );
}`;
      await fs.writeFile(multiLineFile, content, 'utf-8');

      const result = await editor.editSourceText({
        projectRoot: tempDir,
        file: 'Card.tsx',
        originalText: 'Line One\n        Line Two',
        newText: 'Single Updated Line',
      });

      expect(result.success).toBe(true);
      const updated = await fs.readFile(multiLineFile, 'utf-8');
      expect(updated).toContain('Single Updated Line');
    });

    it('detects ambiguous matches and returns an error when not disambiguated', async () => {
      const multiMatchFile = path.join(tempDir, 'List.tsx');
      const content = `export function List() {
  return (
    <ul>
      <li>Item</li>
      <li>Item</li>
      <li>Item</li>
    </ul>
  );
}`;
      await fs.writeFile(multiMatchFile, content, 'utf-8');

      // Attempt ambiguous edit without occurrenceIndex or line
      const ambiguousResult = await editor.editSourceText({
        projectRoot: tempDir,
        file: 'List.tsx',
        originalText: 'Item',
        newText: 'Unique Item',
      });

      expect(ambiguousResult.success).toBe(false);
      expect(ambiguousResult.error).toContain('Ambiguous: found 3 matches');

      // Disambiguate using occurrenceIndex
      const resolvedResult = await editor.editSourceText({
        projectRoot: tempDir,
        file: 'List.tsx',
        originalText: 'Item',
        newText: 'Second Item',
        occurrenceIndex: 1,
      });

      expect(resolvedResult.success).toBe(true);
      const updated = await fs.readFile(multiMatchFile, 'utf-8');
      expect(updated).toContain('<li>Second Item</li>');

      // Disambiguate using line
      const lineResult = await editor.editSourceText({
        projectRoot: tempDir,
        file: 'List.tsx',
        originalText: 'Item',
        newText: 'Third Item',
        line: 6,
      });

      expect(lineResult.success).toBe(true);
      const updatedAgain = await fs.readFile(multiMatchFile, 'utf-8');
      expect(updatedAgain).toContain('<li>Third Item</li>');
    });
  });
});
