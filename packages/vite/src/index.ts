import type { Plugin } from 'vite';
import { BridgeServer } from './bridge-server.js';
import { createLocationMapper } from './source-location.js';
import { formatUpdateNotice } from './update-check.js';
import { MODERN_SCREENSHOT_CODE } from './vendor/modern-screenshot.js';
import { getOverlayBundle } from '@agent-hover/overlay';

export interface ComponentPointerOptions {
  /** Port for the bridge server. Default: 9850 */
  port?: number;
  /** @deprecated Has no effect since 0.2 (use Open in editor in the overlay). */
  openInEditor?: boolean;
  /** Editor to open files in. Default: 'auto' */
  editor?: 'auto' | 'vscode' | 'cursor' | 'webstorm' | 'zed' | 'windsurf' | 'antigravity';
}

export type AgentHoverOptions = ComponentPointerOptions;

function generateOverlayBootstrap(port: number, editor: string, token: string = ''): string {
  const bundle = getOverlayBundle();
  return `
    ${bundle}
    if (typeof window !== 'undefined' && typeof window.__AGENT_HOVER_BOOTSTRAP__ === 'function') {
      window.__AGENT_HOVER_BOOTSTRAP__(${port}, ${JSON.stringify(editor)}, ${JSON.stringify(token)});
    }
  `;
}

export default function componentPointer(options?: ComponentPointerOptions): Plugin {
  const port = options?.port ?? 9850;
  const editor = options?.editor ?? 'auto';
  let projectRoot: string;
  let bridgeServer: BridgeServer | null = null;

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
    },

    configureServer(server) {
      // If a bridge server was already running from a previous reload, stop it first
      if (bridgeServer) {
        try {
          bridgeServer.stop();
        } catch (e) { }
      }
      // Start bridge server when Vite dev server starts
      // The update notice goes after Vite's own startup lines (its URLs), where it is seen, not above them.
      const listening = new Promise<void>((resolve) => {
        if (server.httpServer?.listening) resolve();
        else server.httpServer?.once('listening', () => setTimeout(resolve, 300));
        if (!server.httpServer) resolve();
      });
      bridgeServer = new BridgeServer(projectRoot, port, {
        onUpdateAvailable: (info) => {
          listening.then(() => server.config.logger.info(formatUpdateNotice(info, !!process.stdout.isTTY)));
        },
      });
      // React 19 has no _debugSource: element sources come from React's creation stack and this server's source maps.
      bridgeServer.setLocationMapper(createLocationMapper(server, projectRoot));
      bridgeServer.start();

      const cleanup = () => {
        if (bridgeServer) {
          bridgeServer.stop();
          bridgeServer = null;
        }
      };

      // Clean up on server close
      server.httpServer?.on('close', cleanup);

      // Clean up on process termination (Ctrl+C, kill)
      process.once('SIGINT', cleanup);
      process.once('SIGTERM', cleanup);
      process.once('exit', cleanup);
    },

    transformIndexHtml() {
      const tags: any[] = [];

      // Primary: Inject modern-screenshot (high-resolution DOM to canvas/PNG, robust layout & font metrics)
      if (MODERN_SCREENSHOT_CODE) {
        tags.push({
          tag: 'script',
          children: MODERN_SCREENSHOT_CODE,
          injectTo: 'body' as const,
        });
      }

      const actualPort = bridgeServer ? bridgeServer.getPort() : port;
      const actualToken = bridgeServer ? bridgeServer.getToken() : '';
      tags.push({
        tag: 'script',
        attrs: { type: 'module' },
        children: generateOverlayBootstrap(actualPort, editor, actualToken),
        injectTo: 'body' as const,
      });
      return tags;
    },
  };
}

export { BridgeServer } from './bridge-server.js';
export { componentPointer as agentHover, componentPointer };
