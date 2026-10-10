// @ts-nocheck
import { ICONS } from '../icons.js';
import { CaptureLayer } from '../ui/capture-layer.js';
import { buildHierarchyStack, getComponentBoundingRect, getComponentInfo } from '../lib/fiber.js';
import type { OverlayApp } from '../app/context.js';

/** Hover highlight, click-to-select, and capture-layer wiring. */
export function setupInspector(app: OverlayApp) {
  const { BRIDGE, container, fetch, shadow, state, dom, api } = app;
  Object.assign(api, { highlightComponent, findComponentElement });

  // Update highlight box to match a specific item in currentStack
  function highlightComponent(info, useUnionRect) {
    if (!info) return;
    state.currentComponentInfo = info;
    let rect = null;

    if (info.isDomElement && info.element) {
      rect = info.element.getBoundingClientRect();
      dom.highlight.classList.add('is-raw');
    } else if (useUnionRect && info.fiber) {
      rect = getComponentBoundingRect(info.fiber);
      dom.highlight.classList.remove('is-raw');
    } else if (state.currentElement) {
      rect = state.currentElement.getBoundingClientRect();
      dom.highlight.classList.remove('is-raw');
    }

    if (!rect || (rect.width === 0 && rect.height === 0)) {
      dom.highlight.style.display = 'none';
      api.hideBands();
      return;
    }

    dom.highlight.style.display = 'block';
    dom.highlight.style.top = rect.top + 'px';
    dom.highlight.style.left = rect.left + 'px';
    dom.highlight.style.width = rect.width + 'px';
    dom.highlight.style.height = rect.height + 'px';

    const isFrozen = state.frozenEntries.some(f => (info.source && f.file === info.source.fileName) || f.component === info.name);
    const frameColor = isFrozen ? '#f43f5e' : (info.isDomElement ? '#38bdf8' : '#0ea5e9');
    dom.highlight.style.border = '1.5px solid ' + frameColor;
    dom.highlight.style.background = 'transparent';
    dom.highlight.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.12)';

    // Position single-line chip cleanly above the frame, or inside if too close to viewport top
    if (rect.top < 26) {
      dom.label.style.top = '2px';
      dom.label.style.left = '2px';
      dom.label.style.borderRadius = '3px';
    } else {
      dom.label.style.top = '-23px';
      dom.label.style.left = '-1px';
      dom.label.style.borderRadius = '4px';
    }

    const lockHtml = isFrozen ? '<span style="color:#fb7185; margin-right:4px;">' + ICONS.lock + '</span>' : '';
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const dimSpan = '<span style="color:var(--text-muted); font-size:9.5px; margin-left:4px; font-weight:normal;">' + w + ' × ' + h + '</span>';

    if (info.isDomElement) {
      dom.label.innerHTML = lockHtml + '<span style="color:#38bdf8;">' + info.name + '</span>' + dimSpan;
      dom.label.style.borderColor = '#38bdf8';
    } else {
      dom.label.innerHTML = lockHtml + '<span style="color:#0ea5e9;">&lt;' + info.name + ' /&gt;</span>' + dimSpan;
      dom.label.style.borderColor = isFrozen ? '#f43f5e' : '#0ea5e9';
    }

    if (state.showSpacingOverlay && (info.element || state.currentElement)) {
      api.positionBands(info.element || state.currentElement);
    } else {
      api.hideBands();
    }
  }

  // --- Hover Highlight (Universal Selection, delegated via CaptureLayer) ---
  function handleHoverTarget(el, e) {
    if (!el || (el.closest && el.closest('#agent-hover-root'))) {
      dom.highlight.style.display = 'none';
      if (!state.showSpacingOverlay || (!state.selectedElement && !state.currentElement)) {
        api.hideBands();
      } else {
        api.positionBands(state.selectedElement || state.currentElement);
      }
      api.clearDistanceGuides();
      state.currentElement = null;
      return;
    }
    if (el === state.currentElement) return;
    state.currentElement = el;

    // Build full hierarchy stack (Level 0 = DOM element, Level 1..N = React components)
    state.currentStack = buildHierarchyStack(el);
    state.currentStackIndex = 0; // Default to exact element under cursor!

    // If a selection is active, show measurement guides between selected and hovered
    if (state.selectedRect) {
      const hoveredRect = el.getBoundingClientRect();
      api.renderDistanceGuides(state.selectedRect, hoveredRect);
    } else {
      api.clearDistanceGuides();
    }

    // If hovering over the selected element, hide the hover preview so borders don't double
    if (state.selectedTarget && ((state.selectedTarget.element && state.selectedTarget.element === el) || (state.selectedElement && state.selectedElement === el))) {
      dom.highlight.style.display = 'none';
      if (state.showSpacingOverlay) {
        api.positionBands(state.selectedElement || el);
      } else {
        api.hideBands();
      }
    } else {
      highlightComponent(state.currentStack[0], false);
      if (state.showSpacingOverlay && state.selectedElement) {
        api.positionBands(state.selectedElement);
      }
    }
  }

  // Reposition highlight on scroll/resize
  function repositionHighlight() {
    if (typeof api.updateSelectionFrame === 'function') api.updateSelectionFrame();
    if (state.showSpacingOverlay && (state.selectedElement || state.currentElement)) {
      api.positionBands(state.selectedElement || state.currentElement);
    }
    if (!state.currentComponentInfo || dom.highlight.style.display === 'none') return;
    const target = state.currentStack[state.currentStackIndex] || state.currentComponentInfo;

    if (target.isDomElement && target.element) {
      const rect = target.element.getBoundingClientRect();
      dom.highlight.style.top = rect.top + 'px';
      dom.highlight.style.left = rect.left + 'px';
      dom.highlight.style.width = rect.width + 'px';
      dom.highlight.style.height = rect.height + 'px';
      if (state.showSpacingOverlay) api.positionBands(target.element);
    } else if (target.fiber) {
      const rect = getComponentBoundingRect(target.fiber);
      if (rect) {
        dom.highlight.style.top = rect.top + 'px';
        dom.highlight.style.left = rect.left + 'px';
        dom.highlight.style.width = rect.width + 'px';
        dom.highlight.style.height = rect.height + 'px';
        if (state.showSpacingOverlay && state.currentElement) api.positionBands(state.currentElement);
      }
    }
  }
  window.addEventListener('scroll', repositionHighlight, { capture: true, passive: true });
  window.addEventListener('resize', repositionHighlight);

  function findComponentElement(componentName) {
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.id === 'agent-hover-root') continue;
      const info = getComponentInfo(el);
      if (info && info.name === componentName) return el;
    }
    return null;
  }

  // --- Click to Inspect (delegated via CaptureLayer) ---
  async function handleSelectTarget(clickedEl, e) {
    if (clickedEl && clickedEl !== document.body && clickedEl !== container && (!clickedEl.closest || !clickedEl.closest('#agent-hover-root'))) {
      state.currentStack = buildHierarchyStack(clickedEl);
      state.currentStackIndex = 0;
      state.currentElement = clickedEl;
    }
    if (!state.currentStack || state.currentStack.length === 0) return;

    // Select exact leaf element clicked (index 0) so smaller elements and components are directly selectable
    const targetIndex = 0;
    const target = state.currentStack[targetIndex] || state.currentStack[0];

    // Raw elements can't be frozen/pinned
    if (!target.isDomElement) {
      if (e.ctrlKey || e.metaKey) {
        const resolved = await api.resolveComponent(target);
        if (resolved) {
          const isCurrentlyFrozen = state.frozenEntries.some(f => f.file === resolved.file && f.component === target.name);
          await fetch(BRIDGE + '/api/freeze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: isCurrentlyFrozen ? 'remove' : 'add', file: resolved.file, component: target.name, line: resolved.line })
          });
          api.showCallout(isCurrentlyFrozen ? 'Unfrozen ' + target.name : 'Frozen ' + target.name, 'LOCK');
          api.refreshState();
        }
        return;
      }

      if (e.shiftKey) {
        const resolved = await api.resolveComponent(target);
        if (resolved) {
          await fetch(BRIDGE + '/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', file: resolved.file, line: resolved.line })
          });
          api.showCallout('Pinned ' + target.name, 'PIN');
          api.refreshState();
        }
        return;
      }
    }

    await api.renderFlyoutForStackIndex(targetIndex);
  }

  // Initialize CaptureLayer inside Shadow Root (P2-03)
  if (dom.captureLayerEl) {
    state.captureLayer = new CaptureLayer(dom.captureLayerEl, {
      shadowRoot: shadow,
      onHover: handleHoverTarget,
      onSelect: handleSelectTarget,
      onDblClick: api.handleDblClickTarget,
    });
  }
}
