// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Bridge WebSocket connection, health checks, and presence bootstrap. */
export function setupBridgeConnection(app: OverlayApp) {
  const { BRIDGE, fetch, port, shadow, token, state, api } = app;
  Object.assign(api, { handleUpdateAvailable });

  state.ws = undefined;
  state.isBridgeConnected = false;
  state.connectedAgents = [];
  state.dockController = null;

  function setBridgeConnected(connected) {
    state.isBridgeConnected = connected;
    const badge = shadow.getElementById('cp-bridge-status-badge');
    if (badge) {
      if (connected) {
        badge.className = 'cp-badge cp-badge-emerald';
        badge.textContent = 'Bridge Active';
      } else {
        badge.className = 'cp-badge cp-badge-rose';
        badge.textContent = 'Server Offline';
      }
    }
    if (state.dockController) {
      state.dockController.updatePresence({
        bridgeOnline: connected,
        port,
        agents: state.connectedAgents,
      });
    }
  }

  function handleUpdateAvailable(updateInfo) {
    if (!updateInfo || !updateInfo.latest) return;
    const dot = shadow.getElementById('cp-settings-update-dot');
    if (dot) dot.style.display = 'block';
    const banner = shadow.getElementById('cp-update-banner');
    const verEl = shadow.getElementById('cp-update-latest-ver');
    if (banner && verEl) {
      verEl.textContent = updateInfo.latest;
      banner.style.display = 'block';
    }
  }

  try {
    state.ws = new WebSocket('ws://localhost:' + port + '?token=' + (token || ''));
    state.ws.onopen = () => {
      console.log('[agent-hover] Connected to bridge');
      setBridgeConnected(true);
    };
    state.ws.onclose = () => {
      setBridgeConnected(false);
      console.warn('[agent-hover] Bridge disconnected (dev server stopped)');
    };
    state.ws.onerror = () => {
      setBridgeConnected(false);
      console.warn('[agent-hover] WebSocket connection failed');
    };
  } catch(e) {
    console.warn('[agent-hover] Could not connect WebSocket');
  }

  // Check bridge server health and pending updates on load
  fetch(BRIDGE + '/api/health')
    .then(r => r.json())
    .then(d => {
      setBridgeConnected(true);
      if (d.updateAvailable) handleUpdateAvailable(d.updateAvailable);
    })
    .catch(() => setBridgeConnected(false));

  fetch(BRIDGE + '/api/presence')
    .then(r => r.json())
    .then(d => {
      state.connectedAgents = d.agents || [];
      if (state.dockController) {
        state.dockController.updatePresence({
          bridgeOnline: state.isBridgeConnected,
          port,
          agents: state.connectedAgents,
        });
      }
    })
    .catch(() => {});

  // Check on page restore from browser bfcache (e.g. Cmd+Shift+T)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      fetch(BRIDGE + '/api/health')
        .then(res => res.json())
        .then(data => {
          setBridgeConnected(true);
          if (data.updateAvailable) handleUpdateAvailable(data.updateAvailable);
        })
        .catch(() => {
          setBridgeConnected(false);
          api.showCallout('Dev server offline — restart npm run dev', 'OFFLINE', 3000);
        });
    }
  });
}
