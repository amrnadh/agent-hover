/**
 * DockController: Floating Horizontal Dock Pill (§7.10, D-07)
 *
 * Implements P2-05:
 * - Horizontal pill, bottom-center default, 40px high, --ah-radius-full.
 * - Segments: brand mark + status dot | inspect toggle | pins stack + animated badge | settings/menu | dismiss | drag handle.
 * - Status dot: green (bridge + agent), amber (bridge only), gray (disconnected). Tooltip shows details.
 * - Dragging with viewport edge-snapping and localStorage position persistence per origin.
 * - Dismissible via Cmd/Ctrl+Shift+X or menu 'x'.
 * - Synchronous presence updates reflecting bridge/agent state within 1s.
 */

export interface DockPresenceState {
  bridgeOnline: boolean;
  port: number;
  agents: Array<{ client: string; version?: string }>;
}

export interface DockControllerOptions {
  shadowRoot: ShadowRoot;
  onToggleInspect: () => void;
  onOpenPins: () => void;
  onOpenSettings: () => void;
  onCallout: (text: string, meta?: string, duration?: number) => void;
}

export class DockController {
  private shadow: ShadowRoot;
  private wrapper: HTMLElement;
  private dockEl: HTMLElement;
  private toggleBtn: HTMLElement;
  private pinsBtn: HTMLElement;
  private settingsBtn: HTMLElement;
  private dismissBtn: HTMLElement;
  private dragHandle: HTMLElement;
  private statusDot: HTMLElement;
  private brandSegment: HTMLElement;
  private pinBadge: HTMLElement;
  private options: DockControllerOptions;

  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private initialLeft: number = 0;
  private initialTop: number = 0;
  private isVisible: boolean = true;
  private presenceState: DockPresenceState = {
    bridgeOnline: false,
    port: 0,
    agents: [],
  };

  constructor(wrapper: HTMLElement, options: DockControllerOptions) {
    this.wrapper = wrapper;
    this.shadow = options.shadowRoot;
    this.options = options;

    this.dockEl = wrapper.querySelector('#cp-dock') || wrapper;
    this.toggleBtn = wrapper.querySelector('#cp-dock-toggle') as HTMLElement;
    this.pinsBtn = wrapper.querySelector('#cp-dock-pins') as HTMLElement;
    this.settingsBtn = wrapper.querySelector('#ah-dock-settings-btn') as HTMLElement;
    this.dismissBtn = wrapper.querySelector('#ah-dock-dismiss') as HTMLElement;
    this.dragHandle = wrapper.querySelector('#cp-dock-handle') as HTMLElement;
    this.statusDot = wrapper.querySelector('#cp-mcp-dot') as HTMLElement;
    this.brandSegment = wrapper.querySelector('#ah-dock-brand') as HTMLElement;
    this.pinBadge = wrapper.querySelector('#cp-dock-pin-badge') as HTMLElement;

    this.bindEvents();
    this.restorePosition();
  }

  private getWindow(): any {
    return typeof window !== 'undefined' ? window : (globalThis as any).window;
  }

