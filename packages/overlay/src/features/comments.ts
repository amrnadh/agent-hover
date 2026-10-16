import { anchorTo, buildCSSSelector, esc, timeAgo } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { formatCommentsRequest } from '../lib/prompt-format.js';
import type { OverlayApp } from '../app/context.js';

interface Comment {
  id: string;
  selector?: string;
  component?: string;
  file?: string;
  line?: number;
  text: string;
  createdAt: string;
  resolved?: boolean;
  offsetX?: number;
  offsetY?: number;
  /** Client-only: not saved yet. */
  draft?: boolean;
  /** Client-only: element captured when the draft was created. */
  el?: Element;
}

/**
 * Comments: numbered pins anywhere on the page (Comment mode or the pill), a thread card per pin
 * (Comment / Resolve / Send to agent / Delete), and the data behind the sidebar's Comments tab.
 * Stored by the bridge in .agent-hover/comments.json (format unchanged, offsets optional).
 */
export function setupComments(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { loadComments, setComments, addCommentAt, openComment, closeCommentCard, sendComments, commentList, commentElement });

  const layer = shadow.getElementById('ah-layer-pins') as HTMLElement;
  const card = shadow.getElementById('ah-comment-card') as HTMLElement;
  state.comments = [] as Comment[];
  let draft: Comment | null = null;
  let openId: string | null = null;

  function commentList(): Comment[] {
    return [...state.comments].sort((a: Comment, b: Comment) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  function numberOf(c: Comment): number {
    return commentList().findIndex((x) => x.id === c.id) + 1;
  }

  function commentElement(c: Comment): Element | null {
    if (c.el && c.el.isConnected) return c.el;
    if (!c.selector) return null;
    try {
      return document.querySelector(c.selector);
    } catch {
      return null;
    }
  }

  async function loadComments() {
    try {
      const res = await fetch(BRIDGE + '/api/comments');
      const data = await res.json();
      setComments(data.comments || []);
    } catch {}
  }

  function setComments(list: Comment[]) {
    state.comments = list;
    if (openId && !list.some((c) => c.id === openId)) closeCommentCard();
    else if (openId) renderCard();
    api.renderSidebar?.('comments');
    api.requestLayout();
  }

  async function post(body: Record<string, unknown>) {
    const res = await fetch(BRIDGE + '/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.comments) setComments(data.comments);
    return data;
  }

  // ---------- create ----------
  function addCommentAt(el: Element, x: number, y: number) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    draft = {
      id: 'draft',
      el,
      selector: buildCSSSelector(el),
      text: '',
      createdAt: new Date().toISOString(),
      offsetX: r.width ? (x - r.left) / r.width : 0.5,
      offsetY: r.height ? (y - r.top) / r.height : 0.5,
      draft: true,
    };
    openId = 'draft';
    api.closeTaskCard?.();
    api.closeComposer?.();
    renderCard();
    api.requestLayout();
  }

  async function saveDraft(text: string) {
    if (!draft) return;
    const d = draft;
    const stack = api.stackFor(d.el!);
    const src = await api.sourceFor(stack, 0).catch(() => null);
    try {
      const data = await post({
        action: 'add',
        comment: { text, selector: d.selector, component: src?.component || '', file: src?.file || '', line: src?.line || 1, offsetX: d.offsetX, offsetY: d.offsetY },
      });
      draft = null;
      openId = data.comment?.id || null;
      renderCard();
      api.toast('Comment saved');
    } catch {
      api.toast('Dev server unreachable · comment not saved');
    }
  }

  // ---------- pins ----------
  function pinPoint(c: Comment): { x: number; y: number } | null {
    const el = commentElement(c);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.left + (c.offsetX ?? 1) * r.width - (c.offsetX === undefined ? 10 : 0), y: r.top + (c.offsetY ?? 0) * r.height + (c.offsetY === undefined ? 14 : 0) };
  }

  function renderPins() {
    layer.innerHTML = '';
    const ins = api.insets();
    const all: Comment[] = draft ? [...commentList(), draft] : commentList();
    all.forEach((c) => {
      const p = pinPoint(c);
      if (!p || p.y < 0 || p.y > window.innerHeight + 26) return;
      const b = document.createElement('button');
      b.className = 'ah-cpin' + (c.resolved ? ' resolved' : '') + (openId === c.id ? ' active' : '');
      b.style.left = Math.min(p.x, window.innerWidth - ins.right - 30) + 'px';
      b.style.top = p.y + 'px';
      b.innerHTML = c.draft ? '+' : c.resolved ? icon('check', 13) : String(numberOf(c));
      b.setAttribute('aria-label', c.draft ? 'New comment' : `Comment ${numberOf(c)}`);
      b.onclick = (e) => { e.stopPropagation(); openComment(c.id); };
      layer.appendChild(b);
    });
  }
  api.onLayout(renderPins);

  // ---------- card ----------
  function openComment(id: string) {
    if (draft && id !== 'draft') draft = null;
    openId = id;
    api.closeTaskCard?.();
    api.closeComposer?.();
    renderCard();
    api.requestLayout();
  }

  function closeCommentCard() {
    api.stopVoice?.();
    if (draft) draft = null;
    openId = null;
    card.hidden = true;
    api.requestLayout();
  }

  function current(): Comment | null {
    if (openId === 'draft') return draft;
    return state.comments.find((c: Comment) => c.id === openId) || null;
  }

  function renderCard() {
    const c = current();
    if (!c) { card.hidden = true; return; }
    const el = commentElement(c);
    const label = el ? api.labelFor({ isDomElement: true, element: el }) : c.component ? `<${c.component} />` : 'Element no longer on page';
    card.innerHTML = c.draft
      ? `<div class="head"><b>${esc(label)}</b><button class="ah-ibtn" data-act="close" aria-label="Close">${icon('x')}</button></div>
         <textarea id="ah-comment-input" aria-label="Comment" placeholder="Leave a note for yourself or your agent"></textarea>
         <div class="ah-actions" style="justify-content:flex-end"><button class="ah-ibtn mic" data-act="mic" style="margin-right:auto" title="Speak instead of typing" aria-label="Speak instead of typing" hidden>${icon('mic')}</button><button class="ah-tbtn" data-act="close">Discard</button><button class="ah-tbtn primary" data-act="save">Comment</button></div>`
      : `<div class="head"><span class="ah-dot ${c.resolved ? 'ok' : ''}"></span><b>#${numberOf(c)} ${esc(label)}</b><span class="ah-muted" style="font-size:12px;white-space:nowrap">${esc(timeAgo(c.createdAt))}</span><button class="ah-ibtn" data-act="close" aria-label="Close">${icon('x')}</button></div>
         <div class="body">${esc(c.text)}</div>
         <div class="ah-actions"><button class="ah-tbtn outline" data-act="resolve">${c.resolved ? 'Reopen' : 'Resolve'}</button><button class="ah-tbtn outline" data-act="send">${icon('send', 14)}Send to agent</button><button class="ah-tbtn danger" data-act="delete">Delete</button></div>`;
    card.hidden = false;
    positionCard();
    const ta = card.querySelector('textarea') as HTMLTextAreaElement | null;
    if (ta) {
      const mic = card.querySelector('[data-act=mic]') as HTMLElement | null;
      if (mic) api.attachVoice?.(ta, mic);
      ta.focus();
      ta.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); (card.querySelector('[data-act=save]') as HTMLElement).click(); }
      };
    }
  }

  function positionCard() {
    const c = current();
    if (card.hidden || !c) return;
    const p = pinPoint(c);
    if (!p) { card.hidden = true; return; }
    // Next to the element and its pin together, so the card covers neither.
    const el = commentElement(c);
    const r = el ? el.getBoundingClientRect() : { left: p.x, top: p.y - 26, width: 26, height: 26 };
    const top = Math.min(r.top, p.y - 26), left = Math.min(r.left, p.x);
    anchorTo(card, { left, top, width: Math.max(r.left + r.width, p.x + 26) - left, height: Math.max(r.top + r.height, p.y) - top }, api.insets(), 8);
  }
  api.onLayout(positionCard);

  card.onclick = async (e) => {
    const b = (e.target as Element).closest('button') as HTMLElement | null;
    if (!b) return;
    const c = current();
    const act = b.dataset.act;
    if (act === 'close') { closeCommentCard(); return; }
    if (!c) return;
    if (act === 'save') {
      const ta = card.querySelector('textarea') as HTMLTextAreaElement;
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      await saveDraft(text);
    }
    if (act === 'resolve') await post({ action: 'toggle-resolve', id: c.id }).catch(() => api.toast('Dev server unreachable'));
    if (act === 'delete') {
      await post({ action: 'delete', id: c.id }).catch(() => api.toast('Dev server unreachable'));
      closeCommentCard();
      api.toast('Comment deleted');
    }
    if (act === 'send') { closeCommentCard(); sendComments([c]); }
  };

  // ---------- send ----------
  /** One task for one or more comments; each comment brings its element's context. */
  async function sendComments(list: Comment[]) {
    const items = list.filter((c) => !c.draft);
    if (!items.length) return;
    const entries: Array<{ facts: any; text: string; fallback?: string }> = [];
    let first: { facts: any; el: Element } | null = null;
    for (const c of items) {
      const el = commentElement(c);
      const built = el ? await api.buildFacts(api.stackFor(el), 0) : null;
      if (built && el && !first) first = { facts: built.facts, el };
      entries.push({
        facts: built?.facts || null,
        text: c.text,
        fallback: `${c.component ? `<${c.component} />` : 'an element'} not on this page${c.file ? ` (${c.file}${c.line ? ':' + c.line : ''})` : ''}`,
      });
    }
    const prompt = formatCommentsRequest(entries);
    const f = first?.facts;
    const instruction = items.length === 1 ? items[0].text : `Address ${items.length} comments left on the page`;
    const result = await api.dispatchToAgent(
      prompt,
      { type: 'note', instruction, component: f?.component?.name, file: f?.component?.file, line: f?.component?.startLine, selector: f?.element.selector, hierarchy: f?.hierarchy, label: items.length === 1 ? f?.element.label : `${items.length} comments` },
      { quiet: true },
    );
    if (result.task) {
      api.trackTask(result.task, first?.el);
      api.toast(`Sent ${items.length === 1 ? 'comment' : items.length + ' comments'} to your agent`, { action: 'View', onAction: () => api.openTaskCard(result.task.id) });
    } else {
      api.toast(result.copied ? `${items.length === 1 ? 'Comment' : items.length + ' comments'} copied as a prompt` : 'Dev server unreachable');
    }
  }
}
