import type { OverlayApp } from '../app/context.js';

/** Initial load (frozen components, tasks, comments) and a slow presence refresh so stale agents drop off. */
export function setupStartup(app: OverlayApp) {
  const { BRIDGE, fetch, api } = app;

  api.refreshState();

  setInterval(() => {
    fetch(BRIDGE + '/api/agent/presence')
      .then((r) => r.json())
      .then((d) => api.setConnectedAgents(d.agents || []))
      .catch(() => {});
  }, 15000);

  console.log('[agent-hover] Ready');
}
