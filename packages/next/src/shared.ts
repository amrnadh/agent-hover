// What register() leaves for <AgentHover />: both run in the Next.js server process, but in different bundles, so
// they meet on globalThis. No imports here: the component must stay light enough to bundle into any app.

export interface PageScripts {
  /** modern-screenshot, for Compare's before/after captures. */
  screenshot: string;
  /** The overlay and its start call with the bridge's port and session token. */
  overlay: string;
}

export interface NextBridgeHandle {
  /** The scripts for a page, read fresh each time (a rebuilt overlay is picked up without a restart). */
  scripts(): PageScripts;
}

const KEY = Symbol.for('agent-hover.next');

export function setHandle(handle: NextBridgeHandle | null): void {
  (globalThis as any)[KEY] = handle;
}

export function getHandle(): NextBridgeHandle | null {
  return ((globalThis as any)[KEY] as NextBridgeHandle | undefined) ?? null;
}

let warned = false;

/** The page's scripts, or null outside `next dev` or when the bridge isn't running (warned once). */
export function pageScripts(): PageScripts | null {
  if (process.env.NODE_ENV !== 'development') return null;
  const handle = getHandle();
  if (!handle) {
    if (!warned) {
      warned = true;
      console.warn('[agent-hover] <AgentHover /> found no bridge. Add instrumentation.ts (run `npx agent-hover init`, or see https://github.com/amrnadh/agent-hover#nextjs) and restart `next dev`.');
    }
    return null;
  }
  try {
    return handle.scripts();
  } catch (err: any) {
    console.error('[agent-hover] Could not load the overlay:', err?.message || err);
    return null;
  }
}
