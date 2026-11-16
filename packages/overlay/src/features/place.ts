import { anchorTo, esc, placeBox } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { prettyAgentName } from '../lib/task-status.js';
import { formatPlaceRequest, type PlacePosition, type Placement } from '../lib/prompt-format.js';
import type { OverlayApp } from '../app/context.js';

/** What Place takes: checked again by the bridge from the file's own bytes. */
export const PLACE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm'];
const MAX_VARIANTS = 4;
const MAX_BYTES = 50 * 1024 * 1024;
/** Elements that can't hold children, so Inside and Over aren't offered for them. */
const VOID = new Set(['IMG', 'INPUT', 'BR', 'HR', 'TEXTAREA', 'SELECT', 'VIDEO', 'AUDIO', 'IFRAME', 'CANVAS', 'svg', 'SVG', 'OBJECT', 'EMBED', 'SOURCE', 'WBR']);

interface Variant { file: File; url: string; mime: string; natural?: { width: number; height: number } }
type SizeMode = 'original' | 'fit' | 'custom';

const POSITIONS: Array<[PlacePosition, string]> = [
  ['before', 'Before'],
  ['after', 'After'],
  ['inside-start', 'Inside start'],
  ['inside-end', 'Inside end'],
  ['over', 'Over'],
];

/** Whether a dropped or pasted file is one Place can use. */
export function isPlaceable(file: { type: string; size: number }): boolean {
  return PLACE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_BYTES;
}

/**
 * Place (0.3): put an image, SVG, GIF or video on the real page next to, inside or over the selected element, try
 * up to four variants, then send the agent a precise task. The mock is a real <img>/<video> in the page (marked
 * data-ah-place), so the page's own CSS lays it out; it leaves the page when you send or close. The file goes to the
 * bridge only on Send, staged in .agent-hover/place/; the agent copies it into the project.
 */
