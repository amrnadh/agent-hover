import { describe, expect, it } from 'vitest';
import { findElementLine, jsxTagAt, sourceWindow, formatBatchRequest, formatChangeRequest, formatCommentsRequest, usesTailwind, type PromptFacts } from '../lib/prompt-format.js';
import { formatTaskMarkdown } from '../../../core/src/formatter.js';

const CODE = [
  'export const Hero: React.FC = () => {',
  '  const { openDemoModal } = useApp();',
  '  return (',
  '    <section className="hero">',
  '      <button id="hero-primary-cta" className="px-6 py-3 rounded-full bg-white" onClick={openDemoModal}>',
  '        Book a demo',
  '      </button>',
  '    </section>',
  '  );',
  '};',
].join('\n');

function facts(over: Partial<PromptFacts> = {}): PromptFacts {
  return {
    element: {
      label: 'button#hero-primary-cta',
      tag: 'button',
      isComponent: false,
      selector: 'button#hero-primary-cta',
      text: 'Book a demo',
      classes: ['px-6', 'py-3', 'rounded-full', 'bg-white'],
      attributes: [['type', 'button']],
      size: { width: 137, height: 42 },
      styles: { font: '14px/500', color: '#0b0e13', background: '#ffffff', padding: '12px 24px', margin: '0px', radius: 'full', layout: '' },
    },
    component: {
      name: 'Hero',
      file: 'src/components/Hero.tsx',
      startLine: 8,
      endLine: 17,
      code: CODE,
      props: [{ name: 'title', type: 'string', required: false }],
      propValues: [['title', '"Welcome"']],
      hooks: ['useApp'],
    },
    hierarchy: ['App', 'Hero', 'button#hero-primary-cta'],
    notes: ['Arrow should be white'],
    frozen: [{ component: 'Footer', file: 'src/components/Footer.tsx' }],
    page: { path: '/', viewport: { width: 1280, height: 800 } },
    level: 'standard',
    ...over,
  };
}

describe('formatChangeRequest', () => {
  const prompt = formatChangeRequest(facts(), 'Make this button larger with an arrow icon');

  it('puts the request first and the source last', () => {
    const order = ['# Change request', '## What to do', '## Where', '## The element now', '## <Hero />', '## Notes', '## Constraints', '## Source'].map((h) => prompt.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(prompt.split('\n')[0]).toBe('# Change request: <button> “Book a demo” in <Hero />');
  });

  it('names the element, its file, and the line that renders it', () => {
    expect(prompt).toContain('- Element: `button#hero-primary-cta` with text “Book a demo”');
    expect(prompt).toContain('- Rendered by: `<Hero />` in `src/components/Hero.tsx`, lines 8–17');
    expect(prompt).toContain('around line 12');
  });

  it('describes how it looks now, the component, notes and locks', () => {
    expect(prompt).toContain('137×42px');
    expect(prompt).toContain('color #0b0e13 on #ffffff');
    expect(prompt).toContain('- Current values: title="Welcome"');
    expect(prompt).toContain('- Arrow should be white');
    expect(prompt).toContain('Do not modify <Footer /> (src/components/Footer.tsx): it is locked.');
    expect(prompt).toContain('Change this element only; keep the rest of <Hero /> as it is.');
    expect(prompt).toContain('Tailwind');
  });

  it('compact detail drops styles, component facts and source', () => {
    const p = formatChangeRequest(facts({ level: 'minimal' }), 'x');
    expect(p).not.toContain('## Source');
    expect(p).not.toContain('## The element now');
    expect(p).toContain('## Where');
  });

  it('without a source file, tells the agent how to find the element', () => {
    const p = formatChangeRequest(facts({ component: undefined }), 'Fix the spacing');
    expect(p).toContain('Source file: not found automatically');
    expect(p).toContain('## The element now');
  });

  it('copy without an instruction still reads as context', () => {
    expect(formatChangeRequest(facts(), '')).toMatch(/^# Context: /);
  });
});

describe('batch and comments', () => {
  it('batch lists roles and includes each source once', () => {
    const p = formatBatchRequest('Match these buttons', [
      { facts: facts(), role: 'change' },
      { facts: facts({ element: { ...facts().element, label: 'a.link', selector: 'a.link' } }), role: 'reference' },
    ]);
    expect(p).toContain('# Change request: 2 elements');
    expect(p).toContain('2. <button> “Book a demo” in <Hero />: Reference only');
    expect(p.match(/## Source:/g)).toHaveLength(1);
    expect(p).toContain('Reference elements are examples to match');
  });

  it('a single comment becomes a normal change request; several are listed', () => {
    expect(formatCommentsRequest([{ facts: facts(), text: 'Bigger' }])).toContain('## What to do\nBigger');
    const p = formatCommentsRequest([{ facts: facts(), text: 'Bigger' }, { facts: null, text: 'Fix footer', fallback: '<Footer /> not on this page' }]);
    expect(p).toContain('## Comment 2: <Footer /> not on this page');
  });
});

describe('helpers', () => {
  it('detects Tailwind and finds element lines', () => {
    expect(usesTailwind(['px-6', 'py-3', 'card'])).toBe(true);
    expect(usesTailwind(['card', 'primary'])).toBe(false);
    expect(findElementLine(CODE, 8, { selector: '', tag: 'button', text: 'Book a demo' })).toBe(13);
    expect(findElementLine(undefined, 1, { selector: '', tag: 'div' })).toBeUndefined();
  });

  it('names a shared JSX component that renders the element', () => {
    const code = ['return (', '  <Button', '    id="cta"', '    className="px-6"', '  >Go</Button>', ');'].join('\n');
    expect(jsxTagAt(code, 10, 12)).toEqual({ tag: 'Button', line: 11 });
    expect(jsxTagAt(CODE, 8, 12)).toBeUndefined(); // plain <button>
    // A native element written inside a component's children is not rendered through that component.
    expect(jsxTagAt('<Card title="Hi"><button id="cta">Go</button></Card>', 7, 7, 'button')).toBeUndefined();
    expect(jsxTagAt('<Card title="Hi"><button id="cta">Go</button></Card>', 7, 7)).toEqual({ tag: 'Card', line: 7 });
    const p = formatChangeRequest(facts({ component: { ...facts().component!, code, startLine: 10, endLine: 15 }, element: { ...facts().element, selector: 'button#cta', label: 'button#cta', text: 'Go' } }), 'Bigger');
    expect(p).toContain('rendered through `<Button>` (line 11), a shared component');
  });

  it('long components get a window around the element unless detail is Deep', () => {
    const long = Array.from({ length: 400 }, (_, i) => `line ${i + 1}`).join('\n');
    const w = sourceWindow(long, 1, 200, 'standard');
    expect(w).toMatchObject({ from: 155, to: 245, partial: true });
    expect(sourceWindow(long, 1, 200, 'full').partial).toBe(false);
    expect(sourceWindow(CODE, 8, 12, 'standard').partial).toBe(false);
  });

  it('MCP compact format keeps the request and drops the source', () => {
    const prompt = formatChangeRequest(facts(), 'Bigger');
    const task: any = { id: 't1', type: 'component-context', status: 'queued', target: {}, payload: { prompt } };
    expect(formatTaskMarkdown(task, 'compact')).not.toContain('## Source');
    expect(formatTaskMarkdown(task, 'compact')).toContain('## What to do');
    expect(formatTaskMarkdown(task, 'deep')).toContain('## Source');
  });
});
