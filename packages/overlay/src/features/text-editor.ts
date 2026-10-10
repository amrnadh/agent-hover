// @ts-nocheck
import { buildHierarchyStack, getFiberNode } from '../lib/fiber.js';
import type { OverlayApp } from '../app/context.js';

/** Inline text editor that writes to source with DOM fallback. */
export function setupTextEditor(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, dom, api } = app;
  Object.assign(api, { closeTextEditor, buildCSSSelector, handleDblClickTarget });

  // --- Inline Text Editor (Writes directly to Source with DOM Fallback) ---
  let textEditTarget = null;
  let textEditOriginalHTML = '';
  let textEditOriginalText = '';
  let textEditTargetFile = null;
  let textEditTargetLine = null;
  let textEditTargetComponent = null;
  let textEdits = new Map(); // element -> { originalHTML, currentHTML }
  state.textEditorVisible = false;

  // Managed stylesheet for edited element indicators
  let editedStyleEl = null;
  function getEditedStylesheet() {
    if (!editedStyleEl) {
      editedStyleEl = document.createElement('style');
      editedStyleEl.id = 'agent-hover-edits';
      document.head.appendChild(editedStyleEl);
    }
    return editedStyleEl;
  }

  function updateEditedIndicators() {
    const sheet = getEditedStylesheet();
    let css = '';
    let idx = 0;
    textEdits.forEach(function(val, el) {
      const attrVal = 'ah-edited-' + idx;
      el.setAttribute('data-ah-edited', attrVal);
      css += '[data-ah-edited="' + attrVal + '"] { outline: 1px dashed rgba(0, 240, 255, 0.35) !important; outline-offset: 2px !important; }\\n';
      idx++;
    });
    sheet.textContent = css;
  }

  function isLeafTextElement(el) {
    if (!el || !el.textContent || !el.textContent.trim()) return false;
    // Check that it has mostly text content (no complex children)
    const children = el.children;
    if (children.length === 0) return true;
    // Allow elements with only inline formatting children (b, i, u, em, strong, span, a, br)
    const inlineTags = new Set(['B', 'I', 'U', 'EM', 'STRONG', 'SPAN', 'A', 'BR', 'SMALL', 'SUB', 'SUP', 'MARK', 'CODE']);
    for (let i = 0; i < children.length; i++) {
      if (!inlineTags.has(children[i].tagName)) return false;
    }
    return true;
  }

  function isFormElement(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'OPTION';
  }

  function positionTextEditor(targetEl) {
    if (!dom.textEditor || !targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const edW = 340;
    const edH = 240; // approximate
    const gap = 8;
    let top, left;

    // Prefer below the element
    if (rect.bottom + gap + edH < window.innerHeight) {
      top = rect.bottom + gap;
    } else if (rect.top - gap - edH > 0) {
      // Above the element
      top = rect.top - gap - edH;
    } else {
      // Fallback: center of viewport
      top = Math.max(12, (window.innerHeight - edH) / 2);
    }

    // Horizontally align with element left, clamped to viewport
    left = Math.max(12, Math.min(rect.left, window.innerWidth - edW - 12));

    dom.textEditor.style.top = top + 'px';
    dom.textEditor.style.left = left + 'px';
  }

  function openTextEditor(el) {
    if (!dom.textEditor || !dom.textEditorContent || !el) return;
    textEditTarget = el;
    textEditOriginalHTML = el.innerHTML;
    textEditOriginalText = (el.textContent || '').trim();
    textEditTargetFile = null;
    textEditTargetLine = null;
    textEditTargetComponent = null;

    // 1. Try direct leaf fiber _debugSource (exact JSX element tag)
    const leafFiber = getFiberNode(el);
    if (leafFiber && leafFiber._debugSource) {
      textEditTargetFile = leafFiber._debugSource.fileName;
      textEditTargetLine = leafFiber._debugSource.lineNumber;
    }

    // 2. Find enclosing React component and source location
    const stack = buildHierarchyStack(el);
    const comp = stack.find(c => !c.isDomElement);
    if (comp) {
      textEditTargetComponent = comp.name;
      if (!textEditTargetFile && comp.source && comp.source.fileName) {
        textEditTargetFile = comp.source.fileName;
        textEditTargetLine = comp.source.lineNumber;
      }
    }

    // Target badge
    const targetBadge = shadow.getElementById('cp-text-target-badge');
    if (targetBadge) {
      if (textEditTargetFile) {
        const fileName = textEditTargetFile.split('/').pop();
        targetBadge.textContent = (textEditTargetComponent ? textEditTargetComponent + ' • ' : '') + fileName + (textEditTargetLine ? ':' + textEditTargetLine : '');
        targetBadge.title = textEditTargetFile + (textEditTargetLine ? ':' + textEditTargetLine : '');
      } else if (textEditTargetComponent) {
        targetBadge.textContent = textEditTargetComponent + ' • resolving...';
        api.resolveComponent({ name: textEditTargetComponent }).then(resolved => {
          if (resolved && resolved.file) {
            textEditTargetFile = resolved.file;
            textEditTargetLine = resolved.line;
            const fn = resolved.file.split('/').pop();
            targetBadge.textContent = textEditTargetComponent + ' • ' + fn + (resolved.line ? ':' + resolved.line : '');
            targetBadge.title = resolved.file + ':' + resolved.line;
          } else {
            targetBadge.textContent = textEditTargetComponent + ' • auto-scan';
          }
        });
      } else {
        targetBadge.textContent = 'Auto-scan on save';
        targetBadge.title = 'Will scan project files on save';
      }
    }

    // If this element was previously edited, show current content
    dom.textEditorContent.innerHTML = el.innerHTML;

    positionTextEditor(el);
    dom.textEditor.style.display = 'block';
    state.textEditorVisible = true;

    // Focus the editor and select all text
    setTimeout(function() {
      dom.textEditorContent.focus();
      try {
        const range = document.createRange();
        range.selectNodeContents(dom.textEditorContent);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (e) {}
    }, 50);

    // Update char count
    updateCharCount();
    api.showCallout('Editing source text', 'EDIT');
  }

  function closeTextEditor() {
    if (dom.textEditor) dom.textEditor.style.display = 'none';
    state.textEditorVisible = false;
    textEditTarget = null;
    textEditTargetFile = null;
    textEditTargetLine = null;
    textEditTargetComponent = null;
    textEditOriginalText = '';
  }

  async function applyTextEdit() {
    if (!textEditTarget || !dom.textEditorContent) return;
    const newText = (dom.textEditorContent.textContent || dom.textEditorContent.innerText || '').trim();
    const originalText = textEditOriginalText;
    const newHTML = dom.textEditorContent.innerHTML;

    const applyBtn = shadow.getElementById('cp-text-apply');

    // Always attempt /api/edit-source when text actually changed!
    if (originalText && newText !== originalText) {
      if (applyBtn) {
        applyBtn.textContent = 'Saving...';
        applyBtn.disabled = true;
      }
      try {
        const res = await fetch(BRIDGE + '/api/edit-source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: textEditTargetFile || '',
            component: textEditTargetComponent || '',
            originalText: originalText,
            newText: newText,
            line: textEditTargetLine,
          }),
        });
        const data = await res.json();
        if (applyBtn) {
          applyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save to Code';
          applyBtn.disabled = false;
        }
        if (data.success) {
          const fileBase = (data.file || textEditTargetFile || 'source').split('/').pop();
          api.showCallout('Saved to ' + fileBase + ' (HMR reloaded)', 'SOURCE');
          textEditTarget.textContent = newText;
          closeTextEditor();
          return;
        } else {
          console.warn('[agent-hover] Source edit fallback:', data.error);
          api.showCallout('Could not match AST — applied to DOM', 'WARNING');
        }
      } catch (e) {
        if (applyBtn) {
          applyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save to Code';
          applyBtn.disabled = false;
        }
        console.error('[agent-hover] Error calling /api/edit-source:', e);
        api.showCallout('Server error — applied to DOM', 'WARNING');
      }
    }

    // Fallback to DOM update (ephemeral / dynamic expression)
    textEditTarget.innerHTML = newHTML;
    textEdits.set(textEditTarget, { originalHTML: textEditOriginalHTML, currentHTML: newHTML });
    updateEditedIndicators();
    saveTextEditsToSession();
    api.showCallout('DOM updated', 'EDIT');
    closeTextEditor();
  }

  async function revertTextEdit() {
    if (!textEditTarget) return;
    const revertBtn = shadow.getElementById('cp-text-revert');
    if (revertBtn) revertBtn.disabled = true;

    try {
      const res = await fetch(BRIDGE + '/api/source-undo', { method: 'POST' });
      const data = await res.json();
      if (revertBtn) revertBtn.disabled = false;
      if (data.success) {
        api.showCallout((data.description || 'Source change reverted'), 'UNDO');
        closeTextEditor();
        return;
      }
    } catch (e) {
      if (revertBtn) revertBtn.disabled = false;
    }

    // Fallback DOM revert
    textEditTarget.innerHTML = textEditOriginalHTML;
    textEdits.delete(textEditTarget);
    textEditTarget.removeAttribute('data-ah-edited');
    updateEditedIndicators();
    saveTextEditsToSession();
    api.showCallout('Text reverted', 'UNDO');
    closeTextEditor();
  }

  function updateCharCount() {
    if (!dom.textCharCount || !dom.textEditorContent) return;
    const len = dom.textEditorContent.textContent ? dom.textEditorContent.textContent.length : 0;
    dom.textCharCount.textContent = len + ' chars';
  }

  // --- sessionStorage persistence for text edits ---
  function buildCSSSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return '';
    const parts = [];
    let curr = el;
    while (curr && curr !== document.body && parts.length < 6) {
      let sel = curr.tagName.toLowerCase();
      if (curr.id) {
        sel += '#' + curr.id;
        parts.unshift(sel);
        break; // ID is unique enough
      }
      if (curr.parentElement) {
        const siblings = Array.from(curr.parentElement.children).filter(function(c) { return c.tagName === curr.tagName; });
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

  function saveTextEditsToSession() {
    try {
      const data = [];
      textEdits.forEach(function(val, el) {
        const selector = buildCSSSelector(el);
        if (selector) {
          data.push({ selector: selector, originalHTML: val.originalHTML, currentHTML: val.currentHTML });
        }
      });
      sessionStorage.setItem('agent-hover-text-edits', JSON.stringify(data));
    } catch(e) { }
  }

  function restoreTextEditsFromSession() {
    try {
      const raw = sessionStorage.getItem('agent-hover-text-edits');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return;
      data.forEach(function(item) {
        try {
          const el = document.querySelector(item.selector);
          if (el && el.innerHTML !== item.currentHTML) {
            el.innerHTML = item.currentHTML;
            textEdits.set(el, { originalHTML: item.originalHTML, currentHTML: item.currentHTML });
          }
        } catch(e) { }
      });
      if (textEdits.size > 0) {
        updateEditedIndicators();
        console.log('[agent-hover] Restored ' + textEdits.size + ' text edit(s) from session');
      }
    } catch(e) { }
  }

  // Restore edits after a short delay (let React render first)
  setTimeout(restoreTextEditsFromSession, 800);

  // --- Text Editor Event Handlers ---
  // Apply button
  shadow.getElementById('cp-text-apply').onclick = applyTextEdit;

  // Revert button
  shadow.getElementById('cp-text-revert').onclick = revertTextEdit;

  // Close button
  shadow.getElementById('cp-text-editor-close').onclick = closeTextEditor;

  // Toolbar buttons (bold, italic, underline)
  shadow.querySelectorAll('.cp-text-tb-btn').forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      const cmd = btn.getAttribute('data-cmd');
      if (cmd && dom.textEditorContent) {
        // Need to refocus the contenteditable before executing command
        dom.textEditorContent.focus();
        document.execCommand(cmd, false, null);
      }
    };
  });

  // Update char count on input and keyboard shortcuts (Cmd+Enter to commit, Esc to close)
  if (dom.textEditorContent) {
    dom.textEditorContent.addEventListener('input', updateCharCount);
    dom.textEditorContent.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        applyTextEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeTextEditor();
      }
    });
  }

  // Double-click handler for text editing (delegated via CaptureLayer)
  function handleDblClickTarget(el, e) {
    if (!el || (el.closest && el.closest('#agent-hover-root'))) return;
    if (isFormElement(el)) return;
    if (!isLeafTextElement(el)) {
      api.showCallout('Element has complex children — select a text element', 'TIP');
      return;
    }

    openTextEditor(el);
  }

  // Close text editor on Escape (handled in keydown handler below)
  // Close text editor on click outside
  window.addEventListener('mousedown', function(e) {
    if (!state.textEditorVisible) return;
    // Check if click is inside the text editor (Shadow DOM)
    const path = e.composedPath ? e.composedPath() : [];
    let insideEditor = false;
    for (let i = 0; i < path.length; i++) {
      if (path[i] === dom.textEditor) { insideEditor = true; break; }
    }
    if (!insideEditor) {
      closeTextEditor();
    }
  }, true);
}
