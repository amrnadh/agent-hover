// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Dock orientation controls and host-offset geometry helper. */
export function setupDockLayout(app: OverlayApp) {
  const { container, dom, api } = app;
  Object.assign(api, { getHostOffset });

  function updateDockOrientation() {
    const rect = dom.dockWrapper.getBoundingClientRect();
    const isRight = (rect.left + rect.width / 2) > (window.innerWidth / 2);
    if (isRight) {
      dom.dockWrapper.classList.add('cp-dock-right');
    } else {
      dom.dockWrapper.classList.remove('cp-dock-right');
    }

    const isBottom = (rect.top + rect.height / 2) > (window.innerHeight / 2);
    if (isBottom) {
      dom.dockWrapper.classList.add('cp-dock-bottom');
    } else {
      dom.dockWrapper.classList.remove('cp-dock-bottom');
    }
  }

  // Host offset for coordinate calculations inside reparented dialogs (C)
  function getHostOffset() {
    if (!container) return { x: 0, y: 0 };
    const r = container.getBoundingClientRect();
    return { x: r.left || 0, y: r.top || 0 };
  }

  // Dock Orientation Controller
  let currentDockOrient = 'vertical';
  try {
    currentDockOrient = localStorage.getItem('agent-hover-dock-orient') || 'vertical';
  } catch(e) {}

  function applyDockOrientation(orient) {
    currentDockOrient = orient;
    try { localStorage.setItem('agent-hover-dock-orient', orient); } catch(e) {}
    if (orient === 'horizontal') {
      dom.dockWrapper.classList.add('cp-dock-horizontal');
      if (dom.dockOrientHoriz) dom.dockOrientHoriz.classList.add('primary');
      if (dom.dockOrientVert) dom.dockOrientVert.classList.remove('primary');
    } else {
      dom.dockWrapper.classList.remove('cp-dock-horizontal');
      if (dom.dockOrientVert) dom.dockOrientVert.classList.add('primary');
      if (dom.dockOrientHoriz) dom.dockOrientHoriz.classList.remove('primary');
    }
  }
  applyDockOrientation(currentDockOrient);

  if (dom.dockOrientVert) {
    dom.dockOrientVert.onclick = () => {
      applyDockOrientation('vertical');
      api.showCallout('Dock: Vertical', 'DOCK');
    };
  }
  if (dom.dockOrientHoriz) {
    dom.dockOrientHoriz.onclick = () => {
      applyDockOrientation('horizontal');
      api.showCallout('Dock: Horizontal', 'DOCK');
    };
  }
}
