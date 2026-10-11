import { buildHierarchyStack } from '../lib/fiber.js';
import { extractComputedStyles } from '../lib/computed-styles.js';
import { buildCSSSelector } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

export interface BuiltPrompt {
  prompt: string;
  label: string;
  component: string;
  file: string;
  line?: number;
  selector: string;
  hierarchy: string[];
  tokens?: number;
}

/**
 * Turns an element (+ optional instruction) into a self-contained prompt. Uses the owning component's
 * context from the bridge (source, props, hooks) when it can be resolved, otherwise element-only context.
 * Shared by the composer, comments, batch and Copy.
 */
export function setupPrompt(app: OverlayApp) {
  const { BRIDGE, fetch, state, api } = app;
  Object.assign(api, { buildPrompt, buildPromptForSelection, fetchContext, buildCSSSelector });

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

  async function buildPrompt(stack: any[], index: number, instruction: string): Promise<BuiltPrompt | null> {
    const item = stack[index];
    if (!item) return null;
    const label = api.labelFor(item);
    const element = item.element as Element;
    const selector = buildCSSSelector(element);
    const hierarchy = stack.slice(index).map((s: any) => s.name).reverse();
    const src = await api.sourceFor(stack, index);
    if (src) {
      try {
        const ctx = await fetchContext(src.file, src.line);
        if (stack === state.currentStack && item === state.selectedTarget) {
          state.lastCopiedContext = ctx;
          state.lastResolved = { file: src.file, line: src.line };
        }
        return {
          prompt: api.formatContextForAiPrompt(ctx, stack.slice(index), instruction),
          label,
          component: ctx.component?.name || src.component,
          file: ctx.source?.file || src.file,
          line: ctx.source?.startLine ?? src.line,
          selector,
          hierarchy,
          tokens: ctx.tokens?.current,
        };
      } catch (err) {
        console.warn('[agent-hover] Could not load component context; using element context', err);
      }
    }
    return {
      prompt: api.formatDomElementPrompt(item, extractComputedStyles(element), stack.slice(index), instruction),
      label,
      component: src?.component || '',
      file: src?.file || '',
      line: src?.line,
      selector,
      hierarchy,
    };
  }

  function buildPromptForSelection(instruction = '') {
    return buildPrompt(state.currentStack, state.currentStackIndex, instruction);
  }

  /** Re-create a stack for an element that is not the current selection (comments, batch items). */
  api.stackFor = (el: Element) => buildHierarchyStack(el);
}
