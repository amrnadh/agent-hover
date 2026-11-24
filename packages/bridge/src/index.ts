import { getOverlayBundle } from '@agent-hover/overlay';
import { BridgeServer, type BridgeServerOptions } from './bridge-server.js';
import { MODERN_SCREENSHOT_CODE } from './vendor/modern-screenshot.js';

export { BridgeServer, BRIDGE_API, DEFAULT_IGNORE, isSafeHost, isSafeOrigin, type BridgeServerOptions } from './bridge-server.js';
export { projectRelative, type LocationMapper, type SourceLocation } from './location.js';
export { checkForUpdate, formatUpdateNotice, packageVersion, updateCommand, type UpdateInfo } from './update-check.js';
export { MODERN_SCREENSHOT_CODE } from './vendor/modern-screenshot.js';

export type Editor = 'auto' | 'vscode' | 'cursor' | 'webstorm' | 'zed' | 'windsurf' | 'antigravity';

export interface StartBridgeOptions extends BridgeServerOptions {
  /** The project folder: where tasks, checkpoints and the session file live, and what file paths are relative to. */
  root: string;
  /** First port to try; the next free one is used when it's busy. Default: 9850. */
  port?: number;
  /**
   * Stop a bridge this process already runs and start a new one (the Vite plugin, when Vite restarts its dev server
   * after a config change). Without it, a running bridge for the same project is reused (Next.js may load the
   * instrumentation hook again).
   */
  restart?: boolean;
}

interface BridgeState {
  bridge: BridgeServer | null;
  root: string | null;
  starting: Promise<BridgeServer> | null;
  handlers: boolean;
}

// One bridge per process, shared by every copy of this module a framework may load (Next.js bundles server code
// in more than one graph): the state lives on globalThis, not in module scope.
const KEY = Symbol.for('agent-hover.bridge');

function state(): BridgeState {
  const g = globalThis as unknown as Record<symbol, BridgeState | undefined>;
  return (g[KEY] ??= { bridge: null, root: null, starting: null, handlers: false });
}

/** The bridge this process runs, if any. */
export function currentBridge(): BridgeServer | null {
  return state().bridge;
}

/** Stop this process's bridge (and remove its session file). */
export async function stopBridge(): Promise<void> {
  const s = state();
  const bridge = s.bridge;
  s.bridge = null;
  s.root = null;
  s.starting = null;
  if (bridge) {
    try { await bridge.stop(); } catch { /* already stopped */ }
  }
}

/**
 * Start the bridge for this process, or return the one already running for the same project. Stops it when the
 * process ends (Ctrl+C, kill, exit) so the session file doesn't outlive the dev server.
 */
export async function startBridge(options: StartBridgeOptions): Promise<BridgeServer> {
  const s = state();
  const { root, port = 9850, restart, ...serverOptions } = options;
  if (!restart && s.root === root) {
    if (s.bridge) {
      if (serverOptions.locationMapper) s.bridge.setLocationMapper(serverOptions.locationMapper);
      return s.bridge;
    }
    if (s.starting) return s.starting;
  }
  if (s.bridge || s.starting) {
    await s.starting?.catch(() => {});
    await stopBridge();
  }

  const bridge = new BridgeServer(root, port, serverOptions);
  const starting: Promise<BridgeServer> = bridge.start().then(
    async () => {
      if (s.starting !== starting) {
        // Stopped or replaced while it was starting.
        await bridge.stop().catch(() => {});
        throw new Error('[agent-hover] The bridge was stopped while starting');
      }
      s.bridge = bridge;
      s.starting = null;
      return bridge;
    },
    (err) => {
      if (s.starting === starting) { s.starting = null; s.root = null; }
      throw err;
    }
  );
  s.root = root;
  s.starting = starting;

  if (!s.handlers) {
    s.handlers = true;
    const cleanup = () => { void stopBridge(); };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('exit', cleanup);
  }
  return starting;
}

export interface OverlayScriptOptions {
  port: number;
  token: string;
  /** Editor for Open in editor. Default: 'auto'. */
  editor?: Editor | string;
}

export interface OverlayScripts {
  /** modern-screenshot, for Compare's before/after captures (a classic script; defines `modernScreenshot`). */
  screenshot: string;
  /** The overlay and its start call with the bridge's port and session token (a classic script). */
  overlay: string;
}

/** The scripts a page needs for Agent Hover: inline them after the app (Vite's index.html, Next's root layout). */
export function overlayScripts({ port, token, editor = 'auto' }: OverlayScriptOptions): OverlayScripts {
  const overlay = `
    ${getOverlayBundle()}
    if (typeof window !== 'undefined' && typeof window.__AGENT_HOVER_BOOTSTRAP__ === 'function') {
      window.__AGENT_HOVER_BOOTSTRAP__(${port}, ${JSON.stringify(editor)}, ${JSON.stringify(token)});
    }
  `;
  return { screenshot: MODERN_SCREENSHOT_CODE, overlay };
}
