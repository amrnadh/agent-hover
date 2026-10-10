// @ts-nocheck
import { ICONS } from '../icons.js';
import { getFiberNode } from '../lib/fiber.js';
import type { OverlayApp } from '../app/context.js';

/** Bridge state refresh and pin-stack rendering. */
export function setupStateSync(app: OverlayApp) {
  const { BRIDGE, fetch, port, shadow, state, dom, api } = app;
  Object.assign(api, { refreshState });

  async function refreshState() {
    try {
      const resPins = await fetch(BRIDGE + '/api/pins');
      const dataPins = await resPins.json();
      state.currentPins = dataPins.pins || [];
      const count = state.currentPins.length;
      shadow.getElementById('cp-pin-count').textContent = count;

      if (count > 0) {
        dom.dockPinBadge.style.display = 'inline-flex';
        dom.dockPinBadge.textContent = count;
      } else {
        dom.dockPinBadge.style.display = 'none';
      }
      if (state.dockController) state.dockController.setPinCount(count);

      const list = shadow.getElementById('cp-pin-list');
      list.innerHTML = '';
      if (dataPins.pins && dataPins.pins.length > 0) {
        dataPins.pins.forEach(function(pin, index) {
          const card = document.createElement('div');
          card.className = 'cp-pin-card';
          const name = pin.context ? pin.context.component.name : pin.id;
          const file = pin.context ? pin.context.source.file.split('/').pop() : '';
          
          const isPinFrozen = state.frozenEntries.some(f => (pin.context && f.file === pin.context.source.file) || f.id === pin.id);
          const lockIcon = isPinFrozen ? '<span style="color:#fb7185; margin-right:4px;">' + ICONS.lock + '</span>' : '';
          
          card.innerHTML =
            '<div class="cp-pin-header">' +
              '<div class="cp-pin-title">' +
                '<span class="cp-pin-badge">#' + (index + 1) + '</span>' +
                '<span>' + lockIcon + '&lt;' + name + ' /&gt;</span>' +
                '<span class="cp-pin-file">' + file + '</span>' +
              '</div>' +
              '<button class="cp-pin-remove" data-id="' + pin.id + '" title="Remove pin">' + ICONS.x + '</button>' +
            '</div>' +
            '<textarea class="cp-pin-textarea" rows="2" placeholder="Task for this component..." data-id="' + pin.id + '">' + (pin.task || '') + '</textarea>';
          list.appendChild(card);
        });

        // Listen for changes/blur on task textareas to update-task
        const textareas = list.querySelectorAll('.cp-pin-textarea');
        textareas.forEach(ta => {
          const saveTask = async () => {
            const id = ta.getAttribute('data-id');
            const p = dataPins.pins.find(x => x.id === id);
            if (p && p.task !== ta.value) {
              p.task = ta.value;
              await fetch(BRIDGE + '/api/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update-task', id, task: ta.value })
              });
            }
          };
          ta.addEventListener('change', saveTask);
          ta.addEventListener('blur', saveTask);
        });

        const removeBtns = list.querySelectorAll('.cp-pin-remove');
        removeBtns.forEach(btn => {
          btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            const p = dataPins.pins.find(x => x.id === id);
            if (p) {
              await fetch(BRIDGE + '/api/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove', file: p.context.source.file, id })
              });
              refreshState();
            }
          };
        });
      } else {
        list.innerHTML = '<div style="font-size:11px; color:var(--text-muted); font-style:italic; padding:6px 0;">No pinned components. Click "Pin Component" on any component to stage changes.</div>';
      }

      const genTaskBtn = shadow.getElementById('cp-gen-task');
      if (dataPins.pins && dataPins.pins.length > 0) {
        if (genTaskBtn) {
          genTaskBtn.style.opacity = '1';
          genTaskBtn.style.pointerEvents = 'auto';
          genTaskBtn.classList.add('primary');
        }
      } else {
        if (genTaskBtn) {
          genTaskBtn.style.opacity = '0.5';
          genTaskBtn.style.pointerEvents = 'none';
          genTaskBtn.classList.remove('primary');
        }
      }

      const savingsDiv = shadow.getElementById('cp-token-savings');
      if (dataPins.pins && dataPins.pins.length > 0 && dataPins.totalTokens) {
        const levelSelect = shadow.getElementById('cp-context-level');
        const level = levelSelect.value;
        const cost = dataPins.totalTokens[level] || dataPins.totalTokens.current;
        
        savingsDiv.style.display = 'block';
        savingsDiv.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Stack: ' + cost.toLocaleString() + ' tokens (' + dataPins.pins.length + ' pinned)';
      } else {
        savingsDiv.style.display = 'none';
      }
    } catch(e) { }
  }

  function refreshPins() {
    refreshState();
  }

  if (state.ws) {
    state.ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.type === 'state-update') {
          state.frozenEntries = payload.data.frozenEntries || [];
          if (payload.data.updateAvailable) {
            api.handleUpdateAvailable(payload.data.updateAvailable);
          }
          if (payload.data.comments) {
            state.comments = payload.data.comments;
            api.renderCommentMarkers();
            api.renderSidebarNotes();
          }
          refreshState();
        } else if (payload.type === 'update-available') {
          api.handleUpdateAvailable(payload.data);
        } else if (payload.type === 'pins-update') {
          refreshState();
        } else if (payload.type === 'presence.updated') {
          state.connectedAgents = payload.data?.agents || [];
          if (state.dockController) {
            state.dockController.updatePresence({
              bridgeOnline: state.isBridgeConnected,
              port,
              agents: state.connectedAgents,
            });
          }
        } else if (payload.type === 'task.updated') {
          const task = payload.data;
          if (task) {
            if (task.status === 'delivered') {
              api.showCallout('Seen by ' + (task.claimedBy || 'agent'), 'INFO', 2000);
            } else if (task.status === 'in_progress') {
              api.showCallout('Working…', 'WORKING', 2500);
            } else if (task.status === 'done') {
              const files = task.result?.filesChanged?.length ? task.result.filesChanged.length + ' files' : 'complete';
              api.showCallout('Done · ' + files, 'SUCCESS', 3000);
            } else if (task.status === 'failed') {
              api.showCallout('Failed: ' + (task.result?.error || 'error'), 'ERROR', 3000);
            }
          }
        } else if (payload.type === 'source-updated') {
          api.showCallout('Source updated: ' + (payload.data.file ? payload.data.file.split('/').pop() : 'file'), 'HMR');
        } else if (payload.type === 'source-reverted') {
          api.showCallout('Source reverted: ' + (payload.data.description || 'change'), 'UNDO');
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
      } catch(e) {}
    };
  }
}
