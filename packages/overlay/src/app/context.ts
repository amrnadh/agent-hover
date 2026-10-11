import { getOverlayHtml } from '../ui/template.js';
import { IsolationManager, setupPopover } from '../lib/isolation.js';
import { queryDom, type OverlayDom } from './elements.js';

export interface OverlayConfig {
  port: number;
  editor?: string;
  token?: string;
}

/**
 * Mutable state shared across overlay modules. Each module initializes the keys it owns during setup.
 * Kept loosely typed: modules are migrating from the 0.1 closure one at a time.
 */
export type OverlayState = Record<string, any>;

/** Functions a module exposes to other modules, registered at the start of its setup. */
export type OverlayApi = Record<string, (...args: any[]) => any>;

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

  // Popover API (top layer) for the screenshot preview and lightbox, which must sit above host modals.
  setupPopover(shadow.getElementById('cp-snap-preview'));
  setupPopover(shadow.getElementById('cp-snap-lightbox'));

  const state: OverlayState = {
    mode: null,
    currentStack: [],
    currentStackIndex: -1,
    selectedTarget: null,
    selectedElement: null,
    frozenEntries: [],
    comments: [],
    connectedAgents: [],
    captureLayer: null,
  };

  return {
    port, editor, token, BRIDGE, BRIDGE_TOKEN, fetch,
    container, shadow, isolationManager,
    dom: queryDom(shadow),
    state,
    api: {},
  };
}
