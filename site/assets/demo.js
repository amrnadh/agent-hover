// Agent Hover site — interactive hero demo.
// It renders the product's real overlay UI: the same markup as packages/overlay/src/ui/template.ts and the same
// stylesheet (overlay-ui.css is a copy of packages/overlay/src/styles/ui.css), inside a shadow root over the sample
// app. Only the agent is simulated.
(function () {
  const stage = document.getElementById('stage');
  const host = document.getElementById('ahHost');
  if (!stage || !host) return;

  /* ---------- icons: the overlay's own set (lib/icon.ts) ---------- */
  const DART = 'M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.13 1.58a2 2 0 0 0-1.43 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z';
  const P = {
    pointer: `<path d="${DART}"/>`,
    comment: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    tasks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    'layers-plus': '<path d="M12 2 2 7l10 5 10-5z"/><path d="m2 12 10 5 4-2"/><path d="M19 15v6"/><path d="M16 18h6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    send: '<path d="M14.54 21.69a.5.5 0 0 0 .93-.03l6.5-19a.5.5 0 0 0-.63-.63l-19 6.5a.5.5 0 0 0-.03.93l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/>',
    copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    'chev-down': '<path d="m6 9 6 6 6-6"/>',
    'chev-right': '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    'follow-up': '<path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  };
  const icon = (n, s = 16) => `<svg class="ah-i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
  const GRIP = '<svg class="ah-i" width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></g></svg>';
  const MARK = '<svg class="ah-i" width="20" height="20" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="5"/><g shape-rendering="crispEdges"><rect x="24" y="12" width="2" height="2"/><rect x="22" y="14" width="2" height="2"/><rect x="24" y="16" width="2" height="2"/><rect x="22" y="18" width="2" height="2"/><rect x="20" y="20" width="2" height="2"/><rect x="24" y="20" width="2" height="2"/><rect x="14" y="22" width="2" height="2"/><rect x="18" y="22" width="2" height="2"/><rect x="22" y="22" width="2" height="2"/><rect x="12" y="24" width="2" height="2"/><rect x="16" y="24" width="2" height="2"/><rect x="20" y="24" width="2" height="2"/><rect x="24" y="24" width="2" height="2"/></g></svg>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  /* ---------- the overlay, as in ui/template.ts ---------- */
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <link rel="stylesheet" href="assets/overlay-ui.css">
    <style>:host { position: absolute !important; inset: 0 !important; z-index: 5 !important; } #ah-pill, #ah-composer, .ah-card, #ah-toast { max-width: calc(100% - 24px) !important; }</style>
    <div id="ah-hover" class="ah-ov" hidden></div>
    <div id="ah-hover-label" hidden></div>
    <div id="ah-sel-frame" class="ah-ov" hidden><i></i><i></i><i></i><i></i></div>
    <div id="ah-layer-markers"></div>
    <div id="ah-layer-pins"></div>

    <div id="ah-pill" class="ah-surface" hidden role="toolbar" aria-label="Selected element">
      <button class="who" id="ah-pill-who" title="Open in editor"><b id="ah-pill-name"></b><span id="ah-pill-file"></span></button>
      <span class="ah-sep"></span>
      <button class="ah-tbtn" id="ah-pill-ask" title="Ask your agent (Enter)">${icon('send', 14)}Ask</button>
      <button class="ah-ibtn" id="ah-pill-comment" title="Comment (C)" aria-label="Comment">${icon('comment')}</button>
      <button class="ah-ibtn" id="ah-pill-batch" title="Add to batch (B)" aria-label="Add to batch" aria-pressed="false">${icon('layers-plus')}</button>
      <button class="ah-ibtn" id="ah-pill-copy" title="Copy context (⌘C)" aria-label="Copy context">${icon('copy')}</button>
      <button class="ah-ibtn" id="ah-pill-more" title="More" aria-label="More actions" aria-haspopup="menu">${icon('more')}</button>
      <span class="ah-sep"></span>
      <button class="ah-ibtn" id="ah-pill-close" title="Deselect (Esc)" aria-label="Deselect">${icon('x')}</button>
    </div>
    <div id="ah-pill-menu" class="ah-menu ah-surface" hidden role="menu">
      <button data-act="editor" role="menuitem">${icon('code')}Open in editor<kbd>O</kbd></button>
      <button data-act="shot" role="menuitem">${icon('camera')}Screenshot element</button>
      <button data-act="freeze" role="menuitem">${icon('lock')}<span>Don't let agents change this</span></button>
      <hr>
      <button data-act="parent" role="menuitem">${icon('up')}Select parent<kbd>↑</kbd></button>
      <button data-act="child" role="menuitem">${icon('down')}Select child<kbd>↓</kbd></button>
      <hr>
      <button data-act="details" role="menuitem">${icon('panel')}Show details<kbd>D</kbd></button>
    </div>

    <div id="ah-composer" class="ah-surface" hidden role="dialog" aria-label="Ask your agent">
      <div class="target">${icon('target', 14)}<b id="ah-comp-name"></b><span id="ah-comp-file" class="ah-mono"></span></div>
      <div class="follow" id="ah-comp-follow" hidden></div>
      <textarea id="ah-comp-input" aria-label="What should change" placeholder="What should change? e.g. Make the amount larger and add a sparkline"></textarea>
      <div class="foot">
        <button class="ah-tbtn outline dest" id="ah-comp-dest"><span class="ah-dot ok"></span><span>Claude Code</span>${icon('chev-down', 14)}</button>
        <button class="ah-ibtn mic" id="ah-comp-mic" title="Speak instead of typing" aria-label="Speak instead of typing">${icon('mic')}</button>
        <button class="ah-tbtn" id="ah-comp-cancel">Cancel</button>
        <button class="ah-tbtn primary" id="ah-comp-send"><span>Send</span><kbd>${isMac ? '⌘↵' : 'Ctrl↵'}</kbd></button>
      </div>
    </div>

    <div id="ah-task-card" class="ah-card ah-surface" hidden role="dialog" aria-label="Task"></div>

    <div id="ah-dock" class="ah-surface" role="toolbar" aria-label="Agent Hover">
      <button class="ah-ibtn mark" id="ah-d-mark" data-tip="Agent Hover · Claude Code connected" aria-label="Connection status">${MARK}<span class="ah-dot ok"></span></button>
      <span class="ah-sep"></span>
      <button class="ah-ibtn" id="ah-d-inspect" data-tip="Inspect" data-key="Alt" aria-pressed="true" aria-label="Inspect">${icon('pointer')}</button>
      <button class="ah-ibtn" id="ah-d-comment" data-tip="Comment" data-key="C" aria-pressed="false" aria-label="Comment mode">${icon('comment')}</button>
      <button class="ah-ibtn" id="ah-d-tasks" data-tip="Tasks" data-key="T" aria-pressed="false" aria-label="Tasks">${icon('tasks')}<span class="ah-dot pulse warn working" id="ah-d-tasks-dot" hidden></span></button>
      <button class="ah-ibtn" id="ah-d-batch" data-tip="Batch" data-key="B" aria-pressed="false" aria-label="Batch">${icon('layers')}<span class="count" id="ah-d-batch-count" hidden>0</span></button>
      <span class="ah-sep"></span>
      <button class="ah-ibtn" id="ah-d-more" data-tip="More" aria-label="More">${icon('more')}</button>
      <span class="grip" aria-hidden="true">${GRIP}</span>
    </div>
    <div id="ah-dock-tip" class="ah-tip" hidden></div>
    <div id="ah-toast" class="ah-surface" hidden role="status" aria-live="polite"></div>`;

  const $ = id => shadow.getElementById(id);
  const hover = $('ah-hover'), hoverLabel = $('ah-hover-label'), selFrame = $('ah-sel-frame'),
        pill = $('ah-pill'), pillMenu = $('ah-pill-menu'), composer = $('ah-composer'), input = $('ah-comp-input'),
        card = $('ah-task-card'), dock = $('ah-dock'), toastEl = $('ah-toast'), tip = $('ah-dock-tip'),
        markers = $('ah-layer-markers'), pins = $('ah-layer-pins');
  const hint = document.querySelector('[data-hint]');
  // The prompt isn't shown in the hero; it's still built for Copy and the token count.
  const promptEl = document.getElementById('prompt') || document.createElement('pre'), tokEl = document.getElementById('promptTok') || document.createElement('span');

  // Inside the demo the overlay is positioned in the stage, not the viewport.
  [hover, hoverLabel, selFrame, pill, pillMenu, composer, card, dock, toastEl, tip].forEach(n => (n.style.position = 'absolute'));

  /* follow the site theme, as the overlay follows the system theme */
  const siteDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const applyTheme = () => host.classList.toggle('light-mode', !siteDark());
  addEventListener('ah-theme', applyTheme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  applyTheme();

  /* ---------- state ---------- */
  let inspect = true, commentMode = false, selected = null, follow = null, task = null, pinCount = 0, toastT, typing;
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const rel = r => { const h = host.getBoundingClientRect(); return { left: r.left - h.left, top: r.top - h.top, width: r.width, height: r.height, right: r.right - h.left, bottom: r.bottom - h.top }; };
  const rectOf = el => rel(el.getBoundingClientRect());
  const placeBox = (n, r) => Object.assign(n.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const fileLine = el => el.dataset.file.split('/').pop() + ':' + el.dataset.line;
  const changeTarget = el => (el.dataset.changeTarget ? stage.querySelector(el.dataset.changeTarget) : el);
  const say = t => { if (hint) hint.textContent = t; };

  function toast(msg, action, onAction) {
    toastEl.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button class="ah-tbtn outline" data-act>${esc(action)}</button>` : '');
    if (action) toastEl.querySelector('[data-act]').onclick = () => { toastEl.hidden = true; onAction(); };
    toastEl.hidden = false;
    toastEl.style.bottom = (H() - dock.offsetTop + 10) + 'px';
    clearTimeout(toastT); toastT = setTimeout(() => (toastEl.hidden = true), action ? 5000 : 3000);
  }

  /* ---------- the prompt your agent receives (same sections as core's prompt format) ---------- */
  const hex = c => {
    const m = c.match(/[\d.]+/g); if (!m) return c;
    if (m.length === 4 && +m[3] === 0) return 'transparent';
    return '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
  };
  function renderPrompt(el, text) {
    if (!el || !promptEl) return;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const code = el.dataset.code, tag = code.split(/[#.]/)[0];
    const words = el.dataset.changeTarget ? '' : el.textContent.replace(/\s+/g, ' ').replace('→', '').trim();
    const short = words && words.length < 38;
    const comp = el.dataset.comp, file = el.dataset.file, line = +el.dataset.line;
    const a = Math.max(1, line - 40), b = line + 26;
    const fg = hex(el.classList.contains('squiggle') ? getComputedStyle(el.querySelector('svg')).color : cs.color);
    const bg = hex(cs.backgroundColor);
    const rad = parseFloat(cs.borderRadius) > 100 ? 'full' : (cs.borderRadius === '0px' ? '0' : cs.borderRadius);
    const h = s => `<span class="h">${esc(s)}</span>`, k = s => `<span class="k">${esc(s)}</span>`, q = s => `<span class="s">${esc(s)}</span>`;
    const what = text ? `<span class="typed">${esc(text)}</span>` : '<span class="d">(what you type in Ask goes here)</span>';
    const lines = [
      h(`# Change request: <${tag}>${short ? ` “${words}”` : ''} in <${comp} />`), '',
      h('## What to do'), what, '',
      h('## Where'),
      `- Element: ${k('`' + code + '`')}${short ? ` with text ${q('“' + words + '”')}` : ''}`,
      `- Rendered by: ${k('`<' + comp + ' />`')} in ${q('`' + file + '`')}, lines ${a}–${b}`,
      `- In the source, the element is around line ${el.dataset.via ? line + 1 : line}`,
      ...(el.dataset.via ? [`- It is rendered through ${k('`<' + el.dataset.via + '>`')} (line ${line}), a shared component: change this usage rather than ${k('`<' + el.dataset.via + '>`')} itself.`] : []),
      '',
      h('## The element now'),
      `- Rendered: ${Math.round(r.width)}×${Math.round(r.height)}px · font ${parseFloat(cs.fontSize)}px/${cs.fontWeight} · color ${fg}${bg !== 'transparent' ? ' on ' + bg : ''} · padding ${cs.padding} · radius ${rad}`,
      '',
      h('## Constraints'),
      `- Change this element only; keep the rest of ${esc('<' + comp + ' />')} as it is.`,
      '- Follow the existing styling approach (Tailwind utility classes in this file).',
      ...(follow ? ['', h('## Previous attempt'), `- Request: ${esc(follow.text)}`, `- Agent's summary: ${esc(follow.summary)}`, `- Files: ${esc(file)}`] : []),
      '',
      h(`## Source: ${file} (lines ${a}–${b})`),
      '<span class="d">…</span>',
    ];
    promptEl.innerHTML = lines.join('\n');
    tokEl.textContent = '~' + ((promptEl.textContent.length / 4 + 820) / 1000).toFixed(1) + 'k tokens';
  }

  /* ---------- hover (features/selector.ts) ---------- */
  function showHover(el) {
    const r = rectOf(el);
    placeBox(hover, r); hover.hidden = false;
    hoverLabel.textContent = el.dataset.code;
    const dims = document.createElement('span'); dims.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
    hoverLabel.appendChild(dims); hoverLabel.hidden = false;
    hoverLabel.style.left = Math.max(4, Math.min(r.left, W() - hoverLabel.offsetWidth - 4)) + 'px';
    hoverLabel.style.top = (r.top > 26 ? r.top - 22 : r.top + r.height + 4) + 'px';
  }
  function hideHover() { hover.hidden = true; hoverLabel.hidden = true; }
  stage.addEventListener('mousemove', e => {
    if (!inspect || !composer.hidden) { hideHover(); return; }
    const el = e.target.closest('[data-ah]');
    if (!el || el === selected) { hideHover(); return; }
    showHover(el);
    if (!selected) renderPrompt(el, '');
  });
  stage.addEventListener('mouseleave', hideHover);

  /* ---------- select + pill (ui/action-pill.ts) ---------- */
  function select(el) {
    selected = el; follow = null;
    hideHover(); pillMenu.hidden = true; closeComposer();
    $('ah-pill-name').textContent = el.dataset.name;
    $('ah-pill-file').textContent = fileLine(el);
    $('ah-pill-batch').setAttribute('aria-pressed', 'false');
    pill.hidden = false;
    layout();
    renderPrompt(el, '');
    say('Press Ask (or Enter) and say what to change.');
  }
  function deselect() {
    selected = null; pill.hidden = true; pillMenu.hidden = true; selFrame.hidden = true; closeComposer();
    renderMarker();
    say('Click anything, then Ask.');
  }
  function layout() {
    if (selected) {
      const r = rectOf(selected);
      placeBox(selFrame, { left: r.left - 2, top: r.top - 2, width: r.width + 4, height: r.height + 4 });
      selFrame.hidden = false;
      const h = pill.offsetHeight, w = pill.offsetWidth;
      let top = r.top - h - 8;
      if (top < 8) top = r.bottom + 8;
      pill.style.top = Math.round(top) + 'px';
      pill.style.left = Math.round(Math.max(12, Math.min(r.left, W() - w - 12))) + 'px';
    }
    positionComposer(); renderMarker(); positionCard();
    pins.querySelectorAll('.ah-cpin').forEach(p => {
      const r = rectOf(p._el);
      p.style.left = r.left + 'px'; p.style.top = (r.top > 34 ? r.top : r.bottom + 28) + 'px';
    });
  }

  stage.addEventListener('click', e => {
    if (host.contains(e.target) || e.target === host) return; // clicks on the overlay's own surfaces
    const el = e.target.closest('[data-ah]');
    if (commentMode) { if (el) addPin(el); return; }
    if (!inspect) return;
    if (!el) { if (card.hidden) deselect(); else closeCard(); return; }
    e.preventDefault();
    closeCard();
    select(el);
  });

  pill.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !selected) return;
    if (b.id === 'ah-pill-ask') openComposer();
    if (b.id === 'ah-pill-who') toast(`Opens ${fileLine(selected)} in your editor`);
    if (b.id === 'ah-pill-comment') addPin(selected);
    if (b.id === 'ah-pill-batch') {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      const c = $('ah-d-batch-count'); c.textContent = on ? '1' : '0'; c.hidden = !on;
      toast(on ? 'Added to the batch' : 'Removed from the batch');
    }
    if (b.id === 'ah-pill-copy') {
      navigator.clipboard?.writeText(promptEl.textContent).catch(() => {});
      toast(`Copied context · ${tokEl.textContent.replace('~', '').replace(' tokens', '')} tokens · paste into any AI tool`);
    }
    if (b.id === 'ah-pill-more') {
      if (!pillMenu.hidden) { pillMenu.hidden = true; return; }
      pillMenu.hidden = false;
      const br = rel(b.getBoundingClientRect());
      pillMenu.style.left = Math.max(12, Math.min(br.left, W() - pillMenu.offsetWidth - 12)) + 'px';
      pillMenu.style.top = (br.bottom + 6) + 'px';
    }
    if (b.id === 'ah-pill-close') deselect();
  });
  pillMenu.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !selected) return;
    pillMenu.hidden = true;
    toast({
      editor: `Opens ${fileLine(selected)} in your editor`, shot: 'Saves a screenshot of the element',
      freeze: `Agents are told not to change <${selected.dataset.comp} />`, parent: 'Selects the parent element (↑)',
      child: 'Selects the child element (↓)', details: 'Opens Inspect: props, styles, box model and source',
    }[b.dataset.act]);
  });

  function addPin(el) {
    const p = document.createElement('button');
    p.className = 'ah-cpin'; p.textContent = ++pinCount; p._el = el; p.style.position = 'absolute';
    pins.appendChild(p); layout();
    toast(`Comment ${pinCount} on ${el.dataset.name}`);
  }

  /* ---------- composer (ui/composer.ts) ---------- */
  function openComposer(prev) {
    if (!selected) return;
    follow = prev || null;
    const f = $('ah-comp-follow');
    f.hidden = !follow; f.textContent = follow ? `Follow-up to “${follow.text}”` : '';
    $('ah-comp-name').textContent = selected.dataset.name;
    $('ah-comp-file').textContent = fileLine(selected);
    pillMenu.hidden = true; card.hidden = true;
    input.value = ''; input.dataset.touched = ''; input.classList.remove('invalid');
    composer.hidden = false;
    positionComposer();
    input.focus({ preventScroll: true });
    say('Type the change, or keep this one, and Send.');
    const text = follow ? 'A little smaller than that' : selected.dataset.ask;
    let i = 0; clearInterval(typing);
    typing = setInterval(() => {
      if (input.dataset.touched) { clearInterval(typing); return; }
      input.value = text.slice(0, ++i); renderPrompt(selected, input.value);
      if (i >= text.length) clearInterval(typing);
    }, 34);
  }
  function closeComposer() { clearInterval(typing); composer.hidden = true; }
  function positionComposer() {
    if (composer.hidden || !selected) return;
    const s = rectOf(selected), p = pill.hidden ? s : rel(pill.getBoundingClientRect());
    const top = Math.min(s.top, p.top), bottom = Math.max(s.bottom, p.bottom), left = Math.min(s.left, p.left);
    const w = composer.offsetWidth, h = composer.offsetHeight;
    let y = bottom + 8;
    if (y + h > H() - 70) y = Math.max(8, top - h - 8);
    composer.style.top = Math.round(y) + 'px';
    composer.style.left = Math.round(Math.max(12, Math.min(left, W() - w - 12))) + 'px';
  }
  input.addEventListener('keydown', e => {
    input.dataset.touched = '1';
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
    if (e.key === 'Escape') closeComposer();
  });
  input.addEventListener('input', () => { input.classList.remove('invalid'); renderPrompt(selected, input.value); });
  $('ah-comp-send').onclick = send;
  $('ah-comp-cancel').onclick = closeComposer;
  $('ah-comp-dest').onclick = () => toast('Pick which connected agent gets it, or Copy prompt');
  $('ah-comp-mic').onclick = () => toast('Speak instead of typing, with your browser’s speech recognition');

  /* ---------- task: marker, toast, card (ui/tasks.ts) ---------- */
  const SUMMARY = {
    'div.glow-border': 'Slowed the rotation from 4s to 14s and softened the glow behind the card.',
    'span.badge': 'Changed the badge background to bg-emerald-500.',
    'p.price': 'Raised the price from text-5xl to text-6xl.',
    'button.plan-cta': 'Switched the button to bg-neutral-900 with white text and added an ArrowRight icon.',
    'ul.plan-features': 'Changed the list spacing from space-y-2 to space-y-3.',
    'div.plan-card': 'Gave the Starter card a dashed border.',
    'h1.page-title': 'Moved the month onto the same line as the title.',
    'button.new-invoice': 'Switched the button to the outline variant.',
    'div.stat-card': 'Changed the amount to text-emerald-400.',
    'div.avg-tile': 'Gave the tile the same background, border and padding as <StatCard />.',
    'svg.sparkline': 'Changed the line stroke to blue-500.',
    'a.release-pill': 'Made the “New” label dark.',
    'h1.hero-title': 'Changed tracking-tight to tracking-tighter.',
    'svg.squiggle': 'Changed the stroke to blue-600 and its width from 3 to 4.5.',
    'button#hero-primary-cta': 'Raised the button to h-12 with px-7 and added an ArrowRight icon after the label.',
    'button.hero-secondary': 'Raised the button to h-12 with px-7 and added an ArrowRight icon after the label.',
  };
  function send() {
    const text = input.value.trim();
    if (!text) { input.classList.add('invalid'); input.placeholder = 'Type what should change first'; input.focus(); return; }
    const el = selected;
    if (task && task.review === null && task.status === 'done') task.review = 'kept';
    task = { el, text, status: 'queued', review: null, started: Date.now() };
    task.summary = SUMMARY[el.dataset.code] || `Updated the ${el.dataset.name.replace(/[<>]/g, '')} in ${el.dataset.file.split('/').pop()} and kept the rest of <${el.dataset.comp} /> as it was.`;
    closeComposer();
    toast('Sent to Claude Code', 'View', openCard);
    say('Claude Code picks it up. Watch the marker.');
    setDockDot('pulse warn');
    const t = task;
    setTimeout(() => step(t, 'delivered'), 800);
    setTimeout(() => step(t, 'in_progress'), 1600);
    setTimeout(() => {
      if (task !== t) return;
      changeTarget(t.el).classList.add('changed');
      step(t, 'done');
      setDockDot('warn');
      toast(`Done · ${t.el.dataset.name}`, 'Review', openCard);
      say('Done. Keep it, Undo it, or Follow up.');
      setTimeout(() => { if (task === t && card.hidden && composer.hidden) openCard(); }, 1000);
    }, 3800);
    renderMarker(); renderPrompt(el, text);
  }
  function step(t, s) { if (task !== t) return; t.status = s; if (s === 'in_progress') t.started = Date.now(); renderMarker(); if (!card.hidden) renderCard(); }
  function setDockDot(cls) { const d = $('ah-d-tasks-dot'); if (!cls) { d.hidden = true; return; } d.className = 'ah-dot working ' + cls; d.hidden = false; }
  const needsReview = t => t.status === 'done' && !t.review;

  function renderMarker() {
    markers.innerHTML = '';
    if (!task || task.review === 'undone') return;
    const r = rectOf(task.el);
    const m = document.createElement('button');
    m.className = 'ah-marker' + (task.status === 'done' ? ' done' : '') + (needsReview(task) ? ' review' : '');
    m.style.position = 'absolute';
    const left = Math.min(r.right - 11, W() - 26);
    let top = Math.max(4, r.top - 11);
    if (!pill.hidden) {
      const p = rel(pill.getBoundingClientRect());
      if (left < p.right && left + 22 > p.left && top < p.bottom && top + 22 > p.top) top = r.bottom - 11;
    }
    m.style.left = left + 'px'; m.style.top = top + 'px';
    m.innerHTML = task.status === 'in_progress' ? '<span class="spin"></span>' : task.status === 'done' ? icon('check', 14) : '<span class="ah-dot pulse"></span>';
    m.title = task.text;
    m.onclick = e => { e.stopPropagation(); openCard(); };
    markers.appendChild(m);
  }

  let undoAsk = false, comparing = false;
  function openCard() { if (!task) return; closeComposer(); undoAsk = false; renderCard(); }
  function closeCard() { if (comparing) toggleCompare(true); card.hidden = true; }
  function renderCard() {
    const t = task; if (!t) return;
    const el = t.el, file = el.dataset.file;
    const status = { queued: 'Sent to Claude Code', delivered: 'Seen by Claude Code', in_progress: 'Claude Code is working…', done: 'Done · 1 file' }[t.status];
    const head = needsReview(t) ? status + ' · waiting for you' : status;
    const tone = t.status === 'done' ? 'ok' : t.status === 'in_progress' ? 'warn pulse' : '';
    const reached = { queued: 0, delivered: 1, in_progress: 2, done: t.review ? 4 : 3 }[t.status];
    const steps = ['Sent', 'Seen', 'Working', 'Done', ...(t.status === 'done' ? [t.review ? { kept: 'Kept', undone: 'Undone' }[t.review] : 'Review'] : [])];
    const time = t.status === 'in_progress' ? `${Math.round((Date.now() - t.started) / 1000)}s` : 'just now';
    let actions = '';
    if (t.status === 'done' && t.review !== 'undone') {
      const keep = needsReview(t) ? `<button class="ah-tbtn primary" data-act="keep" title="Keep (K)">${icon('check', 14)}Keep</button>` : '';
      const undo = `<button class="ah-tbtn outline" data-act="undo" aria-pressed="${undoAsk}" title="Undo (U)">${icon('undo', 14)}Undo</button>`;
      const compare = `<button class="ah-tbtn quiet" data-act="compare" aria-pressed="${comparing}">${icon('panel', 14)}Compare</button>`;
      const fu = `<button class="ah-tbtn quiet" data-act="follow-up" title="Follow up (F)">${icon('follow-up', 14)}Follow up</button>`;
      actions = `<div class="ah-actions">${keep}${undo}<span class="grow"></span>${compare}${fu}</div>`;
    }
    card.innerHTML = `
      <div class="head"><span class="ah-dot ${tone}"></span><span class="status">${esc(head)}</span><span class="time">${time}</span>
        <button class="ah-ibtn" data-act="menu" aria-label="More">${icon('more')}</button><button class="ah-ibtn" data-act="close" aria-label="Close">${icon('x')}</button></div>
      <div class="title">${esc(t.text)}</div>
      <div class="sub">${esc(el.dataset.name)} · <span class="ah-mono">${esc(fileLine(el))}</span></div>
      <div class="ah-timeline">${steps.map((s, i) => `<span class="${i <= reached ? 'on' : ''}">${s}</span>`).join(icon('chev-right', 12))}</div>
      ${t.status === 'done' ? `<div class="ah-summary">${esc(t.summary)}</div><div class="ah-files"><button>${icon('file', 14)}<span>${esc(file)}</span></button></div>` : ''}
      ${undoAsk ? `<div class="ah-undo"><span>Undo puts these files back to how they were when the agent started:</span><ul><li><span class="ah-mono">${esc(file)}</span> <span class="ah-muted">+1 −1 · revert</span></li></ul><div class="ah-actions"><span class="grow"></span><button class="ah-tbtn" data-act="undo-cancel">Cancel</button><button class="ah-tbtn primary" data-act="undo-confirm">Undo 1 file</button></div></div>` : ''}
      ${actions}`;
    card.hidden = false;
    positionCard();
  }
  function positionCard() {
    if (card.hidden || !task) return;
    // Beside the element so the change stays in view; below or above when there's no room at the sides.
    let r = rectOf(task.el);
    if (!pill.hidden && selected === task.el) {
      const p = rel(pill.getBoundingClientRect());
      r = { left: Math.min(r.left, p.left), top: Math.min(r.top, p.top), right: Math.max(r.right, p.right), bottom: Math.max(r.bottom, p.bottom) };
    }
    const w = card.offsetWidth, h = card.offsetHeight, gap = 14;
    const clampY = y => Math.max(8, Math.min(y, H() - h - 70));
    let left, top;
    if (r.right + gap + w <= W() - 12) { left = r.right + gap; top = clampY(r.top - 40); }
    else if (r.left - gap - w >= 12) { left = r.left - gap - w; top = clampY(r.top - 40); }
    else {
      left = Math.max(12, Math.min(r.left, W() - w - 12));
      top = r.bottom + gap + h <= H() - 70 ? r.bottom + gap : Math.max(8, r.top - h - gap);
    }
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
  }
  setInterval(() => { if (!card.hidden && task && task.status === 'in_progress') renderCard(); }, 1000);

  function toggleCompare(quiet) {
    if (!task) return;
    comparing = !comparing;
    changeTarget(task.el).classList.toggle('changed', !comparing);
    if (!card.hidden) renderCard();
    if (!quiet) toast(comparing ? 'Before · press Compare again for after' : 'After');
  }
  card.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !task) return;
    const act = b.dataset.act, t = task;
    if (act === 'close') closeCard();
    if (act === 'menu') toast('View in Tasks · Show on page · Copy prompt · Remove');
    if (act === 'compare') toggleCompare();
    if (act === 'keep') {
      if (comparing) toggleCompare(true);
      t.review = 'kept'; renderCard(); renderMarker(); setDockDot(null);
      toast('Kept'); say('Kept. Try another element or page.');
    }
    if (act === 'undo') { undoAsk = !undoAsk; renderCard(); }
    if (act === 'undo-cancel') { undoAsk = false; renderCard(); }
    if (act === 'undo-confirm') {
      if (comparing) toggleCompare(true);
      undoAsk = false; t.review = 'undone';
      changeTarget(t.el).classList.remove('changed');
      renderCard(); renderMarker(); setDockDot(null);
      toast(`Undone · restored ${t.el.dataset.file.split('/').pop()}`);
      say('Undone. The file is back as it was.');
      setTimeout(() => { if (task === t) card.hidden = true; }, 1400);
    }
    if (act === 'follow-up') {
      if (comparing) toggleCompare(true);
      const prev = { text: t.text, summary: t.summary };
      t.review = 'kept'; card.hidden = true; setDockDot(null);
      select(t.el); openComposer(prev);
    }
  });

  /* ---------- dock (ui/dock.ts) ---------- */
  dock.addEventListener('mouseover', e => {
    const b = e.target.closest('[data-tip]'); if (!b) { tip.hidden = true; return; }
    tip.innerHTML = esc(b.dataset.tip) + (b.dataset.key ? `<kbd>${esc(b.dataset.key)}</kbd>` : '');
    tip.hidden = false;
    const br = rel(b.getBoundingClientRect());
    tip.style.left = Math.max(8, Math.min(br.left + br.width / 2 - tip.offsetWidth / 2, W() - tip.offsetWidth - 8)) + 'px';
    tip.style.top = (br.top - tip.offsetHeight - 8) + 'px';
  });
  dock.addEventListener('mouseleave', () => (tip.hidden = true));
  dock.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    tip.hidden = true;
    if (b.id === 'ah-d-inspect') setInspect(!inspect);
    if (b.id === 'ah-d-comment') {
      commentMode = !commentMode; b.setAttribute('aria-pressed', String(commentMode));
      if (commentMode) { inspect = false; $('ah-d-inspect').setAttribute('aria-pressed', 'false'); stage.classList.remove('inspect'); hideHover(); deselect(); }
      stage.classList.toggle('commenting', commentMode);
      toast(commentMode ? 'Comment mode: click anything to leave a note' : 'Comment mode off');
    }
    if (b.id === 'ah-d-tasks') task ? openCard() : toast('No tasks yet. Select something and Ask.');
    if (b.id === 'ah-d-batch') toast('Batch: point at several elements for one task');
    if (b.id === 'ah-d-more') toast('Sidebar, screenshots, Settings and shortcuts');
    if (b.id === 'ah-d-mark') toast('Connected · Claude Code is listening');
  });
  function setInspect(on, quiet) {
    inspect = on;
    $('ah-d-inspect').setAttribute('aria-pressed', String(on));
    stage.classList.toggle('inspect', on);
    if (on && commentMode) { commentMode = false; $('ah-d-comment').setAttribute('aria-pressed', 'false'); stage.classList.remove('commenting'); }
    if (!on) { hideHover(); deselect(); }
    if (!quiet) toast(on ? 'Inspect on' : 'Inspect off');
  }

  /* keyboard, like the real overlay: only while the demo is in use */
  let inDemo = false;
  stage.addEventListener('mouseenter', () => (inDemo = true));
  stage.addEventListener('mouseleave', () => (inDemo = false));
  addEventListener('keydown', e => {
    if (e.composedPath()[0] === input) return;
    if (e.key === 'Escape') {
      if (!card.hidden) closeCard(); else if (!composer.hidden) closeComposer(); else if (!pillMenu.hidden) pillMenu.hidden = true; else if (selected) deselect();
      return;
    }
    if (!inDemo && !selected) return;
    if (e.key === 'Enter' && selected && composer.hidden) { e.preventDefault(); openComposer(); return; }
    if (!card.hidden && task && task.status === 'done') {
      const act = { k: 'keep', u: 'undo', f: 'follow-up' }[e.key.toLowerCase()];
      const b = act && card.querySelector(`[data-act="${act}"]`);
      if (b) { e.preventDefault(); b.click(); }
    }
  });

  /* keep everything on its element while the page reflows */
  addEventListener('resize', layout);
  stage.addEventListener('transitionend', layout);
  if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe(stage);

  /* ---------- pages to try it on ---------- */
  function reset() {
    clearInterval(typing);
    task = null; comparing = false; undoAsk = false; pinCount = 0;
    markers.innerHTML = ''; pins.innerHTML = ''; card.hidden = true; toastEl.hidden = true;
    stage.querySelectorAll('.changed').forEach(e => e.classList.remove('changed'));
    setDockDot(null); deselect(); hideHover();
  }
  const tabs = [...document.querySelectorAll('.scene-tabs [data-scene]')];
  const firstOf = () => stage.querySelector('.scene.on [data-first]');
  function showScene(name) {
    reset();
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.scene === name)));
    stage.querySelectorAll('.scene').forEach(s => s.classList.toggle('on', s.dataset.scene === name));
    requestAnimationFrame(() => { const f = firstOf(); if (f) { showHover(f); renderPrompt(f, ''); } });
  }
  tabs.forEach(t => t.addEventListener('click', () => showScene(t.dataset.scene)));

  /* first state: Inspect on, with the thing nobody can name under the pointer */
  setInspect(true, true);
  const start = () => { const f = firstOf(); if (f && !selected && hover.hidden) { showHover(f); renderPrompt(f, ''); } };
  shadow.querySelector('link').addEventListener('load', start);
  setTimeout(start, 400);
})();