  private bindEvents() {
    // Action clicks
    if (this.toggleBtn) {
      this.toggleBtn.onclick = () => this.options.onToggleInspect();
    }
    if (this.pinsBtn) {
      this.pinsBtn.onclick = () => this.options.onOpenPins();
    }
    if (this.settingsBtn) {
      this.settingsBtn.onclick = () => this.options.onOpenSettings();
    }
    if (this.dismissBtn) {
      this.dismissBtn.onclick = () => this.toggleVisibility(false);
    }
    if (this.brandSegment) {
      this.brandSegment.onclick = () => this.options.onOpenSettings();
    }

    // Drag handle
    const handle = this.dragHandle || this.dockEl;
    if (handle && typeof handle.addEventListener === 'function') {
      handle.addEventListener('mousedown', this.handleMouseDown);
    }

    // Global listeners for dragging and dismiss shortcut
    const win = this.getWindow();
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('mousemove', this.handleMouseMove);
      win.addEventListener('mouseup', this.handleMouseUp);
      win.addEventListener('keydown', this.handleKeyDown);
    }
  }

  public destroy() {
    const handle = this.dragHandle || this.dockEl;
    if (handle && typeof handle.removeEventListener === 'function') {
      handle.removeEventListener('mousedown', this.handleMouseDown);
    }

    const win = this.getWindow();
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('mousemove', this.handleMouseMove);
      win.removeEventListener('mouseup', this.handleMouseUp);
      win.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  public setInspectActive(active: boolean) {
    if (!this.toggleBtn) return;
    if (active) {
      this.toggleBtn.classList.add('active');
      this.toggleBtn.setAttribute('aria-pressed', 'true');
    } else {
      this.toggleBtn.classList.remove('active');
      this.toggleBtn.setAttribute('aria-pressed', 'false');
    }
  }

  public setPinCount(count: number) {
    if (!this.pinBadge) return;
    if (count > 0) {
      this.pinBadge.textContent = String(count);
      this.pinBadge.style.display = 'inline-block';
      this.pinBadge.classList.add('has-update');
      setTimeout(() => this.pinBadge.classList.remove('has-update'), 180);
    } else {
      this.pinBadge.style.display = 'none';
      this.pinBadge.textContent = '0';
    }
  }

  public updatePresence(state: Partial<DockPresenceState>) {
    this.presenceState = { ...this.presenceState, ...state };
    if (!this.statusDot) return;

    const { bridgeOnline, port, agents } = this.presenceState;

    this.statusDot.classList.remove('status-active', 'status-bridge-only', 'status-disconnected');

    if (!bridgeOnline) {
      this.statusDot.classList.add('status-disconnected');
      const tooltip = 'Bridge offline';
      this.statusDot.title = tooltip;
      if (this.brandSegment) this.brandSegment.title = `Agent Hover · ${tooltip}`;
    } else if (agents.length > 0) {
      this.statusDot.classList.add('status-active');
      const clientName = agents.map((a) => a.client).join(', ');
      const tooltip = `Bridge :${port} · ${clientName}`;
      this.statusDot.title = tooltip;
      if (this.brandSegment) this.brandSegment.title = `Agent Hover · ${tooltip}`;
    } else {
      this.statusDot.classList.add('status-bridge-only');
      const tooltip = `Bridge :${port} · No agent connected`;
      this.statusDot.title = tooltip;
      if (this.brandSegment) this.brandSegment.title = `Agent Hover · ${tooltip}`;
    }
  }

  public toggleVisibility(force?: boolean) {
    this.isVisible = typeof force === 'boolean' ? force : !this.isVisible;
    if (this.isVisible) {
      this.wrapper.classList.remove('is-hidden');
      this.options.onCallout('Dock visible', 'DOCK', 1800);
    } else {
      this.wrapper.classList.add('is-hidden');
      this.options.onCallout('Dock hidden · Press Cmd/Ctrl+Shift+X to restore', 'HIDE', 3000);
    }
  }

  public getIsVisible(): boolean {
    return this.isVisible;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl + Shift + X toggles dock visibility
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyX') {
      e.preventDefault();
      this.toggleVisibility();
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    // Only drag on left click and ignore button clicks
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest && target.closest('button')) return;

    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    const rect = this.wrapper.getBoundingClientRect();
    this.initialLeft = rect.left;
    this.initialTop = rect.top;

    // Remove CSS transform centering so direct left/top coordinates apply cleanly
    this.wrapper.style.transform = 'none';
    this.wrapper.style.bottom = 'auto';
    this.wrapper.style.left = `${this.initialLeft}px`;
    this.wrapper.style.top = `${this.initialTop}px`;

    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    const dockW = this.wrapper.offsetWidth || 260;
    const dockH = this.wrapper.offsetHeight || 40;

    const win = this.getWindow();
    const winW = win?.innerWidth || 1024;
    const winH = win?.innerHeight || 768;

    const maxLeft = winW - dockW - 12;
    const maxTop = winH - dockH - 12;

    const newLeft = Math.max(12, Math.min(maxLeft, this.initialLeft + deltaX));
    const newTop = Math.max(12, Math.min(maxTop, this.initialTop + deltaY));

    this.wrapper.style.left = `${newLeft}px`;
    this.wrapper.style.top = `${newTop}px`;
  };

  private handleMouseUp = () => {
    if (!this.isDragging) return;
    this.isDragging = false;

    this.snapToNearestEdge();
    this.persistPosition();
  };

  private snapToNearestEdge() {
    const rect = this.wrapper.getBoundingClientRect();
    const dockW = rect.width;
    const dockH = rect.height;
    const win = this.getWindow();
    const winW = win?.innerWidth || 1024;
    const winH = win?.innerHeight || 768;

    // Check bottom snap (within 50px of bottom)
    const distBottom = winH - (rect.top + dockH);
    if (distBottom < 50) {
      // If near bottom center, restore bottom-center pill style
      const distCenterX = Math.abs(rect.left + dockW / 2 - winW / 2);
      if (distCenterX < 120) {
        this.wrapper.style.left = '50%';
        this.wrapper.style.top = 'auto';
        this.wrapper.style.bottom = '20px';
        this.wrapper.style.transform = 'translateX(-50%)';
        return;
      } else {
        this.wrapper.style.top = 'auto';
        this.wrapper.style.bottom = '20px';
      }
    }

    // Check top snap (within 50px of top)
    if (rect.top < 50) {
      this.wrapper.style.top = '20px';
      this.wrapper.style.bottom = 'auto';
    }

    // Check left snap
    if (rect.left < 50) {
      this.wrapper.style.left = '20px';
    }

    // Check right snap
    if (winW - (rect.left + dockW) < 50) {
      this.wrapper.style.left = `${winW - dockW - 20}px`;
    }
  }

  private persistPosition() {
    try {
      const pos = {
        left: this.wrapper.style.left,
        top: this.wrapper.style.top,
        bottom: this.wrapper.style.bottom,
        transform: this.wrapper.style.transform,
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('agent_hover_dock_pos', JSON.stringify(pos));
      }
    } catch (e) {}
  }

  private restorePosition() {
    try {
      if (typeof localStorage === 'undefined') {
        this.wrapper.style.left = '50%';
        this.wrapper.style.bottom = '20px';
        this.wrapper.style.top = 'auto';
        this.wrapper.style.transform = 'translateX(-50%)';
        return;
      }
      const raw = localStorage.getItem('agent_hover_dock_pos');
      if (!raw) {
        // Default bottom-center
        this.wrapper.style.left = '50%';
        this.wrapper.style.bottom = '20px';
        this.wrapper.style.top = 'auto';
        this.wrapper.style.transform = 'translateX(-50%)';
        return;
      }
      const pos = JSON.parse(raw);
      if (pos.bottom === '20px' && pos.left === '50%') {
        this.wrapper.style.left = '50%';
        this.wrapper.style.bottom = '20px';
        this.wrapper.style.top = 'auto';
        this.wrapper.style.transform = 'translateX(-50%)';
        return;
      }
      if (pos.left) this.wrapper.style.left = pos.left;
      if (pos.top && pos.top !== 'auto') this.wrapper.style.top = pos.top;
      if (pos.bottom) this.wrapper.style.bottom = pos.bottom;
      if (pos.transform) this.wrapper.style.transform = pos.transform;
    } catch (e) {
      this.wrapper.style.left = '50%';
      this.wrapper.style.bottom = '20px';
      this.wrapper.style.top = 'auto';
      this.wrapper.style.transform = 'translateX(-50%)';
    }
  }
}
