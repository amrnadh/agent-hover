import path from 'path';
import { overlayScripts, startBridge, type Editor } from '@agent-hover/bridge';
import { createNextLocationMapper } from './location.js';
import { setHandle } from './shared.js';

export interface RegisterOptions {
  /** The project folder. Default: the folder `next dev` runs in. */
  root?: string;
  /** First port for the bridge; the next free one is used when it's busy. Default: 9850. */
  port?: number;
  /** Editor for Open in editor. Default: 'auto'. */
  editor?: Editor;
  /** Next's build folder, if you changed `distDir`. Default: what next.config says (via withAgentHover), else `.next`. */
  distDir?: string;
}

/**
 * Starts Agent Hover's bridge with the Next.js dev server. Call it from `register()` in `instrumentation.ts`,
 * only in the Node.js runtime:
 *
 *   export async function register() {
 *     if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
 *       await (await import('@agent-hover/next/register')).register();
 *     }
 *   }
 *
 * Does nothing outside `next dev` or in the Edge runtime. Safe to call more than once (one bridge per process).
 */
export async function register(options: RegisterOptions = {}): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return;
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return;
  const root = path.resolve(options.root ?? process.cwd());
  const distDir = options.distDir ?? process.env.AGENT_HOVER_NEXT_DIST_DIR ?? '.next';
  const editor = options.editor ?? 'auto';
  try {
    const bridge = await startBridge({
      root,
      port: options.port,
      packageName: '@agent-hover/next',
      publicDir: path.join(root, 'public'),
      ignore: [`${distDir.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')}/**`],
      // React 19 has no _debugSource: element sources come from React's creation stack and the dev build's source maps.
      locationMapper: createNextLocationMapper(root, distDir),
    });
    setHandle({ scripts: () => overlayScripts({ port: bridge.getPort(), token: bridge.getToken(), editor }) });
  } catch (err: any) {
    // Never take the dev server down with us: the app runs, the dock doesn't show.
    console.error('[agent-hover] Could not start:', err?.message || err);
  }
}

export default register;
