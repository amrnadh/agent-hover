import { describe, it, expect } from 'vitest';
import { checklistKey, confirmKey, renderChecklist, renderConfirm, startChecklist, type Choice } from '../prompt.js';
import { PLAIN } from '../render.js';

const choices: Choice[] = [
  { value: 'claude', label: 'Claude Code', hint: 'found here · .mcp.json', checked: true },
  { value: 'cursor', label: 'Cursor', hint: '.cursor/mcp.json' },
  { value: 'opencode', label: 'OpenCode', hint: 'opencode.json' },
];

describe('agent checklist', () => {
  it('moves with the arrows (wrapping), ticks with space, a for all, and needs one ticked to continue', () => {
    let st = startChecklist(choices);
    expect(st.checked).toEqual([true, false, false]);
    const press = (name: string, ctrl = false) => { const r = checklistKey(st, { name, ctrl }); st = r.state; return r.done; };
    press('up');
    expect(st.cursor).toBe(2);
    press('space');
    press('down');
    press('down');
    press('space');
    expect(st.checked).toEqual([true, true, true]);
    press('a');
    expect(st.checked).toEqual([false, false, false]);
    expect(press('return')).toBeUndefined();
    expect(st.error).toMatch(/at least one/);
    press('space');
    expect(press('return')).toBe('submit');
    expect(press('c', true)).toBe('cancel');
    expect(press('escape')).toBe('cancel');
  });

  it('draws the list with the cursor, ticks and hints, then one line with the answer', () => {
    const st = { cursor: 1, checked: [true, false, true] };
    const open = renderChecklist('Which coding agents do you use?', choices, st, PLAIN);
    expect(open).toContain('◆ Which coding agents do you use?');
    expect(open).toContain('│   ◼ Claude Code  found here · .mcp.json');
    expect(open).toContain('│ › ◻ Cursor');
    expect(open).toContain('2 selected');
    expect(renderChecklist('Which coding agents do you use?', choices, st, PLAIN, 'submit')).toBe('  ◇ Which coding agents do you use? · Claude Code, OpenCode\n');
  });
});

describe('yes/no', () => {
  it('switches with the arrows, takes y and n, and Enter keeps the choice', () => {
    expect(confirmKey(true, { name: 'right' })).toEqual({ yes: false });
    expect(confirmKey(true, { name: 'n' })).toEqual({ yes: false, done: 'submit' });
    expect(confirmKey(false, { name: 'y' })).toEqual({ yes: true, done: 'submit' });
    expect(confirmKey(true, { name: 'return' })).toEqual({ yes: true, done: 'submit' });
    expect(confirmKey(true, { name: 'c', ctrl: true }).done).toBe('cancel');
    expect(renderConfirm('Apply 7 changes?', true, PLAIN)).toContain('● Yes  ○ No');
    expect(renderConfirm('Apply 7 changes?', false, PLAIN, 'submit')).toBe('  ◇ Apply 7 changes? · No\n');
  });
});
