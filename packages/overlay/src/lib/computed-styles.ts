// @ts-nocheck

/** Computed-style extraction and color normalization (pure). */
export function extractComputedStyles(el) {
  const s = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    width: s.width, height: s.height, padding: s.padding, margin: s.margin, border: s.border,
    display: s.display, position: s.position, flexDirection: s.flexDirection,
    alignItems: s.alignItems, justifyContent: s.justifyContent, gridTemplateColumns: s.gridTemplateColumns,
    gap: s.gap, zIndex: s.zIndex, overflow: s.overflow, opacity: s.opacity, visibility: s.visibility,
    fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color, backgroundColor: s.backgroundColor,
    boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
  };
}

export function getInheritedBackgroundColor(el) {
  let curr = el;
  while (curr && curr !== document.documentElement) {
    const bg = window.getComputedStyle(curr).backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      return bg;
    }
    curr = curr.parentElement;
  }
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') {
    return bodyBg;
  }
  const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
  if (htmlBg && htmlBg !== 'transparent' && htmlBg !== 'rgba(0, 0, 0, 0)') {
    return htmlBg;
  }
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDark ? '#09090b' : '#ffffff';
}

export function formatColorToHex(colorStr) {
  if (!colorStr) return '';
  const trimmed = String(colorStr).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return trimmed;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = trimmed;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = data[3];
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    if (a < 255) {
      const alphaPercent = Math.round((a / 255) * 100);
      return `${hex} · ${alphaPercent}%`;
    }
    return hex;
  } catch (_) {
    return trimmed;
  }
}
