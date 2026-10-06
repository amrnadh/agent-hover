/**
 * CaptureLayer: Dedicated full-viewport transparent layer for inspection mode.
 *
 * Implements P2-03 (F-06):
 * - Mounted inside Shadow Root only during inspect mode.
 * - Uses document.elementsFromPoint() to identify host elements while skipping Agent Hover UI.
 * - Passthrough modifier (Shift key) sets pointer-events: none so host page works normally.
 * - Forwards wheel events to the nearest scrollable ancestor so pages can be scrolled while inspecting.
 * - Zero event interception on the host window when inspect mode is inactive.
 *
 * NOTE ON LIMITATION:
 * Hover-driven host styles (CSS :hover rules on host elements) will not trigger while the capture
 * layer is active, because pointer events are intercepted by the capture layer. Holding Shift
 * enables passthrough mode and restores host :hover states.
 */

export interface CaptureLayerOptions {
  shadowRoot: ShadowRoot;
  onHover: (target: Element | null, event: MouseEvent) => void;
  onSelect: (target: Element, event: MouseEvent) => void;
  onDblClick?: (target: Element, event: MouseEvent) => void;
  passthroughKey?: string; // Default: 'Shift'
}

function createSyntheticMouseEvent(type: string, clientX: number, clientY: number): MouseEvent {
  if (typeof MouseEvent !== 'undefined') {
    return new MouseEvent(type, { clientX, clientY });
  }
  return { type, clientX, clientY } as any;
}

export function isOverlayNode(node: Node | null, shadowRoot: ShadowRoot): boolean {
  if (!node) return false;
  if (node === shadowRoot || (shadowRoot && node === shadowRoot.host)) return true;
  const isEl = typeof Element !== 'undefined' ? node instanceof Element : (node && typeof (node as any).getAttribute === 'function');
  if (isEl || (node && typeof (node as any).id === 'string')) {
    const el = node as any;
    if (el.id === 'agent-hover-root') return true;
    if (typeof el.closest === 'function' && el.closest('#agent-hover-root')) return true;
    if (el.id === 'ah-capture-layer') return true;
    if (typeof el.getRootNode === 'function' && el.getRootNode() === shadowRoot) return true;
  }
  return false;
}

