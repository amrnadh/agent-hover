// @ts-nocheck
import { getFiberNode } from '../lib/fiber.js';
import type { OverlayApp } from '../app/context.js';

/**
 * Routes bridge WebSocket messages: tasks, comments, frozen components, presence, updates, and the
 * MCP server's requests for screenshots and the mounted component list.
 */
export function setupStateSync(app: OverlayApp) {
  const { BRIDGE, fetch, state, api } = app;
  Object.assign(api, { refreshState });

  /** Load what the bridge already knows: frozen components, tasks, comments. */
  async function refreshState() {
    try {
      const res = await fetch(BRIDGE + '/api/freeze');
      const data = await res.json();
      state.frozenEntries = data.frozenEntries || [];
    } catch (e) {}
    api.refreshTasks();
    api.loadComments();
    api.requestLayout();
  }

  if (state.ws) {
    state.ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.type === 'state-update') {
          state.frozenEntries = payload.data.frozenEntries || [];
          if (payload.data.updateAvailable) api.handleUpdateAvailable(payload.data.updateAvailable);
          if (payload.data.comments) api.setComments(payload.data.comments);
          api.requestLayout();
        } else if (payload.type === 'update-available') {
          api.handleUpdateAvailable(payload.data);
        } else if (payload.type === 'presence.updated') {
          api.setConnectedAgents(payload.data?.agents || []);
        } else if (payload.type === 'task.created' || payload.type === 'task.updated') {
          api.onTaskEvent(payload.data);
        } else if (payload.type === 'source-updated') {
          // HMR follows; markers and frames re-measure on the next layout.
          setTimeout(() => api.requestLayout(), 300);
        } else if (payload.type === 'capture-screenshot') {
          const { requestId, file, component, label, componentId } = payload.data;
          const el = api.findComponentElement(component);
          if (!el) {
            fetch(BRIDGE + '/api/screenshot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: componentId, label: label, dataUrl: 'data:image/png;base64,', requestId: requestId })
            }).catch(e => console.error(e));
            return;
          }
          
          api.captureElement(el).then(async (dataUrl) => {
            if (!dataUrl) {
              fetch(BRIDGE + '/api/screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: componentId, label: label, dataUrl: 'data:image/png;base64,', requestId: requestId })
              }).catch(e => console.error(e));
              return;
            }
            
            const rect = el.getBoundingClientRect();
            const postBody = {
              id: componentId,
              label: label,
              dataUrl: dataUrl,
              boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
              viewport: { width: window.innerWidth, height: window.innerHeight },
              requestId: requestId
            };
            
            fetch(BRIDGE + '/api/screenshot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(postBody)
            }).catch(e => console.error(e));
          });
        } else if (payload.type === 'list-components') {
          // Walk React fiber tree to collect visible components
          const { requestId, filter, limit, includeLibrary } = payload.data || {};
          const maxCount = limit || 50;
          const filterLower = (filter || '').toLowerCase();
          const allComponents = [];

          function walkFiber(fiber, depth) {
            if (!fiber || allComponents.length >= maxCount * 2) return;
            if (fiber.tag === 0 || fiber.tag === 1 || fiber.tag === 11 || fiber.tag === 15) {
              const name = fiber.type?.displayName || fiber.type?.name || '';
              if (name && name !== 'Fragment') {
                // Skip library components unless explicitly included
                const source = fiber._debugSource;
                const fileName = source?.fileName || '';
                if (!includeLibrary && fileName.includes('node_modules')) {
                  // skip
                } else if (!filterLower || name.toLowerCase().includes(filterLower)) {
                  // Get bounding rect from DOM
                  let domNode = null;
                  try {
                    let n = fiber;
                    while (n) {
                      if (n.stateNode && n.stateNode instanceof HTMLElement) { domNode = n.stateNode; break; }
                      n = n.child;
                    }
                  } catch (_) {}
                  const rect = domNode?.getBoundingClientRect?.() || null;
                  allComponents.push({
                    name,
                    file: fileName || undefined,
                    line: source?.lineNumber || undefined,
                    visible: rect ? (rect.width > 0 && rect.height > 0) : undefined,
                    bounds: rect ? { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) } : undefined,
                  });
                }
              }
            }
            if (fiber.child) walkFiber(fiber.child, depth + 1);
            if (fiber.sibling) walkFiber(fiber.sibling, depth);
          }

          // Find React root fiber
          const rootEl = document.getElementById('root') || document.getElementById('app') || document.getElementById('__next') || document.querySelector('[data-reactroot]');
          let rootFiber = null;
          if (rootEl) {
            const containerKey = Object.keys(rootEl).find(k => k.startsWith('__reactContainer'));
            if (containerKey) {
              const container = rootEl[containerKey];
              rootFiber = container?.stateNode?.current?.child || container?.current?.child || container?.child;
            }
            if (!rootFiber && rootEl.firstElementChild) {
              rootFiber = getFiberNode(rootEl.firstElementChild);
              while (rootFiber?.return) rootFiber = rootFiber.return;
            }
            if (!rootFiber) {
              const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
              if (fiberKey) {
                rootFiber = rootEl[fiberKey];
                while (rootFiber?.return) rootFiber = rootFiber.return;
              }
            }
          }
          if (rootFiber) {
            walkFiber(rootFiber, 0);
          }

          const truncated = allComponents.length > maxCount;
          const result = {
            components: allComponents.slice(0, maxCount),
            total: allComponents.length,
            truncated,
          };

          if (state.ws && state.ws.readyState === 1) {
            state.ws.send(JSON.stringify({ type: 'component-list-response', requestId, data: result }));
          }
        }
      } catch (e) {}
    };
  }
}
