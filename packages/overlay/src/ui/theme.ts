// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Theme management: system / dark / light with manual override. */
export function setupTheme(app: OverlayApp) {
  const { shadow, dom, api } = app;

  // Theme toggle (dark/light mode)
  const themeToggle = shadow.getElementById('cp-flyout-theme');
  const themeIconDark = shadow.getElementById('cp-theme-icon-dark');
  const themeIconLight = shadow.getElementById('cp-theme-icon-light');
  // Theme Management (P2-04: prefers-color-scheme with manual override)
  let storedTheme = 'system';
  try {
    storedTheme = localStorage.getItem('agent-hover-theme') || 'system';
  } catch(e) {}

  const systemDarkMedia = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function resolveIsLight() {
    if (storedTheme === 'light') return true;
    if (storedTheme === 'dark') return false;
    // system mode
    return !!(systemDarkMedia && systemDarkMedia.matches);
  }

  let isLightMode = resolveIsLight();

  function applyTheme() {
    isLightMode = resolveIsLight();
    if (isLightMode) {
      shadow.host.classList.add('light-mode');
      if (themeIconDark) themeIconDark.style.display = 'none';
      if (themeIconLight) themeIconLight.style.display = 'block';
    } else {
      shadow.host.classList.remove('light-mode');
      if (themeIconDark) themeIconDark.style.display = 'block';
      if (themeIconLight) themeIconLight.style.display = 'none';
    }

    if (storedTheme === 'system') {
      if (dom.themeSetSystem) dom.themeSetSystem.classList.add('primary');
      if (dom.themeSetDark) dom.themeSetDark.classList.remove('primary');
      if (dom.themeSetLight) dom.themeSetLight.classList.remove('primary');
    } else if (storedTheme === 'dark') {
      if (dom.themeSetSystem) dom.themeSetSystem.classList.remove('primary');
      if (dom.themeSetDark) dom.themeSetDark.classList.add('primary');
      if (dom.themeSetLight) dom.themeSetLight.classList.remove('primary');
    } else if (storedTheme === 'light') {
      if (dom.themeSetSystem) dom.themeSetSystem.classList.remove('primary');
      if (dom.themeSetDark) dom.themeSetDark.classList.remove('primary');
      if (dom.themeSetLight) dom.themeSetLight.classList.add('primary');
    }
  }
  applyTheme();

  if (systemDarkMedia && typeof systemDarkMedia.addEventListener === 'function') {
    systemDarkMedia.addEventListener('change', () => {
      if (storedTheme === 'system') {
        applyTheme();
      }
    });
  }

  if (themeToggle) {
    themeToggle.onclick = () => {
      storedTheme = isLightMode ? 'dark' : 'light';
      try { localStorage.setItem('agent-hover-theme', storedTheme); } catch(e) {}
      applyTheme();
      api.showCallout(isLightMode ? 'Light mode' : 'Dark mode', 'THEME');
    };
  }
  if (dom.themeSetDark) {
    dom.themeSetDark.onclick = () => {
      storedTheme = 'dark';
      try { localStorage.setItem('agent-hover-theme', 'dark'); } catch(e) {}
      applyTheme();
      api.showCallout('Dark mode', 'THEME');
    };
  }
  if (dom.themeSetLight) {
    dom.themeSetLight.onclick = () => {
      storedTheme = 'light';
      try { localStorage.setItem('agent-hover-theme', 'light'); } catch(e) {}
      applyTheme();
      api.showCallout('Light mode', 'THEME');
    };
  }
  if (dom.themeSetSystem) {
    dom.themeSetSystem.onclick = () => {
      storedTheme = 'system';
      try { localStorage.setItem('agent-hover-theme', 'system'); } catch(e) {}
      applyTheme();
      api.showCallout('System mode', 'THEME');
    };
  }

  const flyoutCloseBtn = shadow.getElementById('cp-flyout-close');
  if (flyoutCloseBtn) {
    flyoutCloseBtn.onclick = () => {
      api.setSidebarTab(null);
    };
  }
}
