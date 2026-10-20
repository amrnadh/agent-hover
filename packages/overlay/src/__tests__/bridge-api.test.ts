import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { BRIDGE_API, bridgeError, bridgeIsOutdated } from '../lib/bridge-api.js';

describe('bridge API level', () => {
  it('matches what the bridge reports', () => {
    const bridge = readFileSync(path.resolve(__dirname, '../../../vite/src/bridge-server.ts'), 'utf8');
    expect(Number(/export const BRIDGE_API = (\d+);/.exec(bridge)?.[1])).toBe(BRIDGE_API);
  });

  it('knows a bridge started before an update', () => {
    expect(bridgeIsOutdated({ version: '0.2.0' })).toBe(true);
    expect(bridgeIsOutdated({ api: BRIDGE_API - 1 })).toBe(true);
    expect(bridgeIsOutdated({ api: BRIDGE_API })).toBe(false);
    expect(bridgeIsOutdated({ api: BRIDGE_API + 1 })).toBe(false);
    expect(bridgeIsOutdated(null)).toBe(false);
  });

  it('turns failed requests into something to show', async () => {
    const res = (status: number, body: string) => new Response(body, { status });
    expect(await bridgeError(res(409, JSON.stringify({ error: 'The agent is working on this task' })), 'x')).toBe('The agent is working on this task');
    expect(await bridgeError(res(404, '<pre>Cannot POST /api/agent/tasks/remove</pre>'), 'x')).toBe('Restart your dev server to finish updating Agent Hover');
    expect(await bridgeError(res(500, 'oops'), 'Could not remove')).toBe('Could not remove');
  });
});
