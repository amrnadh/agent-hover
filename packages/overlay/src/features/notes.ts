// @ts-nocheck
import { ICONS } from '../icons.js';
import type { OverlayApp } from '../app/context.js';

/** Inline comments: markers, note popover, sidebar notes list, copy-all. */
export function setupNotes(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { loadComments, renderCommentMarkers, renderSidebarNotes, openNotePopover, closeNotePopover, saveNote });

  // --- Persistent Inline Comments Logic ---
  async function loadComments() {
    try {
      const res = await fetch(BRIDGE + '/api/comments');
      const data = await res.json();
      state.comments = data.comments || [];
      try { localStorage.setItem('agent-hover-comments', JSON.stringify(state.comments)); } catch(e) {}
      renderCommentMarkers();
      renderSidebarNotes();
    } catch(e) {
      try {
        state.comments = JSON.parse(localStorage.getItem('agent-hover-comments') || '[]');
        renderCommentMarkers();
        renderSidebarNotes();
      } catch(err) {}
    }
  }

  function renderCommentMarkers() {
    const layer = shadow.getElementById('cp-comments-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const notePopoverOpen = shadow.getElementById('cp-note-popover')?.classList.contains('open');

    // Build marker data with positions
    const markerData = [];
    state.comments.forEach((c, index) => {
      let el = null;
      if (c.selector) {
        try { el = document.querySelector(c.selector); } catch(e) {}
      }
      if (!el && c.component) {
        el = api.findComponentElement(c.component);
      }
      if (!el) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      // Anchor at bottom-left corner of the element
      const x = Math.max(12, Math.min(window.innerWidth - 12, rect.left));
      const y = Math.max(24, rect.bottom);
      markerData.push({ c, index, el, x, y, rect });
    });

    // Cluster detection: group markers within 14px of each other
    const CLUSTER_DIST = 14;
    const used = new Set();
    const clusters = [];

    for (let i = 0; i < markerData.length; i++) {
      if (used.has(i)) continue;
      const group = [i];
      used.add(i);
      for (let j = i + 1; j < markerData.length; j++) {
        if (used.has(j)) continue;
        const dx = markerData[i].x - markerData[j].x;
        const dy = markerData[i].y - markerData[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_DIST) {
          group.push(j);
          used.add(j);
        }
      }
      clusters.push(group);
    }

    clusters.forEach((group) => {
      if (group.length > 1) {
        // Render cluster marker
        const avg = group.reduce((a, i) => ({ x: a.x + markerData[i].x, y: a.y + markerData[i].y }), { x: 0, y: 0 });
        avg.x /= group.length;
        avg.y /= group.length;

        const clusterMarker = document.createElement('div');
        clusterMarker.className = 'cp-comment-marker cluster';
        clusterMarker.style.left = avg.x + 'px';
        clusterMarker.style.top = avg.y + 'px';
        clusterMarker.setAttribute('role', 'button');
        clusterMarker.tabIndex = 0;
        clusterMarker.setAttribute('aria-label', group.length + ' notes');
        clusterMarker.innerHTML = '<span class="cp-marker-num">' + group.length + '</span>';

        // Preview for cluster
        if (!notePopoverOpen) {
          const names = group.map(i => markerData[i].c.component || 'Element').join(', ');
          const flipClass = avg.x > window.innerWidth - 240 ? ' flip' : '';
          clusterMarker.innerHTML += '<span class="cp-marker-preview' + flipClass + '">' +
            '<span class="cp-marker-preview-header">' + group.length + ' notes</span>' +
            '<span class="cp-marker-preview-text">' + api.escapeHtml(names) + '</span></span>';
        }

        // Click expands cluster by spreading members
        clusterMarker.onclick = (e) => {
          e.stopPropagation();
          clusterMarker.remove();
          group.forEach((mi, offset) => {
            const m = markerData[mi];
            const spreadX = m.x + (offset - (group.length - 1) / 2) * 28;
            createSingleMarker(m, layer, notePopoverOpen, spreadX, m.y);
          });
        };
        clusterMarker.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clusterMarker.click(); }
        };
        layer.appendChild(clusterMarker);
      } else {
        const m = markerData[group[0]];
        createSingleMarker(m, layer, notePopoverOpen, m.x, m.y);
      }
    });
  }

  function createSingleMarker(m, layer, notePopoverOpen, x, y) {
    const { c, index, el } = m;
    const componentName = c.component || el.tagName.toLowerCase();
    const marker = document.createElement('div');
    marker.className = 'cp-comment-marker' + (c.resolved ? ' resolved' : '');
    if (state.activeNoteMarker === marker) marker.classList.add('active');
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
    marker.setAttribute('role', 'button');
    marker.tabIndex = 0;
    marker.setAttribute('aria-label', 'Note ' + (index + 1) + ' on ' + componentName);

    // Content: number for normal, check icon for resolved
    if (c.resolved) {
      marker.innerHTML = ICONS.check;
    } else {
      marker.innerHTML = '<span class="cp-marker-num">' + (index + 1) + '</span>';
    }

    // Preview card (hidden when popover is open)
    if (!notePopoverOpen) {
      const flipClass = x > window.innerWidth - 240 ? ' flip' : '';
      const previewText = api.escapeHtml(c.text || '').slice(0, 80);
      marker.innerHTML += '<span class="cp-marker-preview' + flipClass + '">' +
        '<span class="cp-marker-preview-header">#' + (index + 1) + ' ' + api.escapeHtml(componentName) + '</span>' +
        '<span class="cp-marker-preview-text">' + previewText + '</span></span>';
    }

    marker.onclick = (e) => {
      e.stopPropagation();
      state.activeNoteMarker = marker;
      openNotePopover({ element: el, name: componentName }, c, marker);
    };
    marker.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); marker.click(); }
      if (e.key === 'Escape') {
        const popover = shadow.getElementById('cp-note-popover');
        if (popover?.classList.contains('open')) closeNotePopover();
      }
    };
    layer.appendChild(marker);
  }

  function renderSidebarNotes() {
    const countEl = shadow.getElementById('cp-notes-count');
    const listEl = shadow.getElementById('cp-notes-list');
    if (!listEl) return;
    if (countEl) countEl.textContent = state.comments.length;

    if (state.comments.length === 0) {
      listEl.innerHTML = '<div style="font-size:11px; color:var(--text-muted); font-style:italic;">No notes yet. Click the note icon on any element to add persistent notes.</div>';
      return;
    }

    listEl.innerHTML = '';
    state.comments.forEach((c, idx) => {
      const item = document.createElement('div');
      item.className = 'cp-note-item' + (c.resolved ? ' resolved' : '');
      
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';

      const titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';
      titleWrap.style.gap = '5px';
      titleWrap.innerHTML = '<span class="cp-pin-badge">#' + (idx + 1) + '</span> <span style="font-weight:600; color:var(--text-primary); font-family:var(--font-mono); font-size:11px;">' + (c.component ? '&lt;' + api.escapeHtml(c.component) + ' /&gt;' : api.escapeHtml(c.selector || 'Element')) + '</span>';

      const actionsWrap = document.createElement('div');
      actionsWrap.style.display = 'flex';
      actionsWrap.style.alignItems = 'center';
      actionsWrap.style.gap = '4px';

      const resolveBtn = document.createElement('button');
      resolveBtn.style.cssText = 'background:none; border:none; cursor:pointer; padding:2px; color:' + (c.resolved ? 'var(--accent-emerald)' : 'var(--text-muted)');
      resolveBtn.title = c.resolved ? 'Mark unresolved' : 'Mark resolved';
      resolveBtn.innerHTML = ICONS.check;
      resolveBtn.onclick = async (e) => {
        e.stopPropagation();
        await fetch(BRIDGE + '/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle-resolve', id: c.id })
        });
        loadComments();
      };

      const delBtn = document.createElement('button');
      delBtn.style.cssText = 'background:none; border:none; cursor:pointer; padding:2px; color:var(--accent-rose); opacity:0.7;';
      delBtn.title = 'Delete note';
      delBtn.innerHTML = ICONS.trash;
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        await fetch(BRIDGE + '/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: c.id })
        });
        loadComments();
      };

      actionsWrap.appendChild(resolveBtn);
      actionsWrap.appendChild(delBtn);
      header.appendChild(titleWrap);
      header.appendChild(actionsWrap);

      const body = document.createElement('div');
      body.style.color = c.resolved ? 'var(--text-muted)' : 'var(--text-primary)';
      body.style.textDecoration = c.resolved ? 'line-through' : 'none';
      body.style.fontSize = '11.5px';
      body.style.lineHeight = '1.4';
      body.textContent = c.text;

      item.appendChild(header);
      item.appendChild(body);
      
      item.onclick = () => {
        let el = null;
        if (c.selector) {
          try { el = document.querySelector(c.selector); } catch(e) {}
        }
        if (!el && c.component) el = api.findComponentElement(c.component);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          state.selectedElement = el;
          state.selectedTarget = { name: c.component || el.tagName.toLowerCase(), element: el, isDomElement: true };
          api.updateSelectionFrame();
        }
      };

      listEl.appendChild(item);
    });
  }

  function openNotePopover(target, comment = null, markerEl = null) {
    state.editingComment = comment;
    state.activeNoteMarker = markerEl;
    state.pendingNoteTarget = target;
    const popover = shadow.getElementById('cp-note-popover');
    const labelEl = shadow.getElementById('cp-note-popover-label');
    const targetNameEl = shadow.getElementById('cp-note-popover-target');
    const fileBadge = shadow.getElementById('cp-note-popover-file');
    const sepEl = shadow.getElementById('cp-note-target-sep');
    const targetCapsule = shadow.getElementById('cp-note-target-capsule');
    const statusBadge = shadow.getElementById('cp-note-status-badge');
    const inputEl = shadow.getElementById('cp-note-input');
    const errorEl = shadow.getElementById('cp-note-error');
    const delBtn = shadow.getElementById('cp-note-delete');
    const resolveBtn = shadow.getElementById('cp-note-resolve');
    if (!popover || !inputEl) return;

    // Close any other floating layers (screenshot dropdown)
    api.closeSnapDropdown();

    const compName = comment?.component || target?.name || state.selectedTarget?.name || (state.lastCopiedContext ? state.lastCopiedContext.component.name : '');
    const fileStr = comment?.file || state.lastResolved?.file || state.lastCopiedContext?.source?.file || '';

    // Header label & status pill
    if (comment) {
      const noteIdx = state.comments.findIndex(c => c.id === comment.id);
      labelEl.textContent = noteIdx >= 0 ? ('Note #' + (noteIdx + 1)) : 'Note';
      if (statusBadge) {
        statusBadge.style.display = comment.resolved ? 'inline-flex' : 'none';
        statusBadge.textContent = 'Resolved';
      }
    } else {
      labelEl.textContent = 'New note';
      if (statusBadge) statusBadge.style.display = 'none';
    }

    // Format component tag & file badge cleanly
    function formatComponentName(name) {
      if (!name) return '';
      name = name.trim();
      if (name.startsWith('<') && name.endsWith('/>')) return name;
      if (name.startsWith('<') && name.endsWith('>')) return name;
      return '<' + name + ' />';
    }

    const formattedTarget = compName ? formatComponentName(compName) : '';
    const shortFile = fileStr ? fileStr.split('/').pop() : '';

    if (targetNameEl) targetNameEl.textContent = formattedTarget;
    if (fileBadge) {
      fileBadge.textContent = shortFile;
      fileBadge.style.display = shortFile ? '' : 'none';
    }
    if (sepEl) {
      sepEl.style.display = (formattedTarget && shortFile) ? 'inline' : 'none';
    }
    if (targetCapsule) {
      targetCapsule.style.display = (formattedTarget || shortFile) ? 'inline-flex' : 'none';
    }

    inputEl.value = comment?.text || '';
    if (errorEl) errorEl.textContent = '';

    // Auto-resize input to content
    const updateInputHeight = () => {
      inputEl.style.height = 'auto';
      const newHeight = Math.max(72, Math.min(inputEl.scrollHeight, 200));
      inputEl.style.height = newHeight + 'px';
    };

    // Platform-specific shortcut hint (⌘↵ on Mac, Ctrl↵ on others)
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const hintEl = popover.querySelector('.cp-note-hint');
    if (hintEl) {
      hintEl.innerHTML = '<kbd class="cp-kbd">' + (isMac ? '⌘' : 'Ctrl') + '</kbd><kbd class="cp-kbd">↵</kbd>';
    }

    // Show/hide delete and resolve for existing notes only
    if (comment) {
      delBtn.style.display = 'inline-flex';
      resolveBtn.style.display = 'inline-flex';
      resolveBtn.title = comment.resolved ? 'Reopen note' : 'Mark as resolved';
      resolveBtn.setAttribute('aria-label', comment.resolved ? 'Reopen note' : 'Resolve note');
      resolveBtn.innerHTML = comment.resolved ? ICONS.undo : ICONS.check;
      if (comment.resolved) {
        resolveBtn.classList.add('resolved');
      } else {
        resolveBtn.classList.remove('resolved');
      }

      delBtn.onclick = async () => {
        await fetch(BRIDGE + '/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: comment.id })
        });
        closeNotePopover();
        await loadComments();
        if (typeof api.renderFlyoutForStackIndex === 'function' && typeof state.currentStackIndex === 'number' && shadow.getElementById('cp-flyout')?.classList.contains('open')) {
          api.renderFlyoutForStackIndex(state.currentStackIndex);
        }
        api.showCallout('Note deleted', 'NOTE');
      };

      resolveBtn.onclick = async () => {
        await fetch(BRIDGE + '/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle-resolve', id: comment.id })
        });
        closeNotePopover();
        await loadComments();
        if (typeof api.renderFlyoutForStackIndex === 'function' && typeof state.currentStackIndex === 'number' && shadow.getElementById('cp-flyout')?.classList.contains('open')) {
          api.renderFlyoutForStackIndex(state.currentStackIndex);
        }
        api.showCallout(comment.resolved ? 'Note reopened' : 'Note resolved', 'SAVED');
      };
    } else {
      delBtn.style.display = 'none';
      resolveBtn.style.display = 'none';
      resolveBtn.classList.remove('resolved');
    }

    // Position: anchor beside the marker or selected element
    const MARGIN = 12;
    const CARD_WIDTH = 320;
    let anchorX, anchorY;

    let anchorRect = null;
    if (markerEl) {
      anchorRect = markerEl.getBoundingClientRect();
    } else if (target?.element && typeof target.element.getBoundingClientRect === 'function') {
      anchorRect = target.element.getBoundingClientRect();
    } else if (state.selectedRect) {
      anchorRect = state.selectedRect;
    }

    if (markerEl && anchorRect) {
      anchorX = anchorRect.right + 14;
      anchorY = anchorRect.top - 16;
      // Flip left if off-screen on the right
      if (anchorX + CARD_WIDTH + MARGIN > window.innerWidth) {
        anchorX = anchorRect.left - CARD_WIDTH - 14;
      }
    } else if (anchorRect) {
      // If anchored to an element, place to the right if fits, or below/left
      if (anchorRect.right + 14 + CARD_WIDTH + MARGIN <= window.innerWidth) {
        anchorX = anchorRect.right + 14;
        anchorY = anchorRect.top;
      } else if (anchorRect.left - CARD_WIDTH - 14 >= MARGIN) {
        anchorX = anchorRect.left - CARD_WIDTH - 14;
        anchorY = anchorRect.top;
      } else {
        anchorX = Math.max(MARGIN, Math.min(window.innerWidth - CARD_WIDTH - MARGIN, anchorRect.left));
        anchorY = anchorRect.bottom + 12;
      }
    } else {
      anchorX = window.innerWidth / 2 - (CARD_WIDTH / 2);
      anchorY = window.innerHeight * 0.25;
    }

    // Clamp inside viewport
    anchorX = Math.max(MARGIN, Math.min(window.innerWidth - CARD_WIDTH - MARGIN, anchorX));
    anchorY = Math.max(MARGIN, Math.min(window.innerHeight - 250 - MARGIN, anchorY));

    popover.style.top = Math.round(anchorY) + 'px';
    popover.style.left = Math.round(anchorX) + 'px';

    // Animate open using requestAnimationFrame for display+class toggle
    requestAnimationFrame(() => {
      popover.classList.add('open');
      updateInputHeight();
    });

    // Set active state on marker
    if (markerEl) markerEl.classList.add('active');

    // Re-render markers to hide previews
    renderCommentMarkers();

    setTimeout(() => {
      inputEl.focus();
      updateInputHeight();
    }, 50);

    // Clear error and resize on input
    inputEl.oninput = () => {
      if (errorEl) errorEl.textContent = '';
      updateInputHeight();
    };
  }

  function closeNotePopover() {
    const popover = shadow.getElementById('cp-note-popover');
    if (popover) popover.classList.remove('open');
    if (state.activeNoteMarker) {
      state.activeNoteMarker.classList.remove('active');
      try { state.activeNoteMarker.focus(); } catch (_) {}
    }
    state.activeNoteMarker = null;
    state.editingComment = null;
    state.pendingNoteTarget = null;
    renderCommentMarkers();
  }

  async function saveNote() {
    const inputEl = shadow.getElementById('cp-note-input');
    const errorEl = shadow.getElementById('cp-note-error');
    const text = inputEl ? inputEl.value.trim() : '';
    if (!text) {
      if (errorEl) errorEl.textContent = 'Enter a note first';
      if (inputEl) inputEl.focus();
      return;
    }

    if (state.editingComment) {
      await fetch(BRIDGE + '/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: state.editingComment.id, text })
      });
      api.showCallout('Note updated', 'SAVED');
    } else {
      const compName = state.pendingNoteTarget?.name || state.selectedTarget?.name || (state.lastCopiedContext ? state.lastCopiedContext.component.name : '');
      const file = state.lastResolved?.file || state.lastCopiedContext?.source?.file || '';
      const line = state.lastResolved?.line || state.lastCopiedContext?.source?.startLine || undefined;
      const targetEl = state.pendingNoteTarget?.element || state.selectedTarget?.element || state.selectedElement;
      const selector = targetEl ? api.buildCSSSelector(targetEl) : '';

      await fetch(BRIDGE + '/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          comment: { file, line, component: compName, selector, text }
        })
      });
      api.showCallout('Note saved', 'SAVED');
    }

    closeNotePopover();
    await loadComments();
    if (typeof api.renderFlyoutForStackIndex === 'function' && typeof state.currentStackIndex === 'number' && shadow.getElementById('cp-flyout')?.classList.contains('open')) {
      api.renderFlyoutForStackIndex(state.currentStackIndex);
    }
  }

  // Note popover keyboard: Cmd/Ctrl+Enter saves, Escape closes anywhere in popover
  shadow.getElementById('cp-note-popover')?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      saveNote();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeNotePopover();
    }
  });

  const noteSaveBtn = shadow.getElementById('cp-note-save');
  if (noteSaveBtn) noteSaveBtn.onclick = saveNote;
  const noteCancelBtn = shadow.getElementById('cp-note-cancel');
  if (noteCancelBtn) noteCancelBtn.onclick = () => closeNotePopover();
  const noteCloseBtn = shadow.getElementById('cp-note-popover-close');
  if (noteCloseBtn) noteCloseBtn.onclick = () => closeNotePopover();

  // Click outside closes popover
  shadow.addEventListener('click', (e) => {
    const popover = shadow.getElementById('cp-note-popover');
    if (popover?.classList.contains('open') && !popover.contains(e.target) && !e.target.closest('.cp-comment-marker')) {
      closeNotePopover();
    }
  });

  const notesCopyAllBtn = shadow.getElementById('cp-notes-copy-all');
  if (notesCopyAllBtn) {
    notesCopyAllBtn.onclick = async () => {
      if (state.comments.length === 0) {
        api.showCallout('No notes to copy', 'TIP');
        return;
      }
      const bt = String.fromCharCode(96);
      const nl = String.fromCharCode(10);
      let md = '### Persistent Codebase Notes & Feedback' + nl + nl;
      state.comments.forEach((c, i) => {
        const num = i + 1;
        const target = c.component ? '<' + c.component + ' />' : (c.selector || 'Element');
        const loc = c.file ? ' (' + bt + c.file + (c.line ? ':' + c.line : '') + bt + ')' : '';
        const status = c.resolved ? ' [RESOLVED]' : '';
        md += num + '. **' + target + '**' + loc + status + ':' + nl;
        md += '   > ' + c.text + nl + nl;
      });
      await navigator.clipboard.writeText(md);
      const origText = notesCopyAllBtn.textContent;
      notesCopyAllBtn.textContent = 'Copied!';
      api.showCallout('All ' + state.comments.length + ' notes copied for AI', 'COPIED');
      setTimeout(() => { notesCopyAllBtn.textContent = origText; }, 1600);
    };
  }
}
