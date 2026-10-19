export function px(v: string | number): number {
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildCSSSelector(el: Element | null): string {
  if (!el || (typeof document !== 'undefined' && (el === document.body || el === document.documentElement))) return '';
  const parts: string[] = [];
  let curr: Element | null = el;
  while (curr && (typeof document === 'undefined' || curr !== document.body) && parts.length < 6) {
    let sel = curr.tagName.toLowerCase();
    if (curr.id) {
      sel += '#' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(curr.id) : curr.id);
      parts.unshift(sel);
      break; // ID is unique enough
    }
    if (curr.parentElement) {
      const siblings = Array.from(curr.parentElement.children).filter(c => c.tagName === curr!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(curr) + 1;
        sel += ':nth-of-type(' + idx + ')';
      }
    }
    parts.unshift(sel);
    curr = curr.parentElement;
  }
  return parts.join(' > ');
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(';base64,');
    const contentType = (parts[0] && parts[0].split(':')[1]) || 'image/png';
    const byteCharacters = atob(parts[1]);
    const byteArrays: Uint8Array[] = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays as any, { type: contentType });
  } catch (e) {
    return null;
  }
}

/**
 * Whether something else is drawn over `el`: the app's own dialog, a sticky header. True only when both its middle
 * and its top-right corner (where markers sit) are under another element. `ignore` is the overlay's own root.
 */
export function isCovered(el: Element, ignore?: Element | null): boolean {
  const r = el.getBoundingClientRect();
  const points: Array<[number, number]> = [[r.left + r.width / 2, r.top + r.height / 2], [r.right - 3, r.top + 3]];
  return points.every(([x, y]) => {
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return !!hit && hit !== ignore && hit !== el && !el.contains(hit) && !hit.contains(el);
  });
}
