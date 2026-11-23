import { anchorTo, esc } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { prettyAgentName } from '../lib/task-status.js';
import { formatPlaceRequest, type Placement } from '../lib/prompt-format.js';
import type { OverlayApp } from '../app/context.js';

/** What Place takes: checked again by the bridge from the file's own bytes. */
export const PLACE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm'];
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_VERSIONS = 4;
const SNAP = 5;
/** Text-level elements: a placed image is described against the block they sit in. */
const TEXT = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'B', 'I', 'EM', 'STRONG', 'A', 'TD', 'TH', 'TR', 'TBODY', 'THEAD', 'LI', 'LABEL', 'SMALL', 'BUTTON', 'IMG', 'SVG', 'PATH', 'svg', 'path']);
const ALIGN_LABEL: Record<string, string> = { tl: 'top left', tc: 'top center', tr: 'top right', ml: 'middle left', mc: 'center', mr: 'middle right', bl: 'bottom left', bc: 'bottom center', br: 'bottom right' };

/** Whether a dropped or pasted file is one Place can use. */
export function isPlaceable(file: { type: string; size: number }): boolean {
  return PLACE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_BYTES;
}

interface Asset { file: File; url: string; mime: string; name: string; natural?: { width: number; height: number } }
interface Item {
  id: number;
  el: HTMLElement;
  versions: Asset[];
  active: number;
  /** The page element it sits on, and its top-left offset from that element's top-left (px). */
  anchor: Element | null;
  dx: number;
  dy: number;
  /** Without an anchor: document position (px). */
  px: number;
  py: number;
  w: number;
  rot: number;
  align: string | null;
  alt: string;
  note: string;
  /** Where you dropped it (document px), until its real size is known and it can be centered there. */
  drop?: { x: number; y: number };
}

/**
 * Place (0.3), like a design tool: images and video go anywhere on the page. Drag them, snap to the edges and centers
 * of what's around, resize, rotate, align, add versions, remove. They live in Agent Hover's own layer (the page is
 * never changed) and stay with the element under them as the page scrolls. Send stages each file in
 * .agent-hover/place/ and tells the agent where each one sits, against the element under it.
 */
