// @ts-nocheck
import { DockController } from '../ui/dock.js';
import type { OverlayApp } from '../app/context.js';

/** Inspect (pointer) mode toggle and dock controller wiring. */
export function setupInspectMode(app: OverlayApp) {
  const { port, shadow, state, dom, api } = app;
  Object.assign(api, { togglePointerMode });

  function updateInspectorCursor(active) {
    // Clean isolation: never inject into document.head or modify document.documentElement (F-07).
    // Cursor will be applied cleanly to the shadow root capture layer in P2-03.
  }

  function togglePointerMode() {
    state.isPointerMode = !state.isPointerMode;
    if (state.dockController) state.dockController.setInspectActive(state.isPointerMode);
    if (state.isPointerMode) {
      dom.dockToggle.classList.add('active');
      api.showCallout('Inspector Active', 'Alt', 2200);
      updateInspectorCursor(true);
      if (state.captureLayer) state.captureLayer.setActive(true);
      console.log('[agent-hover] Pointer mode ON');
    } else {
      dom.dockToggle.classList.remove('active');
      api.showCallout('Inspector Paused', 'OFF', 1500);
      updateInspectorCursor(false);
      if (state.captureLayer) state.captureLayer.setActive(false);
      dom.highlight.style.display = 'none';
      if (typeof api.clearSelection === 'function') api.clearSelection();
      api.hideBands();
      api.clearDistanceGuides();
      api.closeTextEditor();
      state.selectedRect = null;
      state.currentComponentInfo = null;
      state.currentElement = null;
      state.currentStack = [];
      state.currentStackIndex = -1;
      console.log('[agent-hover] Pointer mode OFF');
    }
  }

  if (dom.dockWrapper) {
    state.dockController = new DockController(dom.dockWrapper, {
      shadowRoot: shadow,
      onToggleInspect: () => togglePointerMode(),
      onOpenPins: () => {
        if (state.currentSidebarTab === 'pins') {
          api.setSidebarTab(null);
        } else {
          api.setSidebarTab('pins');
        }
      },
      onOpenSettings: () => {
        if (state.currentSidebarTab === 'settings') {
          api.setSidebarTab(null);
        } else {
          api.setSidebarTab('settings');
        }
      },
      onCallout: (text, meta, duration) => api.showCallout(text, meta, duration),
    });
    state.dockController.updatePresence({
      bridgeOnline: state.isBridgeConnected,
      port,
      agents: state.connectedAgents,
    });
  }
}
