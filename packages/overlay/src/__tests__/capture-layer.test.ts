import { describe, it, expect, vi } from 'vitest';
import { isOverlayNode, isScrollable, findScrollableAncestor, CaptureLayer } from '../ui/capture-layer.js';

describe('CaptureLayer (P2-03)', () => {
  describe('isOverlayNode', () => {
    it('identifies shadowRoot and host element as overlay nodes', () => {
      const mockShadowRoot: any = { host: {} };
      expect(isOverlayNode(mockShadowRoot, mockShadowRoot)).toBe(true);
      expect(isOverlayNode(mockShadowRoot.host, mockShadowRoot)).toBe(true);
    });

    it('identifies nodes inside shadowRoot as overlay nodes', () => {
      const mockShadowRoot: any = { host: {} };
      const child: any = {
        id: 'child-el',
        getRootNode: () => mockShadowRoot,
        closest: () => null,
      };
      expect(isOverlayNode(child, mockShadowRoot)).toBe(true);
    });

    it('identifies #ah-capture-layer as overlay node', () => {
      const mockShadowRoot: any = { host: {} };
      const captureEl: any = {
        id: 'ah-capture-layer',
        getRootNode: () => ({}),
        closest: () => null,
      };
      expect(isOverlayNode(captureEl, mockShadowRoot)).toBe(true);
    });

    it('returns false for host application elements', () => {
      const mockShadowRoot: any = { host: {} };
      const hostAppEl: any = {
        id: 'my-app-button',
        getRootNode: () => ({}),
        closest: () => null,
      };
      expect(isOverlayNode(hostAppEl, mockShadowRoot)).toBe(false);
    });

    it('returns false for null/undefined nodes', () => {
      const mockShadowRoot: any = { host: {} };
      expect(isOverlayNode(null, mockShadowRoot)).toBe(false);
    });
  });

  describe('isScrollable and findScrollableAncestor', () => {
    it('detects vertically scrollable element', () => {
      // Mock window.getComputedStyle
      const originalGetComputedStyle = (globalThis as any).window?.getComputedStyle;
      (globalThis as any).window = (globalThis as any).window || {};
      (globalThis as any).window.getComputedStyle = () => ({
        overflowY: 'auto',
        overflowX: 'hidden',
      });

      const container: any = {
        scrollHeight: 500,
        clientHeight: 200,
        scrollTop: 0,
        scrollWidth: 100,
        clientWidth: 100,
        scrollLeft: 0,
      };

      expect(isScrollable(container, 0, 50)).toBe(true);
      expect(isScrollable(container, 0, -50)).toBe(false); // At top, cannot scroll up

      if (originalGetComputedStyle) {
        (globalThis as any).window.getComputedStyle = originalGetComputedStyle;
      }
    });

    it('finds scrollable ancestor in hierarchy', () => {
      (globalThis as any).window = (globalThis as any).window || {};
      (globalThis as any).window.getComputedStyle = (el: any) => ({
        overflowY: el === outerScroll ? 'scroll' : 'visible',
        overflowX: 'visible',
      });

      const outerScroll: any = {
        scrollHeight: 1000,
        clientHeight: 300,
        scrollTop: 10,
        parentElement: null,
      };

      const middle: any = {
        scrollHeight: 300,
        clientHeight: 300,
        scrollTop: 0,
        parentElement: outerScroll,
      };

      const target: any = {
        parentElement: middle,
      };

      const found = findScrollableAncestor(target, 0, 10);
      expect(found).toBe(outerScroll);
    });

    it('falls back to window when no ancestor is scrollable', () => {
      (globalThis as any).window = (globalThis as any).window || {};
      (globalThis as any).window.getComputedStyle = () => ({
        overflowY: 'visible',
        overflowX: 'visible',
      });

      const middle: any = {
        scrollHeight: 300,
        clientHeight: 300,
        scrollTop: 0,
        parentElement: null,
      };

      const target: any = {
        parentElement: middle,
      };

      const found = findScrollableAncestor(target, 0, 10);
      expect(found).toBe((globalThis as any).window);
    });
  });

  describe('CaptureLayer lifecycle and passthrough', () => {
    it('toggles active state and manages classList', () => {
      const classes = new Set<string>();
      const layerEl: any = {
        classList: {
          add: (c: string) => classes.add(c),
          remove: (c: string) => classes.delete(c),
          contains: (c: string) => classes.has(c),
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const mockShadowRoot: any = { host: {} };
      const onHover = vi.fn();
      const onSelect = vi.fn();

      const layer = new CaptureLayer(layerEl, {
        shadowRoot: mockShadowRoot,
        onHover,
        onSelect,
      });

      expect(layer.getIsActive()).toBe(false);
      expect(classes.has('is-active')).toBe(false);

      layer.setActive(true);
      expect(layer.getIsActive()).toBe(true);
      expect(classes.has('is-active')).toBe(true);

      layer.setActive(false);
      expect(layer.getIsActive()).toBe(false);
      expect(classes.has('is-active')).toBe(false);

      layer.destroy();
    });

    it('toggles passthrough mode and resets hover preview', () => {
      const classes = new Set<string>();
      const layerEl: any = {
        classList: {
          add: (c: string) => classes.add(c),
          remove: (c: string) => classes.delete(c),
          contains: (c: string) => classes.has(c),
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const mockShadowRoot: any = { host: {} };
      const onHover = vi.fn();
      const onSelect = vi.fn();

      const layer = new CaptureLayer(layerEl, {
        shadowRoot: mockShadowRoot,
        onHover,
        onSelect,
      });

      layer.setActive(true);
      expect(layer.getIsPassthrough()).toBe(false);

      layer.setPassthrough(true);
      expect(layer.getIsPassthrough()).toBe(true);
      expect(classes.has('is-passthrough')).toBe(true);
      expect(onHover).toHaveBeenCalledWith(null, expect.anything());

      layer.setPassthrough(false);
      expect(layer.getIsPassthrough()).toBe(false);
      expect(classes.has('is-passthrough')).toBe(false);

      layer.destroy();
    });
  });
});
