import { prettyAgentName } from '../lib/task-status.js';
import type { OverlayApp } from '../app/context.js';

export interface DispatchExtra {
  type?: string;
  instruction?: string;
  goal?: string;
  component?: string;
  file?: string;
  line?: number;
  selector?: string;
  hierarchy?: string[];
  label?: string;
  [key: string]: unknown;
}

export interface DispatchOptions {
  /** Skip the toast; the caller shows its own feedback. */
  quiet?: boolean;
  /** 'copy' only copies the prompt (chat tools). Default 'agent': queue for the agent, D-06 clipboard rule. */
  destination?: 'agent' | 'copy';
}

export interface DispatchResult {
  task: any | null;
  copied: boolean;
}

/** Send a prompt to the agent queue (or the clipboard). Shared by the composer, comments and batch. */
export function setupAgentDispatch(app: OverlayApp) {
  const { BRIDGE, fetch, state, api } = app;
  Object.assign(api, { dispatchToAgent, copyText });

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function dispatchToAgent(promptText: string, extra: DispatchExtra = {}, options: DispatchOptions = {}): Promise<DispatchResult> {
    const notify = (text: string) => { if (!options.quiet) api.toast(text); };
    if (!promptText) return { task: null, copied: false };

    if (options.destination === 'copy' || state.delivery === 'copy') {
      const copied = await copyText(promptText);
      notify(copied ? 'Prompt copied · paste it into any AI tool' : 'Clipboard blocked by the browser');
      return { task: null, copied };
    }

    const hasAgent = Array.isArray(state.connectedAgents) && state.connectedAgents.length > 0;
    const agentName = hasAgent ? prettyAgentName(state.connectedAgents[0].client) : null;
    // D-06: copy as well when no agent would pick the task up.
    const copied = !hasAgent ? await copyText(promptText) : false;

    try {
      const res = await fetch(BRIDGE + '/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: extra.type || 'component-context',
          instruction: extra.instruction || extra.goal || promptText.split('\n')[0],
          target: {
            component: extra.component,
            file: extra.file,
            lineStart: extra.line,
            selector: extra.selector,
            hierarchy: extra.hierarchy,
          },
          payload: { prompt: promptText, ...extra },
        }),
      });
      const data = await res.json();
      if (data?.task) {
        notify(hasAgent ? `Sent to ${agentName}` : 'Queued · no agent connected · also copied');
        return { task: data.task, copied };
      }
    } catch {}
    const fallback = copied || (await copyText(promptText));
    notify(fallback ? 'Dev server unreachable · prompt copied instead' : 'Dev server unreachable');
    return { task: null, copied: fallback };
  }
}
