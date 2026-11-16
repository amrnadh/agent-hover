/**
 * Prompt formatting for every way context leaves Agent Hover (Ask, Copy, comments, batch).
 * Pure functions: the overlay gathers the facts, this decides what an agent reads and in which order.
 *
 * Order matters for agents: what to do → where it is (file + line) → what it looks like now →
 * component facts → notes → constraints → source. Source goes last so the request stays at the top.
 */

export type DetailLevel = 'minimal' | 'standard' | 'full';

export interface ElementFacts {
  /** `button#hero-primary-cta`, `div.card`, or `<Hero />` when the selection is a component. */
  label: string;
  tag: string;
  isComponent: boolean;
  selector: string;
  text?: string;
  classes?: string[];
  attributes?: Array<[string, string]>;
  size?: { width: number; height: number };
  styles?: Record<string, string>;
  /** Where the element's JSX is, exactly (React 19 creation stack, mapped by the bridge). */
  source?: { file: string; line: number };
}

export interface ComponentFacts {
  name: string;
  file: string;
  startLine?: number;
  endLine?: number;
  code?: string;
  props?: Array<{ name: string; type: string; required?: boolean }>;
  /** Current values on the rendered instance, already previewed and redacted. */
  propValues?: Array<[string, string]>;
  hooks?: string[];
}

export interface PromptFacts {
  element: ElementFacts;
  component?: ComponentFacts;
  /** Component names from the outermost down to the element. */
  hierarchy: string[];
  notes?: string[];
  frozen?: Array<{ component: string; file?: string }>;
  page?: { path: string; viewport?: { width: number; height: number } };
  level: DetailLevel;
  /** A shared component used more than once on the page: change this one, or every one. */
  scope?: { mode: 'instance' | 'component'; component: string; count: number };
  /** Recent console errors and failed requests on the page, as prompt lines. */
  pageErrors?: string[];
}

function pageErrorsSection(f: PromptFacts | undefined): string {
  if (!f?.pageErrors?.length) return '';
  return `## On this page
Errors since the page loaded (they may or may not be related to this request):
${f.pageErrors.join('\n')}`;
}

const TAILWIND = /^(-?(p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|w|h|min-w|max-w|min-h|max-h|gap|space-[xy]|text|bg|border|rounded|flex|grid|col|row|items|justify|font|leading|tracking|shadow|opacity|z|inset|top|left|right|bottom)(-|$)|(sm|md|lg|xl|2xl|hover|focus|dark):)/;

/** True when the classes look like Tailwind utilities. */
export function usesTailwind(classes: string[] = []): boolean {
  return classes.filter((c) => TAILWIND.test(c)).length >= 2;
}

/**
 * Best guess for the source line that renders the element: an id, a distinctive text snippet, or a
 * distinctive class. Returns an absolute line number, or undefined when nothing matches.
 */
export function findElementLine(code: string | undefined, startLine: number, el: Pick<ElementFacts, 'selector' | 'text' | 'classes' | 'tag'> & { id?: string }): number | undefined {
  if (!code) return undefined;
  const lines = code.split('\n');
  const find = (needle: string) => {
    if (!needle || needle.length < 3) return -1;
    return lines.findIndex((l) => l.includes(needle));
  };
  const candidates: string[] = [];
  if (el.id) candidates.push(`id="${el.id}"`, `id='${el.id}'`, el.id);
  const text = (el.text || '').trim();
  if (text) candidates.push(text.slice(0, 40), text.split(/\s+/).slice(0, 3).join(' '));
  for (const c of el.classes || []) if (c.length > 6 && !TAILWIND.test(c)) candidates.push(c);
  if (el.classes && el.classes.length >= 2) candidates.push(el.classes.slice(0, 2).join(' '));
  for (const needle of candidates) {
    const i = find(needle);
    if (i >= 0) return startLine + i;
  }
  return undefined;
}

/**
 * The JSX tag that renders the element, read from the source just above `line`: e.g. `Button` when the
 * element comes from a shared <Button> component. Undefined when the nearest tag is a plain HTML tag.
 */
