import { emitKeypressEvents } from 'node:readline';
import type { Style } from './render.js';

/**
 * Terminal prompts for `init`: a checklist (↑ ↓ to move, space to tick, a for all, enter to confirm) and a yes/no.
 * No dependencies, so `npx agent-hover` stays instant. The key handling and drawing are pure functions, tested
 * without a terminal; `ask*` wire them to stdin.
 */
export interface Choice {
  value: string;
  label: string;
  hint?: string;
  checked?: boolean;
}

export interface Key {
  name?: string;
  ctrl?: boolean;
  sequence?: string;
}

export interface CheckState {
  cursor: number;
  checked: boolean[];
  error?: string;
}

export type Outcome = 'submit' | 'cancel' | undefined;

export function startChecklist(choices: Choice[]): CheckState {
  return { cursor: 0, checked: choices.map((c) => !!c.checked) };
}

export function checklistKey(state: CheckState, key: Key): { state: CheckState; done?: Outcome } {
  const n = state.checked.length;
  const name = key.name || key.sequence;
  if ((key.ctrl && name === 'c') || name === 'escape') return { state, done: 'cancel' };
  if (name === 'up' || name === 'k') return { state: { ...state, cursor: (state.cursor - 1 + n) % n, error: undefined } };
  if (name === 'down' || name === 'j' || name === 'tab') return { state: { ...state, cursor: (state.cursor + 1) % n, error: undefined } };
  if (name === 'space') {
    const checked = state.checked.slice();
    checked[state.cursor] = !checked[state.cursor];
    return { state: { ...state, checked, error: undefined } };
  }
  if (name === 'a') {
    const all = state.checked.every(Boolean);
    return { state: { ...state, checked: state.checked.map(() => !all), error: undefined } };
  }
  if (name === 'return' || name === 'enter') {
    if (!state.checked.some(Boolean)) return { state: { ...state, error: 'Pick at least one with space' } };
    return { state, done: 'submit' };
  }
  return { state };
}

const BAR = '│';

export function renderChecklist(message: string, choices: Choice[], state: CheckState, s: Style, done?: Outcome): string {
  if (done === 'submit') {
    const picked = choices.filter((_, i) => state.checked[i]).map((c) => c.label).join(', ');
    return `  ${s.ok('◇')} ${message} ${s.dim('·')} ${picked}\n`;
  }
  if (done === 'cancel') return `  ${s.todo('■')} ${message} ${s.dim('· cancelled')}\n`;
  const width = Math.max(...choices.map((c) => c.label.length));
  const lines = [
    `  ${s.bold('◆')} ${s.bold(message)}`,
    `  ${s.dim(BAR)} ${s.dim('↑ ↓ move · space select · a all · enter confirm')}`,
    ...choices.map((c, i) => {
      const here = i === state.cursor;
      const box = state.checked[i] ? s.ok('◼') : s.dim('◻');
      const label = here ? s.bold(c.label.padEnd(width)) : c.label.padEnd(width);
      return `  ${s.dim(BAR)} ${here ? s.bold('›') : ' '} ${box} ${label}${c.hint ? '  ' + s.dim(c.hint) : ''}`;
    }),
    `  ${s.dim('└')} ${state.error ? s.todo(state.error) : s.dim(`${state.checked.filter(Boolean).length} selected`)}`,
  ];
  return lines.join('\n') + '\n';
}

export function confirmKey(yes: boolean, key: Key): { yes: boolean; done?: Outcome } {
  const name = key.name || key.sequence;
  if ((key.ctrl && name === 'c') || name === 'escape') return { yes, done: 'cancel' };
  if (name === 'left' || name === 'right' || name === 'up' || name === 'down' || name === 'tab' || name === 'h' || name === 'l') return { yes: !yes };
  if (name === 'y') return { yes: true, done: 'submit' };
  if (name === 'n') return { yes: false, done: 'submit' };
  if (name === 'return' || name === 'enter') return { yes, done: 'submit' };
  return { yes };
}

export function renderConfirm(message: string, yes: boolean, s: Style, done?: Outcome): string {
  if (done === 'submit') return `  ${s.ok('◇')} ${message} ${s.dim('·')} ${yes ? 'Yes' : 'No'}\n`;
  if (done === 'cancel') return `  ${s.todo('■')} ${message} ${s.dim('· cancelled')}\n`;
  const opt = (on: boolean, label: string) => (on ? `${s.ok('●')} ${s.bold(label)}` : `${s.dim('○')} ${s.dim(label)}`);
  return `  ${s.bold('◆')} ${s.bold(message)}\n  ${s.dim(BAR)} ${opt(yes, 'Yes')}  ${opt(!yes, 'No')}  ${s.dim('← → · enter')}\n  ${s.dim('└')}\n`;
}

// ---------- terminal ----------
const visible = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, '');

/** Draw `frame`, replacing the previous one; long lines are cut to the terminal width so the redraw stays exact. */
function painter(out: NodeJS.WriteStream) {
  let lines = 0;
  return (frame: string) => {
    const cols = out.columns || 80;
    const fitted = frame.replace(/\n$/, '').split('\n').map((l) => {
      const text = visible(l);
      return text.length >= cols ? text.slice(0, cols - 2) + '…' : l;
    });
    if (lines) out.write(`\x1b[${lines}A\r\x1b[J`);
    out.write(fitted.join('\n') + '\n');
    lines = fitted.length;
  };
}

function interact<T>(render: (done?: Outcome) => string, onKey: (key: Key) => Outcome, result: () => T): Promise<T | null> {
  const input = process.stdin;
  const out = process.stdout;
  const paint = painter(out);
  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  input.setRawMode?.(true);
  input.resume();
  out.write('\x1b[?25l');
  paint(render());
  return new Promise((resolve) => {
    const handler = (_: string, key: Key = {}) => {
      const done = onKey(key);
      paint(render(done));
      if (!done) return;
      input.off('keypress', handler);
      input.setRawMode?.(wasRaw);
      input.pause();
      out.write('\x1b[?25h');
      resolve(done === 'submit' ? result() : null);
    };
    input.on('keypress', handler);
  });
}

/** The ticked values, or null when cancelled (Esc, Ctrl+C). */
export function askChecklist(message: string, choices: Choice[], s: Style): Promise<string[] | null> {
  let state = startChecklist(choices);
  return interact(
    (done) => renderChecklist(message, choices, state, s, done),
    (key) => { const r = checklistKey(state, key); state = r.state; return r.done; },
    () => choices.filter((_, i) => state.checked[i]).map((c) => c.value),
  );
}

/** Yes or no (null when cancelled). */
export function askConfirm(message: string, s: Style, initial = true): Promise<boolean | null> {
  let yes = initial;
  return interact(
    (done) => renderConfirm(message, yes, s, done),
    (key) => { const r = confirmKey(yes, key); yes = r.yes; return r.done; },
    () => yes,
  );
}
