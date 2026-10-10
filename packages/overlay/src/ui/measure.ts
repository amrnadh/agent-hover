// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Hierarchy stack state, margin/padding bands, and distance guides. */
export function setupMeasure(app: OverlayApp) {
  const { state, dom, api } = app;
  Object.assign(api, { positionBands, hideBands, clearDistanceGuides, renderDistanceGuides });

  // --- Hierarchy Navigation State ---
  state.currentStack = [];
  state.currentStackIndex = -1;

  // Position margin/padding bands and dashed axis guides (Studio inspection style)
  function positionBands(el) {
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const offset = api.getHostOffset();
    const top = rect.top - offset.y;
    const bottom = rect.bottom - offset.y;
    const left = rect.left - offset.x;
    const right = rect.right - offset.x;
    const px = (v) => parseFloat(v) || 0;
    const mt = px(cs.marginTop), mr = px(cs.marginRight), mb = px(cs.marginBottom), ml = px(cs.marginLeft);
    const pt = px(cs.paddingTop), pr = px(cs.paddingRight), pb = px(cs.paddingBottom), pl = px(cs.paddingLeft);
    const bt = px(cs.borderTopWidth), brw = px(cs.borderRightWidth), bb = px(cs.borderBottomWidth), blw = px(cs.borderLeftWidth);

    // 1. Draw full-canvas dashed Axis Projection Lines (Figma / Studio inspection style)
    if (dom.axisGuides) {
      const lines = [
        '<div class="cp-axis-line cp-axis-h" style="top:' + Math.round(top) + 'px;"></div>',
        '<div class="cp-axis-line cp-axis-h" style="top:' + Math.round(bottom) + 'px;"></div>',
        '<div class="cp-axis-line cp-axis-v" style="left:' + Math.round(left) + 'px;"></div>',
        '<div class="cp-axis-line cp-axis-v" style="left:' + Math.round(right) + 'px;"></div>'
      ];

      // Flex / Grid direct child dashed frames
      if (cs.display.includes('flex') || cs.display.includes('grid')) {
        const children = Array.from(el.children);
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (!(child instanceof HTMLElement) || child.id === 'agent-hover-root') continue;
          const cr = child.getBoundingClientRect();
          if (cr.width > 0 && cr.height > 0) {
            lines.push('<div class="cp-layout-child-frame" style="top:' + Math.round(cr.top - offset.y) + 'px; left:' + Math.round(cr.left - offset.x) + 'px; width:' + Math.round(cr.width) + 'px; height:' + Math.round(cr.height) + 'px;"></div>');
          }
        }
      }

      dom.axisGuides.innerHTML = lines.join('');
    }

    // 2. Margin Outer Dashed Frame
    if (dom.marginBand) {
      if (mt || mr || mb || ml) {
        dom.marginBand.style.display = 'block';
        dom.marginBand.style.top = (top - mt) + 'px';
        dom.marginBand.style.left = (left - ml) + 'px';
        dom.marginBand.style.width = (rect.width + ml + mr) + 'px';
        dom.marginBand.style.height = (rect.height + mt + mb) + 'px';
        dom.marginBand.style.borderTopWidth = mt + 'px';
        dom.marginBand.style.borderRightWidth = mr + 'px';
        dom.marginBand.style.borderBottomWidth = mb + 'px';
        dom.marginBand.style.borderLeftWidth = ml + 'px';
      } else {
        dom.marginBand.style.display = 'none';
      }
    }

    // 3. Padding Inner Dashed Frame
    if (dom.paddingBand) {
      if (pt || pr || pb || pl) {
        dom.paddingBand.style.display = 'block';
        dom.paddingBand.style.top = (top + bt) + 'px';
        dom.paddingBand.style.left = (left + blw) + 'px';
        dom.paddingBand.style.width = Math.max(0, rect.width - blw - brw) + 'px';
        dom.paddingBand.style.height = Math.max(0, rect.height - bt - bb) + 'px';
        dom.paddingBand.style.borderTopWidth = pt + 'px';
        dom.paddingBand.style.borderRightWidth = pr + 'px';
        dom.paddingBand.style.borderBottomWidth = pb + 'px';
        dom.paddingBand.style.borderLeftWidth = pl + 'px';
      } else {
        dom.paddingBand.style.display = 'none';
      }
    }
  }

  function hideBands() {
    if (dom.marginBand) dom.marginBand.style.display = 'none';
    if (dom.paddingBand) dom.paddingBand.style.display = 'none';
    if (dom.axisGuides) dom.axisGuides.innerHTML = '';
  }

  // --- Measurement Distance Guides ---
  state.selectedRect = null; // Stores the rect of the currently selected (clicked) element

  function clearDistanceGuides() {
    if (dom.distanceLayer) dom.distanceLayer.innerHTML = '';
  }

  function renderDistanceGuides(selRect, hovRect) {
    clearDistanceGuides();
    if (!dom.distanceLayer || !selRect || !hovRect) return;

    // Check if rects are the same element (skip)
    if (Math.abs(selRect.top - hovRect.top) < 2 && Math.abs(selRect.left - hovRect.left) < 2 &&
        Math.abs(selRect.width - hovRect.width) < 2 && Math.abs(selRect.height - hovRect.height) < 2) return;

    const offset = api.getHostOffset();
    const sTop = selRect.top - offset.y;
    const sLeft = selRect.left - offset.x;
    const sBottom = sTop + selRect.height;
    const sRight = sLeft + selRect.width;

    const hTop = hovRect.top - offset.y;
    const hLeft = hovRect.left - offset.x;
    const hBottom = hTop + hovRect.height;
    const hRight = hLeft + hovRect.width;

    const overlapX = sLeft < hRight && sRight > hLeft;
    const overlapY = sTop < hBottom && sBottom > hTop;

    function addLine(cls, top, left, w, h) {
      const el = document.createElement('div');
      el.className = 'cp-dist-line ' + cls;
      el.style.top = top + 'px';
      el.style.left = left + 'px';
      if (w) el.style.width = w + 'px';
      if (h) el.style.height = h + 'px';
      dom.distanceLayer.appendChild(el);
    }

    function addPill(text, top, left, axis) {
      const num = parseInt(text, 10);
      if (isNaN(num) || num < 1) return; // Hide labels under 1px (S5)

      let finalTop = top;
      let finalLeft = left;

      // Check collision with selRect and hovRect (S5: pill must not overlap measured elements, nudge clear)
      const pW = 38;
      const pH = 18;
      const sBox = { left: sLeft, right: sRight, top: sTop, bottom: sBottom };
      const hBox = { left: hLeft, right: hRight, top: hTop, bottom: hBottom };
      const collides = (l, t) => {
        const b = { left: l - pW / 2, right: l + pW / 2, top: t - pH / 2, bottom: t + pH / 2 };
        return !(b.right <= sBox.left || b.left >= sBox.right || b.bottom <= sBox.top || b.top >= sBox.bottom) ||
               !(b.right <= hBox.left || b.left >= hBox.right || b.bottom <= hBox.top || b.top >= hBox.bottom);
      };

      if (collides(finalLeft, finalTop)) {
        if (axis === 'vertical') {
          if (!collides(finalLeft + 26, finalTop)) {
            finalLeft = finalLeft + 26;
          } else if (!collides(finalLeft - 26, finalTop)) {
            finalLeft = finalLeft - 26;
          }
        } else {
          if (!collides(finalLeft, finalTop - 16)) {
            finalTop = finalTop - 16;
          } else if (!collides(finalLeft, finalTop + 16)) {
            finalTop = finalTop + 16;
          }
        }
      }

      const el = document.createElement('div');
      el.className = 'cp-dist-pill';
      el.textContent = text;
      el.style.top = finalTop + 'px';
      el.style.left = finalLeft + 'px';
      dom.distanceLayer.appendChild(el);
    }

    // Vertical gap (elements don't overlap vertically)
    if (!overlapY) {
      const isAbove = sTop > hBottom;
      const gapTop = isAbove ? hBottom : sBottom;
      const gapBottom = isAbove ? sTop : hTop;
      const gap = Math.round(gapBottom - gapTop);
      if (gap >= 1) {
        const overlapXSpan = Math.min(sRight, hRight) - Math.max(sLeft, hLeft);
        const midX = overlapXSpan > 0 
          ? Math.round(Math.max(sLeft, hLeft) + overlapXSpan / 2)
          : Math.round(Math.max(sLeft + selRect.width / 2, hLeft + hovRect.width / 2));
        addLine('vertical', gapTop, midX, null, gap);
        addPill(gap + 'px', gapTop + gap / 2, midX, 'vertical');
      }
    }

    // Horizontal gap (elements don't overlap horizontally)
    if (!overlapX) {
      const isLeft = sLeft > hRight;
      const gapLeft = isLeft ? hRight : sRight;
      const gapRight = isLeft ? sLeft : hLeft;
      const gap = Math.round(gapRight - gapLeft);
      if (gap >= 1) {
        const overlapYSpan = Math.min(sBottom, hBottom) - Math.max(sTop, hTop);
        const midY = overlapYSpan > 0
          ? Math.round(Math.max(sTop, hTop) + overlapYSpan / 2)
          : Math.round(Math.max(sTop + selRect.height / 2, hTop + hovRect.height / 2));
        addLine('horizontal', midY, gapLeft, gap, null);
        addPill(gap + 'px', midY, gapLeft + gap / 2, 'horizontal');
      }
    }

    // Both overlap (nested/containment) — show edge inset distances
    if (overlapX && overlapY) {
      const topGap = Math.round(Math.abs(hTop - sTop));
      const leftGap = Math.round(Math.abs(hLeft - sLeft));
      const bottomGap = Math.round(Math.abs(sBottom - hBottom));
      const rightGap = Math.round(Math.abs(sRight - hRight));

      const innerLeft = Math.max(sLeft, hLeft);
      const innerRight = Math.min(sRight, hRight);
      const innerTop = Math.max(sTop, hTop);
      const innerBottom = Math.min(sBottom, hBottom);
      const midX = (innerLeft + innerRight) / 2;
      const midY = (innerTop + innerBottom) / 2;

      if (topGap >= 1) {
        const t = Math.min(sTop, hTop);
        addLine('vertical', t, midX, null, topGap);
        addPill(topGap + 'px', t + topGap / 2, midX, 'vertical');
      }
      if (leftGap >= 1) {
        const l = Math.min(sLeft, hLeft);
        addLine('horizontal', midY, l, leftGap, null);
        addPill(leftGap + 'px', midY, l + leftGap / 2, 'horizontal');
      }
      if (bottomGap >= 1 && bottomGap !== topGap) {
        const bTop = Math.min(sBottom, hBottom);
        addLine('vertical', bTop, midX, null, bottomGap);
        addPill(bottomGap + 'px', bTop + bottomGap / 2, midX, 'vertical');
      }
      if (rightGap >= 1 && rightGap !== leftGap) {
        const rLeft = Math.min(sRight, hRight);
        addLine('horizontal', midY, rLeft, rightGap, null);
        addPill(rightGap + 'px', midY, rLeft + rightGap / 2, 'horizontal');
      }
    }
  }
}