export function setupPlace(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { openPlace, closePlace: placeEscape, placeEscape, placeKey, isPlaceOpen, togglePlace, placeFiles, placedCount: () => items.length });

  const layer = shadow.getElementById('ah-layer-place') as HTMLElement;
  const pal = shadow.getElementById('ah-d-pal') as HTMLElement;
  const placeBtn = shadow.getElementById('ah-d-place') as HTMLElement;
  const pop = shadow.getElementById('ah-pal-pop') as HTMLElement;
  const frame = shadow.getElementById('ah-place-frame') as HTMLElement;
  const tag = shadow.getElementById('ah-place-tag') as HTMLElement;
  const sizeTip = shadow.getElementById('ah-place-size') as HTMLElement;
  const guideV = shadow.getElementById('ah-guide-v') as HTMLElement;
  const guideH = shadow.getElementById('ah-guide-h') as HTMLElement;
  const dropTip = shadow.getElementById('ah-place-drop') as HTMLElement;
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = PLACE_TYPES.join(',');
  fileInput.multiple = true;

  let items: Item[] = [];
  let activeId: number | null = null;
  let seq = 1;
  let open = false;
  let popKind: string | null = null;
  /** Files added this session, offered again in the palette. */
  const recent: Asset[] = [];
  /** Where the next file from the picker goes: on the selection, a new version, or the middle of the view. */
  let pickFor: 'center' | 'selection' | 'version' = 'center';
  let gesture: null | { kind: 'move' | 'resize' | 'rotate'; it: Item; x: number; y: number; left?: number; top?: number; w?: number; corner?: string; cx?: number; cy?: number; targets?: DOMRect[] } = null;
  let sending = false;

  const act = () => items.find((i) => i.id === activeId) || null;

  // ---------- assets ----------
  function assetOf(file: File): Asset {
    const a: Asset = { file, url: URL.createObjectURL(file), mime: file.type, name: file.name || (file.type.startsWith('video/') ? 'clip.mp4' : 'pasted.png') };
    if (a.mime.startsWith('video/')) {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => { a.natural = { width: v.videoWidth, height: v.videoHeight }; refit(a); };
      v.src = a.url;
    } else {
      const im = new Image();
      im.onload = () => { a.natural = { width: im.naturalWidth, height: im.naturalHeight }; refit(a); };
      im.src = a.url;
    }
    if (!recent.some((r) => r.file === file)) recent.unshift(a);
    if (recent.length > 6) recent.length = 6;
    return a;
  }
  /** First size: its own width, at most 240px; set again once the file's size is known. */
  function refit(a: Asset) {
    for (const it of items) {
      if (it.versions[it.active] !== a || it.el.dataset.sized) continue;
      it.el.dataset.sized = '1';
      it.w = Math.round(Math.min(a.natural?.width || 200, 240));
      if (it.drop && a.natural) {
        const h = (it.w * a.natural.height) / a.natural.width;
        setRect(it, it.drop.x - window.scrollX - it.w / 2, it.drop.y - window.scrollY - h / 2);
        reanchor(it);
      }
      delete it.drop;
    }
    renderPal();
    api.requestLayout();
  }
  function media(a: Asset): HTMLElement {
    const m = document.createElement(a.mime.startsWith('video/') ? 'video' : 'img') as HTMLImageElement | HTMLVideoElement;
    m.src = a.url;
    m.draggable = false;
    if (m instanceof HTMLVideoElement) { m.muted = true; m.loop = true; m.autoplay = true; m.playsInline = true; }
    else m.alt = '';
    return m;
  }

  // ---------- page geometry ----------
  /** The page element at a point (never Agent Hover's own UI), raised from text to the block it sits in. */
  function pageElementAt(x: number, y: number): Element | null {
    let el = document.elementsFromPoint(x, y).find((e) => !e.closest('#agent-hover-root') && e.id !== 'agent-hover-root') || null;
    while (el && el !== document.body && TEXT.has(el.tagName)) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    return el;
  }
  function rectOf(it: Item): { left: number; top: number; width: number; height: number } {
    const n = it.versions[it.active].natural;
    const h = n ? (it.w * n.height) / n.width : it.w;
    if (it.anchor && it.anchor.isConnected) {
      const r = it.anchor.getBoundingClientRect();
      return { left: r.left + it.dx, top: r.top + it.dy, width: it.w, height: h };
    }
    return { left: it.px - window.scrollX, top: it.py - window.scrollY, width: it.w, height: h };
  }
  /** Ties it to the element under its center (so it scrolls and moves with it). */
  function reanchor(it: Item) {
    const r = rectOf(it);
    it.el.style.pointerEvents = 'none';
    const el = pageElementAt(r.left + r.width / 2, r.top + r.height / 2);
    it.el.style.pointerEvents = '';
    it.anchor = el;
    if (el) { const a = el.getBoundingClientRect(); it.dx = r.left - a.left; it.dy = r.top - a.top; }
    else { it.px = r.left + window.scrollX; it.py = r.top + window.scrollY; }
  }
  function setRect(it: Item, left: number, top: number) {
    if (it.anchor && it.anchor.isConnected) { const a = it.anchor.getBoundingClientRect(); it.dx = left - a.left; it.dy = top - a.top; }
    else { it.px = left + window.scrollX; it.py = top + window.scrollY; }
  }

  // ---------- adding ----------
  function addAt(asset: Asset, x: number, y: number): Item {
    const el = document.createElement('div');
    el.className = 'ah-ph';
    el.appendChild(media(asset));
    layer.appendChild(el);
    const w = Math.round(Math.min(asset.natural?.width || 200, 240));
    const n = asset.natural;
    const h = n ? (w * n.height) / n.width : w;
    const it: Item = { id: seq++, el, versions: [asset], active: 0, anchor: null, dx: 0, dy: 0, px: 0, py: 0, w, rot: 0, align: null, alt: '', note: '' };
    if (n) el.dataset.sized = '1';
    else it.drop = { x: x + window.scrollX, y: y + window.scrollY };
    it.px = x - w / 2 + window.scrollX;
    it.py = y - h / 2 + window.scrollY;
    items.push(it);
    reanchor(it);
    el.addEventListener('pointerdown', (e) => startGesture(e, it, 'move'));
    open = true;
    if (state.selectedTarget) api.deselect?.();
    select(it.id);
    return it;
  }
  function addFiles(files: File[], at?: { x: number; y: number }) {
    const ok = files.filter(isPlaceable);
    if (!ok.length) {
      api.toast(files.some((f) => f.size > MAX_BYTES) ? 'That file is over 50 MB' : 'Place takes PNG, JPG, WebP, GIF, SVG, MP4 and WebM');
      return;
    }
    if (ok.length < files.length) api.toast('Some files were skipped: Place takes PNG, JPG, WebP, GIF, SVG, MP4 and WebM up to 50 MB');
    ok.forEach((f, i) => {
      const p = at || centerPoint();
      addAt(assetOf(f), p.x + i * 24, p.y + i * 24);
    });
  }
  /** On the selection when there is one, else the middle of the view. */
  function centerPoint() {
    const sel = state.selectedElement as Element | null;
    if (sel) { const r = sel.getBoundingClientRect(); if (r.width && r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    const ins = api.insets();
    return { x: (window.innerWidth - ins.right) / 2, y: window.innerHeight / 2 - 40 };
  }
  /** Files dropped or pasted: they land where you dropped them (or in view). */
  function placeFiles(files: File[], at?: { x: number; y: number }) { addFiles(files, at); }
  fileInput.onchange = () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    if (!files.length) return;
    const it = act();
    if (pickFor === 'version' && it) { addVersion(it, assetOf(files[0])); return; }
    addFiles(files);
  };
  function pick(kind: typeof pickFor) { pickFor = kind; fileInput.click(); }

  function removeItem(it: Item | null) {
    if (!it) return;
    it.el.remove();
    items = items.filter((i) => i !== it);
    if (activeId === it.id) activeId = null;
    closePop();
    renderPal();
    api.requestLayout();
  }
  function addVersion(it: Item, a: Asset) {
    if (it.versions.length >= MAX_VERSIONS) { api.toast(`Up to ${MAX_VERSIONS} versions`); return; }
    it.versions.push(a);
    setVersion(it, it.versions.length - 1);
    api.toast(`Version ${it.versions.length} · switch between them in the dock`);
  }
  function setVersion(it: Item, i: number) {
    it.active = i;
    it.el.replaceChildren(media(it.versions[i]));
    renderPal();
    api.requestLayout();
  }
  function select(id: number | null) {
    activeId = id;
    items.forEach((i) => i.el.classList.toggle('on', i.id === id));
    closePop();
    renderPal();
    api.requestLayout();
  }

  // ---------- open / close ----------
  function isPlaceOpen() { return open || items.length > 0; }
  /** P or the dock button: open the palette, or back from one image's tools to the palette. */
  function togglePlace() {
    if (activeId !== null) { select(null); return; }
    if (open && !items.length) { open = false; renderPal(); return; }
    open = true;
    api.stopVoice?.();
    renderPal();
  }
  /** The pill's Place: choose a file and put it on the selected element. */
  function openPlace() { open = true; renderPal(); pick('selection'); }
  /** Esc, innermost first. True when it did something. */
  function placeEscape(): boolean {
    if (gesture) { gesture = null; hideGuides(); return true; }
    if (popKind) { closePop(); renderPal(); return true; }
    if (activeId !== null) { select(null); return true; }
    if (open && !items.length) { open = false; renderPal(); return true; }
    return false;
  }
  /** Delete removes the selected image; arrows nudge it (Shift: 10px). */
  function placeKey(e: KeyboardEvent): boolean {
    const it = act();
    if (items.length && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); return true; }
    if (!it) return false;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeItem(it); api.toast('Removed'); return true; }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      const r = rectOf(it);
      setRect(it, r.left + (e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0), r.top + (e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0));
      it.align = null;
      renderPal();
      api.requestLayout();
      return true;
    }
    return false;
  }

  // ---------- the palette in the dock ----------
  placeBtn.onclick = togglePlace;
  function renderPal() {
    const shown = isPlaceOpen();
    placeBtn.setAttribute('aria-pressed', String(shown));
    pal.hidden = !shown;
    if (!shown) { api.renderDock?.(); return; }
    const it = act();
    const send = items.length
      ? `<span class="placed">${items.length} placed</span><button class="ah-tbtn primary send" data-a="send" data-tip="${esc(sendTip())}" data-key="⌘↵" ${sending ? 'disabled' : ''}>${icon('send', 14)}<span class="lbl">${api.destination().kind === 'agent' ? 'Send' : 'Copy'}</span></button>`
      : '';
    if (!it) {
      const thumbs = recent.map((a, i) => `<button class="pt" data-r="${i}" data-tip="Drag onto the page, or click to add" aria-label="Add ${esc(a.name)} again" style="background-image:url('${a.url}')"></button>`).join('');
      pal.innerHTML = `${thumbs}<button class="ah-tbtn add" data-a="pick" data-tip="Add an image or video from your computer">${icon('plus', 14)}${recent.length ? '' : '<span class="lbl">Add image</span>'}</button>`
        + (items.length ? `<span class="ah-sep"></span>${send}` : `<span class="palhint">or drop / paste it on the page</span>`)
        + `<button class="ah-ibtn" data-a="close" data-tip="${items.length ? 'Remove all' : 'Close'}" aria-label="${items.length ? 'Remove all placed images' : 'Close'}">${icon(items.length ? 'trash' : 'back', 14)}</button>`;
    } else {
      const vers = it.versions.map((v, i) => `<button class="pt sm" data-v="${i}" aria-pressed="${i === it.active}" data-tip="Version ${i + 1} · ${esc(v.name)}" aria-label="Version ${i + 1}" style="background-image:url('${v.url}')"></button>`).join('')
        + (it.versions.length < MAX_VERSIONS ? `<button class="ah-ibtn sm" data-a="version" data-tip="Try another version here" aria-label="Add a version">${icon('plus', 14)}</button>` : '');
      pal.innerHTML = `<button class="ah-ibtn" data-a="back" data-tip="Add another image" aria-label="Add another image">${icon('back', 14)}</button><span class="vers">${vers}</span><span class="ah-sep"></span>
        <button class="ah-ibtn" data-a="align" data-tip="${it.align ? 'Aligned ' + esc(ALIGN_LABEL[it.align]) : 'Align on what it sits on'}" aria-label="Align" aria-pressed="${popKind === 'align'}">${icon('align')}</button>
        <button class="ah-ibtn" data-a="rotate" data-tip="Rotate 90°" aria-label="Rotate">${icon('rotate')}${it.rot ? `<span class="deg">${it.rot}°</span>` : ''}</button>
        <button class="ah-tbtn" data-a="alt" aria-pressed="${popKind === 'alt'}" data-tip="Alt text">${it.alt ? 'Alt ✓' : 'Alt'}</button>
        <button class="ah-tbtn" data-a="note" aria-pressed="${popKind === 'note'}" data-tip="A note for the agent">${it.note ? 'Note ✓' : 'Note'}</button>
        <button class="ah-ibtn" data-a="del" data-tip="Remove" data-key="Delete" aria-label="Remove">${icon('trash')}</button><span class="ah-sep"></span>${send}`;
    }
    api.renderDock?.();
  }
  function sendTip() { const d = api.destination(); return d.kind === 'agent' ? `Send to ${prettyAgentName(d.client)}` : 'Copy the prompt'; }

  let palDrag: { a: Asset; x: number; y: number; moved: boolean } | null = null;
  pal.addEventListener('pointerdown', (e) => {
    const t = (e.target as Element).closest('.pt[data-r]') as HTMLElement | null;
    if (!t) return;
    e.preventDefault();
    palDrag = { a: recent[+t.dataset.r!], x: e.clientX, y: e.clientY, moved: false };
  });
  pal.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button') as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    const it = act();
    const a = b.dataset.a;
    if (b.dataset.v && it) { setVersion(it, +b.dataset.v); return; }
    if (a === 'pick') pick('center');
    if (a === 'back') select(null);
    if (a === 'close') { items.slice().forEach(removeItem); open = false; renderPal(); }
    if (a === 'version' || a === 'align' || a === 'alt' || a === 'note') { togglePop(a, b); return; }
    if (a === 'rotate' && it) { it.rot = (it.rot + 90) % 360; renderPal(); api.requestLayout(); }
    if (a === 'del') { removeItem(it); api.toast('Removed'); }
    if (a === 'send') send();
  });

  function closePop() { popKind = null; pop.hidden = true; }
  function togglePop(kind: string, btn: HTMLElement) {
    const it = act();
    if (!it) return;
    if (popKind === kind) { closePop(); renderPal(); return; }
    popKind = kind;
    if (kind === 'version') {
      pop.innerHTML = `<div class="ph-h">Try another version in the same spot</div>${recent.length ? `<div class="tiles">${recent.map((a, i) => `<button class="pt" data-add="${i}" aria-label="${esc(a.name)}" style="background-image:url('${a.url}')"></button>`).join('')}</div>` : ''}<button class="ah-tbtn outline" data-a="pick">${icon('file', 14)}Choose a file…</button>`;
    }
    if (kind === 'align') {
      const on = it.anchor ? api.nameFor({ isDomElement: true, element: it.anchor }) : 'the page';
      pop.innerHTML = `<div class="ph-h">Align on ${esc(on)}</div><div class="agrid">${Object.keys(ALIGN_LABEL).map((c) => `<button data-al="${c}" aria-pressed="${it.align === c}" aria-label="${ALIGN_LABEL[c]}" title="${ALIGN_LABEL[c]}"><i class="al-${c}"></i></button>`).join('')}</div><div class="ph-hint">Or drag it: it snaps to the edges and centers of what's around it.</div>`;
    }
    if (kind === 'alt') pop.innerHTML = `<div class="ph-h">Alt text</div><input id="ah-place-alt" placeholder="What it shows (empty if decorative)" value="${esc(it.alt)}">`;
    if (kind === 'note') pop.innerHTML = `<div class="ph-h">Note for the agent</div><textarea id="ah-place-note" rows="3" placeholder="e.g. round the corners like the avatar">${esc(it.note)}</textarea>`;
    renderPal();
    pop.hidden = false;
    anchorTo(pop, btn.getBoundingClientRect(), api.insets(), 8);
    const f = pop.querySelector('input, textarea') as HTMLInputElement | null;
    if (f) { f.focus(); f.selectionStart = f.value.length; }
  }
  pop.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button') as HTMLElement | null;
    const it = act();
    if (!b || !it) return;
    if (b.dataset.add) { addVersion(it, recent[+b.dataset.add]); closePop(); renderPal(); return; }
    if (b.dataset.a === 'pick') { closePop(); pick('version'); return; }
    if (b.dataset.al) { alignTo(it, b.dataset.al); closePop(); renderPal(); }
  });
  pop.addEventListener('input', (e) => {
    const it = act();
    const t = e.target as HTMLInputElement;
    if (!it) return;
    if (t.id === 'ah-place-alt') it.alt = t.value;
    if (t.id === 'ah-place-note') it.note = t.value;
  });
  pop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); closePop(); send(); }
    else if (e.key === 'Enter' && (e.target as HTMLElement).id === 'ah-place-alt') { e.preventDefault(); closePop(); renderPal(); }
  });

  function alignTo(it: Item, a: string) {
    const r = rectOf(it);
    const box = it.anchor?.getBoundingClientRect() || new DOMRect(0, 0, window.innerWidth - api.insets().right, window.innerHeight);
    const x = a[1] === 'l' ? box.left : a[1] === 'c' ? box.left + (box.width - r.width) / 2 : box.right - r.width;
    const y = a[0] === 't' ? box.top : a[0] === 'm' ? box.top + (box.height - r.height) / 2 : box.bottom - r.height;
    setRect(it, x, y);
    it.align = a;
    api.requestLayout();
  }

  // ---------- gestures: move (with snapping), resize, rotate ----------
  function snapTargets(): DOMRect[] {
    const out: DOMRect[] = [];
    const vh = window.innerHeight;
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (out.length > 600) break;
      if ((el as HTMLElement).closest?.('#agent-hover-root')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 12 || r.bottom < -200 || r.top > vh + 200) continue;
      out.push(r);
    }
    return out;
  }
  function startGesture(e: PointerEvent, it: Item, kind: 'move' | 'resize' | 'rotate', corner?: string) {
    e.preventDefault();
    e.stopPropagation();
    if (activeId !== it.id) select(it.id);
    closePop();
    const r = rectOf(it);
    gesture = { kind, it, x: e.clientX, y: e.clientY, left: r.left, top: r.top, w: it.w, corner, cx: r.left + r.width / 2, cy: r.top + r.height / 2, targets: kind === 'move' ? snapTargets() : undefined };
  }
  frame.addEventListener('pointerdown', (e) => {
    const it = act();
    if (!it) return;
    const t = e.target as HTMLElement;
    if (t.closest('.del')) { e.preventDefault(); removeItem(it); api.toast('Removed'); return; }
    if (t.dataset.c) { startGesture(e, it, 'resize', t.dataset.c); return; }
    if (t.classList.contains('rot')) { startGesture(e, it, 'rotate'); return; }
    startGesture(e, it, 'move');
  });
  window.addEventListener('pointermove', (e) => {
    if (palDrag) {
      if (!palDrag.moved && Math.hypot(e.clientX - palDrag.x, e.clientY - palDrag.y) < 4) return;
      palDrag.moved = true;
      showDropTip(e.clientX, e.clientY);
      return;
    }
    if (!gesture) return;
    const g = gesture, it = g.it;
    delete it.drop;
    if (g.kind === 'move') moveTo(it, g.left! + e.clientX - g.x, g.top! + e.clientY - g.y, e.altKey, g.targets!);
    if (g.kind === 'resize') {
      const west = g.corner!.includes('w');
      it.w = Math.max(16, Math.round(g.w! + (west ? -1 : 1) * (e.clientX - g.x)));
      const r = rectOf(it);
      setRect(it, west ? g.left! + (g.w! - it.w) : g.left!, g.top!);
      if (it.align) alignTo(it, it.align);
      tip(`${Math.round(r.width)} × ${Math.round(r.height)}`);
    }
    if (g.kind === 'rotate') {
      let deg = (Math.atan2(e.clientY - g.cy!, e.clientX - g.cx!) * 180) / Math.PI + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      for (const s of [0, 90, 180, 270, 360]) if (Math.abs(deg - s) < 4) deg = s;
      it.rot = ((Math.round(deg) % 360) + 360) % 360;
      tip(`${it.rot}°`);
      renderPal();
    }
    api.requestLayout();
  });
  window.addEventListener('pointerup', (e) => {
    if (palDrag) {
      const d = palDrag;
      palDrag = null;
      dropTip.hidden = true;
      if (!d.moved) { const p = centerPoint(); addAt(d.a, p.x, p.y); return; }
      if (!overDock(e.clientX, e.clientY)) addAt(d.a, e.clientX, e.clientY);
      return;
    }
    if (!gesture) return;
    const it = gesture.it;
    gesture = null;
    sizeTip.hidden = true;
    hideGuides();
    reanchor(it);
    api.requestLayout();
  });
  function overDock(x: number, y: number) {
    const d = (shadow.getElementById('ah-dock') as HTMLElement).getBoundingClientRect();
    return x >= d.left && x <= d.right && y >= d.top && y <= d.bottom;
  }

  /** Move with smart guides: its edges and center snap to the edges and centers of nearby elements. Alt: no snapping. */
  function moveTo(it: Item, left: number, top: number, free: boolean, targets: DOMRect[]) {
    const r = rectOf(it), w = r.width, h = r.height;
    let bx: { d: number; v: number; line: number; t: DOMRect } | null = null;
    let by: { d: number; v: number; line: number; t: DOMRect } | null = null;
    if (!free) {
      for (const t of targets) {
        for (const o of [0, w / 2, w]) for (const v of [t.left, t.left + t.width / 2, t.right]) { const d = Math.abs(left + o - v); if (d < SNAP && (!bx || d < bx.d)) bx = { d, v: v - o, line: v, t }; }
        for (const o of [0, h / 2, h]) for (const v of [t.top, t.top + t.height / 2, t.bottom]) { const d = Math.abs(top + o - v); if (d < SNAP && (!by || d < by.d)) by = { d, v: v - o, line: v, t }; }
      }
    }
    if (bx) left = bx.v;
    if (by) top = by.v;
    setRect(it, left, top);
    it.align = null;
    if (bx) { const t0 = Math.min(top, bx.t.top), t1 = Math.max(top + h, bx.t.bottom); place(guideV, bx.line, t0, 0, t1 - t0); } else guideV.hidden = true;
    if (by) { const l0 = Math.min(left, by.t.left), l1 = Math.max(left + w, by.t.right); place(guideH, l0, by.line, l1 - l0, 0); } else guideH.hidden = true;
  }
  function place(el: HTMLElement, left: number, top: number, width: number, height: number) {
    el.hidden = false;
    Object.assign(el.style, { left: left + 'px', top: top + 'px', width: Math.max(1, width) + 'px', height: Math.max(1, height) + 'px' });
  }
  function hideGuides() { guideV.hidden = true; guideH.hidden = true; }
  function tip(text: string) {
    const it = act();
    if (!it) return;
    const r = rectOf(it);
    sizeTip.textContent = text;
    sizeTip.hidden = false;
    sizeTip.style.left = r.left + r.width + 8 + 'px';
    sizeTip.style.top = r.top + r.height + 8 + 'px';
  }
  function showDropTip(x: number, y: number) {
    dropTip.hidden = overDock(x, y);
    dropTip.style.left = x + 16 + 'px';
    dropTip.style.top = y + 14 + 'px';
  }

  // ---------- layout: every frame the page moves ----------
  api.onLayout(() => {
    for (const it of items) {
      const r = rectOf(it);
      Object.assign(it.el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', transform: it.rot ? `rotate(${it.rot}deg)` : '' });
    }
    const it = act();
    if (!it) { frame.hidden = true; tag.hidden = true; return; }
    const r = rectOf(it);
    const h = it.el.offsetHeight || r.height;
    Object.assign(frame.style, { left: r.left - 1 + 'px', top: r.top - 1 + 'px', width: r.width + 2 + 'px', height: h + 2 + 'px', transform: it.rot ? `rotate(${it.rot}deg)` : '' });
    frame.hidden = false;
    tag.textContent = where(it);
    tag.hidden = !!gesture;
    tag.style.top = r.top + h + 12 + 'px';
    tag.style.left = Math.max(8, Math.min(r.left, window.innerWidth - api.insets().right - tag.offsetWidth - 12)) + 'px';
    if (!pop.hidden) { const b = pal.querySelector(`[data-a="${popKind}"]`) as HTMLElement | null; if (b) anchorTo(pop, b.getBoundingClientRect(), api.insets(), 8); }
  });

  /** Where it sits relative to the element under it, as placed. */
  function placementOf(it: Item): Omit<Placement, 'assetPath' | 'mime' | 'publicDir'> & { anchor: Element | null } {
    const r = rectOf(it);
    const a = it.versions[it.active];
    const h = it.el.offsetHeight || r.height;
    const base = { fileName: a.name, width: Math.round(r.width), height: Math.round(h), natural: a.natural, rotation: it.rot || undefined, align: it.align ? ALIGN_LABEL[it.align] : undefined, alt: a.mime.startsWith('video/') ? undefined : it.alt, video: a.mime.startsWith('video/') ? { loop: true, muted: true, autoplay: true } : undefined };
    if (it.anchor && it.anchor.isConnected) {
      const b = it.anchor.getBoundingClientRect();
      return { ...base, relation: 'on', offset: { x: Math.round(r.left - b.left), y: Math.round(r.top - b.top) }, box: { width: Math.round(b.width), height: Math.round(b.height) }, anchor: it.anchor };
    }
    // In empty space: describe it against the nearest element above it.
    const above = Array.from(document.body.querySelectorAll('*')).filter((el) => !(el as HTMLElement).closest?.('#agent-hover-root')).map((el) => ({ el, b: el.getBoundingClientRect() }))
      .filter(({ b }) => b.width > 12 && b.height > 12 && b.bottom <= r.top && b.left < r.left + r.width && b.right > r.left)
      .sort((x, y) => y.b.bottom - x.b.bottom)[0];
    if (above) return { ...base, relation: 'below', offset: { x: Math.round(r.left - above.b.left), y: Math.round(r.top - above.b.bottom) }, box: { width: Math.round(above.b.width), height: Math.round(above.b.height) }, anchor: above.el };
    return { ...base, relation: 'on', offset: { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY) }, box: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, anchor: document.body };
  }
  function where(it: Item): string {
    const p = placementOf(it);
    const name = p.anchor && p.anchor !== document.body ? api.nameFor({ isDomElement: true, element: p.anchor }) : 'the page';
    let s = p.relation === 'below'
      ? `Below ${name}, ${p.offset.y}px under it`
      : `On ${name}, ${p.offset.x < 0 ? `${-p.offset.x}px past its left edge` : `${p.offset.x}px from its left`}, ${p.offset.y < 0 ? `${-p.offset.y}px past its top edge` : `${p.offset.y}px from its top`}`;
    if (it.align) s += `, ${ALIGN_LABEL[it.align]}`;
    if (it.rot) s += `, rotated ${it.rot}°`;
    return s;
  }

  // ---------- send ----------
  /** The mock as it looked: the element under it, with the placed images drawn on top (for Compare). */
  async function mockShot(anchor: Element, list: Item[]): Promise<{ url: string; w: number; h: number } | null> {
    try {
      const shot: string | null = await api.captureElement(anchor);
      if (!shot) return null;
      const base = await loadImage(shot);
      const b = anchor.getBoundingClientRect();
      const k = base.width / (b.width || 1);
      const c = document.createElement('canvas');
      c.width = base.width; c.height = base.height;
      const g = c.getContext('2d')!;
      g.drawImage(base, 0, 0);
      for (const it of list) {
        const m = it.el.firstElementChild as CanvasImageSource | null;
        if (!m) continue;
        const r = rectOf(it), h = it.el.offsetHeight || r.height;
        g.save();
        g.translate((r.left - b.left + r.width / 2) * k, (r.top - b.top + h / 2) * k);
        g.rotate((it.rot * Math.PI) / 180);
        g.drawImage(m, (-r.width / 2) * k, (-h / 2) * k, r.width * k, h * k);
        g.restore();
      }
      return { url: c.toDataURL('image/png'), w: Math.round(b.width), h: Math.round(b.height) };
    } catch {
      return null;
    }
  }
  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }

  async function send() {
    if (!items.length || sending) return;
    sending = true;
    renderPal();
    const dest = api.destination();
    const list = items.slice();
    try {
      const prepared: Array<{ it: Item; p: ReturnType<typeof placementOf>; facts: any }> = [];
      for (const it of list) {
        const p = placementOf(it);
        const anchor = p.anchor && p.anchor !== document.body ? p.anchor : document.body;
        const built = await api.buildFacts(api.stackFor(anchor), 0).catch(() => null);
        if (!built) { api.toast('Could not read the element under an image'); return; }
        prepared.push({ it, p, facts: built.facts });
      }
      const first = prepared[0];
      const shot = first.p.anchor ? await mockShot(first.p.anchor, list.filter((i) => placementOf(i).anchor === first.p.anchor)) : null;

      const placements: Array<{ facts: any; placement: Placement }> = [];
      const payload: Array<{ assetPath: string; mime: string; width: number; height: number; rotation?: number; on?: string }> = [];
      for (const { it, p, facts } of prepared) {
        const a = it.versions[it.active];
        const res = await fetch(BRIDGE + '/api/place/assets', { method: 'POST', headers: { 'Content-Type': a.mime || 'application/octet-stream' }, body: a.file });
        const asset = await res.json().catch(() => ({}));
        if (!res.ok || !asset.path) {
          api.toast(res.status === 404 ? 'Restart your dev server to use Place' : asset.error || 'Could not stage the file');
          return;
        }
        const { anchor: _a, ...rest } = p;
        placements.push({ facts, placement: { ...rest, assetPath: asset.path, mime: asset.mime || a.mime, publicDir: asset.publicDir ?? null } });
        payload.push({ assetPath: asset.path, mime: asset.mime || a.mime, width: p.width, height: p.height, rotation: p.rotation, on: facts.element.selector });
      }
      const note = list.map((i) => i.note.trim()).filter(Boolean).join('\n');
      const prompt = formatPlaceRequest(placements, note);
      const f0 = first.facts;
      const anchorEl = first.p.anchor && first.p.anchor !== document.body ? first.p.anchor : null;
      const kind = list.every((i) => i.versions[i.active].mime.startsWith('video/')) ? 'video' : 'image';
      const display = list.length === 1 ? `Place ${kind} · ${anchorEl ? api.nameFor({ isDomElement: true, element: anchorEl }) : 'page'}` : `Place ${list.length} ${kind}s`;
      // The mocks leave once sent, so the built images never show twice.
      list.forEach((i) => i.el.remove());
      items = items.filter((i) => !list.includes(i));
      activeId = null;
      open = false;
      closePop();
      renderPal();
      api.requestLayout();
      const result = await api.dispatchToAgent(
        prompt,
        {
          type: 'place',
          instruction: note || (list.length === 1 ? `Place ${list[0].versions[list[0].active].name}` : `Place ${list.length} ${kind}s`),
          component: f0.component?.name || '',
          file: f0.element.source?.file || f0.component?.file || '',
          line: f0.element.source?.line ?? f0.component?.startLine,
          selector: f0.element.selector,
          hierarchy: f0.hierarchy,
          label: f0.element.label,
          display,
          place: payload,
          ...(dest.client ? { assignee: dest.client } : {}),
        },
        { quiet: true, destination: dest.kind },
      );
      if (result.task) {
        if (shot) api.setTaskShot?.(result.task.id, { before: shot.url, beforeSize: { w: shot.w, h: shot.h }, labels: ['Mock', 'Built'], scope: 'self' });
        api.trackTask(result.task, anchorEl);
        const who = dest.client ? prettyAgentName(dest.client) : null;
        api.toast(who ? `Sent to ${who}` : `Queued · no agent connected${result.copied ? ' · also copied' : ''}`, { action: 'View', onAction: () => api.openTaskCard(result.task.id) });
      } else {
        api.toast(result.copied ? 'Prompt copied · paste it into any AI tool' : 'Clipboard blocked by the browser');
      }
    } finally {
      sending = false;
      renderPal();
    }
  }

  // ---------- drop and paste on the page ----------
  /** Only while Agent Hover is in use, so dropping a file on your app works as usual otherwise. */
  const inUse = () => !!(state.mode || state.selectedTarget || state.side?.open || isPlaceOpen());
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  window.addEventListener('dragover', (e) => {
    if (!inUse() || !hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    showDropTip(e.clientX, e.clientY);
  }, true);
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dropTip.hidden = true; }, true);
  window.addEventListener('drop', (e) => {
    if (!inUse() || !hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dropTip.hidden = true;
    const files = Array.from(e.dataTransfer?.files || []);
    const it = act();
    // Onto the selected image: another version of it. Anywhere else: a new one, right there.
    if (it) { const r = rectOf(it); if (e.clientX >= r.left && e.clientX <= r.left + r.width && e.clientY >= r.top && e.clientY <= r.top + r.height) { const f = files.find(isPlaceable); if (f) { addVersion(it, assetOf(f)); return; } } }
    addFiles(files, { x: e.clientX, y: e.clientY });
  }, true);
  window.addEventListener('paste', (e) => {
    if (!inUse()) return;
    let focused = document.activeElement as HTMLElement | null;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement as HTMLElement;
    if (focused && (focused.matches('input, textarea, select') || focused.isContentEditable)) return;
    const files = Array.from(e.clipboardData?.files || []).filter(isPlaceable);
    if (!files.length) return;
    e.preventDefault();
    addFiles(files);
  });
  // Clicking the page (not an image or the dock) leaves the selected image.
  window.addEventListener('pointerdown', (e) => {
    if (activeId === null) return;
    const path = e.composedPath();
    if (path.includes(frame) || path.includes(pal) || path.includes(pop) || items.some((i) => path.includes(i.el))) return;
    select(null);
  }, true);
}
