// @ts-nocheck
import { ICONS } from '../icons.js';
import { getComponentBoundingRect } from '../lib/fiber.js';
import { extractComputedStyles, formatColorToHex } from '../lib/computed-styles.js';
import type { OverlayApp } from '../app/context.js';

/** Sidebar inspector panel rendering and component context loading. */
export function setupInspectorPanel(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, dom, api } = app;
  Object.assign(api, { renderFlyoutForStackIndex, loadComponentContext });

  async function renderFlyoutForStackIndex(index) {
    if (!state.currentStack || state.currentStack.length === 0) return;
    state.currentStackIndex = index;
    const item = state.currentStack[index];
    state.currentComponentInfo = item;

    // Lock persistent selection frame on the selected element/component
    state.selectedTarget = item;
    state.selectedElement = item.element || state.currentElement;
    api.updateSelectionFrame();

    // Update selection chip text (S4: show component name or tag, with at most the first class)
    if (dom.selName) {
      let labelText = '';
      if (item.isDomElement) {
        const el = item.element || state.currentElement;
        const rawClass = el && (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '');
        const firstClass = rawClass ? rawClass.trim().split(/\s+/).filter(Boolean)[0] : '';
        labelText = firstClass ? (item.name + '.' + firstClass) : item.name;
      } else {
        labelText = '<' + item.name + ' />';
      }
      dom.selName.textContent = labelText;
      dom.selName.title = labelText;
    }
    if (dom.selFile) {
      if (item.source) {
        const shortFile = item.source.fileName.split('/').slice(-2).join('/');
        dom.selFile.textContent = shortFile + ':' + item.source.lineNumber;
      } else if (state.currentStack.length > 1 && state.currentStack[1].source) {
        const shortFile = state.currentStack[1].source.fileName.split('/').slice(-2).join('/');
        dom.selFile.textContent = shortFile + ':' + state.currentStack[1].source.lineNumber;
      } else {
        dom.selFile.textContent = '';
      }
    }

    // Hide hover highlight because selection frame is now displayed
    dom.highlight.style.display = 'none';

    // Store the selected element's rect for measurement guides
    if (item.isDomElement && item.element) {
      state.selectedRect = item.element.getBoundingClientRect();
    } else if (item.fiber) {
      state.selectedRect = getComponentBoundingRect(item.fiber);
    } else if (state.currentElement) {
      state.selectedRect = state.currentElement.getBoundingClientRect();
    }
    api.clearDistanceGuides();

    api.setSidebarTab('inspector');
    if (state.showSpacingOverlay && (item.element || state.selectedElement)) {
      api.positionBands(item.element || state.selectedElement);
    }

    // Render interactive breadcrumbs with proper HTML escaping
    const breadcrumbEl = shadow.getElementById('cp-flyout-breadcrumb');
    if (state.currentStack && state.currentStack.length > 0) {
      const crumbs = [];
      for (let i = state.currentStack.length - 1; i >= 0; i--) {
        const c = state.currentStack[i];
        const isActive = i === state.currentStackIndex;
        const style = isActive
          ? 'color:#ffffff; font-weight:600; cursor:pointer; padding:2px 8px; border-radius:4px; background:#2c2c2c; border:1px solid #444444; white-space:nowrap;'
          : 'color:var(--text-muted); cursor:pointer; padding:2px 6px; border-radius:4px; white-space:nowrap;';
        const label = c.isDomElement ? c.name : '<' + c.name + ' />';
        crumbs.push('<span style="' + style + '" data-bc-idx="' + i + '" title="' + api.escapeHtml(label) + '">' + api.escapeHtml(label) + '</span>');
      }
      breadcrumbEl.innerHTML = crumbs.join('<span style="color:var(--text-muted); margin:0 2px; font-size:10px;">›</span>');
      breadcrumbEl.style.display = 'flex';
      breadcrumbEl.style.alignItems = 'center';
      breadcrumbEl.style.overflowX = 'auto';

      breadcrumbEl.onclick = (evt) => {
        const targetEl = evt.target.closest('[data-bc-idx]');
        if (!targetEl) return;
        const idx = parseInt(targetEl.getAttribute('data-bc-idx'), 10);
        if (isNaN(idx) || idx < 0 || idx >= state.currentStack.length) return;
        renderFlyoutForStackIndex(idx);
      };
    } else {
      breadcrumbEl.style.display = 'none';
    }

    const computedStyles = state.currentElement ? extractComputedStyles(state.currentElement) : {};
    if (state.inSettingsView) api.toggleSettingsView(false);

    if (item.isDomElement) {
      const el = item.element || state.currentElement;
      if (dom.flyoutTitle) {
        dom.flyoutTitle.textContent = item.name;
        dom.flyoutTitle.title = item.name;
      }
      state.lastInfoName = item.name;
      const subtitleEl = shadow.getElementById('cp-flyout-subtitle');
      if (subtitleEl) {
        const rawClass = el && (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '');
        const classStr = rawClass ? rawClass.trim() : '';
        if (classStr) {
          subtitleEl.textContent = classStr;
          subtitleEl.title = classStr;
          subtitleEl.style.display = 'block';
        } else {
          subtitleEl.textContent = '';
          subtitleEl.title = '';
          subtitleEl.style.display = 'none';
        }
      }
      let html = '';

      // Contextual In-Inspector Note Card
      const selector = (typeof api.buildCSSSelector === 'function' && el) ? api.buildCSSSelector(el) : (el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''));
      const attachedNote = (typeof state.comments !== 'undefined' && state.comments && state.comments.length > 0)
        ? state.comments.find(c => {
            if (c.selector) {
              try {
                if (el.matches && el.matches(c.selector)) return true;
                if (el.closest && el.closest(c.selector)) return true;
              } catch (_) {}
              if (c.selector === selector) return true;
            }
            if (c.component && item.name && (c.component === item.name || item.name.includes(c.component))) return true;
            return false;
          })
        : null;

      if (attachedNote) {
        html += '<div class="cp-section" id="cp-inspector-attached-note" style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); border-left:3px solid var(--accent); border-radius:8px; padding:10px 12px; margin-bottom:14px; cursor:pointer;" title="Click to view or edit attached note">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
        html += '<span style="display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:var(--accent);">' + ICONS.comment + ' Attached Note</span>';
        html += '<span class="cp-badge cp-badge-' + (attachedNote.status === 'resolved' ? 'emerald' : 'accent') + '" style="font-size:9.5px; text-transform:uppercase;">' + api.escapeHtml(attachedNote.status || 'open') + '</span>';
        html += '</div>';
        html += '<div style="font-size:12px; color:var(--text-primary); line-height:1.45; word-break:break-word; max-height:80px; overflow-y:auto;">' + api.escapeHtml(attachedNote.text) + '</div>';
        html += '<div style="margin-top:6px; font-size:10.5px; color:var(--text-secondary); font-weight:500;">Click to edit note ›</div>';
        html += '</div>';
      }

      html += '<div class="cp-section" style="margin-bottom:14px;">';
      html += '<span class="cp-badge cp-badge-accent">' + el.tagName.toLowerCase() + '</span> ';
      if (el.id) html += '<span class="cp-badge cp-badge-emerald">#' + el.id + '</span> ';
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\\s+/).slice(0, 6);
        if (cls.length && cls[0]) {
          cls.forEach(function(c) {
            html += '<span class="cp-badge cp-badge-muted">.' + c + '</span> ';
          });
        }
      }
      html += '</div>';

      // If inside a React component, link to the parent component
      if (state.currentStack.length > 1) {
        const parentComp = state.currentStack[1];
        html += '<div class="cp-section" id="cp-parent-comp-card" style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); border-radius:8px; padding:10px 14px; margin-bottom:14px; cursor:pointer;" title="Click to view component">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
        html += '<span style="font-size:10.5px; color:var(--text-muted); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.5px;">Rendered In Component</span>';
        html += '<span style="font-size:10.5px; color:var(--text-secondary); font-weight:600;">Inspect Component ›</span>';
        html += '</div>';
        html += '<div style="font-size:13.5px; font-weight:700; color:var(--text-primary); margin-top:3px;">&lt;' + parentComp.name + ' /&gt;</div>';
        if (parentComp.source) {
          html += '<div style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted); margin-top:3px;">' + parentComp.source.fileName + ':' + parentComp.source.lineNumber + '</div>';
          state.lastResolved = { file: parentComp.source.fileName, line: parentComp.source.lineNumber };
        }
        html += '</div>';
      }

      // Text content preview (leaf or concise direct text only, avoid whole-page dump)
      let text = '';
      if (el.children.length === 0) {
        text = el.textContent ? el.textContent.trim() : '';
      } else {
        let directText = '';
        for (let i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === 3) {
            directText += el.childNodes[i].textContent.trim() + ' ';
          }
        }
        text = directText.trim();
      }
      if (text) {
        if (text.length > 150) text = text.slice(0, 150) + '...';
        html += '<details class="cp-section" open>';
        html += '<summary class="cp-section-title">Text Content</summary>';
        html += '<div style="margin-top:6px; font-size:12px; color:var(--text-secondary); word-break:break-word; max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:8px 10px; border-radius:6px; font-family:var(--font-mono);">' + api.escapeHtml(text) + '</div>';
        html += '</details>';
      } else if (el.children.length > 0) {
        html += '<div style="margin-bottom:12px; font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">' + el.children.length + ' child element' + (el.children.length > 1 ? 's' : '') + '</div>';
      }

      // Attributes
      const attrs = Array.from(el.attributes || []).filter(a => a.name !== 'class' && a.name !== 'id' && a.name !== 'style');
      if (attrs.length > 0) {
        html += '<details class="cp-section" open>';
        html += '<summary class="cp-section-title">Attributes (' + attrs.length + ')</summary>';
        html += '<table class="cp-props-table"><tr><th>Name</th><th>Value</th></tr>';
        attrs.forEach(function(a) {
          const val = a.value.length > 60 ? a.value.substring(0, 60) + '...' : a.value;
          html += '<tr><td style="color:var(--text-primary); font-weight:500;">' + a.name + '</td><td style="color:var(--text-secondary);">' + api.escapeHtml(val) + '</td></tr>';
        });
        html += '</table></details>';
      }

      // Compact visual layout metrics
      if (computedStyles && Object.keys(computedStyles).length > 0) {
        html += '<details class="cp-section" open>';
        html += '<summary class="cp-section-title">Layout & Dimensions</summary>';
        html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; font-family:var(--font-mono); background:var(--bg-surface-sunken); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">';
        html += '<div><span style="color:var(--text-muted);">size:</span> <strong style="color:var(--text-primary);">' + Math.round(parseFloat(computedStyles.width)) + ' × ' + Math.round(parseFloat(computedStyles.height)) + '</strong></div>';
        html += '<div><span style="color:var(--text-muted);">display:</span> ' + computedStyles.display + '</div>';
        html += '<div><span style="color:var(--text-muted);">padding:</span> ' + computedStyles.padding + '</div>';
        html += '<div><span style="color:var(--text-muted);">margin:</span> ' + computedStyles.margin + '</div>';
        if (computedStyles.display && computedStyles.display.includes('flex')) {
          html += '<div><span style="color:var(--text-muted);">flex-dir:</span> ' + computedStyles.flexDirection + '</div>';
          html += '<div><span style="color:var(--text-muted);">gap:</span> ' + computedStyles.gap + '</div>';
        }
        if (computedStyles.color) {
          const hexColor = formatColorToHex(computedStyles.color);
          html += '<div style="display:flex; align-items:center; gap:4px;"><span style="color:var(--text-muted);">color:</span> <span style="width:9px; height:9px; border-radius:2px; background:' + computedStyles.color + '; border:1px solid rgba(255,255,255,0.2);"></span>' + hexColor + '</div>';
        }
        if (computedStyles.backgroundColor && computedStyles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          const hexBg = formatColorToHex(computedStyles.backgroundColor);
          html += '<div style="display:flex; align-items:center; gap:4px;"><span style="color:var(--text-muted);">bg:</span> <span style="width:9px; height:9px; border-radius:2px; background:' + computedStyles.backgroundColor + '; border:1px solid rgba(255,255,255,0.2);"></span>' + hexBg + '</div>';
        }
        html += '</div></details>';
      }

      dom.flyoutContent.innerHTML = html;

      const noteCard = shadow.getElementById('cp-inspector-attached-note');
      if (noteCard && attachedNote) {
        noteCard.onclick = () => {
          api.openNotePopover({ element: el, name: item.name }, attachedNote);
        };
      }

      const parentCard = shadow.getElementById('cp-parent-comp-card');
      if (parentCard) {
        parentCard.onclick = () => renderFlyoutForStackIndex(1);
      }

      // Fetch parent component context in background so tokens and copy context are ready!
      if (state.currentStack.length > 1) {
        api.resolveComponent(state.currentStack[1]).then(async (resolved) => {
          if (resolved) {
            state.lastResolved = resolved;
            try {
              const level = shadow.getElementById('cp-context-level')?.value || 'standard';
              const res = await fetch(BRIDGE + '/api/context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: resolved.file, line: resolved.line, level })
              });
              const ctx = await res.json();
              state.lastCopiedContext = ctx;
              const tokenCountEl = shadow.getElementById('cp-token-count');
              const tokenSavingsEl = shadow.getElementById('cp-token-savings');
              if (tokenCountEl && ctx.tokens) {
                tokenCountEl.textContent = ctx.tokens.current || 0;
              }
              if (tokenSavingsEl && ctx.tokens) {
                const fullTokens = ctx.tokens.full || 0;
                const curTokens = ctx.tokens.current || 0;
                if (fullTokens > curTokens && fullTokens > 0) {
                  const saved = Math.round((1 - curTokens / fullTokens) * 100);
                  tokenSavingsEl.textContent = saved + '% smaller than full';
                } else {
                  tokenSavingsEl.textContent = 'prompt-ready';
                }
              }
            } catch(e) {}
          }
        });
      }
    } else {
      // React Component
      if (dom.flyoutTitle) {
        dom.flyoutTitle.textContent = item.name;
        dom.flyoutTitle.title = item.name;
      }
      state.lastInfoName = item.name;
      const subtitleEl = shadow.getElementById('cp-flyout-subtitle');
      if (subtitleEl) {
        const el = item.element || state.currentElement;
        const rawClass = el && (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '');
        const classStr = rawClass ? rawClass.trim() : '';
        if (classStr) {
          subtitleEl.textContent = classStr;
          subtitleEl.title = classStr;
          subtitleEl.style.display = 'block';
        } else if (item.source && item.source.fileName) {
          const shortFile = item.source.fileName.split('/').slice(-2).join('/') + ':' + item.source.lineNumber;
          subtitleEl.textContent = shortFile;
          subtitleEl.title = item.source.fileName + ':' + item.source.lineNumber;
          subtitleEl.style.display = 'block';
        } else {
          subtitleEl.textContent = '';
          subtitleEl.title = '';
          subtitleEl.style.display = 'none';
        }
      }
      dom.flyoutContent.innerHTML = '<p style="color:var(--text-secondary);">Loading context...</p>';
      try {
        const resolved = await api.resolveComponent(item);
        if (!resolved) {
          dom.flyoutContent.innerHTML = '<p style="color:#fb7185;">Could not find source file for ' + item.name + '</p>';
          return;
        }
        fetch(BRIDGE + '/api/computed-styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: resolved.file + ':' + item.name, styles: computedStyles })
        }).catch(e => console.error(e));

        await loadComponentContext(item.name, resolved, computedStyles);
      } catch(err) {
        dom.flyoutContent.innerHTML = '<p style="color:#fb7185;">Failed to load context: ' + err.message + '</p>';
      }
    }
  }

  async function loadComponentContext(infoName, resolved, computedStyles) {
    dom.flyoutContent.innerHTML = '<p style="color:var(--text-secondary);">Loading context...</p>';
    try {
      const level = shadow.getElementById('cp-context-level')?.value || 'standard';
      const res = await fetch(BRIDGE + '/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: resolved.file, line: resolved.line, level })
      });
      const ctx = await res.json();
      state.lastCopiedContext = ctx;
      state.lastResolved = resolved;
      state.lastInfoName = infoName;
      state.lastComputedStyles = computedStyles;

      // Update Live Token Meter
      const tokenCountEl = shadow.getElementById('cp-token-count');
      const tokenSavingsEl = shadow.getElementById('cp-token-savings');
      if (tokenCountEl && ctx.tokens) {
        tokenCountEl.textContent = ctx.tokens.current || 0;
      }
      if (tokenSavingsEl && ctx.tokens) {
        const fullTokens = ctx.tokens.full || 0;
        const curTokens = ctx.tokens.current || 0;
        if (fullTokens > curTokens && fullTokens > 0) {
          const saved = Math.round((1 - curTokens / fullTokens) * 100);
          tokenSavingsEl.textContent = saved + '% smaller than full';
        } else {
          tokenSavingsEl.textContent = 'prompt-ready';
        }
      }

      let html = '';

      // Contextual In-Inspector Note Card
      const attachedNote = (typeof state.comments !== 'undefined' && state.comments && state.comments.length > 0)
        ? state.comments.find(c => (c.component && ctx.component && c.component === ctx.component.name) || (c.file && ctx.source && c.file === ctx.source.file))
        : null;

      if (attachedNote) {
        html += '<div class="cp-section" id="cp-inspector-attached-note" style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); border-left:3px solid var(--accent); border-radius:8px; padding:10px 12px; margin-bottom:14px; cursor:pointer;" title="Click to view or edit attached note">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
        html += '<span style="display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:var(--accent);">' + ICONS.comment + ' Attached Note</span>';
        html += '<span class="cp-badge cp-badge-' + (attachedNote.status === 'resolved' ? 'emerald' : 'accent') + '" style="font-size:9.5px; text-transform:uppercase;">' + api.escapeHtml(attachedNote.status || 'open') + '</span>';
        html += '</div>';
        html += '<div style="font-size:12px; color:var(--text-primary); line-height:1.45; word-break:break-word; max-height:80px; overflow-y:auto;">' + api.escapeHtml(attachedNote.text) + '</div>';
        html += '<div style="margin-top:6px; font-size:10.5px; color:var(--text-secondary); font-weight:500;">Click to edit note ›</div>';
        html += '</div>';
      }

      html += '<div class="cp-section" style="margin-bottom:14px;">';
      html += '<span class="cp-badge cp-badge-accent">' + ctx.component.type + '</span> ';
      html += '<span class="cp-badge cp-badge-emerald">' + ctx.component.exportType + ' export</span> ';
      html += '<span class="cp-badge cp-badge-muted">' + ctx.tokens.current + ' tokens</span>';
      html += '<div style="margin-top:8px; font-size:12px; font-family:var(--font-mono); color:var(--text-muted);">' + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + '</div>';
      html += '</div>';

      if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
        html += '<details class="cp-section" open>';
        html += '<summary class="cp-section-title">Props (' + ctx.interface.props.length + ')</summary>';
        html += '<table class="cp-props-table"><tr><th>Name</th><th>Type</th><th>Req</th></tr>';
        ctx.interface.props.forEach(function(p) {
          html += '<tr><td style="color:var(--text-primary); font-weight:500;">' + p.name + '</td><td style="color:var(--text-secondary);">' + p.type + '</td><td style="color:var(--accent-emerald);">' + (p.required ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '—') + '</td></tr>';
        });
        html += '</table></details>';
      }

      if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
        html += '<details class="cp-section" open>';
        html += '<summary class="cp-section-title">Hooks</summary>';
        html += '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary); margin-top:6px;">' + ctx.interface.hooks.join(', ') + '</div>';
        html += '</details>';
      }

      if (ctx.imports && ctx.imports.length > 0) {
        html += '<details class="cp-section">';
        html += '<summary class="cp-section-title">Imports (' + ctx.imports.length + ')</summary>';
        html += '<div style="margin-top:8px;">';
        ctx.imports.forEach(function(imp) {
          const badge = imp.isLocal ? '<span class="cp-badge cp-badge-emerald" style="font-size:9px; padding:2px 5px;">LOCAL</span>' : '<span class="cp-badge cp-badge-muted" style="font-size:9px; padding:2px 5px;">PKG</span>';
          html += '<div style="padding:4px 0; display:flex; align-items:center; gap:8px;">' + badge + ' <span style="font-family:var(--font-mono); font-size:11.5px;">' + imp.name + '</span></div>';
        });
        html += '</div></details>';
      }

      if (computedStyles && Object.keys(computedStyles).length > 0) {
        html += '<details class="cp-section" open>';
        html += '<summary class="cp-section-title">Computed Box Model</summary>';
        html += '<div class="cp-box-model">';
        html += '<div style="margin-bottom:4px; color:var(--text-muted);">margin: ' + computedStyles.margin + '</div>';
        html += '<div style="border:1px dashed #475569; padding:8px; margin:4px; display:inline-block; border-radius:6px;">';
        html += '<div style="margin-bottom:4px; color:var(--text-muted);">border: ' + computedStyles.border + '</div>';
        html += '<div style="border:1px solid var(--border-glass); padding:8px; margin:4px; display:inline-block; background:rgba(255,255,255,0.03); border-radius:4px;">';
        html += '<div style="margin-bottom:4px; color:var(--text-muted);">padding: ' + computedStyles.padding + '</div>';
        html += '<div style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); padding:8px 12px; display:inline-block; color:var(--text-primary); border-radius:4px; font-weight:600;">';
        html += Math.round(parseFloat(computedStyles.width)) + ' × ' + Math.round(parseFloat(computedStyles.height));
        html += '</div></div></div></div>';
        
        html += '<div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; font-family:var(--font-mono);">';
        html += '<div><span style="color:var(--text-muted);">display:</span> ' + computedStyles.display + '</div>';
        html += '<div><span style="color:var(--text-muted);">position:</span> ' + computedStyles.position + '</div>';
        if (computedStyles.display && computedStyles.display.includes('flex')) {
          html += '<div><span style="color:var(--text-muted);">flex-dir:</span> ' + computedStyles.flexDirection + '</div>';
          html += '<div><span style="color:var(--text-muted);">gap:</span> ' + computedStyles.gap + '</div>';
        }
        const hexColor = formatColorToHex(computedStyles.color);
        html += '<div><span style="color:var(--text-muted);">color:</span> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + api.escapeHtml(computedStyles.color) + '; margin-right:4px;"></span>' + api.escapeHtml(hexColor) + '</div>';
        html += '</div>';
        html += '</details>';
      }

      if (ctx.source && ctx.source.code) {
        html += '<details class="cp-section" open>';
        html += '<summary class="cp-section-title" style="display:flex; justify-content:space-between; align-items:center;">';
        html += '<span>Component Source</span>';
        html += '<button class="cp-btn-bento" id="cp-toggle-source-editor" style="font-size:10.5px; padding:2px 8px; border-radius:4px; margin-left:auto; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source</button>';
        html += '</summary>';
        html += '<div id="cp-source-preview-box">';
        html += '<div class="cp-code" id="cp-source-code-display">' + api.escapeHtml(ctx.source.code) + '</div>';
        html += '</div>';
        html += '<div id="cp-source-editor-box" style="display:none; margin-top:8px;">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:11px; font-family:var(--font-mono); color:var(--text-muted);">';
        html += '<span>' + ctx.source.file.split('/').pop() + ' (L' + ctx.source.startLine + '-L' + ctx.source.endLine + ')</span>';
        html += '<span style="color:var(--text-secondary); font-weight:500;">Direct Disk Edit</span>';
        html += '</div>';
        html += '<textarea id="cp-source-code-editor" spellcheck="false"></textarea>';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:8px;">';
        html += '<div style="display:flex; gap:6px;">';
        html += '<button class="cp-btn-bento primary" id="cp-source-save-btn" style="padding:5px 12px; font-size:11px; display:inline-flex; align-items:center; gap:5px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd></button>';
        html += '<button class="cp-btn-bento" id="cp-source-undo-btn" style="padding:5px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Undo</button>';
        html += '</div>';
        html += '<button class="cp-btn-bento" id="cp-source-cancel-btn" style="padding:5px 8px; font-size:11px;">Close</button>';
        html += '</div>';
        html += '<div id="cp-source-save-status" style="font-size:11px; font-family:var(--font-mono); margin-top:6px; min-height:16px;"></div>';
        html += '</div>';
        html += '</details>';
      }

      dom.flyoutContent.innerHTML = html;

      const noteCard = shadow.getElementById('cp-inspector-attached-note');
      if (noteCard && attachedNote) {
        noteCard.onclick = () => {
          api.openNotePopover({ element: state.selectedTarget?.element, name: ctx.component?.name || infoName }, attachedNote);
        };
      }

      // Wire up in-flyout Component Source Editor
      const toggleEditorBtn = shadow.getElementById('cp-toggle-source-editor');
      const previewBox = shadow.getElementById('cp-source-preview-box');
      const editorBox = shadow.getElementById('cp-source-editor-box');
      const codeTextarea = shadow.getElementById('cp-source-code-editor');
      const saveSourceBtn = shadow.getElementById('cp-source-save-btn');
      const undoSourceBtn = shadow.getElementById('cp-source-undo-btn');
      const cancelSourceBtn = shadow.getElementById('cp-source-cancel-btn');
      const saveStatus = shadow.getElementById('cp-source-save-status');

      if (toggleEditorBtn && previewBox && editorBox && codeTextarea) {
        toggleEditorBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isEditing = editorBox.style.display !== 'none';
          if (isEditing) {
            editorBox.style.display = 'none';
            previewBox.style.display = 'block';
            toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source';
          } else {
            codeTextarea.value = ctx.source.code;
            editorBox.style.display = 'block';
            previewBox.style.display = 'none';
            toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview';
            if (saveStatus) saveStatus.textContent = '';
            setTimeout(() => codeTextarea.focus(), 50);
          }
        };

        if (cancelSourceBtn) {
          cancelSourceBtn.onclick = (e) => {
            e.preventDefault();
            editorBox.style.display = 'none';
            previewBox.style.display = 'block';
            toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source';
          };
        }

        const handleSaveSource = async () => {
          if (!saveSourceBtn || saveSourceBtn.disabled) return;
          const newSource = codeTextarea.value;
          saveSourceBtn.disabled = true;
          saveSourceBtn.innerHTML = 'Saving...';
          if (saveStatus) {
            saveStatus.style.color = 'var(--text-primary)';
            saveStatus.textContent = 'Writing to disk & compiling...';
          }

          try {
            const res = await fetch(BRIDGE + '/api/save-source', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file: ctx.source.file,
                component: infoName,
                newSource: newSource,
                startLine: ctx.source.startLine,
                endLine: ctx.source.endLine,
              }),
            });
            const data = await res.json();
            saveSourceBtn.disabled = false;
            saveSourceBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd>';

            if (data.success) {
              ctx.source.code = newSource;
              const displayEl = shadow.getElementById('cp-source-code-display');
              if (displayEl) displayEl.textContent = newSource;
              if (saveStatus) {
                saveStatus.style.color = '#34d399';
                saveStatus.textContent = 'Saved to disk & HMR reloaded!';
              }
              api.showCallout(infoName + ' saved to disk — HMR reloaded', 'SOURCE');
            } else {
              if (saveStatus) {
                saveStatus.style.color = '#fb7185';
                saveStatus.textContent = 'Syntax error: ' + (data.error || 'Failed to save');
              }
              api.showCallout('Save failed: ' + (data.error || 'Syntax error'), 'WARNING');
            }
          } catch (err) {
            saveSourceBtn.disabled = false;
            saveSourceBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd>';
            if (saveStatus) {
              saveStatus.style.color = '#fb7185';
              saveStatus.textContent = 'Error: ' + err.message;
            }
          }
        };

        if (saveSourceBtn) {
          saveSourceBtn.onclick = (e) => {
            e.preventDefault();
            handleSaveSource();
          };
        }

        // Keyboard shortcut Cmd+S / Ctrl+S inside textarea
        codeTextarea.addEventListener('keydown', (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            e.stopPropagation();
            handleSaveSource();
          }
          // Tab key indents by 2 spaces
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeTextarea.selectionStart;
            const end = codeTextarea.selectionEnd;
            codeTextarea.value = codeTextarea.value.substring(0, start) + '  ' + codeTextarea.value.substring(end);
            codeTextarea.selectionStart = codeTextarea.selectionEnd = start + 2;
          }
        });

        if (undoSourceBtn) {
          undoSourceBtn.onclick = async (e) => {
            e.preventDefault();
            undoSourceBtn.disabled = true;
            if (saveStatus) {
              saveStatus.style.color = 'var(--text-primary)';
              saveStatus.textContent = 'Reverting...';
            }
            try {
              const res = await fetch(BRIDGE + '/api/source-undo', { method: 'POST' });
              const data = await res.json();
              undoSourceBtn.disabled = false;
              if (data.success) {
                if (saveStatus) {
                  saveStatus.style.color = '#34d399';
                  saveStatus.textContent = data.description || 'Reverted';
                }
                api.showCallout(data.description || 'Reverted change', 'UNDO');
                // Reload component context to refresh source snippet
                loadComponentContext(infoName, resolved, computedStyles);
              } else {
                if (saveStatus) {
                  saveStatus.style.color = '#fb7185';
                  saveStatus.textContent = data.error || 'Nothing to undo';
                }
              }
            } catch (err) {
              undoSourceBtn.disabled = false;
              if (saveStatus) {
                saveStatus.style.color = '#fb7185';
                saveStatus.textContent = 'Undo error: ' + err.message;
              }
            }
          };
        }
      }
    } catch(err) {
      dom.flyoutContent.innerHTML = '<p style="color:#fb7185;">Failed to load context: ' + err.message + '</p>';
    }
  }
}
