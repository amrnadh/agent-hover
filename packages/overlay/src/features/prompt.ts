import { buildHierarchyStack } from '../lib/fiber.js';
import { formatColorToHex } from '../lib/computed-styles.js';
import { buildCSSSelector } from '../lib/ui.js';
import { previewValue } from '../lib/value-preview.js';
import { findElementLine, formatChangeRequest, type ComponentFacts, type ElementFacts, type PromptFacts, type PreviousAttempt } from '../lib/prompt-format.js';
import type { OverlayApp } from '../app/context.js';

export interface BuiltPrompt {
  prompt: string;
  facts: PromptFacts;
  label: string;
  component: string;
  file: string;
  line?: number;
  selector: string;
  hierarchy: string[];
  tokens?: number;
}

const SKIP_ATTRS = new Set(['class', 'id', 'style']);
const color = (c: string) => (c === 'rgba(0, 0, 0, 0)' ? 'transparent' : formatColorToHex(c) || c);

/**
 * Gathers the facts about an element (what it is, where its code lives, how it looks, notes, locks)
 * and turns them into prompts with lib/prompt-format.ts. Shared by Ask, Copy, comments and batch.
 */
export function setupPrompt(app: OverlayApp) {
  const { BRIDGE, fetch, state, api } = app;
  Object.assign(api, { buildFacts, buildPrompt, buildPromptForSelection, fetchContext, buildCSSSelector, stackFor: (el: Element) => buildHierarchyStack(el) });

  state.level = state.level || 'standard';

  async function fetchContext(file: string, line: number) {
    const res = await fetch(BRIDGE + '/api/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, line, level: state.level }),
    });
    if (!res.ok) throw new Error('context ' + res.status);
    return res.json();
  }

  function elementFacts(item: any): ElementFacts {
    const el = item.element as HTMLElement;
    const cs = getComputedStyle(el);
    const r = api.rectOf(item) || el.getBoundingClientRect();
    const classes = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
    const attributes: Array<[string, string]> = Array.from(el.attributes)
      .filter((a) => !SKIP_ATTRS.has(a.name) && !a.name.startsWith('data-ah') && a.value.length < 200)
      .slice(0, 8)
      .map((a) => [a.name, a.value]);
    const layout = cs.display.includes('flex') ? `flex ${cs.flexDirection}, gap ${cs.gap}` : cs.display.includes('grid') ? `grid, gap ${cs.gap}` : '';
    return {
      label: api.labelFor(item),
      tag: el.tagName.toLowerCase(),
      isComponent: !item.isDomElement,
      selector: buildCSSSelector(el),
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160) || undefined,
      classes,
      attributes,
      size: { width: r.width, height: r.height },
      styles: {
        font: `${parseFloat(cs.fontSize)}px/${cs.fontWeight}`,
        color: color(cs.color),
        background: color(cs.backgroundColor),
        padding: cs.padding,
        margin: cs.margin,
        radius: parseFloat(cs.borderRadius) >= 9999 ? 'full' : cs.borderRadius,
        layout,
      },
    };
  }

  /** Load a component's source and interface from the bridge. */
  async function loadComponent(src: { file: string; line: number; component: string }) {
    let component: ComponentFacts = { name: src.component, file: src.file, startLine: src.line };
    let tokens: number | undefined;
    let ctx: any = null;
    try {
      ctx = await fetchContext(src.file, src.line);
      component = {
        name: ctx.component?.name || src.component,
        file: ctx.source?.file || src.file,
        startLine: ctx.source?.startLine ?? src.line,
        endLine: ctx.source?.endLine,
        code: ctx.source?.code,
        props: ctx.interface?.props,
        hooks: ctx.interface?.hooks,
      };
      tokens = ctx.tokens?.current;
    } catch (err) {
      console.warn('[agent-hover] Could not load component context', err);
    }
    return { src, component, tokens, ctx };
  }

  const locate = (c: ComponentFacts, el: ElementFacts) =>
    findElementLine(c.code, c.startLine || 1, { selector: el.selector, text: el.text, classes: el.classes, tag: el.tag, id: el.selector.match(/#([\w-]+)$/)?.[1] });

  /**
   * Sources of the components that wrote this element's JSX (React's owner chain), nearest first. An element
   * passed as children (<Card><button/></Card>) is written in the owner (App), not in the parent it renders in.
   */
  async function ownerSources(stack: any[], index: number) {
    const found: Array<{ file: string; line: number; component: string }> = [];
    let owner = stack[index]?.fiber?._debugOwner;
    for (let n = 0; owner && n < 5; n++, owner = owner._debugOwner) {
      const j = stack.findIndex((s: any, k: number) => k > index && !s.isDomElement && s.fiber && (s.fiber === owner || s.fiber === owner.alternate || s.fiber.alternate === owner));
      if (j < 0) continue;
      const ref = await api.sourceFor(stack, j);
      if (ref && !found.some((f) => f.file === ref.file && f.line === ref.line)) found.push(ref);
    }
    return found;
  }

  /** Everything an agent needs to find and change `stack[index]`. */
  async function buildFacts(stack: any[], index: number): Promise<{ facts: PromptFacts; tokens?: number } | null> {
    const item = stack[index];
    if (!item?.element) return null;
    const element = elementFacts(item);
    // React 19: the exact line of this element's JSX. The component around that line is the one that wrote it.
    const exact = await api.exactElementSource?.(item);
    if (exact) element.source = { file: exact.file, line: exact.line };
    const src = exact ? { file: exact.file, line: exact.line, component: '' } : await api.sourceFor(stack, index);
    let component: ComponentFacts | undefined;
    let tokens: number | undefined;
    if (src) {
      let loaded = await loadComponent(src);
      // The nearest component does not contain the element's JSX: use the component that wrote it.
      if (!exact && item.isDomElement && loaded.component.code && locate(loaded.component, element) === undefined) {
        for (const alt of await ownerSources(stack, index)) {
          if (alt.file === src.file && alt.line === src.line) continue;
          const other = await loadComponent(alt);
          if (other.component.code && locate(other.component, element) !== undefined) { loaded = other; break; }
        }
      }
      component = loaded.component;
      tokens = loaded.tokens;
      if (loaded.ctx && stack === state.currentStack && item === state.selectedTarget) {
        state.lastCopiedContext = loaded.ctx;
        state.lastResolved = { file: loaded.src.file, line: loaded.src.line };
      }
      const owner = stack.find((s: any) => !s.isDomElement && s.name === (loaded.src.component || loaded.component.name));
      const props = owner?.fiber?.memoizedProps;
      if (props && typeof props === 'object') {
        component.propValues = Object.keys(props)
          .filter((k) => k !== 'children')
          .slice(0, 12)
          .map((k) => [k, previewValue(props[k], k)] as [string, string]);
      }
    }

    const notes = (state.comments || [])
      .filter((c: any) => !c.resolved && c.selector && c.selector === element.selector)
      .map((c: any) => c.text);
    const frozen = (state.frozenEntries || [])
      .filter((f: any) => !component || f.component !== component.name)
      .map((f: any) => ({ component: f.component, file: f.file }));

    const facts: PromptFacts = {
      element,
      component,
      hierarchy: stack.slice(index).map((s: any) => (s.isDomElement ? api.labelFor(s) : s.name)).reverse(),
      notes,
      frozen,
      page: { path: location.pathname + location.hash, viewport: { width: window.innerWidth, height: window.innerHeight } },
      level: state.level,
    };
    return { facts, tokens };
  }

  async function buildPrompt(stack: any[], index: number, instruction: string, previous?: PreviousAttempt): Promise<BuiltPrompt | null> {
    const built = await buildFacts(stack, index);
    if (!built) return null;
    const { facts, tokens } = built;
    return {
      prompt: formatChangeRequest(facts, instruction, previous),
      facts,
      label: facts.element.label,
      component: facts.component?.name || '',
      // Where the element is written: its own JSX line (React 19), else the component's first line.
      file: facts.element.source?.file || facts.component?.file || '',
      line: facts.element.source?.line ?? facts.component?.startLine,
      selector: facts.element.selector,
      hierarchy: facts.hierarchy,
      tokens,
    };
  }

  function buildPromptForSelection(instruction = '') {
    return buildPrompt(state.currentStack, state.currentStackIndex, instruction);
  }
}
