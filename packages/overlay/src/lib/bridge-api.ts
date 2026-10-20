/**
 * The bridge features this overlay uses. The bridge reports its own level in /api/health (BRIDGE_API in
 * packages/vite/src/bridge-server.ts). The page reloads a new overlay right after an update, while the bridge keeps
 * running old code until the dev server restarts: a lower level means "restart your dev server".
 * 2: remove tasks, Clear finished, Send again (0.2.1).
 */
export const BRIDGE_API = 2;

/** Whether the running bridge is older than this overlay. Bridges before 0.2.1 report no level. */
export function bridgeIsOutdated(health: { api?: unknown } | null | undefined): boolean {
  return !!health && (typeof health.api === 'number' ? health.api : 1) < BRIDGE_API;
}

/**
 * A readable error for a failed bridge request. An old bridge answers new routes with Express's HTML 404
 * ("Cannot POST …"), which used to reach the toast as a JSON parse error.
 */
export async function bridgeError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const data = JSON.parse(text);
    if (data?.error) return String(data.error);
  } catch { /* not JSON */ }
  if (res.status === 404 && /Cannot (POST|GET|DELETE)/.test(text)) return 'Restart your dev server to finish updating Agent Hover';
  return fallback;
}
