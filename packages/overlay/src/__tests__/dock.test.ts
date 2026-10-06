import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockController } from '../ui/dock.js';

describe('DockController (P2-05 / D-07)', () => {
  let wrapper: HTMLElement;
  let mockShadow: any;
  let onToggleInspect: any;
  let onOpenPins: any;
  let onOpenSettings: any;
  let onCallout: any;
  let controller: DockController;

  beforeEach(() => {
    wrapper = {
      classList: new Set<string>(),
      style: {} as any,
      querySelector: (selector: string) => {
        if (selector === '#cp-dock-toggle') return toggleBtn;
        if (selector === '#cp-dock-pins') return pinsBtn;
        if (selector === '#ah-dock-settings-btn') return settingsBtn;
        if (selector === '#ah-dock-dismiss') return dismissBtn;
        if (selector === '#cp-dock-handle') return handle;
        if (selector === '#cp-mcp-dot') return dot;
        if (selector === '#ah-dock-brand') return brand;
        if (selector === '#cp-dock-pin-badge') return badge;
        return null;
      },
      getBoundingClientRect: () => ({ left: 100, top: 500, width: 280, height: 40 }),
    } as any;

    wrapper.classList = {
      add: (c: string) => (wrapper as any)._classes.add(c),
      remove: (c: string) => (wrapper as any)._classes.delete(c),
      contains: (c: string) => (wrapper as any)._classes.has(c),
    } as any;
    (wrapper as any)._classes = new Set<string>();

    const toggleBtn: any = {
      classList: new Set<string>(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
    };
    toggleBtn.classList = {
      add: (c: string) => toggleBtn._classes.add(c),
      remove: (c: string) => toggleBtn._classes.delete(c),
      contains: (c: string) => toggleBtn._classes.has(c),
    };
    toggleBtn._classes = new Set<string>();

    const pinsBtn: any = {};
    const settingsBtn: any = {};
    const dismissBtn: any = {};
    const handle: any = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const dot: any = {
      classList: new Set<string>(),
      title: '',
    };
    dot.classList = {
      add: (c: string) => dot._classes.add(c),
      remove: (...args: string[]) => args.forEach((c) => dot._classes.delete(c)),
      contains: (c: string) => dot._classes.has(c),
    };
    dot._classes = new Set<string>();

    const brand: any = { title: '' };

    const badge: any = {
      style: {},
      textContent: '0',
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

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
    const toggleBtn = wrapper.querySelector('#cp-dock-toggle') as any;

    controller.setInspectActive(true);
    expect(toggleBtn._classes.has('active')).toBe(true);
    expect(toggleBtn.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');

    controller.setInspectActive(false);
    expect(toggleBtn._classes.has('active')).toBe(false);
    expect(toggleBtn.setAttribute).toHaveBeenCalledWith('aria-pressed', 'false');
  });

  it('updates pin count and triggers animated badge', () => {
    const badge = wrapper.querySelector('#cp-dock-pin-badge') as any;

    controller.setPinCount(3);
    expect(badge.textContent).toBe('3');
    expect(badge.style.display).toBe('inline-block');
    expect(badge.classList.add).toHaveBeenCalledWith('has-update');

    controller.setPinCount(0);
    expect(badge.style.display).toBe('none');
    expect(badge.textContent).toBe('0');
  });

  describe('presence updates and status dot (P2-05 AC)', () => {
    it('sets disconnected status when bridge is offline', () => {
      const dot = wrapper.querySelector('#cp-mcp-dot') as any;

      controller.updatePresence({ bridgeOnline: false, port: 4400, agents: [] });
      expect(dot._classes.has('status-disconnected')).toBe(true);
      expect(dot.title).toBe('Bridge offline');
    });

    it('sets amber status when bridge is online but no agents connected', () => {
      const dot = wrapper.querySelector('#cp-mcp-dot') as any;

      controller.updatePresence({ bridgeOnline: true, port: 4400, agents: [] });
      expect(dot._classes.has('status-bridge-only')).toBe(true);
      expect(dot.title).toBe('Bridge :4400 · No agent connected');
    });

    it('sets green status when bridge is online and agent is connected', () => {
      const dot = wrapper.querySelector('#cp-mcp-dot') as any;

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
