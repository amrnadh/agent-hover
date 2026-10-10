// @ts-nocheck
import { ICONS } from '../icons.js';
import { extractComputedStyles } from '../lib/computed-styles.js';
import type { OverlayApp } from '../app/context.js';

/** Send-to-agent dispatch through the task queue with the D-06 clipboard rule. */
export function setupAgentDispatch(app: OverlayApp) {
  const { BRIDGE, fetch, shadow, state, api } = app;
  Object.assign(api, { dispatchToAgent });

  // --- Dispatch to AI Agent (Queue & Clipboard per D-06) ---
  let copyOnSend = 'auto'; // 'auto' | 'always' | 'never'

  async function dispatchToAgent(promptText, extra = {}) {
    if (!promptText) return;

    const hasAgent = Array.isArray(state.connectedAgents) && state.connectedAgents.length > 0;
    const agentName = hasAgent ? state.connectedAgents[0].client : null;

    // Clipboard rule D-06:
    // 'auto': write to clipboard ONLY if no agent connected or bridge unreachable
    // 'always': always write
    // 'never': never write
    const shouldCopy = copyOnSend === 'always' || (copyOnSend === 'auto' && !hasAgent);

    if (shouldCopy) {
      try {
        await navigator.clipboard.writeText(promptText);
      } catch (_) {}
    }

    try {
      const res = await fetch(BRIDGE + '/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: extra.type || 'component-context',
          instruction: extra.instruction || extra.goal || (typeof promptText === 'string' ? promptText.split(String.fromCharCode(10))[0] : 'UI Instruction'),
          target: {
            component: extra.component,
            file: extra.file,
            lineStart: extra.line,
          },
          payload: {
            prompt: promptText,
            ...extra,
          },
        }),
      });
      const data = await res.json();
      if (data && data.task) {
        if (hasAgent) {
          api.showCallout('Sent to ' + agentName, 'SUCCESS', 2500);
        } else {
          api.showCallout('Queued · no agent connected', 'SENT', 2500);
        }
      } else {
        api.showCallout('Copied to clipboard', 'COPIED', 2000);
      }
    } catch (err) {
      if (copyOnSend !== 'never') {
        try {
          await navigator.clipboard.writeText(promptText);
        } catch (_) {}
      }
      api.showCallout('Copied to clipboard', 'COPIED', 2000);
    }
  }

  // Flyout Send to Agent Button
  const sendAgentBtn = shadow.getElementById('cp-send-agent-btn');
  if (sendAgentBtn) {
    sendAgentBtn.onclick = async () => {
      let promptText = '';
      let compName = '';
      let filePath = '';
      if (state.lastCopiedContext) {
        promptText = api.formatContextForAiPrompt(state.lastCopiedContext, state.currentStack);
        compName = state.lastCopiedContext.component?.name || '';
        filePath = state.lastCopiedContext.source?.file || '';
      } else if (state.selectedTarget) {
        promptText = api.formatDomElementPrompt(state.selectedTarget, state.lastComputedStyles || extractComputedStyles(state.selectedTarget.element || state.selectedElement), state.currentStack);
        compName = state.selectedTarget.name || '';
      }
      if (!promptText) {
        api.showCallout('Select a component first', 'TIP', 2000);
        return;
      }
      const origHtml = sendAgentBtn.innerHTML;
      sendAgentBtn.innerHTML = ICONS.check + ' Sent!';
      setTimeout(() => { sendAgentBtn.innerHTML = origHtml; }, 1600);
      await dispatchToAgent(promptText, { type: 'component-context', component: compName, file: filePath });
    };
  }

  // Note Popover Send to Agent Button
  const noteSendAgentBtn = shadow.getElementById('cp-note-send-agent');
  if (noteSendAgentBtn) {
    noteSendAgentBtn.onclick = async () => {
      const input = shadow.getElementById('cp-note-input');
      const text = input ? input.value.trim() : '';
      if (!text) {
        const errEl = shadow.getElementById('cp-note-error');
        if (errEl) errEl.textContent = 'Please enter a note';
        return;
      }
      api.saveNote();
      const compName = state.selectedTarget?.name || (state.lastCopiedContext ? state.lastCopiedContext.component.name : '');
      const file = state.lastResolved?.file || state.lastCopiedContext?.source?.file || '';
      const line = state.lastResolved?.line || state.lastCopiedContext?.source?.startLine || '';
      const targetStr = compName ? '<' + compName + ' />' : 'Element';
      const locStr = file ? ' (' + file + (line ? ':' + line : '') + ')' : '';
      const notePrompt = '### Note for ' + targetStr + locStr + String.fromCharCode(10) + String.fromCharCode(10) + text;
      await dispatchToAgent(notePrompt, { type: 'note', component: compName, file, line, text });
    };
  }

  // Pin Stack Send to Agent Button
  const pinSendAgentBtn = shadow.getElementById('cp-pin-send-agent');
  if (pinSendAgentBtn) {
    pinSendAgentBtn.onclick = async () => {
      if (!state.currentPins || state.currentPins.length === 0) {
        api.showCallout('Pin components first', 'TIP');
        return;
      }
      const taskInputEl = shadow.getElementById('cp-task-input');
      const overallGoal = taskInputEl ? taskInputEl.value.trim() : '';
      const level = shadow.getElementById('cp-context-level')?.value || 'standard';
      const origHtml = pinSendAgentBtn.innerHTML;
      pinSendAgentBtn.innerHTML = '<svg class="cp-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Sending...';
      try {
        const res = await fetch(BRIDGE + '/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: overallGoal, level })
        });
        const data = await res.json();
        const prompt = data.context || JSON.stringify(data, null, 2);
        await dispatchToAgent(prompt, { type: 'pinned-stack', count: state.currentPins.length, goal: overallGoal });
        pinSendAgentBtn.innerHTML = ICONS.check + ' Sent to Agent!';
        api.showCallout('Pinned tasks sent to agent', 'SENT');
        setTimeout(() => { pinSendAgentBtn.innerHTML = origHtml; }, 1600);
      } catch (e) {
        pinSendAgentBtn.innerHTML = origHtml;
        api.showCallout('Failed to send pinned tasks to agent', 'ERROR');
      }
    };
  }
}
