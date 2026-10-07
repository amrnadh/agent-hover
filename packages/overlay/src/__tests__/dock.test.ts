import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockController } from '../ui/dock.js';

describe('DockController (Gate 2.5 / P2-05 / D-07)', () => {
  let wrapper: HTMLElement;
  let mockShadow: any;
  let onToggleInspect: any;
  let onOpenPins: any;
  let onOpenSettings: any;
  let onCallout: any;
  let controller: DockController;

  function createMockElement(id: string) {
    const el: any = {
      id,
      style: {},
      _classes: new Set<string>(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      closest: vi.fn(() => null),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 20, height: 20 }),
    };
    el.classList = {
      add: (c: string) => el._classes.add(c),
      remove: (...args: string[]) => args.forEach((c) => el._classes.delete(c)),
      contains: (c: string) => el._classes.has(c),
    };
    return el;
  }

  let toggleBtn: any;
  let pinsBtn: any;
  let settingsBtn: any;
  let minimizedBtn: any;
  let minimizedDot: any;
  let hintEl: any;
  let handle: any;
  let dot: any;
  let brand: any;
  let badge: any;
  let dockEl: any;

  beforeEach(() => {
    dockEl = createMockElement('cp-dock');
    toggleBtn = createMockElement('cp-dock-toggle');
    pinsBtn = createMockElement('cp-dock-pins');
    settingsBtn = createMockElement('ah-dock-settings-btn');
    minimizedBtn = createMockElement('ah-dock-minimized');
    minimizedDot = createMockElement('cp-minimized-dot');
    hintEl = createMockElement('ah-first-run-hint');
    handle = createMockElement('cp-dock-handle');
    dot = createMockElement('cp-mcp-dot');
    brand = createMockElement('ah-dock-brand');
    badge = createMockElement('cp-dock-pin-badge');
    badge.textContent = '0';

    wrapper = {
      style: {} as any,
      _classes: new Set<string>(),
      querySelector: (selector: string) => {
        if (selector === '#cp-dock') return dockEl;
        if (selector === '#cp-dock-toggle') return toggleBtn;
        if (selector === '#cp-dock-pins') return pinsBtn;
        if (selector === '#ah-dock-settings-btn') return settingsBtn;
        if (selector === '#ah-dock-minimized') return minimizedBtn;
        if (selector === '#cp-minimized-dot') return minimizedDot;
        if (selector === '#ah-first-run-hint') return hintEl;
        if (selector === '#cp-dock-handle') return handle;
        if (selector === '#cp-mcp-dot') return dot;
        if (selector === '#ah-dock-brand') return brand;
        if (selector === '#cp-dock-pin-badge') return badge;
        return null;
      },
      getBoundingClientRect: () => ({ left: 100, top: 500, width: 280, height: 40 }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    wrapper.classList = {
      add: (c: string) => (wrapper as any)._classes.add(c),
      remove: (c: string) => (wrapper as any)._classes.delete(c),
      contains: (c: string) => (wrapper as any)._classes.has(c),
    } as any;

    mockShadow = {};
    onToggleInspect = vi.fn();
    onOpenPins = vi.fn();
    onOpenSettings = vi.fn();
    onCallout = vi.fn();

    controller = new DockController(wrapper, {
      shadowRoot: mockShadow,
      onToggleInspect,
      onOpenPins,
      onOpenSettings,
      onCallout,
    });
  });

  afterEach(() => {
    controller.destroy();
  });

  it('manages inspect active button state and aria-pressed', () => {
    controller.setInspectActive(true);
    expect(toggleBtn._classes.has('active')).toBe(true);
    expect(toggleBtn.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');

    controller.setInspectActive(false);
    expect(toggleBtn._classes.has('active')).toBe(false);
    expect(toggleBtn.setAttribute).toHaveBeenCalledWith('aria-pressed', 'false');
  });

  it('manages active tabs according to single responsibility rule (A.1)', () => {
    // Pins tab active
    controller.setActiveTab('pins');
    expect(controller.getActiveTab()).toBe('pins');
    expect(pinsBtn._classes.has('active')).toBe(true);
    expect(pinsBtn.setAttribute).toHaveBeenCalledWith('aria-selected', 'true');
    expect(settingsBtn._classes.has('active')).toBe(false);

    // Switch to Settings tab
    controller.setActiveTab('settings');
    expect(controller.getActiveTab()).toBe('settings');
    expect(pinsBtn._classes.has('active')).toBe(false);
    expect(pinsBtn.setAttribute).toHaveBeenCalledWith('aria-selected', 'false');
    expect(settingsBtn._classes.has('active')).toBe(true);
    expect(settingsBtn.setAttribute).toHaveBeenCalledWith('aria-selected', 'true');

    // Deselect all (sidebar closed)
    controller.setActiveTab(null);
    expect(controller.getActiveTab()).toBe(null);
    expect(pinsBtn._classes.has('active')).toBe(false);
    expect(settingsBtn._classes.has('active')).toBe(false);
  });

  it('manages dock minimization and restoration (A.6)', () => {
    expect(controller.getIsMinimized()).toBe(false);

    controller.setMinimized(true);
    expect(controller.getIsMinimized()).toBe(true);
    expect(dockEl.style.display).toBe('none');
    expect(minimizedBtn.style.display).toBe('flex');
    expect(onCallout).toHaveBeenCalledWith(expect.stringContaining('minimized'), 'MINIMIZED', expect.any(Number));

    controller.setMinimized(false);
    expect(controller.getIsMinimized()).toBe(false);
    expect(dockEl.style.display).toBe('flex');
    expect(minimizedBtn.style.display).toBe('none');
    expect(onCallout).toHaveBeenCalledWith(expect.stringContaining('restored'), 'RESTORED', expect.any(Number));
  });

  it('resets dock position to bottom-center with safe area (B)', () => {
    controller.resetPosition();
    expect(wrapper.style.left).toBe('50%');
    expect(wrapper.style.transform).toBe('translateX(-50%)');
    expect(wrapper.style.bottom).toContain('safe-area-inset-bottom');
    expect(onCallout).toHaveBeenCalledWith(expect.stringContaining('reset'), 'DEFAULT', expect.any(Number));
  });

  it('updates pin count and triggers animated badge', () => {
    controller.setPinCount(3);
    expect(badge.textContent).toBe('3');
    expect(badge.style.display).toBe('inline-block');
    expect(badge._classes.has('has-update')).toBe(true);

    controller.setPinCount(0);
    expect(badge.style.display).toBe('none');
    expect(badge.textContent).toBe('0');
  });

  describe('presence updates and status dot (P2-05 AC)', () => {
    it('sets disconnected status when bridge is offline', () => {
      controller.updatePresence({ bridgeOnline: false, port: 4400, agents: [] });
      expect(dot._classes.has('status-disconnected')).toBe(true);
      expect(dot.title).toBe('Bridge offline');
    });

    it('sets amber status when bridge is online but no agents connected', () => {
      controller.updatePresence({ bridgeOnline: true, port: 4400, agents: [] });
      expect(dot._classes.has('status-bridge-only')).toBe(true);
      expect(dot.title).toBe('Bridge :4400 · No agent connected');
    });

    it('sets green status when bridge is online and agent is connected', () => {
      controller.updatePresence({
        bridgeOnline: true,
        port: 4400,
        agents: [{ client: 'Claude Code', version: '1.0' }],
      });
      expect(dot._classes.has('status-active')).toBe(true);
      expect(dot.title).toBe('Bridge :4400 · Claude Code');
    });
  });

  it('toggles visibility and invokes callout', () => {
    expect(controller.getIsVisible()).toBe(true);

    controller.toggleVisibility(false);
    expect(controller.getIsVisible()).toBe(false);
    expect((wrapper as any)._classes.has('is-hidden')).toBe(true);
    expect(onCallout).toHaveBeenCalledWith(expect.stringContaining('hidden'), 'HIDE', expect.any(Number));

    controller.toggleVisibility(true);
    expect(controller.getIsVisible()).toBe(true);
    expect((wrapper as any)._classes.has('is-hidden')).toBe(false);
    expect(onCallout).toHaveBeenCalledWith(expect.stringContaining('visible'), 'DOCK', expect.any(Number));
  });
});
