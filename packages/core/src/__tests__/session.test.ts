import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { discoverSession, getRegistryFilePath, isPidAlive, listRunningSessions, removeSessionFile, writeSessionFile, type BridgeSession } from '../session.js';

describe('finding the running dev server', () => {
  let home: string;
  let work: string;
  const session = (projectRoot: string, startedAt: string, pid = process.pid): BridgeSession => ({ version: 1, port: 9850, token: 'tok-' + path.basename(projectRoot), pid, projectRoot, startedAt });

  beforeEach(() => {
    home = mkdtempSync(path.join(os.tmpdir(), 'ah-home-'));
    work = mkdtempSync(path.join(os.tmpdir(), 'ah-work-'));
    vi.stubEnv('AGENT_HOVER_HOME', home);
    vi.stubEnv('AGENT_HOVER_SESSION', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  });

  it('counts a dev server it may not signal (an agent sandbox) as running', () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error('not permitted'), { code: 'EPERM' }); });
    expect(isPidAlive(12345)).toBe(true);
    kill.mockImplementation(() => { throw Object.assign(new Error('no such process'), { code: 'ESRCH' }); });
    expect(isPidAlive(12345)).toBe(false);
    kill.mockRestore();
  });

  it('lists itself in your own folder too, and leaves it on stop', async () => {
    const app = path.join(work, 'app');
    await writeSessionFile(session(app, '2026-10-28T10:00:00Z'));
    expect(existsSync(getRegistryFilePath(app))).toBe(true);
    expect(listRunningSessions().map((s) => s.projectRoot)).toEqual([app]);
    await removeSessionFile(app);
    expect(listRunningSessions()).toEqual([]);
  });

  it('works from the project, from a workspace folder, or from anywhere (newest dev server)', async () => {
    const a = path.join(work, 'a'), b = path.join(work, 'b'), elsewhere = path.join(work, 'elsewhere');
    mkdirSync(path.join(a, 'src'), { recursive: true });
    mkdirSync(elsewhere);
    await writeSessionFile(session(a, '2026-10-28T09:00:00Z'));
    await writeSessionFile(session(b, '2026-10-28T10:00:00Z'));
    // Started inside a project.
    expect(discoverSession(path.join(a, 'src'))?.token).toBe('tok-a');
    // Started elsewhere (a global MCP config), with the workspace folders the agent reports.
    expect(discoverSession(elsewhere, [a])?.token).toBe('tok-a');
    // Started elsewhere, nothing reported: the newest running dev server.
    expect(discoverSession(elsewhere)?.token).toBe('tok-b');
    // A dev server that has stopped is skipped.
    await writeSessionFile(session(path.join(work, 'gone'), '2026-10-28T11:00:00Z', 999999));
    expect(discoverSession(elsewhere)?.token).toBe('tok-b');
  });
});
