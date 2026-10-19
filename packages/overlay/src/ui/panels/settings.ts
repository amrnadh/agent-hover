import { esc, writePref } from '../../lib/ui.js';
import { icon } from '../../lib/icon.js';
import { prettyAgentName } from '../../lib/task-status.js';
import { AGENT_SETUPS, EDITORS } from '../../lib/agents.js';
import type { OverlayApp } from '../../app/context.js';

declare const __AH_VERSION__: string;

/** The plugin pulls in core and the overlay; the MCP server runs through npx and stays current on its own. */
const UPDATE_CMD = 'npm i -D @agent-hover/vite@latest';

/** Settings view (gear): agents, what Send does, appearance, editor, keyboard, about. */
export function setupSettingsPanel(app: OverlayApp) {
  const { port, state, api } = app;
  let agentTab = 'claude';
  /** Whether the setup steps are unfolded: open while no agent is connected, or after you open them. */
  let setupOpen: boolean | null = null;
  const version = typeof __AH_VERSION__ !== 'undefined' ? __AH_VERSION__ : '';
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const mod = isMac ? '⌘' : 'Ctrl';
  try { state.delivery = localStorage.getItem('agent-hover-delivery') || 'auto'; } catch { state.delivery = 'auto'; }

  const seg = (name: string, options: Array<[string, string]>, current: string) =>
    `<div class="ah-seg" role="radiogroup" data-seg="${name}">${options.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === current}">${esc(l)}</button>`).join('')}</div>`;

  api.registerPanel('settings', {
    render(body: HTMLElement) {
      const agents = state.connectedAgents || [];
      const setup = AGENT_SETUPS.find((a) => a.id === agentTab) || AGENT_SETUPS[0];
      const showSetup = setupOpen ?? (!agents.length || state.side.settingsFocus === 'agents');
      body.innerHTML = `
        <div class="ah-ident" style="grid-auto-flow:column;justify-content:start;align-items:center;gap:8px">
          <button class="ah-ibtn" data-act="back" aria-label="Back">${icon('back')}</button><div class="name" style="font-family:var(--ui-font)">Settings</div>
        </div>
        <section class="ah-set" id="ah-set-agents"><h4>Agents</h4>
          ${agents.length
            ? agents.map((a: any) => `<div class="ah-agent"><span class="ah-dot ok"></span>${esc(prettyAgentName(a.client))}<span class="ah-muted">connected</span></div>`).join('')
            : `<p>${state.isBridgeConnected ? 'No agent is connected right now.' : 'The dev server is offline.'} Ask and Comment still work by copying prompts.</p>`}
          <p>Works with any MCP coding agent. Add the server once, then run <b>/agent-hover</b> in your agent (<b>$agent-hover</b> in Codex) or tell it <b>“Listen for agent-hover tasks”</b>.</p>
          <details class="ah-sec ah-setup" ${showSetup ? 'open' : ''}><summary>${icon('chev-right', 12)}<span class="chev-label">${agents.length ? 'Connect another agent' : 'Set up an agent'}</span></summary>
          <div class="ah-chips" data-agents>${AGENT_SETUPS.map((a) => `<button data-agent="${a.id}" aria-pressed="${a.id === setup.id}">${esc(a.title)}</button>`).join('')}</div>
          ${setup.command ? `<pre class="ah-snippet" tabindex="0">${esc(setup.command)}</pre><p>Or add to ${esc(setup.configPath)}:</p>` : `<p>Add to ${esc(setup.configPath)}:</p>`}
          <pre class="ah-snippet" tabindex="0">${esc(setup.snippet)}</pre>
          <div class="ah-actions"><button class="ah-tbtn outline" data-act="copy-setup">${icon('copy', 14)}Copy</button><span class="ah-muted" style="font-size:12px">Or run <span class="ah-mono">npx agent-hover mcp</span> in your project.</span></div>
          ${/Windows/.test(navigator.userAgent) ? '<p>On Windows, agents start the server through cmd: <span class="ah-mono">"command": "cmd", "args": ["/c", "npx", "-y", "@agent-hover/mcp"]</span>. <span class="ah-mono">npx agent-hover init</span> writes it that way for you.</p>' : ''}
          </details>
          <p>Using ChatGPT, Claude.ai, v0, Lovable or Bolt? Use Copy: every prompt is self-contained.</p>
        </section>
        <section class="ah-set"><h4>When you press Send</h4>
          ${seg('delivery', [['auto', 'Send if an agent is connected, else copy'], ['copy', 'Always copy']], state.delivery)}
          <p>Context detail</p>
          ${seg('level', [['minimal', 'Compact'], ['standard', 'Standard'], ['full', 'Deep']], state.level)}
        </section>
        <section class="ah-set" id="ah-set-voice"><h4>Voice</h4>
          ${api.voiceSupported()
            ? `${seg('voice', [['on', 'Mic in Ask and comments'], ['off', 'Off']], api.voiceEnabled() ? 'on' : 'off')}
               <div class="ah-field" style="padding:0"><label for="ah-voice-lang">Language</label><input id="ah-voice-lang" data-voice-lang value="${esc(api.voiceLanguage())}" placeholder="en-US"></div>
               <p>Your browser turns speech into text: on the device when it can, otherwise Chrome and Edge send the audio to Google or Microsoft, Safari to Apple. Agent Hover never receives or stores audio.</p>`
            : '<p>This browser has no speech recognition.</p>'}
          <p>Your system's dictation works in any text box too: press Fn twice on macOS, or Windows + H.</p>
        </section>
        <section class="ah-set"><h4>Appearance</h4>
          <p>Theme</p>${seg('theme', [['system', 'System'], ['dark', 'Dark'], ['light', 'Light']], state.theme)}
          <p>Dock</p>${seg('dock', [['horizontal', 'Horizontal'], ['vertical', 'Vertical']], state.dockVertical ? 'vertical' : 'horizontal')}
          <div class="ah-actions"><button class="ah-tbtn outline" data-act="reset-dock">Reset dock position</button><button class="ah-tbtn outline" data-act="minimize">Minimize dock</button></div>
        </section>
        <section class="ah-set"><h4>Open files in</h4>
          <div class="ah-chips" data-editors>${EDITORS.map(([id, l]) => `<button data-editor="${id}" aria-pressed="${state.editorPref === id}">${esc(l)}</button>`).join('')}</div>
        </section>
        <section class="ah-set" id="ah-set-keys"><h4>Keyboard</h4><div class="ah-shortcuts">
          <span>Inspect on / off</span><kbd>Alt</kbd>
          <span>Comment mode</span><kbd>C</kbd>
          <span>Ask about the selection</span><kbd>Enter</kbd>
          <span>Add selection to batch</span><kbd>B</kbd>
          <span>Copy context</span><kbd>${mod} C</kbd>
          <span>Open in editor</span><kbd>O</kbd>
          <span>Select parent / child</span><kbd>↑ ↓</kbd>
          <span>Show distances</span><kbd>Hold ${mod}</kbd>
          <span>Click through to the page</span><kbd>Hold Shift</kbd>
          <span>Send</span><kbd>${mod} Enter</kbd>
          <span>Tasks</span><kbd>T</kbd>
          <span>Task card: Keep · Undo · Follow up · Try again</span><kbd>K U F R</kbd>
          <span>Lists: move · open · remove</span><kbd>↑ ↓ Enter Del</kbd>
          <span>Hide / show dock</span><kbd>${mod} ⇧ X</kbd>
          <span>Close / deselect</span><kbd>Esc</kbd></div></section>
        <section class="ah-set" id="ah-set-about" style="border:0"><h4>About</h4>
          <p>Agent Hover${version ? ' ' + esc(version) : ''} · bridge on port ${port} · MIT</p>
          ${state.updateAvailable ? `<p><b>${esc(state.updateAvailable.latest)}</b> is available (you have ${esc(state.updateAvailable.current)}). Update, then restart the dev server:</p>
            <pre class="ah-snippet" tabindex="0">${esc(UPDATE_CMD)}</pre>
            <div class="ah-actions"><button class="ah-tbtn outline" data-act="copy-update">${icon('copy', 14)}Copy</button></div>` : ''}
        </section>`;

      if (state.side.settingsFocus) {
        const target = body.querySelector(`#ah-set-${state.side.settingsFocus}`) || body.querySelector('#ah-set-agents');
        target?.scrollIntoView({ block: 'start' });
        state.side.settingsFocus = '';
      }

      const setupEl = body.querySelector('.ah-setup') as HTMLDetailsElement | null;
      if (setupEl) setupEl.ontoggle = () => { setupOpen = setupEl.open; };

      const lang = body.querySelector('[data-voice-lang]') as HTMLInputElement | null;
      if (lang) lang.onchange = () => api.setVoiceLanguage(lang.value);

      body.onclick = async (e) => {
        const b = (e.target as Element).closest('button') as HTMLElement | null;
        if (!b) return;
        const segEl = b.closest('[data-seg]') as HTMLElement | null;
        if (segEl) {
          const v = b.dataset.v!;
          const name = segEl.dataset.seg;
          if (name === 'delivery') { state.delivery = v; writePref('agent-hover-delivery', v); }
          if (name === 'level') api.setContextLevel(v);
          if (name === 'theme') api.setTheme(v);
          if (name === 'dock') api.setDockVertical(v === 'vertical');
          if (name === 'voice') api.setVoiceEnabled(v === 'on');
          api.renderSidebar();
          return;
        }
        if (b.dataset.agent) { agentTab = b.dataset.agent; api.renderSidebar(); return; }
        if (b.dataset.editor) { api.setEditorPref(b.dataset.editor); api.renderSidebar(); return; }
        const act = b.dataset.act;
        if (act === 'back') api.openSidebar();
        if (act === 'reset-dock') api.resetDockPosition();
        if (act === 'minimize') api.setDockMinimized(true);
        if (act === 'copy-setup') {
          const ok = await api.copyText(setup.command || setup.snippet);
          api.toast(ok ? `Copied ${setup.title} setup` : 'Clipboard blocked by the browser');
        }
        if (act === 'copy-update') {
          const ok = await api.copyText(UPDATE_CMD);
          api.toast(ok ? 'Copied the update command' : 'Clipboard blocked by the browser');
        }
      };
    },
  });
}
