import { getOverlayHtml } from '../ui/template.js';
import { IsolationManager, setupPopover } from '../lib/isolation.js';
import { queryDom, type OverlayDom } from './elements.js';

export interface OverlayConfig {
  port: number;
  editor?: string;
  token?: string;
}

/**
 * Mutable state shared across overlay modules. Each module initializes the keys it owns
 * during setup; values are intentionally untyped until the modules are typed individually.
 */
export interface OverlayState {
  ws: any;
  isBridgeConnected: any;
  connectedAgents: any;
  dockController: any;
  isPointerMode: any;
  currentElement: any;
  currentComponentInfo: any;
  frozenEntries: any;
  captureLayer: any;
  currentSidebarTab: any;
  inSettingsView: any;
  currentEditorPref: any;
  showSpacingOverlay: any;
  lastCopiedContext: any;
  lastResolved: any;
  lastInfoName: any;
  lastComputedStyles: any;
  selectedTarget: any;
  selectedElement: any;
  comments: any;
  editingComment: any;
  activeNoteMarker: any;
  pendingNoteTarget: any;
  pendingPinTarget: any;
  currentPins: any;
  currentStack: any;
  currentStackIndex: any;
  selectedRect: any;
  textEditorVisible: any;
}

/** Functions a module exposes to other modules. Registered by each module at the start of its setup. */
export interface OverlayApi {
  handleUpdateAvailable: (...args: any[]) => any;
  getHostOffset: (...args: any[]) => any;
  setSidebarTab: (...args: any[]) => any;
  toggleSettingsView: (...args: any[]) => any;
  showCallout: (...args: any[]) => any;
  togglePointerMode: (...args: any[]) => any;
  clearSelection: (...args: any[]) => any;
  updateSelectionFrame: (...args: any[]) => any;
  loadComments: (...args: any[]) => any;
  renderCommentMarkers: (...args: any[]) => any;
  renderSidebarNotes: (...args: any[]) => any;
  openNotePopover: (...args: any[]) => any;
  closeNotePopover: (...args: any[]) => any;
  saveNote: (...args: any[]) => any;
  openPinDialog: (...args: any[]) => any;
  dispatchToAgent: (...args: any[]) => any;
  openInEditor: (...args: any[]) => any;
  closeSnapDropdown: (...args: any[]) => any;
  handleSnapMode: (...args: any[]) => any;
  positionBands: (...args: any[]) => any;
  hideBands: (...args: any[]) => any;
  clearDistanceGuides: (...args: any[]) => any;
  renderDistanceGuides: (...args: any[]) => any;
  closeTextEditor: (...args: any[]) => any;
  buildCSSSelector: (...args: any[]) => any;
  handleDblClickTarget: (...args: any[]) => any;
  highlightComponent: (...args: any[]) => any;
  captureElement: (...args: any[]) => any;
  findComponentElement: (...args: any[]) => any;
  renderFlyoutForStackIndex: (...args: any[]) => any;
  loadComponentContext: (...args: any[]) => any;
  resolveComponent: (...args: any[]) => any;
  escapeHtml: (...args: any[]) => any;
  formatContextForAiPrompt: (...args: any[]) => any;
  formatDomElementPrompt: (...args: any[]) => any;
  refreshState: (...args: any[]) => any;
}

/** Everything an overlay module needs: bridge access, the shadow root, element refs, shared state, and cross-module functions. */
export interface OverlayApp {
  port: number;
  editor: string;
  token: string;
  BRIDGE: string;
  BRIDGE_TOKEN: string;
  /** fetch that injects the bridge Bearer token into requests targeting the bridge. */
  fetch: typeof window.fetch;
  container: HTMLDivElement;
  shadow: ShadowRoot;
  isolationManager: IsolationManager;
  dom: OverlayDom;
  state: OverlayState;
  api: OverlayApi;
}

export function createOverlayApp(config: OverlayConfig): OverlayApp {
  const { port, editor = 'auto', token = '' } = config;

  const BRIDGE = 'http://localhost:' + port;
  const BRIDGE_TOKEN = token || '';

  // Transparently inject Bearer token into all requests targeting the bridge
  const _origFetch = window.fetch;
  const fetch = ((input: any, init: any = {}) => {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
    if (BRIDGE_TOKEN && (urlStr.startsWith(BRIDGE) || urlStr.startsWith('http://localhost:' + port) || urlStr.startsWith('http://127.0.0.1:' + port))) {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
      if (!headers.has('Authorization')) {
        headers.set('Authorization', 'Bearer ' + BRIDGE_TOKEN);
      }
      return _origFetch(input, { ...init, headers });
    }
    return _origFetch(input, init);
  }) as typeof window.fetch;

  // --- Shadow DOM UI Container ---
  const container = document.createElement('div');
  container.id = 'agent-hover-root';
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '2147483600';
  const shadow = container.attachShadow({ mode: 'open' });
  shadow.innerHTML = getOverlayHtml();
  if (document.body) {
    document.body.appendChild(container);
  } else {
    window.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
  }

  // Initialize host dialog isolation manager (reparents into active modal dialogs if needed)
  const isolationManager = new IsolationManager(container);

  // Setup Popover API for floating UI surfaces
  setupPopover(shadow.getElementById('cp-flyout'));
  setupPopover(shadow.getElementById('cp-note-popover'));
  setupPopover(shadow.getElementById('cp-snap-preview'));
  setupPopover(shadow.getElementById('cp-snap-lightbox'));
  setupPopover(shadow.getElementById('cp-mcp-modal'));

  const state = {
    isPointerMode: false,
    currentElement: null,
    currentComponentInfo: null,
    frozenEntries: [],
    // Capture layer for isolated inspect mode (P2-03); created by the inspector module.
    captureLayer: null,
  } as unknown as OverlayState;

  return {
    port, editor, token, BRIDGE, BRIDGE_TOKEN, fetch,
    container, shadow, isolationManager,
    dom: queryDom(shadow),
    state,
    api: {} as OverlayApi,
  };
}