export function jsxTagAt(code: string | undefined, startLine: number, line: number | undefined, nativeTag?: string): { tag: string; line: number } | undefined {
  if (!code || !line) return undefined;
  const lines = code.split('\n');
  // The element's own tag is written on its line (<Card><button>Go</button></Card>): it is not rendered through Card.
  if (nativeTag && new RegExp(`<${nativeTag}[\\s>/]`).test(lines[line - startLine] || '')) return undefined;
  for (let i = line - startLine; i >= Math.max(0, line - startLine - 6); i--) {
    const m = (lines[i] || '').match(/<([A-Za-z][\w.]*)/);
    if (m) return /^[A-Z]/.test(m[1]) ? { tag: m[1], line: startLine + i } : undefined;
  }
  return undefined;
}

/** Lines of `code` to include: all of it, or a window around the element for long components. */
export function sourceWindow(code: string, startLine: number, focusLine: number | undefined, level: DetailLevel): { text: string; from: number; to: number; partial: boolean } {
  const lines = code.replace(/\s+$/, '').split('\n');
  const last = startLine + lines.length - 1;
  if (level === 'full' || lines.length <= 150 || !focusLine) return { text: lines.join('\n'), from: startLine, to: last, partial: false };
  const from = Math.max(startLine, focusLine - 45);
  const to = Math.min(last, focusLine + 45);
  return { text: lines.slice(from - startLine, to - startLine + 1).join('\n'), from, to, partial: true };
}

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const code = (s: string) => '`' + s.replace(/`/g, "'") + '`';

function describeTarget(f: PromptFacts): string {
  const el = f.element;
  const text = el.text ? ` “${short(el.text.replace(/\s+/g, ' ').trim(), 40)}”` : '';
  if (el.isComponent) return `${el.label}${f.component?.file ? ` (${f.component.file})` : ''}`;
  const where = f.component ? ` in <${f.component.name} />` : '';
  return `<${el.tag}>${text}${where}`;
}

const sameFile = (a: string, b: string) => {
  const x = a.replace(/\\/g, '/'), y = b.replace(/\\/g, '/');
  return x === y || x.endsWith('/' + y) || y.endsWith('/' + x);
};

function elementLine(f: PromptFacts): number | undefined {
  const c = f.component;
  if (!c) return undefined;
  const el = f.element;
  if (el.source && c.file && sameFile(el.source.file, c.file)) return el.source.line;
  return findElementLine(c.code, c.startLine || 1, { selector: el.selector, text: el.text, classes: el.classes, tag: el.tag, id: el.selector.match(/#([\w-]+)$/)?.[1] });
}

/** The element-specific sections, at heading level `h` (2 for a single request, 3 inside a batch). */
export function formatElementSections(f: PromptFacts, h = 2): string {
  const H = '#'.repeat(h);
  const el = f.element;
  const c = f.component;
  const out: string[] = [];

  // Where
  const where: string[] = [];
  const text = el.text && !el.isComponent ? ` with text “${short(el.text.replace(/\s+/g, ' ').trim(), 80)}”` : '';
  where.push(`- Element: ${code(el.label)}${text}`);
  if (el.selector && el.selector !== el.label && el.selector.length <= 100) where.push(`- CSS selector: ${code(el.selector)}`);
  if (c) {
    const range = c.startLine ? `, lines ${c.startLine}${c.endLine ? `–${c.endLine}` : ''}` : '';
    where.push(`- Rendered by: ${code(`<${c.name} />`)} in ${code(c.file)}${range}`);
    const line = elementLine(f);
    if (line && !el.isComponent) {
      const exact = !!el.source && sameFile(el.source.file, c.file) && el.source.line === line;
      where.push(`- In the source, the element is ${exact ? 'at' : 'around'} line ${line}`);
      const jsx = jsxTagAt(c.code, c.startLine || 1, line, el.tag);
      if (jsx && jsx.tag !== c.name) {
        where.push(`- It is rendered through ${code(`<${jsx.tag}>`)} (line ${jsx.line}), a shared component: change this usage (className or props) rather than ${code(`<${jsx.tag}>`)} itself, unless the request is about every ${jsx.tag}.`);
      }
    }
  } else {
    where.push('- Source file: not found automatically. Search the codebase for the text or classes below.');
  }
  if (f.hierarchy.length) where.push(`- Component path: ${f.hierarchy.join(' › ')}`);
  if (f.page) where.push(`- Page: ${code(f.page.path)}${f.page.viewport ? ` at ${f.page.viewport.width}×${f.page.viewport.height}` : ''}`);
  out.push(`${H} Where\n${where.join('\n')}`);

  // What it looks like now
  if (f.level !== 'minimal' || !c) {
    const now: string[] = [];
    if (el.classes?.length) now.push(`- Classes: ${code(short(el.classes.join(' '), 300))}`);
    if (el.attributes?.length) now.push(`- Attributes: ${el.attributes.map(([k, v]) => `${k}="${short(v, 60)}"`).join(', ')}`);
    const s = el.styles || {};
    const look: string[] = [];
    if (el.size) look.push(`${Math.round(el.size.width)}×${Math.round(el.size.height)}px`);
    if (s.font) look.push(`font ${s.font}`);
    if (s.color) look.push(`color ${s.color}${s.background ? ` on ${s.background}` : ''}`);
    if (s.padding && s.padding !== '0px') look.push(`padding ${s.padding}`);
    if (s.margin && s.margin !== '0px') look.push(`margin ${s.margin}`);
    if (s.radius && s.radius !== '0px') look.push(`radius ${s.radius}`);
    if (s.layout) look.push(s.layout);
    if (look.length) now.push(`- Rendered: ${look.join(' · ')}`);
    if (now.length) out.push(`${H} The element now\n${now.join('\n')}`);
  }

  // Component facts
  if (c && f.level !== 'minimal') {
    const comp: string[] = [];
    if (c.props?.length) comp.push(`- Props: ${c.props.map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join(', ')}`);
    if (c.propValues?.length) comp.push(`- Current values: ${c.propValues.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    if (c.hooks?.length) comp.push(`- Hooks: ${c.hooks.join(', ')}`);
    if (comp.length) out.push(`${H} <${c.name} />\n${comp.join('\n')}`);
  }

  if (f.notes?.length) out.push(`${H} Notes left on this element\n${f.notes.map((n) => `- ${n}`).join('\n')}`);
  return out.join('\n\n');
}

function constraints(f: PromptFacts, extra: string[] = []): string {
  const lines = [
    f.element.isComponent || !f.component
      ? '- Keep the change focused on what is asked; leave unrelated code as it is.'
      : `- Change this element only; keep the rest of <${f.component.name} /> as it is.`,
    usesTailwind(f.element.classes) ? '- Follow the existing styling approach (Tailwind utility classes in this file).' : '- Follow the styling approach already used in this file.',
    f.scope?.mode === 'instance'
      ? `- <${f.scope.component} /> is used in ${f.scope.count} places on this page: change only this one. Leave the other ${f.scope.count - 1} as they are (add an optional prop or a local override if the component itself must change).`
      : f.scope?.mode === 'component'
        ? `- <${f.scope.component} /> is used in ${f.scope.count} places on this page: change the component itself, so every one of them gets the change.`
        : '- If the change would also affect other places that use this component, say so and prefer a prop or a local override.',
    ...extra,
  ];
  for (const z of f.frozen || []) lines.push(`- Do not modify <${z.component} />${z.file ? ` (${z.file})` : ''}: it is locked.`);
  return lines.join('\n');
}

function sourceSection(f: PromptFacts | undefined, h = 2): string {
  const c = f?.component;
  if (!f || !c?.code || f.level === 'minimal') return '';
  const win = sourceWindow(c.code, c.startLine || 1, f.element.isComponent ? undefined : elementLine(f), f.level);
  const lang = /\.(tsx|ts)$/.test(c.file) ? 'tsx' : /\.(jsx|js)$/.test(c.file) ? 'jsx' : '';
  const note = win.partial ? `\nShowing lines ${win.from}–${win.to} around the element; the component spans ${c.startLine}–${c.endLine ?? '?'}. Open the file for the rest.\n` : '';
  return `${'#'.repeat(h)} Source: ${c.file} (lines ${win.from}–${win.to})${note}\n\`\`\`${lang}\n${win.text}\n\`\`\``;
}

/** An earlier task on the same element that this request follows up on. */
export interface PreviousAttempt { instruction: string; summary?: string; files?: string[] }

/** One element, one request. The default prompt for Ask and Copy; with `previous`, a follow-up to that task. */
export function formatChangeRequest(f: PromptFacts, instruction: string, previous?: PreviousAttempt): string {
  const title = instruction.trim() ? `# Change request: ${describeTarget(f)}` : `# Context: ${describeTarget(f)}`;
  const parts = [title];
  if (instruction.trim()) parts.push(`## What to do\n${instruction.trim()}`);
  else parts.push('## What to do\nNo instruction yet. Use this as context for the next request about this element.');
  if (previous) {
    const lines = [`- Asked: ${previous.instruction.trim()}`];
    if (previous.summary?.trim()) lines.push(`- The agent's summary: ${previous.summary.trim()}`);
    if (previous.files?.length) lines.push(`- Files changed: ${previous.files.join(', ')}`);
    parts.push(`## Previous attempt\nThis is a follow-up. An earlier change to this element was kept on the page:\n${lines.join('\n')}\n\nBuild on that change instead of starting over, and don't undo it unless the request says so.`);
  }
  parts.push(formatElementSections(f, 2));
  const errors = pageErrorsSection(f);
  if (errors) parts.push(errors);
  parts.push(`## Constraints\n${constraints(f)}`);
  const src = sourceSection(f, 2);
  if (src) parts.push(src);
  return parts.join('\n\n') + '\n';
}

export type BatchRole = 'change' | 'reference' | 'keep';
const ROLE: Record<BatchRole, string> = {
  change: 'Change',
  reference: 'Reference only (read for context, do not modify)',
  keep: "Don't touch (must not be modified)",
};

/** Several elements, one goal (Batch). Sources are listed once per file at the end. */
export function formatBatchRequest(goal: string, items: Array<{ facts: PromptFacts; role: BatchRole }>): string {
  const parts = [`# Change request: ${items.length} elements`, `## What to do\n${goal.trim()}`];
  parts.push(`## Elements\n${items.map((it, i) => `${i + 1}. ${describeTarget(it.facts)}: ${ROLE[it.role]}`).join('\n')}`);
  items.forEach((it, i) => parts.push(`## ${i + 1}. ${it.facts.element.label} (${ROLE[it.role].split(' (')[0]})\n\n${formatElementSections(it.facts, 3)}`));
  const keep = items.filter((it) => it.role === 'keep').map((it) => `- Do not modify ${it.facts.element.label}${it.facts.component ? ` in ${it.facts.component.file}` : ''}.`);
  const reference = items.some((it) => it.role === 'reference') ? ['- Reference elements are examples to match; read them, do not edit them.'] : [];
  parts.push(`## Constraints\n${constraints(items.find((it) => it.role === 'change')?.facts || items[0].facts, [...reference, ...keep])}`);
  const seen = new Set<string>();
  for (const it of items) {
    const c = it.facts.component;
    if (!c?.code || seen.has(c.file)) continue;
    seen.add(c.file);
    const src = sourceSection(it.facts, 2);
    if (src) parts.push(src);
  }
  return parts.join('\n\n') + '\n';
}

/** One or more comments left on the page, each with its element's context. */
export function formatCommentsRequest(items: Array<{ facts: PromptFacts | null; text: string; fallback?: string }>): string {
  if (items.length === 1 && items[0].facts) return formatChangeRequest(items[0].facts, items[0].text);
  const parts = [`# Change request: ${items.length} comments left on the page`, '## What to do\nAddress each comment below. Each one names the element it was left on.'];
  items.forEach((it, i) => {
    parts.push(`## Comment ${i + 1}: ${it.facts ? describeTarget(it.facts) : it.fallback || 'element not on the current page'}\n> ${it.text.replace(/\n/g, '\n> ')}${it.facts ? `\n\n${formatElementSections(it.facts, 3)}` : ''}`);
  });
  const first = items.find((it) => it.facts)?.facts;
  if (first) parts.push(`## Constraints\n${constraints({ ...first, element: { ...first.element, isComponent: true } })}`);
  const seen = new Set<string>();
  for (const it of items) {
    const c = it.facts?.component;
    if (!c?.code || seen.has(c.file)) continue;
    seen.add(c.file);
    const src = sourceSection(it.facts!, 2);
    if (src) parts.push(src);
  }
  return parts.join('\n\n') + '\n';
}

// ---------- Place ----------

export type PlacePosition = 'before' | 'after' | 'inside-start' | 'inside-end' | 'over';

/** An image or video you put on the page at a spot, for the agent to add for real. */
export interface Placement {
  /** Project-relative path of the staged file (.agent-hover/place/…). */
  assetPath: string;
  mime: string;
  /** The file's name when you dropped it, for a sensible destination name. */
  fileName?: string;
  /** Where the app serves static files from (Vite's publicDir), project-relative; null when it has none. */
  publicDir?: string | null;
  position: PlacePosition;
  /** Rendered size of the mock on the page, CSS px. */
  width: number;
  height: number;
  /** The file's own size, px (video: its frame size). */
  natural?: { width: number; height: number };
  /** The target element's width, so the size can also be given as a share of it. */
  targetWidth?: number;
  /** Over: the top-left corner as a share of the target's box (0–1). */
  offset?: { x: number; y: number };
  alt?: string;
  video?: { loop: boolean; muted: boolean; autoplay: boolean };
}

const POSITION: Record<PlacePosition, string> = {
  before: 'directly before the element (as its previous sibling)',
  after: 'directly after the element (as its next sibling)',
  'inside-start': 'inside the element, as its first child',
  'inside-end': 'inside the element, as its last child',
  over: 'on top of the element, positioned over it',
};

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** Turns `My Logo (final).PNG` into `my-logo-final`, the base name suggested for the copy in the project. */
export function placeBaseName(fileName: string | undefined, fallback: string): string {
  const base = (fileName || '').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return base || fallback;
}

/** Place: add this asset to the page here, at this size. The staged file is copied into the project by the agent. */
export function formatPlaceRequest(f: PromptFacts, p: Placement, note = ''): string {
  const isVideo = p.mime.startsWith('video/');
  const isSvg = p.mime === 'image/svg+xml';
  const kind = isVideo ? 'video' : isSvg ? 'SVG' : p.mime === 'image/gif' ? 'GIF' : 'image';
  const ext = p.assetPath.split('.').pop() || '';
  const name = `${placeBaseName(p.fileName, p.assetPath.split('/').pop()!.replace(/\.[^.]+$/, ''))}.${ext}`;
  const dest = p.publicDir && p.publicDir !== '.' ? `${p.publicDir.replace(/\/+$/, '')}/${name}` : null;
  const media = isVideo ? 'media' : 'images';

  const what: string[] = [
    `Add the ${kind} ${code(p.assetPath)} to the page, ${POSITION[p.position]}.`,
    dest
      ? `Copy it into the project first, e.g. to ${code(dest)} (served as ${code('/' + name)}), unless this project keeps ${media} somewhere else: then follow that pattern (an ${code('assets')} import, an icons folder, an image component).`
      : `Copy it into the project first, where this project keeps its ${media} (follow the existing pattern: a public folder, an ${code('assets')} import, an icons folder, an image component).`,
    `Don't reference ${code('.agent-hover/')} from the code: that folder is temporary and not committed.`,
  ];
  if (note.trim()) what.push('', note.trim());

  const look: string[] = [];
  const share = p.targetWidth && p.position !== 'over' ? ` (${pct(p.width / p.targetWidth)} of the element's width)` : '';
  look.push(`- Size on the page: ${Math.round(p.width)}×${Math.round(p.height)}px${share}; keep the aspect ratio.`);
  look.push(p.natural ? `- The file itself: ${Math.round(p.natural.width)}×${Math.round(p.natural.height)}px, ${p.mime}.` : `- The file itself: ${p.mime}.`);
  if (p.position === 'over' && p.offset) {
    look.push(`- Position: its top-left corner at ${pct(p.offset.x)} from the element's left and ${pct(p.offset.y)} from its top. Make the element the positioning context if it isn't one, and don't let the ${kind} change the layout around it.`);
  } else {
    look.push(`- It takes part in the layout ${p.position.startsWith('inside') ? 'of the element' : 'next to the element'}; keep the spacing consistent with the neighbouring content.`);
  }
  if (isVideo && p.video) {
    const attrs = [p.video.autoplay && 'autoplay', p.video.loop && 'loop', p.video.muted && 'muted', 'playsInline'].filter(Boolean).join(', ');
    look.push(`- Video attributes: ${attrs}.`);
  }
  if (p.alt?.trim()) look.push(`- Alt text: “${p.alt.trim()}”.`);
  else if (!isVideo) look.push('- No alt text was given: treat it as decorative (alt="") unless it clearly carries meaning.');
  if (isSvg) look.push('- It is an SVG: check it before inlining (no scripts or external references); an <img> works too.');

  const article = kind === 'image' ? 'an image' : kind === 'SVG' ? 'an SVG' : `a ${kind}`;
  const parts = [
    `# Place ${article}: ${describeTarget(f)}`,
    `## What to do\n${what.join('\n')}`,
    `## The ${kind} as placed on the page\n${look.join('\n')}`,
    formatElementSections(f, 2),
    `## Constraints\n${constraints(f, [`- Add the ${kind} only; leave the element and its other content as they are.`])}`,
  ];
  const src = sourceSection(f, 2);
  if (src) parts.push(src);
  return parts.join('\n\n') + '\n';
}

// ---------- Talk & point ----------

/**
 * Talk & point: one sentence that names elements by number ("make [1] match [2], remove [3]"), and the elements.
 * Element n in the list is [n] in the sentence. What each one is for (change it, copy it) comes from the sentence.
 */
export function formatTalkRequest(text: string, items: Array<{ facts: PromptFacts }>): string {
  const parts = [
    `# Change request: ${items.length} element${items.length === 1 ? '' : 's'}`,
    `## What to do\n${text.trim()}\n\nThe numbers in brackets point at the elements below: [1] is element 1, [2] is element 2, and so on.`,
    `## Elements\n${items.map((it, i) => `${i + 1}. ${describeTarget(it.facts)}`).join('\n')}`,
  ];
  items.forEach((it, i) => parts.push(`## [${i + 1}] ${it.facts.element.label}\n\n${formatElementSections(it.facts, 3)}`));
  const errors = pageErrorsSection(items[0]?.facts);
  if (errors) parts.push(errors);
  const unnamed = items.map((_, i) => i + 1).filter((n) => !text.includes(`[${n}]`));
  const extra = [
    '- Change only what the request asks for. An element the request uses as an example (match it, like it) is a reference: read it, don\'t edit it.',
    ...(unnamed.length ? [`- ${unnamed.map((n) => `[${n}]`).join(', ')} ${unnamed.length === 1 ? 'is' : 'are'} not named in the request: treat ${unnamed.length === 1 ? 'it' : 'them'} as context.`] : []),
  ];
  parts.push(`## Constraints\n${constraints({ ...items[0].facts, element: { ...items[0].facts.element, isComponent: true } }, extra)}`);
  const seen = new Set<string>();
  for (const it of items) {
    const c = it.facts.component;
    if (!c?.code || seen.has(c.file)) continue;
    seen.add(c.file);
    const src = sourceSection(it.facts, 2);
    if (src) parts.push(src);
  }
  return parts.join('\n\n') + '\n';
}
