import type { Plugin } from 'vite';
import { currentBridge, formatUpdateNotice, overlayScripts, startBridge, stopBridge, type BridgeServer, type Editor } from '@agent-hover/bridge';
import { createLocationMapper } from './source-location.js';

export interface ComponentPointerOptions {
  /** Port for the bridge server. Default: 9850 */
  port?: number;
  /** @deprecated Has no effect since 0.2 (use Open in editor in the overlay). */
  openInEditor?: boolean;
  /** Editor to open files in. Default: 'auto' */
  editor?: Editor;
}

export type AgentHoverOptions = ComponentPointerOptions;

export default function componentPointer(options?: ComponentPointerOptions): Plugin {
  const port = options?.port ?? 9850;
  const editor = options?.editor ?? 'auto';
  let projectRoot: string;
  let publicDir: string | null = null;
  let bridge: Promise<BridgeServer> | null = null;

  return {
    name: 'agent-hover',
    apply: 'serve', // only in dev mode

    config() {
      return {
        server: {
          watch: {
            ignored: ['**/.agent-hover/**', '**/.agent-hover/comments.json'],
          },
        },
      };
    },

    configResolved(config) {
      projectRoot = config.root;
      publicDir = config.publicDir || null;
    },

    configureServer(server) {
      // The update notice goes after Vite's own startup lines (its URLs), where it is seen, not above them.
      const listening = new Promise<void>((resolve) => {
        if (server.httpServer?.listening) resolve();
        else server.httpServer?.once('listening', () => setTimeout(resolve, 300));
        if (!server.httpServer) resolve();
      });
      // Vite calls this again when it restarts its dev server (a config change): start a fresh bridge.
      const started = startBridge({
        root: projectRoot,
        port,
        restart: true,
        publicDir,
        packageName: '@agent-hover/vite',
        // React 19 has no _debugSource: element sources come from React's creation stack and this server's source maps.
        locationMapper: createLocationMapper(server, projectRoot),
        onUpdateAvailable: (info) => {
          listening.then(() => server.config.logger.info(formatUpdateNotice(info, !!process.stdout.isTTY)));
        },
      });
      bridge = started;
      started.catch(() => { /* logged by the bridge; the page shows the bridge as offline */ });

      // Stop it with the dev server, unless a restart already replaced it.
      server.httpServer?.on('close', () => {
        started.then((b) => { if (currentBridge() === b) return stopBridge(); }).catch(() => {});
      });
    },

    async transformIndexHtml() {
      const running = await bridge?.catch(() => null);
      const scripts = overlayScripts({
        port: running ? running.getPort() : port,
        token: running ? running.getToken() : '',
        editor,
      });
      const tags: any[] = [];
      // modern-screenshot: high-resolution DOM to canvas/PNG for Compare (robust layout and font metrics).
      if (scripts.screenshot) tags.push({ tag: 'script', children: scripts.screenshot, injectTo: 'body' as const });
      tags.push({ tag: 'script', attrs: { type: 'module' }, children: scripts.overlay, injectTo: 'body' as const });
      return tags;
    },
  };
}

export {
  BridgeServer,
  BRIDGE_API,
  startBridge,
  stopBridge,
  overlayScripts,
  type BridgeServerOptions,
  type LocationMapper,
  type SourceLocation,
} from '@agent-hover/bridge';
export { createLocationMapper } from './source-location.js';
export { componentPointer as agentHover, componentPointer };
