// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Startup: MCP status polling, initial freeze/state load, scroll/resize sync. */
export function setupStartup(app: OverlayApp) {
  const { BRIDGE, fetch, port, shadow, state, api } = app;

  // MCP status polling: check every 10s
  let mcpStatusInterval = null;
  function pollMcpStatus() {
    fetch(BRIDGE + '/api/mcp-status')
      .then(r => r.json())
      .then(d => {
        const label = shadow.getElementById('cp-mcp-status-label');
        if (label) {
          label.textContent = d.connected ? 'Connected' : 'Not connected';
          label.style.color = d.connected ? 'var(--accent-emerald, #10b981)' : 'var(--text-muted)';
        }
        if (d.connected && state.connectedAgents.length === 0) {
          state.connectedAgents = [{ client: 'mcp' }];
          if (state.dockController) {
            state.dockController.updatePresence({
              bridgeOnline: state.isBridgeConnected,
              port,
              agents: state.connectedAgents,
            });
          }
        }
      })
      .catch(() => {
        const label = shadow.getElementById('cp-mcp-status-label');
        if (label) { label.textContent = 'Not connected'; label.style.color = 'var(--text-muted)'; }
      });
  }
  pollMcpStatus();
  mcpStatusInterval = setInterval(pollMcpStatus, 10000);

  fetch(BRIDGE + '/api/freeze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list' })
  })
  .then(r => r.json())
  .then(d => {
    if (d.frozenEntries) state.frozenEntries = d.frozenEntries;
    api.refreshState();
  })
  .catch(e => api.refreshState());
  window.addEventListener('scroll', () => {
    if (typeof api.updateSelectionFrame === 'function') api.updateSelectionFrame();
    if (typeof api.renderCommentMarkers === 'function') api.renderCommentMarkers();
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (typeof api.updateSelectionFrame === 'function') api.updateSelectionFrame();
    if (typeof api.renderCommentMarkers === 'function') api.renderCommentMarkers();
  }, { passive: true });

  api.loadComments();

  console.log('[agent-hover] Ready');
}
