import { readPref, writePref } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

/**
 * Bridge connection: WebSocket (messages are routed by sync.ts), health and agent presence.
 * Every change fires `ah-presence-changed` on the shadow root; the dock, composer and Settings listen.
 */
export function setupBridgeConnection(app: OverlayApp) {
  const { BRIDGE, fetch, port, shadow, token, state, api } = app;
  Object.assign(api, { handleUpdateAvailable, setConnectedAgents });

  state.ws = undefined;
  state.isBridgeConnected = false;
  state.connectedAgents = [];
  state.updateAvailable = null;

  function presenceChanged() {
    shadow.dispatchEvent(new Event('ah-presence-changed'));
    api.renderDock?.();
    if (state.side?.settings) api.renderSidebar?.();
  }

  function setBridgeConnected(connected: boolean) {
    if (state.isBridgeConnected === connected) return;
    state.isBridgeConnected = connected;
    if (!connected) state.connectedAgents = [];
    presenceChanged();
  }

  function setConnectedAgents(agents: any[]) {
    state.connectedAgents = Array.isArray(agents) ? agents : [];
    presenceChanged();
  }

  /** A newer @agent-hover/vite is on npm (the bridge checks once a day). Shown in the dock popover and
   *  Settings › About, plus one toast per new version. */
  function handleUpdateAvailable(info: any) {
    if (!info?.latest || state.updateAvailable?.latest === info.latest) return;
    state.updateAvailable = info;
    api.renderDock?.();
    if (readPref('agent-hover-update-seen', '') === info.latest) return;
    writePref('agent-hover-update-seen', info.latest);
    api.toast?.(`Agent Hover ${info.latest} is available`, { action: 'Details', onAction: () => api.openSettings('about'), ms: 8000 });
  }

  try {
    state.ws = new WebSocket('ws://localhost:' + port + '?token=' + (token || ''));
    state.ws.onopen = () => setBridgeConnected(true);
    state.ws.onclose = () => setBridgeConnected(false);
    state.ws.onerror = () => setBridgeConnected(false);
  } catch {
    console.warn('[agent-hover] Could not connect to the dev server bridge');
  }

  function checkHealth() {
    return fetch(BRIDGE + '/api/health')
      .then((r) => r.json())
      .then((d) => {
        setBridgeConnected(true);
        if (d.updateAvailable) handleUpdateAvailable(d.updateAvailable);
      })
      .catch(() => setBridgeConnected(false));
  }

  checkHealth();
  fetch(BRIDGE + '/api/agent/presence')
    .then((r) => r.json())
    .then((d) => setConnectedAgents(d.agents || []))
    .catch(() => {});

  // Page restored from the back/forward cache: re-check the dev server.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) checkHealth().then(() => { if (!state.isBridgeConnected) api.toast?.('Dev server offline · restart it to reconnect'); });
  });
}
