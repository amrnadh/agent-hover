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
      sel += '#' + curr.id;
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
