import type { APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/** Bridge session written by the demo dev server (port + token). */
export function readDemoSession(): { port: number; token: string } | null {
  try {
    const sessionFile = path.resolve('demo/.agent-hover/session.json');
    if (fs.existsSync(sessionFile)) {
      return JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    }
  } catch {}
  return null;
}

/**
 * Remove all pins on the bridge. Pins live in the dev server's memory, so they survive between
 * specs when Playwright reuses a running dev server; specs that assert on the pin stack call this first.
 */
export async function clearPins(request: APIRequestContext): Promise<void> {
  const session = readDemoSession();
  if (!session) return;
  const base = `http://localhost:${session.port}/api/pins`;
  const headers = { Authorization: `Bearer ${session.token}` };
  const res = await request.get(base, { headers });
  if (!res.ok()) return;
  const { pins = [] } = await res.json();
  for (const pin of pins) {
    await request.delete(base, { headers, data: { id: pin.id } });
  }
}
