import { esc } from '../../lib/ui.js';
import { icon } from '../../lib/icon.js';
import { formatColorToHex } from '../../lib/computed-styles.js';
import { previewValue } from '../../lib/value-preview.js';
import type { OverlayApp } from '../../app/context.js';

export { previewValue };

const CHEV = icon('chev-right', 14).replace('class="ah-i"', 'class="ah-i chev"');
const LEVELS: Array<[string, string]> = [['minimal', 'Compact'], ['standard', 'Standard'], ['full', 'Deep']];

/** Inspect tab: everything about the current selection. No action buttons besides Copy (D-08). */
export function setupInspectPanel(app: OverlayApp) {
  const { state, api } = app;
  const cache = new WeakMap<object, { ctx: any; src: any } | null>();
  const loading = new WeakSet<object>();

  function ensureContext(item: any) {
    if (!item || cache.has(item) || loading.has(item)) return;
    loading.add(item);
    const stack = state.currentStack, index = state.currentStackIndex;
    api.sourceFor(stack, index).then(async (src: any) => {
      let ctx = null;
      if (src) {
        try { ctx = await api.fetchContext(src.file, src.line); } catch {}
      }
      cache.set(item, src ? { ctx, src } : null);
      loading.delete(item);
      if (item === state.selectedTarget) api.renderSidebar('inspect');
    });
  }

  api.registerPanel('inspect', {
    render(body: HTMLElement, foot: HTMLElement) {
      const item = state.selectedTarget;
      if (!item) {
        body.innerHTML = `<div class="ah-empty"><b>Nothing selected</b><p>Click any element on the page to see what it is, where it lives in your code, and its props, state and layout.</p><button class="ah-tbtn primary" data-act="pick">${icon('target', 14)}Pick an element <kbd>Alt</kbd></button></div>`;
        body.onclick = (e) => { if ((e.target as Element).closest('[data-act=pick]') && state.mode !== 'inspect') api.setMode('inspect'); };
        return;
      }
      ensureContext(item);
      const data = cache.get(item);
      const ctx = data?.ctx;
      const src = data?.src;
      const el = item.element as Element;
      const owner = src ? state.currentStack.find((s: any) => !s.isDomElement && s.name === src.component) || api.projectOwner(state.currentStack, state.currentStackIndex) : api.projectOwner(state.currentStack, state.currentStackIndex);
      const r = api.rectOf(item) || { width: 0, height: 0 };
      const cs = getComputedStyle(el);

      // Breadcrumb: outermost component first, current item last.
      const crumbs = state.currentStack
        .map((s: any, i: number) => ({ s, i }))
        .reverse()
        .map(({ s, i }: any) => `<button class="${i === state.currentStackIndex ? 'cur' : ''}" data-i="${i}">${esc(api.labelFor(s))}</button>`)
        .join('<span class="ah-muted">›</span>');

      const runtimeProps = owner?.fiber?.memoizedProps || {};
      const propKeys = Object.keys(runtimeProps).filter((k) => k !== 'children');
      const declared = new Map<string, any>((ctx?.interface?.props || []).map((p: any) => [p.name, p]));
      const propsHtml = propKeys.length
        ? propKeys.map((k) => `<dt title="${esc(declared.get(k)?.type || '')}">${esc(k)}</dt><dd>${esc(previewValue(runtimeProps[k], k))}</dd>`).join('')
        : (ctx?.interface?.props || []).map((p: any) => `<dt>${esc(p.name)}</dt><dd class="ah-muted">${esc(p.type)}${p.required ? '' : ' (optional)'}</dd>`).join('');
      const hooks: string[] = ctx?.interface?.hooks || [];
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 220);
      const swatch = (c: string) => `<span class="ah-swatch" style="background:${esc(c)}"></span>${esc(formatColorToHex(c) || c)}`;
      const code: string = ctx?.source?.code || '';
      const startLine = ctx?.source?.startLine || src?.line || 1;
      const codeLines = code.split('\n').slice(0, 120);

      body.innerHTML = `
        <div class="ah-ident">
          <div class="name">${esc(api.nameFor(item))}</div>
          <div class="code ah-mono">${esc(api.labelFor(item))}</div>
          <div class="file">${icon('file', 14)}${src ? `<button data-act="open" title="Open in editor">${esc(src.file)}:${src.line}</button>` : `<span>${data === undefined ? 'Finding source…' : 'No source file found'}</span>`}</div>
        </div>
        <div class="ah-crumbs">${crumbs}</div>
        ${owner ? `<details class="ah-sec" open><summary>${CHEV}Props<span class="meta">${propKeys.length || (ctx?.interface?.props || []).length || ''}</span></summary>
          ${propsHtml ? `<dl class="ah-kv">${propsHtml}</dl>` : '<div class="ah-text ah-muted">No props</div>'}</details>` : ''}
        ${hooks.length ? `<details class="ah-sec"><summary>${CHEV}State and hooks<span class="meta">${hooks.length}</span></summary>
          <div class="ah-text ah-mono" style="font-size:12px">${hooks.map(esc).join(', ')}</div></details>` : ''}
        ${text ? `<details class="ah-sec"><summary>${CHEV}Text</summary><div class="ah-text">${esc(text)}</div></details>` : ''}
        <details class="ah-sec" open><summary>${CHEV}Layout<span class="meta ah-mono">${Math.round(r.width)} × ${Math.round(r.height)}</span></summary>
          <div class="ah-box"><span class="lab">margin ${esc(cs.margin)}</span><div class="pad"><span class="lab">padding ${esc(cs.padding)}</span><div class="core">${Math.round(r.width)} × ${Math.round(r.height)}</div></div></div>
          <dl class="ah-kv">
            <dt>display</dt><dd>${esc(cs.display)}${cs.display.includes('flex') ? ` · ${esc(cs.flexDirection)} · gap ${esc(cs.gap)}` : ''}</dd>
            <dt>font</dt><dd>${esc(parseFloat(cs.fontSize) + 'px / ' + cs.fontWeight)} · ${esc(cs.lineHeight)}</dd>
            <dt>color</dt><dd>${swatch(cs.color)}</dd>
            <dt>background</dt><dd>${cs.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'transparent' : swatch(cs.backgroundColor)}</dd>
            <dt>radius</dt><dd>${esc(parseFloat(cs.borderRadius) >= 9999 ? 'full (9999px)' : cs.borderRadius)}</dd>
            <dt>position</dt><dd>${esc(cs.position)}</dd>
          </dl></details>
        ${code ? `<details class="ah-sec"><summary>${CHEV}Source<span class="meta ah-mono">${esc((ctx.source.file || '').split('/').pop())}</span></summary>
          <pre class="ah-src">${codeLines.map((l, i) => `<span class="ah-muted">${String(startLine + i).padStart(4, ' ')}</span>  ${esc(l)}`).join('\n')}</pre></details>` : ''}`;

      body.onclick = (e) => {
        const b = (e.target as Element).closest('button') as HTMLElement | null;
        if (!b) return;
        if (b.dataset.i !== undefined) api.selectIndex(Number(b.dataset.i));
        if (b.dataset.act === 'open' && src) api.openInEditor({ file: src.file, line: src.line, component: src.component });
      };

      foot.hidden = false;
      foot.innerHTML = `<span class="ah-mono" style="font-variant-numeric:tabular-nums;white-space:nowrap">${ctx?.tokens?.current ? ctx.tokens.current.toLocaleString() + ' tokens' : '—'}</span>
        <div class="ah-seg" style="margin-left:auto" role="radiogroup" aria-label="Context detail">${LEVELS.map(([v, l]) => `<button data-level="${v}" aria-pressed="${state.level === v}">${l}</button>`).join('')}</div>
        <button class="ah-tbtn outline" data-act="copy">${icon('copy', 14)}Copy</button>`;
      foot.onclick = (e) => {
        const b = (e.target as Element).closest('button') as HTMLElement | null;
        if (!b) return;
        if (b.dataset.level) {
          api.setContextLevel(b.dataset.level);
          cache.delete(item);
          api.renderSidebar('inspect');
        }
        if (b.dataset.act === 'copy') api.copySelection();
      };
    },
  });

  api.setContextLevel = (level: string) => {
    state.level = level;
    try { localStorage.setItem('agent-hover-context-level', level); } catch {}
  };
  try { state.level = localStorage.getItem('agent-hover-context-level') || state.level || 'standard'; } catch {}

}
