import { readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

export interface UpdateInfo { current: string; latest: string }

const PACKAGE = '@agent-hover/vite';
const DAY = 24 * 60 * 60 * 1000;

/** This package's version, read from its package.json (one source of truth for the bridge and /api/health). */
export function packageVersion(): string {
  try {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    return JSON.parse(readFileSync(file, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** True when `latest` is a newer stable release than `current` (pre-releases are never offered). */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => /^(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(v.trim());
  const a = parse(latest);
  const b = parse(current);
  if (!a || !b || a[4]) return false;
  for (let i = 1; i <= 3; i++) {
    if (Number(a[i]) !== Number(b[i])) return Number(a[i]) > Number(b[i]);
  }
  return !!b[4]; // 0.2.0 is newer than 0.2.0-beta.1
}

export interface UpdateCheckOptions {
  /** Where the last answer is cached; at most one registry request per day. */
  cacheFile?: string;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  now?: number;
}

/**
 * Ask the npm registry for the latest @agent-hover/vite. Sends nothing about the project: one GET for the
 * package's public metadata, at most once a day. Off when AGENT_HOVER_NO_UPDATE_CHECK is set or in CI.
 */
export async function checkForUpdate(current: string, options: UpdateCheckOptions = {}): Promise<UpdateInfo | null> {
  const env = options.env ?? process.env;
  if (env.AGENT_HOVER_NO_UPDATE_CHECK || env.CI || env.NODE_ENV === 'test') return null;
  const cacheFile = options.cacheFile ?? path.join(os.tmpdir(), 'agent-hover-update-check.json');
  const now = options.now ?? Date.now();

  let latest: string | null = null;
  try {
    const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    if (typeof cached.latest === 'string' && now - cached.checkedAt < DAY) latest = cached.latest;
  } catch { /* no cache yet */ }

  if (!latest) {
    try {
      const res = await (options.fetchImpl ?? fetch)(`https://registry.npmjs.org/${PACKAGE.replace('/', '%2F')}/latest`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      latest = String((await res.json()).version || '');
      await fs.writeFile(cacheFile, JSON.stringify({ latest, checkedAt: now })).catch(() => {});
    } catch {
      return null; // offline or blocked: say nothing
    }
  }
  return latest && isNewer(latest, current) ? { current, latest } : null;
}
