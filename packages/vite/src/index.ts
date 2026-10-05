import type { Plugin } from 'vite';
import { BridgeServer } from './bridge-server.js';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { MODERN_SCREENSHOT_CODE } from './vendor/modern-screenshot.js';
import { getOverlayBundle } from '@agent-hover/overlay';

export interface ComponentPointerOptions {
  /** Port for the bridge server. Default: 9850 */
  port?: number;
  /** Whether to automatically open in editor on Alt+Shift+Click. Default: true */
  openInEditor?: boolean;
  /** Editor to open files in. Default: 'auto' */
  editor?: 'auto' | 'vscode' | 'cursor' | 'webstorm' | 'zed' | 'windsurf' | 'antigravity';
}

export type AgentHoverOptions = ComponentPointerOptions;

function generateOverlayBootstrap(port: number, editor: string, token: string = ''): string {
  const bundle = getOverlayBundle();
  return `
    ${bundle}
    if (typeof window !== 'undefined' && typeof (window as any).__AGENT_HOVER_BOOTSTRAP__ === 'function') {
      (window as any).__AGENT_HOVER_BOOTSTRAP__(${port}, ${JSON.stringify(editor)}, ${JSON.stringify(token)});
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
      bridgeServer = new BridgeServer(projectRoot, port);
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

      // Fallback: Inline dom-to-image-more library if present
      const req = createRequire(import.meta.url);
      let domToImageSource = '';
      try {
        const domToImagePath = req.resolve('dom-to-image-more/dist/dom-to-image-more.min.js');
        domToImageSource = readFileSync(domToImagePath, 'utf-8');
      } catch (e) {
        // Fallback gracefully
      }

      if (domToImageSource) {
        tags.push({
          tag: 'script',
          children: domToImageSource,
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
