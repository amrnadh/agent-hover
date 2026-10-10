// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Sidebar tab/view switching, docked vs floating mode, and floating-panel dragging. */
export function setupSidebar(app: OverlayApp) {
  const { shadow, state, dom, api } = app;
  Object.assign(api, { setSidebarTab, toggleSettingsView });

  // Sidebar Tab & View Switcher (A.1, A.4, A.5)
  state.currentSidebarTab = null;
  state.inSettingsView = false;

  function setSidebarTab(tab: 'inspector' | 'pins' | 'settings' | null) {
    state.currentSidebarTab = tab;
    state.inSettingsView = (tab === 'settings');

    if (!tab) {
      dom.flyout.classList.remove('open');
      dom.dockWrapper.classList.remove('sidebar-open');
      if (state.dockController) state.dockController.setActiveTab(null);
      return;
    }

    dom.flyout.classList.add('open');
    if (dom.flyout.classList.contains('is-sidebar')) {
      dom.dockWrapper.classList.add('sidebar-open');
    }
    if (state.dockController) state.dockController.setActiveTab(tab);

    const flyoutSubtitle = shadow.getElementById('cp-flyout-subtitle');

    if (tab === 'inspector') {
      if (dom.viewInspector) dom.viewInspector.style.display = 'flex';
      if (dom.viewPins) dom.viewPins.style.display = 'none';
      if (dom.viewSettings) dom.viewSettings.style.display = 'none';
      if (dom.flyoutBadge) dom.flyoutBadge.style.display = 'inline-flex';
      if (dom.settingsBackBtn) dom.settingsBackBtn.style.display = 'none';
      if (dom.flyoutThemeBtn) dom.flyoutThemeBtn.style.display = 'inline-flex';
      if (dom.flyoutSettingsBtn) {
        dom.flyoutSettingsBtn.style.display = 'inline-flex';
        dom.flyoutSettingsBtn.classList.remove('active');
      }
      if (dom.flyoutTitle) dom.flyoutTitle.textContent = state.lastInfoName || 'Component Inspector';
      if (flyoutSubtitle && flyoutSubtitle.textContent) flyoutSubtitle.style.display = 'block';
    } else if (tab === 'pins') {
      if (dom.viewInspector) dom.viewInspector.style.display = 'none';
      if (dom.viewPins) dom.viewPins.style.display = 'flex';
      if (dom.viewSettings) dom.viewSettings.style.display = 'none';
      if (dom.flyoutBadge) dom.flyoutBadge.style.display = 'none';
      if (dom.settingsBackBtn) dom.settingsBackBtn.style.display = 'none';
      if (dom.flyoutThemeBtn) dom.flyoutThemeBtn.style.display = 'none';
      if (dom.flyoutSettingsBtn) dom.flyoutSettingsBtn.style.display = 'none';
      if (dom.flyoutTitle) dom.flyoutTitle.textContent = 'Pinned Stack';
      if (flyoutSubtitle) flyoutSubtitle.style.display = 'none';
    } else if (tab === 'settings') {
      if (dom.viewInspector) dom.viewInspector.style.display = 'none';
      if (dom.viewPins) dom.viewPins.style.display = 'none';
      if (dom.viewSettings) dom.viewSettings.style.display = 'flex';
      if (dom.flyoutBadge) dom.flyoutBadge.style.display = 'none';
      if (dom.settingsBackBtn) dom.settingsBackBtn.style.display = 'inline-flex';
      if (dom.flyoutThemeBtn) dom.flyoutThemeBtn.style.display = 'none';
      if (dom.flyoutSettingsBtn) dom.flyoutSettingsBtn.style.display = 'none';
      if (dom.flyoutTitle) dom.flyoutTitle.textContent = 'Settings';
      if (flyoutSubtitle) flyoutSubtitle.style.display = 'none';
    }
  }

  function toggleSettingsView(force?: boolean) {
    if (typeof force === 'boolean') {
      setSidebarTab(force ? 'settings' : 'inspector');
    } else {
      setSidebarTab(state.currentSidebarTab === 'settings' ? null : 'settings');
    }
  }

  if (dom.flyoutSettingsBtn) {
    dom.flyoutSettingsBtn.onclick = () => {
      if (state.currentSidebarTab === 'settings') {
        setSidebarTab(null);
      } else {
        setSidebarTab('settings');
      }
    };
  }
  if (dom.settingsBackBtn) {
    dom.settingsBackBtn.onclick = () => setSidebarTab('inspector');
  }
  if (dom.settingsMinimizeBtn) {
    dom.settingsMinimizeBtn.onclick = () => {
      if (state.dockController) state.dockController.setMinimized(true);
    };
  }
  if (dom.settingsResetPosBtn) {
    dom.settingsResetPosBtn.onclick = () => {
      if (state.dockController) state.dockController.resetPosition();
    };
  }

  // Flyout Sidebar Mode Switcher & Draggable Floating Panel
  const flyoutModeToggle = shadow.getElementById('cp-flyout-mode-toggle');
  const modeSidebarIcon = shadow.getElementById('cp-mode-sidebar-icon');
  const modeFloatIcon = shadow.getElementById('cp-mode-float-icon');
  const flyoutHeader = shadow.getElementById('cp-flyout-header');

  // Requirement 4: The sidebar by default should be attached for now.
  let flyoutMode = 'sidebar';
  try {
    flyoutMode = localStorage.getItem('agent-hover-flyout-mode-v2') || 'sidebar';
  } catch(e) {}

  function applyFlyoutMode(mode) {
    flyoutMode = mode;
    try {
      localStorage.setItem('agent-hover-flyout-mode-v2', mode);
    } catch(e) {}

    if (mode === 'sidebar') {
      dom.flyout.classList.add('is-sidebar');
      dom.flyout.style.left = '';
      dom.flyout.style.top = '';
      dom.flyout.style.right = '';
      dom.flyout.style.bottom = '';
      if (flyoutHeader) flyoutHeader.style.cursor = 'default';
      if (modeSidebarIcon) modeSidebarIcon.style.display = 'none';
      if (modeFloatIcon) modeFloatIcon.style.display = 'block';
      if (flyoutModeToggle) flyoutModeToggle.setAttribute('title', 'Detach Sidebar (Float Window)');
      if (dom.flyout.classList.contains('open')) {
        dom.dockWrapper.classList.add('sidebar-open');
      }
    } else {
      dom.flyout.classList.remove('is-sidebar');
      if (flyoutHeader) flyoutHeader.style.cursor = 'grab';
      if (modeSidebarIcon) modeSidebarIcon.style.display = 'block';
      if (modeFloatIcon) modeFloatIcon.style.display = 'none';
      if (flyoutModeToggle) flyoutModeToggle.setAttribute('title', 'Attach Sidebar (Dock to Edge)');
      dom.dockWrapper.classList.remove('sidebar-open');

      // Position screen-friendly within viewport
      try {
        const savedFlyoutPos = localStorage.getItem('agent_hover_flyout_pos');
        if (savedFlyoutPos) {
          const parsed = JSON.parse(savedFlyoutPos);
          const fW = 440;
          const fH = 600;
          const maxLeft = Math.max(12, window.innerWidth - fW - 12);
          const maxTop = Math.max(12, window.innerHeight - fH - 12);
          const clampedLeft = Math.max(12, Math.min(maxLeft, parseInt(parsed.left, 10) || maxLeft));
          const clampedTop = Math.max(12, Math.min(maxTop, parseInt(parsed.top, 10) || 60));
          dom.flyout.style.left = clampedLeft + 'px';
          dom.flyout.style.top = clampedTop + 'px';
          dom.flyout.style.right = 'auto';
        } else {
          const defaultLeft = Math.max(12, window.innerWidth - 440 - 24);
          dom.flyout.style.left = defaultLeft + 'px';
          dom.flyout.style.top = '60px';
          dom.flyout.style.right = 'auto';
        }
      } catch(e) {
        dom.flyout.style.left = Math.max(12, window.innerWidth - 440 - 24) + 'px';
        dom.flyout.style.top = '60px';
        dom.flyout.style.right = 'auto';
      }
    }
  }

  applyFlyoutMode(flyoutMode);

  if (flyoutModeToggle) {
    flyoutModeToggle.onclick = () => {
      applyFlyoutMode(flyoutMode === 'sidebar' ? 'float' : 'sidebar');
      api.showCallout(flyoutMode === 'sidebar' ? 'Sidebar: Attached' : 'Sidebar: Detached & Draggable', 'MODE');
    };
  }

  // Detached Draggable Flyout Mechanics (Requirements 2 & 5)
  let isFlyoutDragging = false;
  let flyoutDragStartX = 0;
  let flyoutDragStartY = 0;
  let flyoutInitialTop = 0;
  let flyoutInitialLeft = 0;

  if (flyoutHeader) {
    flyoutHeader.addEventListener('mousedown', (e) => {
      if (dom.flyout.classList.contains('is-sidebar')) return;
      if (e.target.closest('button') || e.target.closest('.cp-dock-tile') || e.target.closest('select') || e.target.closest('input')) return;

      isFlyoutDragging = true;
      flyoutDragStartX = e.clientX;
      flyoutDragStartY = e.clientY;
      const rect = dom.flyout.getBoundingClientRect();
      flyoutInitialTop = rect.top;
      flyoutInitialLeft = rect.left;
      flyoutHeader.style.cursor = 'grabbing';
      e.preventDefault();
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (!isFlyoutDragging || dom.flyout.classList.contains('is-sidebar')) return;
    const fW = dom.flyout.offsetWidth || 440;
    const fH = dom.flyout.offsetHeight || 600;
    const newLeft = flyoutInitialLeft + (e.clientX - flyoutDragStartX);
    const newTop = flyoutInitialTop + (e.clientY - flyoutDragStartY);
    const maxLeft = Math.max(12, window.innerWidth - fW - 12);
    const maxTop = Math.max(12, window.innerHeight - fH - 12);
    const clampedLeft = Math.max(12, Math.min(maxLeft, newLeft));
    const clampedTop = Math.max(12, Math.min(maxTop, newTop));
    dom.flyout.style.left = clampedLeft + 'px';
    dom.flyout.style.top = clampedTop + 'px';
    dom.flyout.style.right = 'auto';
    dom.flyout.style.bottom = 'auto';
  });

  window.addEventListener('mouseup', () => {
    if (!isFlyoutDragging) return;
    isFlyoutDragging = false;
    if (flyoutHeader && !dom.flyout.classList.contains('is-sidebar')) {
      flyoutHeader.style.cursor = 'grab';
    }
    try {
      localStorage.setItem('agent_hover_flyout_pos', JSON.stringify({
        left: dom.flyout.style.left,
        top: dom.flyout.style.top
      }));
    } catch(e) {}
  });

  // Window resize bounds keeper
  window.addEventListener('resize', () => {
    if (dom.flyout.classList.contains('is-sidebar')) return;
    const rect = dom.flyout.getBoundingClientRect();
    const fW = rect.width || 440;
    const fH = rect.height || 600;
    const maxLeft = Math.max(12, window.innerWidth - fW - 12);
    const maxTop = Math.max(12, window.innerHeight - fH - 12);
    if (rect.left > maxLeft || rect.top > maxTop) {
      dom.flyout.style.left = Math.max(12, Math.min(maxLeft, rect.left)) + 'px';
      dom.flyout.style.top = Math.max(12, Math.min(maxTop, rect.top)) + 'px';
      dom.flyout.style.right = 'auto';
    }
  });
}
