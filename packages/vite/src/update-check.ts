import { existsSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { userDataDir } from '@agent-hover/core';

export interface UpdateInfo {
  current: string;
  latest: string;
  /** The install command for this project's package manager, e.g. `pnpm add -D @agent-hover/vite@latest`. */
  command: string;
  /** Release notes for `latest`. */
  releaseUrl: string;
}

const PACKAGE = '@agent-hover/vite';
const SCOPE = '@agent-hover';
const RELEASES = 'https://github.com/amrnadh/agent-hover/releases';
const NPMJS = 'https://registry.npmjs.org/';
export const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

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

/** How this project installs packages, from its lockfile (the project folder or a monorepo root above it). */
export function updateCommand(projectRoot: string): string {
  const spec = `${PACKAGE}@latest`;
  for (let dir = path.resolve(projectRoot); ; dir = path.dirname(dir)) {
    const has = (f: string) => existsSync(path.join(dir, f));
    if (has('pnpm-lock.yaml')) return `pnpm add -D ${spec}`;
    if (has('yarn.lock')) return `yarn add -D ${spec}`;
    if (has('bun.lock') || has('bun.lockb')) return `bun add -d ${spec}`;
    if (has('package-lock.json')) return `npm i -D ${spec}`;
    if (path.dirname(dir) === dir) return `npm i -D ${spec}`;
  }
}

/** The registry npm would use for @agent-hover: the scope's, then the default, from the npm settings package managers pass to scripts. */
export function registryUrl(env: Record<string, string | undefined>): string {
  const url = env[`npm_config_${SCOPE}:registry`] || env.npm_config_registry || NPMJS;
  return url.endsWith('/') ? url : url + '/';
}

export interface UpdateCheckOptions {
  projectRoot?: string;
  /** Where the last answer is cached; at most one registry request per day. */
  cacheFile?: string;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  now?: number;
}

/**
 * Ask the registry for the latest @agent-hover/vite, like other npm tools do: one GET for the package's public
 * metadata, at most once a day, nothing about the project. Off with AGENT_HOVER_NO_UPDATE_CHECK or NO_UPDATE_NOTIFIER
 * (the usual switch), in CI and in tests.
 */
export async function checkForUpdate(current: string, options: UpdateCheckOptions = {}): Promise<UpdateInfo | null> {
  const env = options.env ?? process.env;
  if (env.AGENT_HOVER_NO_UPDATE_CHECK || env.NO_UPDATE_NOTIFIER || env.CI || env.NODE_ENV === 'test') return null;
  const cacheFile = options.cacheFile ?? path.join(userDataDir(), 'update-check.json');
  const now = options.now ?? Date.now();
  const registry = registryUrl(env);

  let latest: string | null = null;
  try {
    const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    if (typeof cached.latest === 'string' && cached.registry === registry && now - cached.checkedAt < UPDATE_CHECK_INTERVAL) latest = cached.latest;
  } catch { /* no cache yet */ }

  if (!latest) {
    try {
      const res = await (options.fetchImpl ?? fetch)(`${registry}${PACKAGE.replace('/', '%2F')}/latest`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      latest = String((await res.json()).version || '');
      await fs.mkdir(path.dirname(cacheFile), { recursive: true }).catch(() => {});
      await fs.writeFile(cacheFile, JSON.stringify({ latest, registry, checkedAt: now })).catch(() => {});
    } catch {
      return null; // offline or blocked: say nothing
    }
  }
  if (!latest || !isNewer(latest, current)) return null;
  return { current, latest, command: updateCommand(options.projectRoot ?? process.cwd()), releaseUrl: `${RELEASES}/tag/v${latest}` };
}

/**
 * The terminal notice, boxed so it stands out from the dev server's own output:
 *
 *   ╭───────────────────────────────────────────────────╮
 *   │  Agent Hover update available  0.2.0 → 0.2.1       │
 *   │  Run npm i -D @agent-hover/vite@latest             │
 *   │  then restart the dev server.                     │
 *   │  What's new: https://github.com/…/releases/…      │
 *   ╰───────────────────────────────────────────────────╯
 */
export function formatUpdateNotice(info: UpdateInfo, color = false): string {
  const c = (code: number, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const lines: Array<[string, string]> = [
    [`Agent Hover update available  ${info.current} → ${info.latest}`, `${c(1, 'Agent Hover update available')}  ${c(2, info.current)} → ${c(32, info.latest)}`],
    [`Run ${info.command}`, `Run ${c(36, info.command)}`],
    ['then restart the dev server.', 'then restart the dev server.'],
    [`What's new: ${info.releaseUrl}`, c(2, `What's new: ${info.releaseUrl}`)],
  ];
  const width = Math.max(...lines.map(([plain]) => plain.length)) + 4;
  const border = (l: string, r: string) => c(33, `${l}${'─'.repeat(width)}${r}`);
  const row = ([plain, styled]: [string, string]) => `${c(33, '│')}  ${styled}${' '.repeat(width - plain.length - 2)}${c(33, '│')}`;
  return '\n' + [border('╭', '╮'), ...lines.map(row), border('╰', '╯')].map((l) => '  ' + l).join('\n') + '\n';
}
