// Agent Hover site — shared behaviour (theme, copy, live badges, reveal, video, features, docs nav)
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  /* theme */
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  $$('.theme-btn').forEach(b => b.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('ah-theme', next);
    window.dispatchEvent(new Event('ah-theme'));
  }));

  /* header border on scroll */
  const header = $('.site-header');
  const onScroll = () => header && header.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* copy buttons */
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const label = b.querySelector('span') || b;
    try { await navigator.clipboard.writeText(b.dataset.copy); label.textContent = 'Copied'; }
    catch { label.textContent = 'Press ⌘C'; }
    setTimeout(() => (label.textContent = 'Copy'), 1500);
  }));

  /* live npm version and GitHub stars (static fallbacks stay if offline) */
  fetch('https://registry.npmjs.org/@agent-hover/vite/latest').then(r => r.ok && r.json()).then(d => {
    if (d && d.version) $$('[data-npm-version]').forEach(e => (e.textContent = 'v' + d.version));
  }).catch(() => {});
  fetch('https://api.github.com/repos/amrnadh/agent-hover').then(r => r.ok && r.json()).then(d => {
    if (!d || typeof d.stargazers_count !== 'number' || d.stargazers_count < 10) return;
    const n = d.stargazers_count;
    $$('[data-stars]').forEach(e => { e.textContent = n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n; e.hidden = false; });
    $$('[data-stars-wrap]').forEach(e => (e.hidden = false));
  }).catch(() => {});

  /* reveal on scroll */
  const io = 'IntersectionObserver' in window && new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 60 + 'ms';
    io ? io.observe(el) : el.classList.add('in');
  });

  /* video: our own play button, no download / PiP / right-click menu */
  const video = $('#video'), play = $('#play');
  if (video && play) {
    video.addEventListener('contextmenu', e => e.preventDefault());
    play.addEventListener('click', () => {
      video.controls = true;
      $('#videoFrame').classList.add('play-hidden');
      video.play();
    });
  }

  /* dither (same Bayer pattern as the logo) */
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function dither(c, color) {
    if (!c) return;
    const r = c.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.fillStyle = color;
    const cell = 9, dot = 3.5, cols = Math.ceil(r.width / cell), rows = Math.ceil(r.height / cell);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = 1 - Math.min(1, Math.hypot((cols - x) / cols, (rows - y) / rows * 1.15));
      if (v * 17 > bayer[y % 4][x % 4] + 1) ctx.fillRect(x * cell + 3, y * cell + 3, dot, dot);
    }
  }
  const drawAll = () => dither($('#ctaDither'), '#f2efe9');
  addEventListener('resize', drawAll); drawAll();

  /* feature explorer */
  const S = 'assets/screenshots/';
  const features = [
    { id: 'point', icon: 'pointer', key: 'Alt', t: 'Point', d: 'Click anything. The pill names it in plain words and shows its file and line.',
      img: S + '01-pill.png', pos: 'center 45%',
      text: 'Press Alt (or the pointer in the dock) and click an element. The pill shows what you picked, such as “Book a demo” button, with Hero.tsx:54 next to it. ↑ and ↓ move to the parent or child, holding ⌘ shows distances, and holding Shift clicks through to your app.' },
    { id: 'ask', icon: 'send', key: 'Enter', t: 'Ask', d: 'Type or say the change. It goes to your agent with the full context.',
      mini: 'ask',
      text: 'Ask opens a small composer on the element. Type the change or click the mic and say it. ⌘ + Enter sends it to your connected agent; with several agents connected, you pick which one gets it. No agent? It goes to the clipboard instead.' },
    { id: 'track', icon: 'pulse', key: '', t: 'Track', d: 'A marker on the element follows the task until it’s done.',
      img: S + '02-task-done.png', pos: 'top center',
      text: 'A marker on the element follows the task: Sent, Seen, Working, Done. Open it for the agent’s summary and the files it changed. Markers come back after a reload, and the dock’s Tasks dot tells you when something needs you.' },
    { id: 'review', icon: 'compare', key: 'K', t: 'Review', d: 'Compare before and after, then Keep, Undo or Follow up.',
      img: S + '06-compare.png', pos: 'center 55%',
      text: 'A finished change waits on its element until you decide. Compare shows it before and after. Keep settles it. Undo restores exactly the files that changed, from a git checkpoint taken when the agent started. Follow up asks again with the earlier attempt attached.' },
    { id: 'tasks', icon: 'list', key: 'T', t: 'Tasks', d: 'Everything you sent, sorted by what needs you first.',
      img: S + '10-tasks.png', pos: 'top center',
      text: 'The Tasks tab groups everything: Needs you (changes to review, failures), In progress, and History. Keep and Undo work from here too, a task nobody picked up can be sent again, and a failed one tried again.' },
    { id: 'comment', icon: 'bubble', key: 'C', t: 'Comment', d: 'Numbered notes on anything, sent one at a time or all at once.',
      mini: 'comment',
      text: 'Press C and click to drop numbered notes anywhere: a misaligned header, an odd date. Send each one when you’re ready, or all of them as one task.' },
    { id: 'batch', icon: 'layers', key: 'B', t: 'Batch', d: 'Like this, not that: point at several elements in one task.',
      mini: 'batch',
      text: 'Collect several elements into one task and mark each one Change, Reference or Don’t touch. “Make this tile match those cards” stops being a paragraph and becomes three clicks.' },
    { id: 'lock', icon: 'lock', key: '', t: 'Lock', d: 'Keep agents off finished work, and hear about it if they don’t.',
      img: S + '09-lock-guard.png', pos: 'top center',
      text: '“Don’t let agents change this” puts a component in every prompt as off limits. If a finished task changed its file anyway, the marker turns amber and the card names the locked component, with Undo right there.' },
    { id: 'inspect', icon: 'scan', key: '', t: 'Inspect', d: 'Props, hooks, styles, box model and source for any element.',
      img: S + '04-inspect.png', pos: 'top right',
      text: 'The sidebar shows the component, a clickable breadcrumb, live props (secrets redacted), hooks, text, box model and key styles, and the source, with the token count of what would be sent.' },
  ];
  const minis = {
    ask: `<div class="mini"><div class="mini-card" style="width:68%"><div style="font-size:12px;color:#6b6f76;margin-bottom:8px">“Book a demo” button <code style="font-size:11px">Hero.tsx:54</code></div><div style="border:1px solid #e3e3e0;border-radius:10px;padding:12px;font-size:15px;min-height:70px;background:#fbfaf8">Make it larger with a subtle arrow<span style="display:inline-block;width:1.5px;height:17px;background:#17181a;vertical-align:-3px;margin-left:2px;animation:blink 1s steps(1) infinite"></span></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12px;color:#6b6f76"><span style="display:flex;gap:6px;align-items:center"><i style="width:7px;height:7px;border-radius:50%;background:#24a06b;display:inline-block"></i>Claude Code</span><span style="display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:7px;background:#111214;color:#fff;font-weight:500">Send <span style="opacity:.7">⌘↵</span></span></div></div></div><style>@keyframes blink{50%{opacity:0}}</style>`,
    comment: `<div class="mini"><div class="mini-card"><div class="line w40" style="height:14px;background:#dcdbd7"></div><div class="line w80"></div><div class="line w60"></div><div class="line w80"></div><div class="line w40"></div><span class="pin" style="left:-10px;top:-10px">1</span><span class="pin" style="right:30%;top:58%">2</span><div class="mini-note" style="left:12%;top:-46px">1 · Header isn’t aligned with the table</div><div class="mini-note" style="right:-8%;bottom:-40px">2 · This date format looks odd</div></div></div>`,
    batch: `<div class="mini"><div style="display:flex;flex-direction:column;align-items:center;width:100%"><div class="batch-row"><div class="batch-card change"><span class="role">Change</span><small>One-off tile</small><b>9.4 days</b></div><div class="batch-card ref"><span class="role">Reference</span><small>&lt;StatCard /&gt;</small><b>$16,150</b></div><div class="batch-card dont"><span class="role">Don’t touch</span><small>&lt;Logo /&gt;</small><b>Sorrel</b></div></div><div class="batch-goal">Make the tile match the stat cards</div></div></div>`,
  };
  const list = $('#fList');
  if (list) {
    list.innerHTML = features.map((f, i) => `<button class="f-item" role="tab" aria-selected="${i === 0}" data-i="${i}">
      <span class="t"><svg><use href="#i-${f.icon}"/></svg>${f.t}${f.key ? `<kbd>${f.key}</kbd>` : ''}</span><span class="d">${f.d}</span></button>`).join('');
    const show = i => {
      const f = features[i];
      $$('.f-item', list).forEach(b => b.setAttribute('aria-selected', b.dataset.i == i));
      $('#fShot').innerHTML = f.img
        ? `<img src="${f.img}" alt="${f.t}" style="object-position:${f.pos}">`
        : minis[f.mini];
      $('#fText').textContent = f.text;
      $('#fLink').href = 'docs.html#' + f.id;
    };
    list.addEventListener('click', e => { const b = e.target.closest('.f-item'); if (b) show(+b.dataset.i); });
    list.addEventListener('keydown', e => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const cur = +$('[aria-selected="true"]', list).dataset.i;
      const n = (cur + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + features.length) % features.length;
      show(n); $$('.f-item', list)[n].focus();
    });
    show(0);
  }

  /* docs: active section, search filter, mobile menu */
  const docNav = $('.docs-nav');
  if (docNav) {
    const links = $$('a[href^="#"]', docNav);
    const tocLinks = $$('.docs-toc a');
    const secs = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
    const spy = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        const id = '#' + e.target.id;
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    secs.forEach(s => spy.observe(s));
    const heads = tocLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);
    const tspy = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) tocLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-80px 0px -75% 0px' });
    heads.forEach(h => tspy.observe(h));

    const q = $('#docSearch');
    q && q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase();
      links.forEach(a => {
        const sec = $(a.getAttribute('href'));
        const hit = !v || a.textContent.toLowerCase().includes(v) || (sec && sec.textContent.toLowerCase().includes(v));
        a.style.display = hit ? '' : 'none';
      });
      $$('h5', docNav).forEach(h => {
        let n = h.nextElementSibling, any = false;
        while (n && n.tagName === 'A') { if (n.style.display !== 'none') any = true; n = n.nextElementSibling; }
        h.style.display = any ? '' : 'none';
      });
    });
    addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q && q.focus(); }
    });
    const mb = $('.docs-menu-btn');
    mb && mb.addEventListener('click', () => docNav.classList.toggle('open'));
    links.forEach(a => a.addEventListener('click', () => docNav.classList.remove('open')));
  }
})();
