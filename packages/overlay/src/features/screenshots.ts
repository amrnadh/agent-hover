import { esc } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { getInheritedBackgroundColor } from '../lib/computed-styles.js';
import type { OverlayApp } from '../app/context.js';

export type SnapMode = 'component' | 'viewport' | 'fullpage';

interface CaptureOptions { width?: number; height?: number; scrollX?: number; scrollY?: number }
interface Shot { dataUrl: string; mode: SnapMode; filename: string; savedPath: string | null; width: number; height: number }

const MODE_LABEL: Record<SnapMode, string> = { component: 'Element', viewport: 'Visible area', fullpage: 'Full page' };
const BLOCK_TAGS = new Set(['div', 'p', 'section', 'article', 'header']);

/**
 * Screenshots: the element, the visible area or the full page (from the pill and dock menus). Each shot is
 * copied to the clipboard, saved to .agent-hover/screenshots/ for agents, and announced with a toast whose
 * View action opens the lightbox. `captureElement` is the shared engine (Compare and agent screenshot requests).
 */
export function setupScreenshots(app: OverlayApp) {
  const { BRIDGE, container, fetch, shadow, state, api } = app;
  Object.assign(api, { handleSnapMode, captureElement, closeLightbox, isLightboxOpen: () => !lightbox.hidden });

  const lightbox = shadow.getElementById('ah-lightbox') as HTMLElement;
  let busy = false;
  let last: Shot | null = null;
  let returnFocus: HTMLElement | null = null;

  async function handleSnapMode(mode: SnapMode) {
    if (busy) return;
    const el = mode === 'component' ? (state.selectedTarget?.element || state.selectedElement) as Element | null : document.documentElement;
    if (!el || !el.isConnected) { api.toast('Select an element first'); return; }
    busy = true;

    // Start the clipboard write inside the click (Safari needs the user gesture); the image arrives later.
    let resolveBlob: (b: Blob) => void = () => {};
    let rejectBlob: (e: Error) => void = () => {};
    const pending = new Promise<Blob>((res, rej) => { resolveBlob = res; rejectBlob = rej; });
    let copied: Promise<boolean> = Promise.resolve(false);
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        copied = navigator.clipboard.write([new ClipboardItem({ 'image/png': pending })]).then(() => true, () => false);
      }
    } catch { /* clipboard unsupported: the toast offers View → Download instead */ }

    // Let menus close before the capture hides the overlay.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const opts: CaptureOptions | undefined = mode === 'viewport'
      ? { width: window.innerWidth, height: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY }
      : mode === 'fullpage' ? { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight } : undefined;

    try {
      const dataUrl = await captureElement(el, opts);
      const blob = dataUrl ? dataUrlToBlob(dataUrl) : null;
      if (!dataUrl || !blob) {
        rejectBlob(new Error('capture failed'));
        api.toast(mode === 'fullpage' ? 'The page is too long to capture in one image' : 'Capture failed. Try the visible area instead.');
        return;
      }
      resolveBlob(blob);
      flash();
      // Sizes are in page (CSS) pixels; the image itself is captured at up to 2× for sharpness.
      const r = el.getBoundingClientRect();
      const size = mode === 'component' ? { width: Math.round(r.width), height: Math.round(r.height) } : { width: opts!.width!, height: opts!.height! };
      const name = mode === 'component' ? api.labelFor?.(state.selectedTarget)?.replace(/[<>/\s]+/g, '') || 'element' : mode;
      const savedPath = await saveToProject(dataUrl, name);
      last = { dataUrl, mode, filename: savedPath?.split('/').pop() || `${name}-${Date.now()}.png`, savedPath, ...size };
      const didCopy = await copied;
      const where = savedPath ? 'saved to .agent-hover/screenshots' : 'not saved (dev server offline)';
      api.toast(`${didCopy ? 'Screenshot copied · ' : 'Screenshot '}${where}`, { action: 'View', onAction: openLightbox, ms: 6000 });
    } catch {
      rejectBlob(new Error('capture failed'));
      api.toast('Capture failed. Try the visible area instead.');
    } finally {
      busy = false;
    }
  }

  async function saveToProject(dataUrl: string, name: string): Promise<string | null> {
    try {
      const res = await fetch(BRIDGE + '/api/screenshot/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename: name }),
      });
      const data = await res.json();
      return data?.success ? data.path || '' : null;
    } catch {
      return null;
    }
  }

  // ---------- lightbox ----------
  function openLightbox() {
    if (!last) return;
    const dims = last.width ? `${last.width} × ${last.height}` : '';
    lightbox.innerHTML = `<div class="dialog ah-surface" role="dialog" aria-modal="true" aria-label="Screenshot">
        <div class="head">
          <div class="title"><b>${esc(MODE_LABEL[last.mode])}</b><span class="ah-muted">${esc(dims)}</span>
            <span class="ah-mono ah-muted file" title="${esc(last.savedPath || last.filename)}">${esc(last.savedPath || last.filename)}</span></div>
          <button class="ah-tbtn outline" data-act="copy">${icon('copy', 14)}Copy image</button>
          <button class="ah-tbtn outline" data-act="download">${icon('download', 14)}Download</button>
          ${last.savedPath ? `<button class="ah-tbtn outline" data-act="folder">${icon('folder', 14)}Show in folder</button>` : ''}
          <button class="ah-ibtn" data-act="close" aria-label="Close (Esc)" title="Close (Esc)">${icon('x')}</button>
        </div>
        <div class="body"><img src="${last.dataUrl}" alt="${esc(MODE_LABEL[last.mode])} screenshot"${last.width ? ` style="width:${last.width}px"` : ''}></div>
      </div>`;
    returnFocus = shadow.activeElement as HTMLElement | null;
    lightbox.hidden = false;
    (lightbox.querySelector('[data-act=close]') as HTMLElement).focus();
  }

  function closeLightbox() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.innerHTML = '';
    returnFocus?.focus?.();
    returnFocus = null;
  }

  lightbox.addEventListener('click', async (e) => {
    if (e.target === lightbox) { closeLightbox(); return; }
    const b = (e.target as Element).closest('button') as HTMLElement | null;
    if (!b || !last) return;
    const act = b.dataset.act;
    if (act === 'close') closeLightbox();
    if (act === 'download') download(last);
    if (act === 'copy') {
      const blob = dataUrlToBlob(last.dataUrl);
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob! })]);
        api.toast('Screenshot copied');
      } catch {
        api.toast('Clipboard blocked by the browser. Use Download.');
      }
    }
    if (act === 'folder') {
      try {
        const res = await fetch(BRIDGE + '/api/screenshot/open-folder', { method: 'POST' });
        api.toast(res.ok ? 'Opened .agent-hover/screenshots' : 'Could not open the folder');
      } catch {
        api.toast('Dev server unreachable');
      }
    }
  });

  // Keep Tab inside the lightbox while it is open.
  lightbox.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(lightbox.querySelectorAll('button')) as HTMLElement[];
    const i = items.indexOf(shadow.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
    e.preventDefault();
    items[next]?.focus();
  });

  function download(shot: Shot) {
    const blob = dataUrlToBlob(shot.dataUrl);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = shot.filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 3000);
  }

  function flash() {
    const f = document.createElement('div');
    f.className = 'ah-flash';
    shadow.appendChild(f);
    setTimeout(() => f.remove(), 400);
  }

  // ---------- capture engine ----------
  async function captureElement(element: Element | null, opts?: CaptureOptions): Promise<string | null> {
    if (!element) return null;
    const lib = (window as any).modernScreenshot;
    if (!lib?.domToPng) {
      console.error('[agent-hover] Screenshot library not loaded');
      return null;
    }
    // Hide the whole overlay so only the page is captured.
    const root = (shadow.host as HTMLElement) || container;
    const prevVisibility = root.style.visibility;
    root.style.visibility = 'hidden';

    const isViewport = opts?.scrollX !== undefined;
    const isFullPage = !!opts?.height && opts.height > window.innerHeight;
    try {
      if (!isViewport && !isFullPage) {
        const r = element.getBoundingClientRect();
        if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth) {
          element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' as ScrollBehavior });
          await new Promise((r2) => setTimeout(r2, 100));
        }
      }
      const options: Record<string, any> = {
        scale: 2,
        backgroundColor: getInheritedBackgroundColor(element),
        filter: (node: any) => node?.id !== 'agent-hover-root' && node !== container && !node?.classList?.contains?.('agent-hover-ignore'),
        // Short single-line labels can wrap in the clone because of font metrics; keep them on one line.
        onCloneEachNode: (node: any) => {
          if (node?.nodeType !== 1) return;
          const text = (node.textContent || '').trim();
          if (!text || text.length > 60 || text.includes('\n')) return;
          const hasBlockChild = Array.from(node.children || []).some((c: any) => BLOCK_TAGS.has(String(c.tagName || '').toLowerCase()));
          if (!hasBlockChild) node.style.whiteSpace = 'nowrap';
        },
      };
      if (isViewport) {
        options.width = opts!.width || window.innerWidth;
        options.height = opts!.height || window.innerHeight;
        options.style = { transform: `translate(-${opts!.scrollX || 0}px, -${opts!.scrollY || 0}px)`, transformOrigin: 'top left' };
      }
      if (isFullPage) {
        options.width = opts!.width;
        options.height = opts!.height;
      }
      try {
        return (await lib.domToPng(element, options)) || null;
      } catch (err) {
        // Very tall pages can exceed the canvas limit at 2×; retry at 1×.
        if (!isFullPage) throw err;
        options.scale = 1;
        return (await lib.domToPng(element, options)) || null;
      }
    } catch (err) {
      console.error('[agent-hover] Screenshot capture failed:', err);
      return null;
    } finally {
      root.style.visibility = prevVisibility || 'visible';
    }
  }
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [head, data] = dataUrl.split(';base64,');
    const type = head.split(':')[1] || 'image/png';
    const bytes = atob(data);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
    return new Blob([out], { type });
  } catch {
    return null;
  }
}
