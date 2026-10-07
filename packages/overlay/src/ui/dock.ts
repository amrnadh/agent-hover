/**
 * DockController: Floating Horizontal Dock Pill (§7.10, D-07)
 *
 * Implements Gate 2.5:
 * - Horizontal pill, bottom-center default (20px from bottom, respects safe-area inset).
 * - Single responsibility controls:
 *   - Brand mark + status dot: informational only, default cursor, no click action.
 *   - Inspect: icon only, no text label, tooltip "Inspect · Alt", active = soft accent tint + accent icon.
 *   - Pins: icon only + count badge, opens sidebar on Pins tab.
 *   - Settings: gear icon, opens sidebar on Settings tab.
 *   - Dedicated right grip handle; dragging allowed from empty padding with 4px threshold (< 4px = click).
 * - Sidebar tabs: panel button is highlighted while its tab is visible. Clicking highlighted closes sidebar;
 *   clicking unhighlighted opens/switches to that tab. Nothing cycles between views.
 * - Minimized dock: small round brand button at same position; dock never becomes invisible with no click target.
 *   Cmd/Ctrl+Shift+X toggles minimization.
 * - Tooltips: 350ms delay, shortcut chip, pointer-events: none.
 * - First-run dismissible hint: "Press Alt to inspect · drag to move", never intercepts clicks.
 * - Position validation and clamping on load and resize; reset dock position support.
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
  private minimizedBtn: HTMLElement | null;
  private minimizedDot: HTMLElement | null;
  private hintEl: HTMLElement | null;
  private hintDismissBtn: HTMLElement | null;
  private toggleBtn: HTMLElement | null;
  private pinsBtn: HTMLElement | null;
  private settingsBtn: HTMLElement | null;
  private dragHandle: HTMLElement | null;
  private statusDot: HTMLElement | null;
  private brandSegment: HTMLElement | null;
  private pinBadge: HTMLElement | null;
  private calloutEl: HTMLElement | null;
  private calloutTextEl: HTMLElement | null;
  private calloutMetaEl: HTMLElement | null;
  private options: DockControllerOptions;

  private isPointerDown: boolean = false;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private initialLeft: number = 0;
  private initialTop: number = 0;
  private isVisible: boolean = true;
  private isMinimized: boolean = false;
  private activeTab: 'inspector' | 'pins' | 'settings' | null = null;
  private tooltipTimer: any = null;
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
    this.minimizedBtn = wrapper.querySelector('#ah-dock-minimized') as HTMLElement | null;
    this.minimizedDot = wrapper.querySelector('#cp-minimized-dot') as HTMLElement | null;
    this.hintEl = wrapper.querySelector('#ah-first-run-hint') as HTMLElement | null;
    this.hintDismissBtn = wrapper.querySelector('#ah-hint-dismiss') as HTMLElement | null;
    this.toggleBtn = wrapper.querySelector('#cp-dock-toggle') as HTMLElement | null;
    this.pinsBtn = wrapper.querySelector('#cp-dock-pins') as HTMLElement | null;
    this.settingsBtn = wrapper.querySelector('#ah-dock-settings-btn') as HTMLElement | null;
    this.dragHandle = wrapper.querySelector('#cp-dock-handle') as HTMLElement | null;
    this.statusDot = wrapper.querySelector('#cp-mcp-dot') as HTMLElement | null;
    this.brandSegment = wrapper.querySelector('#ah-dock-brand') as HTMLElement | null;
    this.pinBadge = wrapper.querySelector('#cp-dock-pin-badge') as HTMLElement | null;
    this.calloutEl = wrapper.querySelector('#cp-dock-callout') as HTMLElement | null;
    this.calloutTextEl = wrapper.querySelector('#cp-callout-text') as HTMLElement | null;
    this.calloutMetaEl = wrapper.querySelector('#cp-callout-meta') as HTMLElement | null;

    this.bindEvents();
    this.restorePosition();
    this.initFirstRunHint();
  }

  private getWindow(): any {
    return typeof window !== 'undefined' ? window : (globalThis as any).window;
  }

  private bindEvents() {
    // Action clicks: each control has exactly one job (A.1)
    if (this.toggleBtn) {
      this.toggleBtn.onclick = () => {
        this.dismissHint();
        this.options.onToggleInspect();
      };
      this.bindTooltip(this.toggleBtn, 'Inspect', 'Alt');
    }

    if (this.pinsBtn) {
      this.pinsBtn.onclick = () => {
        this.dismissHint();
        this.options.onOpenPins();
      };
      this.bindTooltip(this.pinsBtn, 'Pins', '');
    }

    if (this.settingsBtn) {
      this.settingsBtn.onclick = () => {
        this.dismissHint();
        this.options.onOpenSettings();
      };
      this.bindTooltip(this.settingsBtn, 'Settings', '');
    }

    // Minimized brand button: clicking it restores the dock (A.6)
    if (this.minimizedBtn) {
      this.minimizedBtn.onclick = () => {
        this.setMinimized(false);
      };
    }

    // Brand segment: informational only, default cursor, no click action (A.2)
    if (this.brandSegment) {
      this.brandSegment.style.cursor = 'default';
      this.brandSegment.onclick = null;
    }

    // Drag handle & empty dock padding: allow dragging with 4px threshold (A.7)
    if (this.dragHandle) {
      this.bindTooltip(this.dragHandle, 'Drag to move', '');
    }
    if (this.dockEl && typeof this.dockEl.addEventListener === 'function') {
      this.dockEl.addEventListener('mousedown', this.handleMouseDown);
    }

    // First-run hint dismiss
    if (this.hintDismissBtn) {
      this.hintDismissBtn.onclick = () => this.dismissHint();
    }

    // Global listeners for dragging, resizing, and shortcuts
    const win = this.getWindow();
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('mousemove', this.handleMouseMove);
      win.addEventListener('mouseup', this.handleMouseUp);
      win.addEventListener('keydown', this.handleKeyDown);
      win.addEventListener('resize', this.handleWindowResize);
    }
  }

  public destroy() {
    if (this.dockEl && typeof this.dockEl.removeEventListener === 'function') {
      this.dockEl.removeEventListener('mousedown', this.handleMouseDown);
    }

    const win = this.getWindow();
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('mousemove', this.handleMouseMove);
      win.removeEventListener('mouseup', this.handleMouseUp);
      win.removeEventListener('keydown', this.handleKeyDown);
      win.removeEventListener('resize', this.handleWindowResize);
    }

    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
  }

  // --- Tooltips with 350ms delay, shortcut chip, pointer-events none (A.8) ---
  private bindTooltip(el: HTMLElement | null, title: string, shortcut: string) {
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener('mouseenter', () => {
      this.scheduleTooltip(title, shortcut);
    });
    el.addEventListener('mouseleave', () => {
      this.cancelTooltip();
    });
  }

  private scheduleTooltip(title: string, shortcut: string) {
    this.cancelTooltip();
    this.tooltipTimer = setTimeout(() => {
      if (!this.calloutEl || !this.calloutTextEl) return;
      this.calloutTextEl.textContent = title;
      if (this.calloutMetaEl) {
        if (shortcut) {
          this.calloutMetaEl.innerHTML = `<span class="ah-shortcut-chip">${shortcut}</span>`;
          this.calloutMetaEl.style.display = 'inline-block';
        } else {
          this.calloutMetaEl.textContent = '';
          this.calloutMetaEl.style.display = 'none';
        }
      }
      this.calloutEl.classList.add('show');
    }, 350);
  }

  private cancelTooltip() {
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    if (this.calloutEl) {
      this.calloutEl.classList.remove('show');
    }
  }

  // --- First-Run Hint Management (B) ---
  private initFirstRunHint() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('agent_hover_hint_dismissed') === 'true') {
        if (this.hintEl) this.hintEl.style.display = 'none';
        return;
      }
      if (this.hintEl) {
        this.hintEl.style.display = 'flex';
      }
    } catch (_) {}
  }

  public dismissHint() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('agent_hover_hint_dismissed', 'true');
      }
    } catch (_) {}
    if (this.hintEl) {
      this.hintEl.style.display = 'none';
    }
  }

  // --- Inspect Mode State (A.3) ---
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

  // --- Tab Highlighting & Single Responsibility (A.1, A.4, A.5) ---
  public setActiveTab(tab: 'inspector' | 'pins' | 'settings' | null) {
    this.activeTab = tab;

    if (this.pinsBtn) {
      if (tab === 'pins') {
        this.pinsBtn.classList.add('active');
        this.pinsBtn.setAttribute('aria-selected', 'true');
      } else {
        this.pinsBtn.classList.remove('active');
        this.pinsBtn.setAttribute('aria-selected', 'false');
      }
    }

    if (this.settingsBtn) {
      if (tab === 'settings') {
        this.settingsBtn.classList.add('active');
        this.settingsBtn.setAttribute('aria-selected', 'true');
      } else {
        this.settingsBtn.classList.remove('active');
        this.settingsBtn.setAttribute('aria-selected', 'false');
      }
    }
  }

  public getActiveTab(): 'inspector' | 'pins' | 'settings' | null {
    return this.activeTab;
  }

  // --- Minimization State (A.6) ---
  public setMinimized(minimized: boolean) {
    this.isMinimized = minimized;
    if (minimized) {
      if (this.dockEl) this.dockEl.style.display = 'none';
      if (this.minimizedBtn) this.minimizedBtn.style.display = 'flex';
      this.cancelTooltip();
      this.options.onCallout('Dock minimized · Click brand to restore', 'MINIMIZED', 2500);
    } else {
      if (this.minimizedBtn) this.minimizedBtn.style.display = 'none';
      if (this.dockEl) this.dockEl.style.display = 'flex';
      this.options.onCallout('Dock restored', 'RESTORED', 1500);
    }
  }

  public getIsMinimized(): boolean {
    return this.isMinimized;
  }

  public toggleMinimized() {
    this.setMinimized(!this.isMinimized);
  }

  // --- Pin Count Badge (A.4, A.9) ---
  public setPinCount(count: number) {
    if (!this.pinBadge) return;
    if (count > 0) {
      this.pinBadge.textContent = String(count);
      this.pinBadge.style.display = 'inline-block';
      this.pinBadge.classList.add('has-update');
      setTimeout(() => this.pinBadge?.classList.remove('has-update'), 180);
    } else {
      this.pinBadge.style.display = 'none';
      this.pinBadge.textContent = '0';
    }
  }

  // --- Presence Updates ---
  public updatePresence(state: Partial<DockPresenceState>) {
    this.presenceState = { ...this.presenceState, ...state };
    const { bridgeOnline, port, agents } = this.presenceState;

    const dots = [this.statusDot, this.minimizedDot].filter(Boolean) as HTMLElement[];
    for (const dot of dots) {
      dot.classList.remove('status-active', 'status-bridge-only', 'status-disconnected');

      if (!bridgeOnline) {
        dot.classList.add('status-disconnected');
        const tooltip = 'Bridge offline';
        dot.title = tooltip;
        if (this.brandSegment) this.brandSegment.title = `Agent Hover · ${tooltip}`;
        if (this.minimizedBtn) this.minimizedBtn.title = `Restore Agent Hover · ${tooltip}`;
      } else if (agents.length > 0) {
        dot.classList.add('status-active');
        const clientName = agents.map((a) => a.client).join(', ');
        const tooltip = `Bridge :${port} · ${clientName}`;
        dot.title = tooltip;
        if (this.brandSegment) this.brandSegment.title = `Agent Hover · ${tooltip}`;
        if (this.minimizedBtn) this.minimizedBtn.title = `Restore Agent Hover · ${tooltip}`;
      } else {
        dot.classList.add('status-bridge-only');
        const tooltip = `Bridge :${port} · No agent connected`;
        dot.title = tooltip;
        if (this.brandSegment) this.brandSegment.title = `Agent Hover · ${tooltip}`;
        if (this.minimizedBtn) this.minimizedBtn.title = `Restore Agent Hover · ${tooltip}`;
      }
    }
  }

  // --- Visibility & Shortcuts (A.6) ---
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
    // Cmd/Ctrl + Shift + X minimizes or restores the dock (A.6)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyX') {
      e.preventDefault();
      this.toggleMinimized();
    }
  };

  // --- Dragging with 4px threshold & empty padding support (A.7) ---
  private handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;

    // Do NOT drag if clicking any button inside the dock, UNLESS it's the dedicated drag handle
    const clickedBtn = target.closest('button');
    if (clickedBtn && !target.closest('.ah-dock-handle')) return;

    this.isPointerDown = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.isDragging = false;

    const rect = this.wrapper.getBoundingClientRect();
    this.initialLeft = rect.left;
    this.initialTop = rect.top;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isPointerDown) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;
    const dist = Math.hypot(deltaX, deltaY);

    if (!this.isDragging) {
      // 4px drag threshold (under 4px = click) (A.7)
      if (dist >= 4) {
        this.isDragging = true;
        this.dismissHint();
        this.cancelTooltip();
        this.wrapper.style.transform = 'none';
        this.wrapper.style.bottom = 'auto';
        this.wrapper.style.left = `${this.initialLeft}px`;
        this.wrapper.style.top = `${this.initialTop}px`;
      } else {
        return;
      }
    }

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
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    if (this.isDragging) {
      this.isDragging = false;
      this.snapToNearestEdge();
      this.persistPosition();
    }
  };

  private handleWindowResize = () => {
    this.validateAndClampPosition();
  };

  // --- Edge Snapping & Clamping (B) ---
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
        this.wrapper.style.bottom = 'calc(20px + env(safe-area-inset-bottom, 0px))';
        this.wrapper.style.transform = 'translateX(-50%)';
        return;
      } else {
        this.wrapper.style.top = 'auto';
        this.wrapper.style.bottom = 'calc(20px + env(safe-area-inset-bottom, 0px))';
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

  public validateAndClampPosition() {
    const rect = this.wrapper.getBoundingClientRect();
    const win = this.getWindow();
    const winW = win?.innerWidth || 1024;
    const winH = win?.innerHeight || 768;

    // Centered bottom pill stays responsive
    if (this.wrapper.style.left === '50%') return;

    const dockW = rect.width || 260;
    const dockH = rect.height || 40;

    const currentLeft = parseFloat(this.wrapper.style.left) || rect.left;
    const currentTop = parseFloat(this.wrapper.style.top) || rect.top;

    const maxLeft = Math.max(12, winW - dockW - 12);
    const maxTop = Math.max(12, winH - dockH - 12);

    const clampedLeft = Math.max(12, Math.min(maxLeft, currentLeft));
    const clampedTop = Math.max(12, Math.min(maxTop, currentTop));

    if (clampedLeft !== currentLeft || clampedTop !== currentTop) {
      this.wrapper.style.left = `${clampedLeft}px`;
      if (this.wrapper.style.top && this.wrapper.style.top !== 'auto') {
        this.wrapper.style.top = `${clampedTop}px`;
      }
      this.persistPosition();
    }
  }

  public resetPosition() {
    this.wrapper.style.left = '50%';
    this.wrapper.style.bottom = 'calc(20px + env(safe-area-inset-bottom, 0px))';
    this.wrapper.style.top = 'auto';
    this.wrapper.style.transform = 'translateX(-50%)';
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('agent_hover_dock_pos');
      }
    } catch (_) {}
    this.options.onCallout('Dock position reset', 'DEFAULT', 1500);
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
        this.resetPosition();
        return;
      }
      const raw = localStorage.getItem('agent_hover_dock_pos');
      if (!raw) {
        this.resetPosition();
        return;
      }
      const pos = JSON.parse(raw);
      if (pos.left === '50%') {
        this.resetPosition();
        return;
      }
      if (pos.left) this.wrapper.style.left = pos.left;
      if (pos.top && pos.top !== 'auto') this.wrapper.style.top = pos.top;
      if (pos.bottom) this.wrapper.style.bottom = pos.bottom;
      if (pos.transform) this.wrapper.style.transform = pos.transform;

      // Validate on load
      this.validateAndClampPosition();
    } catch (e) {
      this.resetPosition();
    }
  }
}
