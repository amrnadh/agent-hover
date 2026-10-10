// @ts-nocheck
import { extractComputedStyles } from '../lib/computed-styles.js';
import type { OverlayApp } from '../app/context.js';

/** Pinned multi-component stack: pin dialog, pin button, task goal, brief generation. */
export function setupPins(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, dom, api } = app;
  Object.assign(api, { openPinDialog });

  // --- Pinned Multi-Task Dialog Logic ---
  function openPinDialog(target, resolved) {
    state.pendingPinTarget = { target, resolved };
    const pinBadge = shadow.getElementById('cp-pin-dialog-badge');
    const pinName = shadow.getElementById('cp-pin-dialog-name');
    const pinFile = shadow.getElementById('cp-pin-dialog-file');
    const pinTask = shadow.getElementById('cp-pin-dialog-task');
    const pinDlg = shadow.getElementById('cp-pin-dialog');

    const currentPinsCount = state.currentPins.length;
    pinBadge.textContent = 'Pin #' + (currentPinsCount + 1);
    pinName.textContent = '<' + (target?.name || 'Component') + ' />';
    pinFile.textContent = resolved?.file ? (resolved.file.split('/').slice(-2).join('/') + (resolved.line ? ':' + resolved.line : '')) : '';
    
    const existingPin = state.currentPins.find(p => p.context?.source?.file === resolved?.file);
    pinTask.value = existingPin?.task || '';

    if (state.selectedRect) {
      let top = state.selectedRect.bottom + 10;
      if (top + 190 > window.innerHeight) top = Math.max(20, state.selectedRect.top - 200);
      let left = Math.max(20, Math.min(window.innerWidth - 360, state.selectedRect.left));
      pinDlg.style.top = top + 'px';
      pinDlg.style.left = left + 'px';
      pinDlg.style.transform = 'none';
    } else {
      pinDlg.style.top = '30%';
      pinDlg.style.left = '50%';
      pinDlg.style.transform = 'translate(-50%, -50%)';
    }

    pinDlg.style.display = 'block';
    setTimeout(() => pinTask.focus(), 50);
  }

  const pinDialogAddMore = shadow.getElementById('cp-pin-dialog-add-more');
  if (pinDialogAddMore) {
    pinDialogAddMore.onclick = async () => {
      if (!state.pendingPinTarget) return;
      const { target, resolved } = state.pendingPinTarget;
      const taskVal = shadow.getElementById('cp-pin-dialog-task')?.value.trim() || '';
      const pinId = 'pin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      
      await fetch(BRIDGE + '/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', id: pinId, file: resolved.file, line: resolved.line, task: taskVal })
      });
      shadow.getElementById('cp-pin-dialog').style.display = 'none';
      api.showCallout('Pin added. Click next element to add more', 'PIN');
      await api.refreshState();
      
      if (!state.isPointerMode) {
        api.togglePointerMode();
      }
    };
  }

  const pinDialogCopyNow = shadow.getElementById('cp-pin-dialog-copy-now');
  if (pinDialogCopyNow) {
    pinDialogCopyNow.onclick = async () => {
      if (!state.pendingPinTarget) return;
      const { target, resolved } = state.pendingPinTarget;
      const taskVal = shadow.getElementById('cp-pin-dialog-task')?.value.trim() || '';
      const pinId = 'pin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

      await fetch(BRIDGE + '/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', id: pinId, file: resolved.file, line: resolved.line, task: taskVal })
      });
      shadow.getElementById('cp-pin-dialog').style.display = 'none';
      await api.refreshState();

      const level = shadow.getElementById('cp-context-level')?.value || 'standard';
      try {
        const taskRes = await fetch(BRIDGE + '/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: taskVal, level })
        });
        const taskData = await taskRes.json();
        await navigator.clipboard.writeText(taskData.context);
        api.showCallout('Task prompt copied (' + (taskData.tokenCost || '?') + ' tok)', 'COPIED');
      } catch(e) {
        api.showCallout('Pinned ' + (target?.name || 'Component'), 'PIN');
      }
    };
  }

  const pinDialogClose = shadow.getElementById('cp-pin-dialog-close');
  if (pinDialogClose) {
    pinDialogClose.onclick = () => {
      shadow.getElementById('cp-pin-dialog').style.display = 'none';
    };
  }

  if (dom.selCloseBtn) {
    dom.selCloseBtn.onclick = (e) => {
      e.stopPropagation();
      api.clearSelection();
      dom.flyout.classList.remove('open');
      dom.dockWrapper.classList.remove('sidebar-open');
    };
  }

  if (dom.selCopyBtn) {
    dom.selCopyBtn.onclick = async (e) => {
      e.stopPropagation();
      if (state.lastCopiedContext) {
        const promptText = api.formatContextForAiPrompt(state.lastCopiedContext, state.currentStack);
        await navigator.clipboard.writeText(promptText);
        if (dom.selCopyLabel) dom.selCopyLabel.textContent = 'Copied!';
        api.showCallout('AI Prompt Copied (' + (state.lastCopiedContext.tokens?.current || '?') + ' tok)', 'COPIED');
        setTimeout(() => { if (dom.selCopyLabel) dom.selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
      } else if (state.selectedTarget) {
        try {
          if (dom.selCopyLabel) dom.selCopyLabel.textContent = 'Copying...';
          const compToResolve = state.selectedTarget.isDomElement && state.currentStack.length > 1 ? state.currentStack[1] : state.selectedTarget;
          const res = await api.resolveComponent(compToResolve);
          if (res) {
            const fetchRes = await fetch(BRIDGE + '/api/context', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file: res.file, line: res.line, level: 'standard' })
            });
            const ctx = await fetchRes.json();
            state.lastCopiedContext = ctx;
            const promptText = api.formatContextForAiPrompt(ctx, state.currentStack);
            await navigator.clipboard.writeText(promptText);
            if (dom.selCopyLabel) dom.selCopyLabel.textContent = 'Copied!';
            api.showCallout('AI Prompt Copied', 'COPIED');
            setTimeout(() => { if (dom.selCopyLabel) dom.selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
            return;
          }
        } catch(err) {
          console.error(err);
        }
        const promptText = api.formatDomElementPrompt(state.selectedTarget, state.lastComputedStyles || extractComputedStyles(state.selectedTarget.element || state.selectedElement), state.currentStack);
        await navigator.clipboard.writeText(promptText);
        if (dom.selCopyLabel) dom.selCopyLabel.textContent = 'Copied!';
        api.showCallout('Element Prompt Copied', 'COPIED');
        setTimeout(() => { if (dom.selCopyLabel) dom.selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
      }
    };
  }

  shadow.getElementById('cp-pin-btn').onclick = async () => {
    const targetToPin = state.selectedTarget?.isDomElement && state.currentStack.length > 1 ? state.currentStack[1] : state.selectedTarget;
    const resolved = state.lastResolved || (targetToPin ? await api.resolveComponent(targetToPin) : null);
    if (resolved) {
      openPinDialog(targetToPin, resolved);
    } else if (state.lastCopiedContext) {
      openPinDialog({ name: state.lastCopiedContext.component.name }, { file: state.lastCopiedContext.source.file, line: state.lastCopiedContext.source.startLine });
    } else {
      api.showCallout('Select a component to pin first', 'TIP');
    }
  };

  const taskInput = shadow.getElementById('cp-task-input');
  if (taskInput) {
    taskInput.addEventListener('focus', () => {
      taskInput.style.borderColor = 'var(--border-accent)';
    });
    taskInput.addEventListener('blur', () => {
      taskInput.style.borderColor = '';
    });
  }

  shadow.getElementById('cp-gen-task').onclick = async () => {
    if (!state.currentPins || state.currentPins.length === 0) {
      api.showCallout('Pin at least one component first', 'TIP');
      return;
    }
    const instruction = taskInput ? taskInput.value.trim() : '';
    const level = shadow.getElementById('cp-context-level')?.value || 'standard';
    const btn = shadow.getElementById('cp-gen-task');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<svg class="cp-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Generating...';
    btn.disabled = true;
    try {
      const res = await fetch(BRIDGE + '/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, level })
      });
      const data = await res.json();
      await navigator.clipboard.writeText(data.context || JSON.stringify(data, null, 2));
      api.showCallout('All tasks copied in order (' + (data.tokenCost || '?') + ' tokens)', 'COPIED');
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
      setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 1600);
    } catch(e) {
      api.showCallout('Failed to generate task context', 'ERROR');
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  };
}