export function setupPlace(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { openPlace, closePlace, isPlaceOpen: () => !card.hidden, placeFiles });

  const card = shadow.getElementById('ah-place') as HTMLElement;
  const layer = shadow.getElementById('ah-layer-place') as HTMLElement;
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = PLACE_TYPES.join(',');
  fileInput.multiple = true;
  fileInput.onchange = () => { if (fileInput.files?.length) addFiles(Array.from(fileInput.files)); fileInput.value = ''; };

  let target: { item: any; stack: any[]; index: number; element: HTMLElement } | null = null;
  let factsPromise: Promise<any> | null = null;
  let variants: Variant[] = [];
  let active = 0;
  let position: PlacePosition = 'after';
  let sizeMode: SizeMode = 'original';
  let customWidth = 0;
  let overBox = { x: 0.1, y: 0.1, w: 0 }; // Over: top-left as a share of the target, width in px
  let alt = '';
  let note = '';
  const video = { loop: true, muted: true, autoplay: true };
  let mock: HTMLImageElement | HTMLVideoElement | null = null;
  let restorePosition: string | null = null;
  let observer: MutationObserver | null = null;
  let sending = false;

  // ---------- open / close ----------

  function openPlace(files?: File[]) {
    const item = state.selectedTarget;
    const element = state.selectedElement as HTMLElement | null;
    if (!item || !element) { api.toast('Select an element first, then Place'); return; }
    api.closePillMenu?.();
    api.closeComposer?.();
    api.closeCommentCard?.();
    api.closeTaskCard?.();
    if (target?.element !== element) reset();
    target = { item, stack: state.currentStack, index: state.currentStackIndex, element };
    // Facts are read before the mock goes in: it would shift :nth-of-type selectors and the element's text.
    factsPromise = factsPromise || api.buildFacts(target.stack, target.index).catch(() => null);
    if (VOID.has(element.tagName) && (position === 'inside-start' || position === 'inside-end' || position === 'over')) position = 'after';
    card.hidden = false;
    if (files?.length) addFiles(files);
    else render();
    if (!files?.length && !variants.length) (card.querySelector('[data-act=browse]') as HTMLElement | null)?.focus();
  }

  function closePlace() {
    if (card.hidden && !mock) return;
    removeMock();
    card.hidden = true;
    layer.innerHTML = '';
    api.stopVoice?.();
    reset();
  }

  function reset() {
    removeMock();
    variants.forEach((v) => URL.revokeObjectURL(v.url));
    variants = [];
    active = 0;
    sizeMode = 'original';
    customWidth = 0;
    overBox = { x: 0.1, y: 0.1, w: 0 };
    alt = '';
    note = '';
    factsPromise = null;
    target = null;
  }

  /** Files dropped or pasted on the page: select what they landed on (when given) and open Place with them. */
  function placeFiles(files: File[], at?: Element | null) {
    const usable = files.filter(isPlaceable);
    if (!usable.length) {
      api.toast(files.some((f) => f.size > MAX_BYTES) ? 'That file is over 50 MB' : 'Place takes PNG, JPG, WebP, GIF, SVG, MP4 and WebM');
      return;
    }
    if (at && at !== state.selectedElement) api.selectElement(at);
    openPlace(usable);
  }

  // ---------- variants ----------

  function addFiles(files: File[]) {
    const usable = files.filter(isPlaceable);
    if (usable.length < files.length) api.toast('Some files were skipped: Place takes PNG, JPG, WebP, GIF, SVG, MP4 and WebM up to 50 MB');
    const firstNew = variants.length;
    for (const file of usable) {
      if (variants.length >= MAX_VARIANTS) { api.toast(`Up to ${MAX_VARIANTS} variants`); break; }
      const v: Variant = { file, url: URL.createObjectURL(file), mime: file.type };
      variants.push(v);
      measure(v);
    }
    // Show the first new one on the page.
    if (variants.length > firstNew) active = firstNew;
    render();
    refreshMock();
  }

  function measure(v: Variant) {
    const done = (w: number, h: number) => {
      if (w && h) v.natural = { width: w, height: h };
      if (v === variants[active]) { if (!overBox.w) overBox.w = defaultOverWidth(); refreshMock(); render(); }
    };
    if (v.mime.startsWith('video/')) {
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.onloadedmetadata = () => done(el.videoWidth, el.videoHeight);
      el.src = v.url;
    } else {
      const img = new Image();
      img.onload = () => done(img.naturalWidth, img.naturalHeight);
      img.src = v.url;
    }
  }

  const current = (): Variant | undefined => variants[active];

  // ---------- size ----------

  function targetWidth(): number {
    if (!target) return 0;
    const r = target.element.getBoundingClientRect();
    if (position === 'inside-start' || position === 'inside-end') {
      const cs = getComputedStyle(target.element);
      return Math.max(0, target.element.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) || r.width;
    }
    return r.width;
  }

  function defaultOverWidth(): number {
    const tw = target?.element.getBoundingClientRect().width || 200;
    const nw = current()?.natural?.width || tw;
    return Math.round(Math.max(24, Math.min(nw, tw * 0.4)));
  }

  /** The mock's width in px for the current size choice. */
  function renderedWidth(): number {
    const v = current();
    if (position === 'over') return overBox.w || defaultOverWidth();
    if (sizeMode === 'fit') return Math.round(targetWidth());
    if (sizeMode === 'custom' && customWidth > 0) return customWidth;
    const nw = v?.natural?.width || 0;
    const room = position.startsWith('inside') ? targetWidth() : (target?.element.parentElement?.clientWidth || targetWidth());
    return Math.round(nw ? Math.min(nw, room || nw) : Math.min(240, room || 240));
  }

  function renderedHeight(width: number): number {
    const n = current()?.natural;
    return n ? Math.round((width * n.height) / n.width) : 0;
  }

  // ---------- the mock on the page ----------

  function removeMock() {
    observer?.disconnect();
    observer = null;
    mock?.remove();
    mock = null;
    if (target && restorePosition !== null) target.element.style.position = restorePosition;
    restorePosition = null;
  }

  function refreshMock() {
    const v = current();
    if (!target || !v || card.hidden) { removeMock(); layer.innerHTML = ''; return; }
    const isVideo = v.mime.startsWith('video/');
    if (!mock || (mock.tagName === 'VIDEO') !== isVideo || mock.dataset.src !== v.url) {
      removeMock();
      const el = document.createElement(isVideo ? 'video' : 'img') as HTMLImageElement | HTMLVideoElement;
      el.setAttribute('data-ah-place', '');
      el.dataset.src = v.url;
      if (isVideo) {
        const vid = el as HTMLVideoElement;
        vid.playsInline = true;
      }
      el.src = v.url;
      mock = el;
    }
    const el = mock!;
    if (el instanceof HTMLVideoElement) {
      el.loop = video.loop;
      el.muted = video.muted;
      el.autoplay = video.autoplay;
      if (video.autoplay) el.play?.().catch(() => {});
      else el.pause?.();
    } else {
      (el as HTMLImageElement).alt = alt;
    }
    const w = renderedWidth();
    Object.assign(el.style, { display: 'block', boxSizing: 'border-box', width: w + 'px', height: 'auto', maxWidth: position === 'over' ? 'none' : '100%', margin: '0', pointerEvents: 'none' });
    if (position === 'over') {
      Object.assign(el.style, { position: 'absolute', left: overBox.x * 100 + '%', top: overBox.y * 100 + '%', zIndex: '1' });
      if (restorePosition === null && getComputedStyle(target.element).position === 'static') {
        restorePosition = target.element.style.position;
        target.element.style.position = 'relative';
      }
    } else {
      Object.assign(el.style, { position: '', left: '', top: '', zIndex: '' });
      if (restorePosition !== null) { target.element.style.position = restorePosition; restorePosition = null; }
    }
    insert(el);
    watch();
    renderMeta();
    api.requestLayout();
  }

  function insert(el: Element) {
    if (!target) return;
    const t = target.element;
    const where: InsertPosition = position === 'before' ? 'beforebegin' : position === 'after' ? 'afterend' : position === 'inside-start' ? 'afterbegin' : 'beforeend';
    const ok =
      (where === 'beforebegin' && el.nextSibling === t) ||
      (where === 'afterend' && el.previousSibling === t) ||
      (where === 'afterbegin' && el.parentNode === t && t.firstChild === el) ||
      (where === 'beforeend' && el.parentNode === t && t.lastChild === el);
    if (!ok) t.insertAdjacentElement(where, el);
  }

  /** React may re-render the mock away: put it back while Place is open. */
  function watch() {
    observer?.disconnect();
    if (!mock || !target) return;
    const parent = position === 'before' || position === 'after' ? target.element.parentNode : target.element;
    if (!parent) return;
    observer = new MutationObserver(() => {
      if (!mock || card.hidden || !target) return;
      if (!target.element.isConnected) { closePlace(); api.toast('The element left the page, so Place closed'); return; }
      if (!mock.isConnected) requestAnimationFrame(() => { if (mock && !mock.isConnected && !card.hidden) insert(mock); });
    });
    observer.observe(parent, { childList: true });
  }

  // ---------- Over: drag to move, corner to resize ----------

  function renderHandle() {
    if (!mock || position !== 'over' || card.hidden) { layer.innerHTML = ''; return; }
    let h = layer.querySelector('.ah-place-handle') as HTMLElement | null;
    if (!h) {
      layer.innerHTML = `<div class="ah-place-handle" title="Drag to move"><span class="corner" title="Drag to resize"></span></div>`;
      h = layer.querySelector('.ah-place-handle') as HTMLElement;
      h.onpointerdown = startDrag;
    }
    placeBox(h, mock.getBoundingClientRect(), 0);
  }

  function startDrag(e: PointerEvent) {
    if (!target || !mock) return;
    e.preventDefault();
    e.stopPropagation();
    const resize = (e.target as Element).classList.contains('corner');
    const tr = target.element.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, box: { ...overBox } };
    const h = e.currentTarget as HTMLElement;
    h.setPointerCapture(e.pointerId);
    h.onpointermove = (m) => {
      const dx = m.clientX - start.x;
      const dy = m.clientY - start.y;
      if (resize) overBox.w = Math.max(16, Math.round(start.box.w + dx));
      else {
        overBox.x = start.box.x + dx / (tr.width || 1);
        overBox.y = start.box.y + dy / (tr.height || 1);
      }
      refreshMock();
    };
    h.onpointerup = () => { h.onpointermove = null; h.onpointerup = null; render(); };
  }

  // ---------- card ----------

  /** The size line, updated in place (re-rendering the card mid-click would swallow the click). */
  function renderMeta() {
    const meta = card.querySelector('.row.meta');
    const v = current();
    if (!meta || !v) return;
    const w = renderedWidth();
    meta.textContent = `${w}×${renderedHeight(w) || '?'}px${v.natural ? ` · file ${v.natural.width}×${v.natural.height}` : ''}`;
  }

  function render() {
    if (card.hidden || !target) return;
    const v = current();
    const isVoid = VOID.has(target.element.tagName);
    const w = v ? renderedWidth() : 0;
    const hgt = v ? renderedHeight(w) : 0;
    const isVideo = !!v?.mime.startsWith('video/');
    const thumbs = variants.map((x, i) => {
      const media = x.mime.startsWith('video/') ? `<video src="${x.url}" muted playsinline></video>` : `<img src="${x.url}" alt="">`;
      return `<button class="thumb" data-variant="${i}" aria-pressed="${i === active}" title="${esc(x.file.name)} (${i + 1})">${media}<span class="n">${i + 1}</span><span class="rm" data-remove="${i}" title="Remove" aria-label="Remove ${esc(x.file.name)}">${icon('x', 12)}</span></button>`;
    }).join('');
    const well = variants.length
      ? `<div class="thumbs">${thumbs}${variants.length < MAX_VARIANTS ? `<button class="thumb add" data-act="browse" title="Add a variant" aria-label="Add a variant">+</button>` : ''}</div>`
      : `<button class="ah-place-drop" data-act="browse"><b>Drop, paste or browse</b><span>PNG, JPG, WebP, GIF, SVG, MP4 or WebM</span></button>`;
    const posSeg = `<div class="ah-seg" role="radiogroup" aria-label="Position">${POSITIONS.map(([k, l]) => {
      const off = isVoid && (k.startsWith('inside') || k === 'over');
      return `<button data-pos="${k}" aria-pressed="${k === position}"${off ? ' disabled title="This element can\'t hold other content"' : ''}>${l}</button>`;
    }).join('')}</div>`;
    const sizeSeg = position === 'over'
      ? `<span class="ah-muted">Drag the ${isVideo ? 'video' : 'image'} on the page; pull its corner to resize.</span>`
      : `<div class="ah-seg" role="radiogroup" aria-label="Size">${(['original', 'fit', 'custom'] as SizeMode[]).map((k) => `<button data-size="${k}" aria-pressed="${k === sizeMode}">${k === 'original' ? 'Original' : k === 'fit' ? 'Fit width' : 'Custom'}</button>`).join('')}</div>${sizeMode === 'custom' ? `<input type="number" min="8" max="4000" step="1" data-field="width" value="${customWidth || w}" aria-label="Width in px"> <span class="ah-muted">px</span>` : ''}`;
    const d = api.destination();
    card.innerHTML = `
      <div class="head"><span class="status">Place</span><span class="sub2">${esc(api.nameFor(target.item))}</span><button class="ah-ibtn" data-act="close" aria-label="Close" title="Close (Esc)">${icon('x')}</button></div>
      ${well}
      ${v ? `<div class="row"><label>Position</label>${posSeg}</div>
      <div class="row"><label>Size</label>${sizeSeg}</div>
      <div class="row meta ah-mono">${w}×${hgt || '?'}px${v.natural ? ` · file ${v.natural.width}×${v.natural.height}` : ''}</div>
      ${isVideo
        ? `<div class="row checks">${(['autoplay', 'loop', 'muted'] as const).map((k) => `<label><input type="checkbox" data-video="${k}" ${video[k] ? 'checked' : ''}> ${k[0].toUpperCase() + k.slice(1)}</label>`).join('')}</div>`
        : `<div class="row"><label for="ah-place-alt">Alt text</label><input id="ah-place-alt" type="text" data-field="alt" value="${esc(alt)}" placeholder="Describe it, or leave empty if decorative"></div>`}
      <textarea id="ah-place-note" aria-label="Anything else for the agent" placeholder="Anything else? e.g. Round the corners like the other logos">${esc(note)}</textarea>` : ''}
      <div class="ah-actions"><button class="ah-ibtn mic" data-act="mic" title="Speak instead of typing" aria-label="Speak instead of typing" hidden>${icon('mic')}</button><span class="grow"></span><button class="ah-tbtn" data-act="close">Cancel</button><button class="ah-tbtn primary" data-act="send" ${!v || sending ? 'disabled' : ''}>${d.kind === 'agent' ? 'Send' : 'Copy'}${d.kind === 'agent' && d.client ? ` to ${esc(prettyAgentName(d.client))}` : ''}</button></div>`;
    const ta = card.querySelector('textarea') as HTMLTextAreaElement | null;
    const mic = card.querySelector('[data-act=mic]') as HTMLElement | null;
    if (ta && mic) api.attachVoice?.(ta, mic);
    position_();
  }

  function position_() {
    if (card.hidden || !target) return;
    const r = target.element.getBoundingClientRect();
    const m = mock?.getBoundingClientRect();
    let box = { left: r.left, top: r.top, width: r.width, height: r.height };
    // Clear of the element, the mock and the action pill together, like the composer.
    const pill = shadow.getElementById('ah-pill') as HTMLElement | null;
    const p = pill && !pill.hidden ? pill.getBoundingClientRect() : null;
    for (const o of [m && m.width ? m : null, p]) {
      if (!o) continue;
      const left = Math.min(box.left, o.left), top = Math.min(box.top, o.top);
      box = { left, top, width: Math.max(box.left + box.width, o.right) - left, height: Math.max(box.top + box.height, o.bottom) - top };
    }
    anchorTo(card, box, api.insets(), 10);
  }
  api.onLayout(() => { position_(); renderHandle(); });
  api.onSelectionChange((changed: boolean) => { if (changed && !card.hidden && state.selectedElement !== target?.element) closePlace(); });

  card.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const rm = t.closest('[data-remove]') as HTMLElement | null;
    if (rm) {
      e.stopPropagation();
      const i = Number(rm.dataset.remove);
      URL.revokeObjectURL(variants[i].url);
      variants.splice(i, 1);
      active = Math.min(active, Math.max(0, variants.length - 1));
      refreshMock();
      render();
      return;
    }
    const b = t.closest('button') as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    if (b.dataset.variant) { active = Number(b.dataset.variant); overBox.w = overBox.w || defaultOverWidth(); refreshMock(); render(); return; }
    if (b.dataset.pos) { position = b.dataset.pos as PlacePosition; if (position === 'over' && !overBox.w) overBox.w = defaultOverWidth(); refreshMock(); render(); return; }
    if (b.dataset.size) { sizeMode = b.dataset.size as SizeMode; if (sizeMode === 'custom' && !customWidth) customWidth = renderedWidth(); refreshMock(); render(); return; }
    const act = b.dataset.act;
    if (act === 'close') closePlace();
    if (act === 'browse') fileInput.click();
    if (act === 'send') send();
  });
  card.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.field === 'alt') { alt = t.value; if (mock instanceof HTMLImageElement) mock.alt = alt; }
    if (t.dataset.field === 'width') { customWidth = Math.max(8, Math.min(4000, Number(t.value) || 0)); refreshMock(); }
    if (t.id === 'ah-place-note') note = t.value;
  });
  card.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    const k = t.dataset.video as keyof typeof video | undefined;
    if (k) { video[k] = t.checked; refreshMock(); }
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); return; }
    const typing = (e.target as HTMLElement).matches('input, textarea');
    if (!typing && /^[1-4]$/.test(e.key) && variants[Number(e.key) - 1]) { active = Number(e.key) - 1; refreshMock(); render(); }
  });
  // Paste into the open card adds a variant.
  card.addEventListener('paste', (e) => {
    const files = Array.from(e.clipboardData?.files || []).filter(isPlaceable);
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  // ---------- send ----------

  async function send() {
    const v = current();
    if (!v || !target || sending) return;
    sending = true;
    render();
    const t = target;
    const dest = api.destination();
    try {
      const built = await factsPromise;
      if (!built) { api.toast('Could not read this element'); return; }
      const facts = built.facts;
      const width = renderedWidth();
      const height = renderedHeight(width) || Math.round(mock?.getBoundingClientRect().height || 0);
      // The mock as it looks on the page: the element, or its parent when the asset sits next to it.
      const scope: 'self' | 'parent' = position === 'before' || position === 'after' ? 'parent' : 'self';
      const shotOf = scope === 'parent' ? t.element.parentElement || t.element : t.element;
      const r = shotOf.getBoundingClientRect();
      const mockShot: string | null = await Promise.resolve(api.captureElement(shotOf)).catch(() => null);

      const res = await fetch(BRIDGE + '/api/place/assets', { method: 'POST', headers: { 'Content-Type': v.mime || 'application/octet-stream' }, body: v.file });
      const asset = await res.json().catch(() => ({}));
      if (!res.ok || !asset.path) {
        api.toast(res.status === 404 ? 'Restart your dev server to use Place' : asset.error || 'Could not stage the file');
        return;
      }
      const placement: Placement = {
        assetPath: asset.path,
        mime: asset.mime || v.mime,
        fileName: v.file.name,
        publicDir: asset.publicDir ?? null,
        position,
        width,
        height,
        natural: v.natural,
        targetWidth: Math.round(targetWidth()),
        offset: position === 'over' ? { x: overBox.x, y: overBox.y } : undefined,
        alt: v.mime.startsWith('video/') ? undefined : alt,
        video: v.mime.startsWith('video/') ? { ...video } : undefined,
      };
      const prompt = formatPlaceRequest(facts, placement, note);
      const kind = v.mime.startsWith('video/') ? 'video' : 'image';
      const name = api.nameFor(t.item);
      // The mock leaves before the agent works, so the built asset never shows twice.
      closePlace();
      const result = await api.dispatchToAgent(
        prompt,
        {
          type: 'place',
          instruction: note.trim() || `Place ${kind} ${v.file.name}`,
          component: facts.component?.name || '',
          file: facts.element.source?.file || facts.component?.file || '',
          line: facts.element.source?.line ?? facts.component?.startLine,
          selector: facts.element.selector,
          hierarchy: facts.hierarchy,
          label: facts.element.label,
          display: `Place ${kind} · ${name}`,
          place: { assetPath: placement.assetPath, mime: placement.mime, position, width, height },
          ...(dest.client ? { assignee: dest.client } : {}),
        },
        { quiet: true, destination: dest.kind },
      );
      if (result.task) {
        if (mockShot) api.setTaskShot?.(result.task.id, { before: mockShot, beforeSize: { w: Math.round(r.width), h: Math.round(r.height) }, labels: ['Mock', 'Built'], scope });
        api.trackTask(result.task, t.element);
        const who = dest.client ? prettyAgentName(dest.client) : null;
        api.toast(who ? `Sent to ${who}` : `Queued · no agent connected${result.copied ? ' · also copied' : ''}`, { action: 'View', onAction: () => api.openTaskCard(result.task.id) });
      } else {
        api.toast(result.copied ? 'Prompt copied · paste it into any AI tool' : 'Clipboard blocked by the browser');
      }
    } finally {
      sending = false;
      if (!card.hidden) render();
    }
  }

  // ---------- drop and paste on the page ----------

  /** The page element under a point, skipping Agent Hover's own UI and the mock. */
  function pageElementAt(x: number, y: number): Element | null {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest('#agent-hover-root') || el.closest('[data-ah-place]')) continue;
      return el;
    }
    return null;
  }

  /** Only while Agent Hover is in use, so dropping a file on your app works as usual otherwise. */
  const inUse = () => !!(state.mode || state.selectedTarget || state.side?.open || !card.hidden);
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');

  window.addEventListener('dragover', (e) => {
    if (!inUse() || !hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, true);
  window.addEventListener('drop', (e) => {
    if (!inUse() || !hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files || []);
    // Onto the open card: more variants. Onto the page: Place at what it landed on.
    if (!card.hidden) {
      const r = card.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { addFiles(files); return; }
    }
    placeFiles(files, pageElementAt(e.clientX, e.clientY));
  }, true);
  window.addEventListener('paste', (e) => {
    if (!state.selectedTarget || !card.hidden) return;
    // Pasting into a text field (yours or ours) stays a normal paste.
    let focused = document.activeElement as HTMLElement | null;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement as HTMLElement;
    if (focused && (focused.matches('input, textarea, select') || focused.isContentEditable)) return;
    const files = Array.from(e.clipboardData?.files || []).filter(isPlaceable);
    if (!files.length) return;
    e.preventDefault();
    openPlace(files);
  });
}
