import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
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

export async function writeSessionFile(session: BridgeSession): Promise<string> {
  const filePath = getSessionFilePath(session.projectRoot);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(session, null, 2), { mode: 0o600, encoding: 'utf-8' });
  return filePath;
}

export async function removeSessionFile(projectRoot: string): Promise<void> {
  try {
    const filePath = getSessionFilePath(projectRoot);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
  } catch {}
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Discovers active bridge session:
 * 1. AGENT_HOVER_SESSION env var (explicit path)
 * 2. Walk up directory tree from startDir looking for <dataDir>/session.json
 * Validates that pid is still running; ignores stale sessions.
 */
export function discoverSession(startDir: string = process.cwd()): BridgeSession | null {
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

  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, BRAND.dataDir, 'session.json');
    if (existsSync(candidate)) {
      try {
        const content = readFileSync(candidate, 'utf-8');
        const session = JSON.parse(content) as BridgeSession;
        if (session && isPidAlive(session.pid)) {
          return session;
        }
      } catch {}
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}
