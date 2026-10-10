// @ts-nocheck
import { ICONS } from '../icons.js';
import { getInheritedBackgroundColor } from '../lib/computed-styles.js';
import type { OverlayApp } from '../app/context.js';

/** Screenshot modes, preview toast, lightbox, and the capture engine. */
export function setupScreenshots(app: OverlayApp) {
  const { BRIDGE, container, fetch, shadow, state, api } = app;
  Object.assign(api, { closeSnapDropdown, handleSnapMode, captureElement });

  // --- Screenshot Mode System ---
  let snapBusy = false;
  let snapPreviewBlobUrl = null;
  let lastCapturedDataUrl = null;
  let lastCapturedFilename = null;

  function closeSnapDropdown() {
    const dd = shadow.getElementById('cp-snap-dropdown');
    if (dd) dd.classList.remove('open');
    const btn = shadow.getElementById('cp-flyout-snap-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    hideRegionHint();
    const msg = shadow.getElementById('cp-snap-message');
    if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
  }

  function hideRegionHint() {
    const hint = shadow.getElementById('cp-region-hint');
    if (hint) { hint.className = ''; hint.style.display = 'none'; hint.style.cssText = ''; }
  }

  function showRegionHint(mode) {
    const hint = shadow.getElementById('cp-region-hint');
    const label = shadow.getElementById('cp-region-label');
    if (!hint) return;
    hideRegionHint();

    if (mode === 'component') {
      const el = state.selectedTarget?.element || state.selectedElement;
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect();
        hint.className = 'component';
        hint.style.display = 'block';
        hint.style.position = 'fixed';
        hint.style.left = r.left + 'px';
        hint.style.top = r.top + 'px';
        hint.style.width = r.width + 'px';
        hint.style.height = r.height + 'px';
        if (label) label.textContent = 'Element bounds';
      }
    } else if (mode === 'viewport') {
      hint.className = 'viewport';
      hint.style.display = 'block';
      hint.style.position = 'fixed';
      if (label) label.textContent = 'Visible viewport';
    } else if (mode === 'fullpage') {
      const w = document.documentElement.scrollWidth;
      const h = document.documentElement.scrollHeight;
      const sizeLabel = shadow.getElementById('cp-snap-fullpage-size');
      if (sizeLabel) sizeLabel.textContent = 'Full scroll height, ' + w + ' x ' + h + ' px';
    }
  }

  function openSnapDropdown() {
    const dd = shadow.getElementById('cp-snap-dropdown');
    const btn = shadow.getElementById('cp-flyout-snap-btn');
    if (!dd || !btn) return;

    // Close note popover
    api.closeNotePopover();

    // Position dropdown under the button using fixed viewport coordinates
    const btnRect = btn.getBoundingClientRect();
    let top = btnRect.bottom + 4;
    let left = btnRect.right - 240;

    // Flip above if no room below
    if (btnRect.bottom + 200 > window.innerHeight) {
      top = btnRect.top - 200;
    }
    // Clamp
    left = Math.max(8, left);
    dd.style.top = top + 'px';
    dd.style.left = left + 'px';

    // Update component name caption
    const compCaption = shadow.getElementById('cp-snap-component-name');
    if (compCaption) {
      const name = state.selectedTarget?.name || (state.selectedElement ? state.selectedElement.tagName.toLowerCase() : null);
      compCaption.textContent = name ? '<' + name + ' />' : 'None selected';
    }

    dd.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');

    // Focus the right row
    const options = dd.querySelectorAll('.cp-snap-option');
    const hasSelection = state.selectedTarget?.element || state.selectedElement;
    const focusIdx = hasSelection ? 0 : 1;
    if (options[focusIdx]) options[focusIdx].focus();
  }

  const flyoutSnapBtn = shadow.getElementById('cp-flyout-snap-btn');
  if (flyoutSnapBtn) {
    flyoutSnapBtn.onclick = () => {
      const dd = shadow.getElementById('cp-snap-dropdown');
      if (dd?.classList.contains('open')) {
        closeSnapDropdown();
      } else {
        openSnapDropdown();
      }
    };
  }

  // Dropdown keyboard navigation
  shadow.getElementById('cp-snap-dropdown')?.addEventListener('keydown', (e) => {
    const options = Array.from(shadow.querySelectorAll('.cp-snap-option'));
    const idx = options.indexOf(e.target);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? (idx + 1) % options.length : (idx - 1 + options.length) % options.length;
      options[next]?.focus();
    }
    if (e.key === 'Home') { e.preventDefault(); options[0]?.focus(); }
    if (e.key === 'End') { e.preventDefault(); options[options.length - 1]?.focus(); }
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      closeSnapDropdown();
      flyoutSnapBtn?.focus();
    }
  });

  // Dropdown option hover/focus region hints
  shadow.querySelectorAll('.cp-snap-option').forEach((opt) => {
    const mode = opt.getAttribute('data-mode');
    opt.addEventListener('mouseenter', () => showRegionHint(mode));
    opt.addEventListener('focus', () => showRegionHint(mode));
    opt.addEventListener('mouseleave', () => hideRegionHint());
    opt.addEventListener('blur', () => hideRegionHint());

    opt.addEventListener('click', () => handleSnapMode(mode));
  });

  // Click outside closes dropdown
  shadow.addEventListener('click', (e) => {
    const dd = shadow.getElementById('cp-snap-dropdown');
    if (dd?.classList.contains('open') && !dd.contains(e.target) && e.target !== flyoutSnapBtn && !flyoutSnapBtn?.contains(e.target)) {
      closeSnapDropdown();
    }
  });

  async function handleSnapMode(mode) {
    if (snapBusy) return;

    if (mode === 'component') {
      const el = state.selectedTarget?.element || state.selectedElement;
      if (!el || !el.isConnected) {
        api.showCallout('Select a component on the page first', 'WARNING', 2000);
        const msg = shadow.getElementById('cp-snap-message');
        if (msg) {
          msg.textContent = 'Click an element on the page first, or pick Viewport.';
          msg.style.display = 'block';
        }
        return;
      }
    }

    closeSnapDropdown();
    hideRegionHint();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    snapBusy = true;
    const modeLabel = mode === 'component' ? 'Component' : mode === 'viewport' ? 'Viewport' : 'Full page';
    api.showCallout(mode === 'fullpage' ? 'Capturing full page...' : 'Capturing...', 'SNAP', 1500);

    try {
      let el, captureOpts;
      if (mode === 'component') {
        el = state.selectedTarget?.element || state.selectedElement;
      } else if (mode === 'viewport') {
        el = document.documentElement;
        captureOpts = { width: window.innerWidth, height: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY };
      } else {
        el = document.documentElement;
        captureOpts = { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
      }

      const dataUrl = await captureElement(el, captureOpts);
      if (!dataUrl) {
        api.showCallout(mode === 'fullpage' ? 'Page is too long to capture in one image' : 'Capture failed. Try Viewport instead.', 'ERROR', 3000);
        snapBusy = false;
        return;
      }

      // Flash after capture completes
      triggerShutterFlash();

      // Get image dimensions for meta line
      const img = new Image();
      img.onload = () => {
        const filename = mode + '-' + Date.now() + '.png';
        lastCapturedDataUrl = dataUrl;
        lastCapturedFilename = filename;
        const resStr = img.naturalWidth + ' × ' + img.naturalHeight;
        showSnapPreview(dataUrl, modeLabel + ' • ' + resStr, filename, mode);
      };
      img.onerror = () => {
        const filename = mode + '-' + Date.now() + '.png';
        lastCapturedDataUrl = dataUrl;
        lastCapturedFilename = filename;
        showSnapPreview(dataUrl, modeLabel, filename, mode);
      };
      img.src = dataUrl;

      // Save to bridge for agent workflow
      let savedForAgent = false;
      try {
        const res = await fetch(BRIDGE + '/api/screenshot/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, filename: mode })
        });
        const result = await res.json();
        savedForAgent = result?.success;
      } catch (_) {}

      // Update status line
      setTimeout(() => {
        const statusEl = shadow.getElementById('cp-snap-preview-status');
        if (statusEl) {
          if (savedForAgent) {
            statusEl.className = 'cp-snap-preview-status success';
            statusEl.innerHTML = ICONS.check + ' Saved for agent';
          } else {
            statusEl.className = 'cp-snap-preview-status error';
            statusEl.innerHTML = 'Local preview only';
          }
        }
      }, 100);

    } catch (err) {
      api.showCallout('Capture failed. Try Viewport instead.', 'ERROR', 3000);
    }
    snapBusy = false;
  }

  let lastCapturedMode = 'viewport';
  let lastCapturedMeta = '';
  let snapAutoDismissTimer = null;

  function showSnapPreview(dataUrl, meta, filename, mode) {
    const card = shadow.getElementById('cp-snap-preview');
    const img = shadow.getElementById('cp-snap-preview-img');
    const metaEl = shadow.getElementById('cp-snap-preview-meta');
    const statusEl = shadow.getElementById('cp-snap-preview-status');
    if (!card) return;

    lastCapturedDataUrl = dataUrl;
    lastCapturedFilename = filename || 'screenshot.png';
    lastCapturedMode = mode || 'viewport';
    lastCapturedMeta = meta || '';

    // Revoke previous blob URL
    if (snapPreviewBlobUrl) { URL.revokeObjectURL(snapPreviewBlobUrl); snapPreviewBlobUrl = null; }

    // Create blob URL for thumbnail
    const blob = dataUrlToBlob(dataUrl);
    if (blob) {
      snapPreviewBlobUrl = URL.createObjectURL(blob);
      if (img) img.src = snapPreviewBlobUrl;
    } else if (img) {
      img.src = dataUrl;
    }

    if (metaEl) metaEl.textContent = meta || '';
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'cp-snap-preview-status';
    }

    // Reset button labels
    const dlBtn = shadow.getElementById('cp-snap-download');
    const cpBtn = shadow.getElementById('cp-snap-copy');
    if (dlBtn) dlBtn.innerHTML = ICONS.download + ' Download';
    if (cpBtn) cpBtn.innerHTML = ICONS.copy + ' Copy Image';

    // Trigger smooth opening & restart progress bar animation
    card.classList.remove('open');
    card.classList.remove('animating');
    void card.offsetWidth; // Force reflow to restart CSS animation
    card.classList.add('open');
    card.classList.add('animating');

    // Auto-dismiss after 6s (pauses on hover)
    if (snapAutoDismissTimer) clearTimeout(snapAutoDismissTimer);
    snapAutoDismissTimer = setTimeout(() => {
      closeSnapPreview();
    }, 6000);

    // Hover pause / leave resume
    card.onmouseenter = () => {
      if (snapAutoDismissTimer) {
        clearTimeout(snapAutoDismissTimer);
        snapAutoDismissTimer = null;
      }
    };
    card.onmouseleave = () => {
      if (card.classList.contains('open') && !snapAutoDismissTimer) {
        snapAutoDismissTimer = setTimeout(() => {
          closeSnapPreview();
        }, 3000);
      }
    };
  }

  function closeSnapPreview() {
    const card = shadow.getElementById('cp-snap-preview');
    if (card) {
      card.classList.remove('open');
      card.classList.remove('animating');
    }
    if (snapAutoDismissTimer) {
      clearTimeout(snapAutoDismissTimer);
      snapAutoDismissTimer = null;
    }
    if (snapPreviewBlobUrl) { URL.revokeObjectURL(snapPreviewBlobUrl); snapPreviewBlobUrl = null; }
  }

  // Preview card close button
  shadow.getElementById('cp-snap-preview-close')?.addEventListener('click', closeSnapPreview);

  // Clickable Zoom Thumbnail opens Full Lightbox Modal
  const snapThumbBtn = shadow.getElementById('cp-snap-thumb-btn');
  if (snapThumbBtn) {
    snapThumbBtn.onclick = () => {
      if (lastCapturedDataUrl) {
        openLightbox(lastCapturedDataUrl, lastCapturedMode, lastCapturedFilename, lastCapturedMeta);
      }
    };
  }

  // Full Lightbox Modal Logic
  function openLightbox(dataUrl, mode, filename, meta) {
    const lb = shadow.getElementById('cp-snap-lightbox');
    const lbImg = shadow.getElementById('cp-lightbox-img');
    const lbBadge = shadow.getElementById('cp-lightbox-mode-badge');
    const lbFilename = shadow.getElementById('cp-lightbox-filename');
    const lbRes = shadow.getElementById('cp-lightbox-res');
    if (!lb || !lbImg) return;

    lbImg.src = dataUrl;
    if (lbBadge) lbBadge.textContent = (mode || 'COMPONENT').toUpperCase();
    if (lbFilename) lbFilename.textContent = filename || 'screenshot.png';
    if (lbRes) lbRes.textContent = meta || '';

    lb.classList.add('open');
  }

  function closeLightbox() {
    const lb = shadow.getElementById('cp-snap-lightbox');
    if (lb) lb.classList.remove('open');
  }

  shadow.getElementById('cp-lightbox-close')?.addEventListener('click', closeLightbox);
  shadow.getElementById('cp-snap-lightbox')?.addEventListener('click', (e) => {
    if (e.target === shadow.getElementById('cp-snap-lightbox')) {
      closeLightbox();
    }
  });

  // Lightbox download button
  shadow.getElementById('cp-lightbox-download')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!lastCapturedDataUrl) return;
    const blob = dataUrlToBlob(lastCapturedDataUrl);
    if (!blob) return;
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = lastCapturedFilename || 'screenshot.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch(_) {}
        URL.revokeObjectURL(url);
      }, 3000);
      const btn = shadow.getElementById('cp-lightbox-download');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = ICONS.check + ' Downloaded';
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
      }
      api.showCallout('Screenshot downloaded', 'SAVED', 2000);
    } catch (_) {}
  });

  // Lightbox copy image button
  shadow.getElementById('cp-lightbox-copy')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!lastCapturedDataUrl) return;
    const blob = dataUrlToBlob(lastCapturedDataUrl);
    const btn = shadow.getElementById('cp-lightbox-copy');
    if (blob && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = ICONS.check + ' Copied';
          setTimeout(() => { btn.innerHTML = orig; }, 1500);
        }
        api.showCallout('Screenshot copied to clipboard', 'COPIED', 2000);
      } catch (_) {
        api.showCallout('Browser blocked clipboard access. Use Download.', 'WARNING', 3000);
      }
    }
  });

  // Escape key closes Lightbox or Toast
  shadow.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lb = shadow.getElementById('cp-snap-lightbox');
      if (lb?.classList.contains('open')) {
        closeLightbox();
        e.stopPropagation();
        return;
      }
      const preview = shadow.getElementById('cp-snap-preview');
      if (preview?.classList.contains('open')) {
        closeSnapPreview();
      }
    }
  });

  // Download button
  shadow.getElementById('cp-snap-download')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!lastCapturedDataUrl) return;
    const blob = dataUrlToBlob(lastCapturedDataUrl);
    if (!blob) return;
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = lastCapturedFilename || 'screenshot.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch(_) {}
        URL.revokeObjectURL(url);
      }, 3000);
      const btn = shadow.getElementById('cp-snap-download');
      if (btn) {
        btn.innerHTML = ICONS.check + ' Downloaded';
        setTimeout(() => { btn.innerHTML = ICONS.download + ' Download'; }, 1500);
      }
      api.showCallout('Screenshot downloaded', 'SAVED', 2000);
    } catch (_) {}
  });

  // Open Folder button
  shadow.getElementById('cp-snap-open-folder')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = shadow.getElementById('cp-snap-open-folder');
    try {
      const res = await fetch(BRIDGE + '/api/screenshot/open-folder', { method: 'POST' });
      if (res.ok) {
        if (btn) {
          btn.innerHTML = ICONS.check + ' Opened';
          setTimeout(() => { btn.innerHTML = ICONS.camera + ' Folder'; }, 1500);
        }
        api.showCallout('Screenshots folder opened', 'OPENED', 2000);
      } else {
        api.showCallout('Failed to open folder', 'ERROR', 2000);
      }
    } catch (_) {
      api.showCallout('Failed to connect to bridge', 'ERROR', 2000);
    }
  });

  // Copy button
  shadow.getElementById('cp-snap-copy')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!lastCapturedDataUrl) return;
    const blob = dataUrlToBlob(lastCapturedDataUrl);
    const btn = shadow.getElementById('cp-snap-copy');
    if (blob && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        if (btn) {
          btn.innerHTML = ICONS.check + ' Copied';
          setTimeout(() => { btn.innerHTML = ICONS.copy + ' Copy Image'; }, 1500);
        }
        api.showCallout('Screenshot copied to clipboard', 'COPIED', 2000);
      } catch (_) {
        if (btn) {
          btn.innerHTML = 'Copy failed';
          setTimeout(() => { btn.innerHTML = ICONS.copy + ' Copy Image'; }, 2000);
        }
        api.showCallout('Browser blocked clipboard access. Use Download.', 'WARNING', 3000);
      }
    }
  });

  function triggerShutterFlash() {
    try {
      const flash = document.createElement('div');
      flash.id = 'ah-shutter-flash';
      flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.32);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);pointer-events:none;z-index:9999999;opacity:1;transition:opacity 0.35s cubic-bezier(0.16,1,0.3,1);';
      document.body.appendChild(flash);
      requestAnimationFrame(() => {
        flash.style.opacity = '0';
        setTimeout(() => {
          try { if (flash.parentNode) flash.parentNode.removeChild(flash); } catch (_) {}
        }, 400);
      });
    } catch (_) {}
  }

  async function captureElement(element, opts) {
    if (!element) return null;
    // Completely hide Agent Hover UI (dock, sidebar, overlays, markers) so only website UI is captured
    const rootContainer = shadow.host || container;
    const prevVisibility = rootContainer.style.visibility;
    rootContainer.style.visibility = 'hidden';

    // Capture filter: exclude agent-hover UI, preview card, dropdown, markers, popover, flash
    const captureFilter = (node) => {
      if (!node) return true;
      if (node.id === 'agent-hover-root' || node === container) return false;
      if (node.id === 'ah-shutter-flash') return false;
      if (node.classList && node.classList.contains && (
        node.classList.contains('agent-hover-ignore') ||
        node.classList.contains('cp-comment-marker') ||
        node.classList.contains('cp-marker-preview')
      )) return false;
      return true;
    };

    try {
      const isViewport = opts && opts.scrollX !== undefined;
      const isFullPage = opts && opts.height > window.innerHeight;
      const isComponent = !isViewport && !isFullPage;

      if (isComponent && element.getBoundingClientRect) {
        const rect = element.getBoundingClientRect();
        const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
        if (!inViewport && element.scrollIntoView) {
          element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          await new Promise(r => setTimeout(r, 100));
        }
      }

      let scale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 2);
      const solidBg = getInheritedBackgroundColor(element);

      // Build capture options
      const captureOpts = {
        scale,
        backgroundColor: solidBg,
        filter: captureFilter,
        onCloneNode: (clonedRoot) => {
          if (!clonedRoot) return;
          const fixNode = (node) => {
            if (!node || node.nodeType !== 1) return;
            const text = node.textContent ? node.textContent.trim() : '';
            if (text.length > 0 && text.length <= 60 && !text.includes(String.fromCharCode(10))) {
              const hasBlockChild = Array.from(node.children || []).some((c) => {
                const tag = c.tagName ? c.tagName.toLowerCase() : '';
                return tag === 'div' || tag === 'p' || tag === 'section' || tag === 'article' || tag === 'header';
              });
              if (!hasBlockChild) {
                node.style.whiteSpace = 'nowrap';
              }
            }
            if (node.children) {
              for (let i = 0; i < node.children.length; i++) {
                fixNode(node.children[i]);
              }
            }
          };
          fixNode(clonedRoot);
        },
        onCloneEachNode: (clonedNode) => {
          if (clonedNode && clonedNode.nodeType === 1) {
            const text = clonedNode.textContent ? clonedNode.textContent.trim() : '';
            if (text.length > 0 && text.length <= 60 && !text.includes(String.fromCharCode(10))) {
              const hasBlockChild = Array.from(clonedNode.children || []).some((c) => {
                const tag = c.tagName ? c.tagName.toLowerCase() : '';
                return tag === 'div' || tag === 'p' || tag === 'section' || tag === 'article';
              });
              if (!hasBlockChild) {
                clonedNode.style.whiteSpace = 'nowrap';
              }
            }
          }
        }
      };

      // Viewport mode: capture at viewport dimensions with scroll offset
      if (isViewport) {
        captureOpts.width = opts.width || window.innerWidth;
        captureOpts.height = opts.height || window.innerHeight;
        // Offset by scroll position through the clone's style
        captureOpts.style = {
          transform: 'translate(-' + (opts.scrollX || 0) + 'px, -' + (opts.scrollY || 0) + 'px)',
          transformOrigin: 'top left',
        };
      }

      // Full page mode: pass dimensions without mutating live DOM
      if (isFullPage) {
        captureOpts.width = opts.width || document.documentElement.scrollWidth;
        captureOpts.height = opts.height || document.documentElement.scrollHeight;
      }

      // Primary: Use modernScreenshot
      if (window.modernScreenshot && window.modernScreenshot.domToPng) {
        try {
          const dataUrl = await window.modernScreenshot.domToPng(element, captureOpts);
          if (dataUrl) return dataUrl;
        } catch (err) {
          // Retry full page at lower scale on canvas failure
          if (isFullPage && scale > 1) {
            console.warn('[agent-hover] Full page capture failed at scale ' + scale + ', retrying at scale 1');
            captureOpts.scale = 1;
            try {
              const dataUrl = await window.modernScreenshot.domToPng(element, captureOpts);
              if (dataUrl) return dataUrl;
            } catch (_) {}
          }
        }
      }

      // Fallback: domtoimage
      if (window.domtoimage && window.domtoimage.toPng) {
        const rect = isComponent && element.getBoundingClientRect ? element.getBoundingClientRect() : null;
        const captureWidth = Math.max(Math.round(
          opts?.width || (isComponent ? (element.offsetWidth || element.clientWidth || (rect ? rect.width : 300)) : window.innerWidth)
        ), 10);
        const captureHeight = Math.max(Math.round(
          opts?.height || (isComponent ? (element.offsetHeight || element.clientHeight || (rect ? rect.height : 200)) : window.innerHeight)
        ), 10);
        const dataUrl = await window.domtoimage.toPng(element, {
          width: captureWidth,
          height: captureHeight,
          pixelRatio: scale,
          bgcolor: solidBg,
          imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=',
          filter: captureFilter,
        });
        return dataUrl;
      }

      console.error('[agent-hover] No screenshot capture library available');
      return null;
    } catch (err) {
      console.error('[agent-hover] Screenshot capture failed:', err);
      return null;
    } finally {
      rootContainer.style.visibility = prevVisibility || 'visible';
    }
  }

  function dataUrlToBlob(dataUrl) {
    try {
      const parts = dataUrl.split(';base64,');
      const contentType = (parts[0] && parts[0].split(':')[1]) || 'image/png';
      const byteCharacters = atob(parts[1]);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
        const slice = byteCharacters.slice(offset, offset + 1024);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      return new Blob(byteArrays, { type: contentType });
    } catch (e) {
      console.error('[agent-hover] Blob conversion error:', e);
      return null;
    }
  }

  async function downloadCleanScreenshot(targetEl, name) {
    triggerShutterFlash();
    api.showCallout('Capturing screenshot...', 'SNAP', 800);
    const el = (targetEl && targetEl.isConnected) ? targetEl : document.body;
    const cleanName = (name || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const filename = cleanName + '_' + timestamp + '.png';

    const dataUrl = await captureElement(el);
    if (!dataUrl) {
      api.showCallout('Failed to capture screenshot', 'ERROR', 2500);
      return;
    }

    const blob = dataUrlToBlob(dataUrl);

    // 1. Direct browser download via Blob Object URL
    let browserDownloaded = false;
    if (blob) {
      try {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { document.body.removeChild(a); } catch (_) {}
          URL.revokeObjectURL(blobUrl);
        }, 5000);
        browserDownloaded = true;
      } catch (e) {
        console.warn('[agent-hover] Browser blob download failed:', e);
      }
    }

    // 2. Direct copy to system clipboard for immediate pasting (Cmd+V / Ctrl+V)
    let clipboardCopied = false;
    if (blob && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        clipboardCopied = true;
      } catch (_) {}
    }

    // 3. Save directly to project disk via Bridge server (.agent-hover/screenshots/)
    let diskSaved = false;
    try {
      const res = await fetch(BRIDGE + '/api/screenshot/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename: cleanName })
      });
      const result = await res.json();
      if (result && result.success) {
        diskSaved = true;
      }
    } catch (_) {}

    if (diskSaved || browserDownloaded) {
      const testImg = new Image();
      testImg.onload = () => {
        showSnapPreview(dataUrl, (name || 'Component') + ' • ' + testImg.naturalWidth + ' × ' + testImg.naturalHeight, filename, 'component');
      };
      testImg.onerror = () => {
        showSnapPreview(dataUrl, (name || 'Component'), filename, 'component');
      };
      testImg.src = dataUrl;

      if (clipboardCopied && diskSaved) {
        api.showCallout('Screenshot saved and copied to clipboard', 'SAVED', 3500);
      } else if (clipboardCopied) {
        api.showCallout('Downloaded and copied to clipboard', 'SAVED', 3000);
      } else if (diskSaved) {
        api.showCallout('Saved to .agent-hover/screenshots/', 'SAVED', 3000);
      } else {
        api.showCallout('Screenshot downloaded', 'SAVED', 3000);
      }
    } else {
      api.showCallout('Failed to save screenshot', 'ERROR', 2500);
    }
  }
}
