import fs from 'fs/promises';
import { existsSync, readdirSync, readFileSync, unlinkSync } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { BRAND } from './brand.js';

export interface BridgeSession {
  version: number;
  port: number;
  token: string;
  pid: number;
  projectRoot: string;
  startedAt: string;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function getSessionFilePath(projectRoot: string): string {
  return path.join(projectRoot, BRAND.dataDir, 'session.json');
}

/** Your own Agent Hover folder (~/.agent-hover), or AGENT_HOVER_HOME. */
export function userDataDir(): string {
  return process.env[`${BRAND.envPrefix}_HOME`] || path.join(os.homedir(), BRAND.dataDir);
}

/**
 * Where a running bridge also lists itself, for agents that don't start in the project folder (a global MCP config,
 * as Antigravity and Windsurf use): ~/.agent-hover/bridges/<project hash>.json. Only you can read it (0600), like
 * the project's session file.
 */
export function getRegistryFilePath(projectRoot: string): string {
  const id = crypto.createHash('sha256').update(path.resolve(projectRoot)).digest('hex').slice(0, 16);
  return path.join(userDataDir(), 'bridges', id + '.json');
}

export async function writeSessionFile(session: BridgeSession): Promise<string> {
  const filePath = getSessionFilePath(session.projectRoot);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const json = JSON.stringify(session, null, 2);
  await fs.writeFile(filePath, json, { mode: 0o600, encoding: 'utf-8' });
  try {
    const listed = getRegistryFilePath(session.projectRoot);
    await fs.mkdir(path.dirname(listed), { recursive: true, mode: 0o700 });
    await fs.writeFile(listed, json, { mode: 0o600, encoding: 'utf-8' });
  } catch {
    // The project's own file is enough for agents started in the project.
  }
  return filePath;
}

export async function removeSessionFile(projectRoot: string): Promise<void> {
  for (const filePath of [getSessionFilePath(projectRoot), getRegistryFilePath(projectRoot)]) {
    try {
      if (existsSync(filePath)) await fs.unlink(filePath);
    } catch {}
  }
}

/** For exit handlers, which can't wait. */
export function removeSessionFileSync(projectRoot: string): void {
  for (const filePath of [getSessionFilePath(projectRoot), getRegistryFilePath(projectRoot)]) {
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {}
  }
}

/**
 * Whether the dev server that wrote a session is still running. EPERM means it exists but this process may not
 * signal it, as in an agent's sandbox (Cursor, Antigravity): that is still a running dev server.
 */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === 'EPERM';
  }
}

function readSession(file: string): BridgeSession | null {
  try {
    const session = JSON.parse(readFileSync(file, 'utf-8')) as BridgeSession;
    return session && typeof session.port === 'number' && isPidAlive(session.pid) ? session : null;
  } catch {
    return null;
  }
}

/** The project session file in `dir` or the nearest folder above it. */
function sessionAbove(dir: string): BridgeSession | null {
  let current = path.resolve(dir);
  while (true) {
    const candidate = path.join(current, BRAND.dataDir, 'session.json');
    // ~/.agent-hover is your own folder, not a project.
    if (existsSync(candidate) && path.join(current, BRAND.dataDir) !== userDataDir()) {
      const session = readSession(candidate);
      if (session) return session;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Every running dev server with Agent Hover on this machine, newest first. */
export function listRunningSessions(): BridgeSession[] {
  const dir = path.join(userDataDir(), 'bridges');
  let files: string[] = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return []; }
  return files
    .map((f) => readSession(path.join(dir, f)))
    .filter((s): s is BridgeSession => !!s)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

const inside = (child: string, parent: string) => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

/**
 * Finds the running dev server an agent should talk to:
 * 1. AGENT_HOVER_SESSION (a session file path you set)
 * 2. <dataDir>/session.json in the working folder or above it
 * 3. the same in the agent's workspace folders (`roots`, which MCP clients report)
 * 4. the dev servers listed in ~/.agent-hover/bridges: one inside a workspace folder, else the newest
 * Sessions whose dev server has stopped are skipped.
 */
export function discoverSession(startDir: string = process.cwd(), roots: string[] = []): BridgeSession | null {
  const envPath = process.env[`${BRAND.envPrefix}_SESSION`];
  if (envPath && existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      const session = JSON.parse(content) as BridgeSession;
      if (session && isPidAlive(session.pid)) {
        return session;
      }
    } catch {}
  }

  const here = sessionAbove(startDir);
  if (here) return here;
  for (const root of roots) {
    const session = sessionAbove(root);
    if (session) return session;
  }
  const running = listRunningSessions();
  return running.find((s) => roots.some((r) => inside(s.projectRoot, r) || inside(r, s.projectRoot))) || running[0] || null;
}
