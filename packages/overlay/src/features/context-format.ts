// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Component resolution and AI prompt / clipboard formatters. */
export function setupContextFormat(app: OverlayApp) {
  const { BRIDGE, fetch, state, api } = app;
  Object.assign(api, { resolveComponent, escapeHtml, formatContextForAiPrompt, formatDomElementPrompt });

  async function resolveComponent(info) {
    if (info.source && info.source.fileName) {
      const fn = info.source.fileName.split('/').pop().replace(/\.[jt]sx?$/, '');
      if (fn.toLowerCase() === info.name.toLowerCase()) {
        return { file: info.source.fileName, line: info.source.lineNumber };
      }
    }
    try {
      // Send ancestor names so bridge can prefer the right file
      const ancestorNames = state.currentStack.map(c => c.name).filter(n => n !== info.name);
      const res = await fetch(BRIDGE + '/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentName: info.name, ancestors: ancestorNames })
      });
      const data = await res.json();
      if (data.resolved) return { file: data.file, line: data.line };
    } catch(e) {}
    return null;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatContextForAiPrompt(ctx, stack, customTask) {
    const bt = String.fromCharCode(96);
    const nl = String.fromCharCode(10);
    const compName = ctx.component && ctx.component.name ? '<' + ctx.component.name + ' />' : 'Target Component';
    let text = '### Component Task: ' + compName + nl;
    if (ctx.source && ctx.source.file) {
      text += '- **Location**: ' + bt + ctx.source.file + (ctx.source.startLine ? ':' + ctx.source.startLine + '-' + ctx.source.endLine : '') + bt + nl;
    }
    if (stack && stack.length > 0) {
      const pathStr = stack.map(function(s) { return s.name; }).reverse().join(' › ');
      text += '- **Hierarchy**: ' + pathStr + nl;
    }
    if (customTask && customTask.trim()) {
      text += nl + '#### Objective' + nl + '> ' + customTask.trim() + nl;
    }
    if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
      const propSummary = ctx.interface.props.map(function(p) { return p.name + ': ' + p.type + (p.required ? ' (req)' : ''); }).join(', ');
      text += '- **Props**: ' + propSummary + nl;
    }
    if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
      text += '- **Hooks**: ' + ctx.interface.hooks.join(', ') + nl;
    }
    if (typeof state.comments !== 'undefined' && state.comments && state.comments.length > 0) {
      const relComments = state.comments.filter(c => (ctx.component && c.component === ctx.component.name) || (ctx.source && c.file === ctx.source.file));
      if (relComments.length > 0) {
        text += nl + '#### Active Notes & Feedback' + nl;
        relComments.forEach(c => {
          text += '- ' + (c.resolved ? '[RESOLVED] ' : '') + c.text + nl;
        });
      }
    }
    if (ctx.source && ctx.source.code) {
      text += nl + '#### Source Code' + nl + bt+bt+bt + 'tsx' + nl + ctx.source.code + nl + bt+bt+bt + nl;
    }
    text += nl + '> Token Budget: ~' + (ctx.tokens && ctx.tokens.current ? ctx.tokens.current : '150') + ' tokens' + nl;
    return text;
  }

  function formatDomElementPrompt(target, computedStyles, stack, customTask) {
    const bt = String.fromCharCode(96);
    const nl = String.fromCharCode(10);
    const el = target?.element || state.selectedElement;
    const tag = el ? el.tagName.toLowerCase() : 'element';
    const classes = el && el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    const selector = (typeof api.buildCSSSelector === 'function' && el) ? api.buildCSSSelector(el) : tag + classes;

    let text = '### UI Element Task: <' + tag + classes + ' />' + nl;
    text += '- **Selector**: ' + bt + selector + bt + nl;
    if (stack && stack.length > 0) {
      const pathStr = stack.map(function(s) { return s.name; }).reverse().join(' › ');
      text += '- **Hierarchy**: ' + pathStr + nl;
    }
    if (customTask && customTask.trim()) {
      text += nl + '#### Objective' + nl + '> ' + customTask.trim() + nl;
    }
    if (computedStyles) {
      text += nl + '#### Computed Styles & Box Model' + nl;
      if (computedStyles.boundingBox) {
        text += '- **Dimensions**: ' + Math.round(computedStyles.boundingBox.width) + 'px × ' + Math.round(computedStyles.boundingBox.height) + 'px (at x: ' + Math.round(computedStyles.boundingBox.left) + ', y: ' + Math.round(computedStyles.boundingBox.top) + ')' + nl;
      }
      text += '- **Layout**: display: ' + (computedStyles.display || 'block') + ' | position: ' + (computedStyles.position || 'static') + nl;
      text += '- **Colors**: color: ' + (computedStyles.color || 'inherit') + ' | bg: ' + (computedStyles.backgroundColor || 'transparent') + nl;
      text += '- **Typography**: ' + (computedStyles.fontSize || '14px') + ' line-height: ' + (computedStyles.lineHeight || 'normal') + nl;
    }
    if (typeof state.comments !== 'undefined' && state.comments && state.comments.length > 0) {
      const relComments = state.comments.filter(c => c.selector === selector || (c.component && target && c.component === target.name));
      if (relComments.length > 0) {
        text += nl + '#### Active Notes & Feedback' + nl;
        relComments.forEach(c => {
          text += '- ' + (c.resolved ? '[RESOLVED] ' : '') + c.text + nl;
        });
      }
    }
    return text;
  }

  function formatContextForClipboard(ctx) {
    const bt = String.fromCharCode(96);
    const nl = String.fromCharCode(10);
    let text = '## ' + ctx.component.name + nl;
    text += '**Source**: ' + bt + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + bt + nl + nl;
    if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
      text += '### Props' + nl;
      ctx.interface.props.forEach(function(p) { text += '- ' + p.name + ': ' + p.type + (p.required ? ' (required)' : '') + nl; });
      text += nl;
    }
    if (ctx.source.code) {
      text += '### Source Code' + nl + bt+bt+bt + 'tsx' + nl + ctx.source.code + nl + bt+bt+bt + nl;
    }
    if (ctx.imports) {
      text += '### Imports' + nl;
      ctx.imports.forEach(function(imp) { text += '- ' + imp.name + ' from ' + imp.source + nl; });
    }
    text += nl + '**Tokens**: ' + ctx.tokens.current + nl;
    return text;
  }
}