export function isScrollable(el: HTMLElement, deltaX: number, deltaY: number): boolean {
  const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
  if (!win || !win.getComputedStyle) return false;
  const style = win.getComputedStyle(el);
  const canScrollY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
  const canScrollX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;

  if (deltaY !== 0 && canScrollY) {
    if (deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
    if (deltaY < 0 && el.scrollTop > 1) return true;
  }
  if (deltaX !== 0 && canScrollX) {
    if (deltaX > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1) return true;
    if (deltaX < 0 && el.scrollLeft > 1) return true;
  }
  return false;
}

export function findScrollableAncestor(startEl: Element, deltaX: number, deltaY: number): Element | Window | null {
  const doc = typeof document !== 'undefined' ? document : (globalThis as any).document;
  const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
  let curr: any = startEl;
  while (curr && (!doc || (curr !== doc.body && curr !== doc.documentElement))) {
    const isHtmlEl = typeof HTMLElement !== 'undefined' ? curr instanceof HTMLElement : (curr && typeof curr.scrollHeight === 'number');
    if (isHtmlEl && isScrollable(curr, deltaX, deltaY)) {
      return curr;
    }
    curr = curr.parentElement;
  }
  return win || null;
}

export class CaptureLayer {
  private element: HTMLElement;
  private shadowRoot: ShadowRoot;
  private options: CaptureLayerOptions;
  private isActive: boolean = false;
  private isPassthrough: boolean = false;
  private hoverRaf: number | null = null;
  private lastClientX: number = 0;
  private lastClientY: number = 0;

  constructor(element: HTMLElement, options: CaptureLayerOptions) {
    this.element = element;
    this.shadowRoot = options.shadowRoot;
    this.options = options;

    this.bindEvents();
  }

  private getWindow(): any {
    return typeof window !== 'undefined' ? window : (globalThis as any).window;
  }

  private bindEvents() {
    this.element.addEventListener('pointermove', this.handlePointerMove as any);
    this.element.addEventListener('click', this.handleClick as any);
    if (this.options.onDblClick) {
      this.element.addEventListener('dblclick', this.handleDblClick as any);
    }
    this.element.addEventListener('wheel', this.handleWheel as any, { passive: false });

    // Passthrough modifier key listeners on window
    const win = this.getWindow();
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('keydown', this.handleKeyDown);
      win.addEventListener('keyup', this.handleKeyUp);
      win.addEventListener('blur', this.handleWindowBlur);
    }
  }

  public destroy() {
    this.element.removeEventListener('pointermove', this.handlePointerMove as any);
    this.element.removeEventListener('click', this.handleClick as any);
    if (this.options.onDblClick) {
      this.element.removeEventListener('dblclick', this.handleDblClick as any);
    }
    this.element.removeEventListener('wheel', this.handleWheel as any);

    const win = this.getWindow();
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('keydown', this.handleKeyDown);
      win.removeEventListener('keyup', this.handleKeyUp);
      win.removeEventListener('blur', this.handleWindowBlur);
    }

    if (this.hoverRaf !== null && win && typeof win.cancelAnimationFrame === 'function') {
      win.cancelAnimationFrame(this.hoverRaf);
      this.hoverRaf = null;
    }
  }

  public setActive(active: boolean) {
    this.isActive = active;
    if (active) {
      this.element.classList.add('is-active');
      this.setPassthrough(false);
    } else {
      this.element.classList.remove('is-active');
      this.setPassthrough(false);
      const win = this.getWindow();
      if (this.hoverRaf !== null && win && typeof win.cancelAnimationFrame === 'function') {
        win.cancelAnimationFrame(this.hoverRaf);
        this.hoverRaf = null;
      }
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getIsPassthrough(): boolean {
    return this.isPassthrough;
  }

  public setPassthrough(passthrough: boolean) {
    if (this.isPassthrough === passthrough) return;
    this.isPassthrough = passthrough;

    if (passthrough) {
      this.element.classList.add('is-passthrough');
      // While in passthrough, clear hover preview so user sees raw host interaction
      this.options.onHover(null, createSyntheticMouseEvent('mousemove', this.lastClientX, this.lastClientY));
    } else {
      this.element.classList.remove('is-passthrough');
      if (this.isActive) {
        this.scheduleHoverHitTest(createSyntheticMouseEvent('mousemove', this.lastClientX, this.lastClientY));
      }
    }
  }

  public getTargetElement(clientX: number, clientY: number): Element | null {
    const doc = typeof document !== 'undefined' ? document : (globalThis as any).document;
    if (!doc || typeof doc.elementsFromPoint !== 'function') return null;
    const elements = doc.elementsFromPoint(clientX, clientY);
    for (const el of elements) {
      if (!isOverlayNode(el, this.shadowRoot)) {
        return el;
      }
    }
    return null;
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isActive || this.isPassthrough) return;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    this.scheduleHoverHitTest(e);
  };

  private scheduleHoverHitTest(e: MouseEvent) {
    const win = this.getWindow();
    if (this.hoverRaf !== null) return;
    if (win && typeof win.requestAnimationFrame === 'function') {
      this.hoverRaf = win.requestAnimationFrame(() => {
        this.hoverRaf = null;
        if (!this.isActive || this.isPassthrough) return;
        const target = this.getTargetElement(this.lastClientX, this.lastClientY);
        this.options.onHover(target, e);
      });
    } else {
      const target = this.getTargetElement(this.lastClientX, this.lastClientY);
      this.options.onHover(target, e);
    }
  }

  private handleClick = (e: MouseEvent) => {
    if (!this.isActive || this.isPassthrough) return;
    e.preventDefault();
    e.stopPropagation();

    const target = this.getTargetElement(e.clientX, e.clientY);
    if (target) {
      this.options.onSelect(target, e);
    }
  };

  private handleDblClick = (e: MouseEvent) => {
    if (!this.isActive || this.isPassthrough) return;
    e.preventDefault();
    e.stopPropagation();

    const target = this.getTargetElement(e.clientX, e.clientY);
    if (target && this.options.onDblClick) {
      this.options.onDblClick(target, e);
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (!this.isActive || this.isPassthrough) return;
    e.preventDefault();
    e.stopPropagation();

    const win = this.getWindow();
    const target = this.getTargetElement(e.clientX, e.clientY);
    if (target) {
      const scrollTarget = findScrollableAncestor(target, e.deltaX, e.deltaY);
      if (scrollTarget === win) {
        if (win && typeof win.scrollBy === 'function') {
          win.scrollBy({ left: e.deltaX, top: e.deltaY, behavior: 'instant' as ScrollBehavior });
        }
      } else if (scrollTarget && 'scrollBy' in scrollTarget) {
        (scrollTarget as HTMLElement).scrollBy({ left: e.deltaX, top: e.deltaY, behavior: 'instant' as ScrollBehavior });
      }
    } else if (win && typeof win.scrollBy === 'function') {
      win.scrollBy({ left: e.deltaX, top: e.deltaY, behavior: 'instant' as ScrollBehavior });
    }

    // Re-evaluate hover element after scroll
    this.scheduleHoverHitTest(e);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isActive) return;
    const targetKey = this.options.passthroughKey || 'Shift';
    if (e.key === targetKey) {
      this.setPassthrough(true);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (!this.isActive) return;
    const targetKey = this.options.passthroughKey || 'Shift';
    if (e.key === targetKey) {
      this.setPassthrough(false);
    }
  };

  private handleWindowBlur = () => {
    if (this.isPassthrough) {
      this.setPassthrough(false);
    }
  };
}
