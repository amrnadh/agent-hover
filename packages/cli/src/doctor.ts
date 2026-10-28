import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BRAND, DISPLAY_NAME, VITE_PACKAGE } from './brand.js';
import { MCP_CLIENTS } from './clients.js';
import { inspectProject, installCommand } from './project.js';
import { gitignoreCoversSession, RULES_MARKER } from './setup-files.js';
import type { Style } from './render.js';

export type CheckState = 'ok' | 'warn' | 'fail';
export interface Check { state: CheckState; label: string; fix?: string }

export interface DoctorIO {
  fetch: typeof fetch;
  home: string;
  nodeVersion: string;
  isPidAlive(pid: number): boolean;
}

export const defaultDoctorIO = (): DoctorIO => ({
  fetch: globalThis.fetch,
  home: os.homedir(),
  nodeVersion: process.versions.node,
  isPidAlive(pid) {
    try { process.kill(pid, 0); return true; } catch (err: any) { return err?.code === 'EPERM'; }
  },
});

const read = (file: string) => { try { return readFileSync(file, 'utf8'); } catch { return null; } };

/** Global MCP config files per agent; read only, to tell the user where the server is registered. */
function globalConfigs(home: string): Array<[string, string]> {
  return [
    ['Claude Code', path.join(home, '.claude.json')],
    ['Cursor', path.join(home, '.cursor', 'mcp.json')],
    ['Codex', path.join(home, '.codex', 'config.toml')],
    ['Windsurf', path.join(home, '.codeium', 'windsurf', 'mcp_config.json')],
    ['Antigravity', path.join(home, '.gemini', 'config', 'mcp_config.json')],
  ];
}

async function getJson(io: DoctorIO, url: string, token?: string): Promise<{ status: number; body: any } | null> {
  try {
    const res = await io.fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(2000) });
    let body: any = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, body };
  } catch {
    return null;
  }
}

/** `agent-hover doctor`: everything between "installed" and "my agent picks up tasks", checked in order. */
export async function runChecks(root: string, io: DoctorIO): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (state: CheckState, label: string, fix?: string) => checks.push({ state, label, fix });
  const p = inspectProject(root);

  const major = Number(io.nodeVersion.split('.')[0]);
  add(major >= 20 ? 'ok' : 'fail', `Node ${io.nodeVersion}`, major >= 20 ? undefined : 'Agent Hover needs Node 20 or newer.');

  if (!p.hasPackageJson) {
    add('fail', 'No package.json here', `Run ${BRAND.cliName} doctor in your app's folder.`);
    return checks;
  }
  if (!p.viteConfig) add('fail', 'No Vite config found', 'Agent Hover 0.2 supports Vite + React.');
  else add('ok', `Vite config: ${p.viteConfig}`);
  add(p.usesReact ? 'ok' : 'warn', p.usesReact ? 'React found' : 'React not found in dependencies', p.usesReact ? undefined : 'Component names and props need React.');

  const installed = read(path.join(root, 'node_modules', '@agent-hover', 'vite', 'package.json'));
  const installedVersion = installed ? (() => { try { return JSON.parse(installed).version as string; } catch { return null; } })() : null;
  if (!p.pluginInstalled) add('fail', `${VITE_PACKAGE} is not a dependency`, `${installCommand(p.packageManager, VITE_PACKAGE)}  (or ${BRAND.cliName} init)`);
  else if (!installedVersion) add('fail', `${VITE_PACKAGE} is in package.json but not installed`, `Run ${p.packageManager} install.`);
  else add('ok', `${VITE_PACKAGE} ${installedVersion} installed`);
  if (p.viteConfig) add(p.pluginConfigured ? 'ok' : 'fail', p.pluginConfigured ? 'Plugin is in the Vite config' : 'Plugin is not in the Vite config', p.pluginConfigured ? undefined : `${BRAND.cliName} init adds it.`);

  // The running dev server (bridge) and the agent connection.
  const sessionText = read(path.join(root, BRAND.dataDir, 'session.json'));
  let session: any = null;
  try { session = sessionText ? JSON.parse(sessionText) : null; } catch { /* corrupt */ }
  if (!session) {
    add('warn', 'Dev server not running (no session file)', 'Start it (npm run dev), then run doctor again to check the agent connection.');
  } else if (!io.isPidAlive(session.pid)) {
    add('warn', 'Dev server not running (stale session file)', 'Start it (npm run dev).');
  } else {
    const base = `http://localhost:${session.port}`;
    const health = await getJson(io, `${base}/api/health`);
    if (!health || health.status !== 200) {
      add('fail', `Bridge not answering on port ${session.port}`, 'Restart the dev server.');
    } else {
      add('ok', `Bridge running on port ${session.port}${health.body?.version ? ` (${health.body.version})` : ''}`);
      if (installedVersion && health.body?.version && health.body.version !== installedVersion) {
        add('warn', `The running bridge is ${health.body.version} but ${installedVersion} is installed`, 'Restart the dev server.');
      }
      const update = health.body?.updateAvailable;
      if (update?.latest) add('warn', `${DISPLAY_NAME} ${update.latest} is available (you have ${update.current})`, `${update.command || `npm i -D ${VITE_PACKAGE}@latest`}, then restart the dev server.${update.releaseUrl ? ` What's new: ${update.releaseUrl}` : ''}`);
      const presence = await getJson(io, `${base}/api/agent/presence`, session.token);
      if (!presence || presence.status === 401) add('fail', 'The session token was rejected', 'Restart the dev server to write a fresh session file.');
      else {
        const agents: any[] = presence.body?.agents || [];
        add(agents.length ? 'ok' : 'warn', agents.length ? `Agent connected: ${agents.map((a) => a.client).join(', ')}` : 'No agent connected right now',
          agents.length ? undefined : 'Start your agent in this project. Run /agent-hover in it (or tell it "Listen for agent-hover tasks") so it waits for what you send.');
      }
    }
  }

  // MCP registration, project files first, then global ones (read only).
  const projectFiles = MCP_CLIENTS.filter((c) => c.projectConfig).map((c) => [c.title, path.join(root, c.projectConfig!.file)] as [string, string]);
  const registered = [...projectFiles, ...globalConfigs(io.home)].filter(([, f]) => read(f)?.includes(BRAND.mcpServerName));
  add(registered.length ? 'ok' : 'fail',
    registered.length ? `MCP server registered for ${[...new Set(registered.map(([t]) => t))].join(', ')}` : 'MCP server not registered for any agent',
    registered.length ? undefined : `${BRAND.cliName} init, or ${BRAND.cliName} mcp <agent> for the config.`);

  const rules = MCP_CLIENTS.filter((c) => c.rulesFile).filter((c) => read(path.join(root, c.rulesFile!.file))?.includes(RULES_MARKER));
  add(rules.length ? 'ok' : 'warn', rules.length ? `Task rules in ${rules.map((c) => c.rulesFile!.file).join(', ')}` : 'No agent rules file mentions Agent Hover tasks',
    rules.length ? undefined : `${BRAND.cliName} rules prints the snippet (optional; listen mode works without it).`);

  const ignore = read(path.join(root, '.gitignore'));
  add(gitignoreCoversSession(ignore) ? 'ok' : 'warn', gitignoreCoversSession(ignore) ? `.gitignore keeps ${BRAND.dataDir}/session.json private` : `.gitignore does not cover ${BRAND.dataDir}/session.json (it holds the bridge token)`,
    gitignoreCoversSession(ignore) ? undefined : `${BRAND.cliName} init adds the entries.`);

  let dir = root;
  let git = false;
  for (;;) {
    if (existsSync(path.join(dir, '.git'))) { git = true; break; }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  add(git ? 'ok' : 'warn', git ? 'Git repository: Undo is available' : 'Not a git repository: Undo is off', git ? undefined : 'git init (Undo restores files from git checkpoints).');
  return checks;
}

export function renderChecks(checks: Check[], s: Style): string {
  const icon = { ok: s.ok('✓'), warn: s.todo('!'), fail: s.todo('✗') };
  const out = ['', `  ${s.bold(`${BRAND.name} doctor`)}`, ''];
  for (const c of checks) {
    out.push(`  ${icon[c.state]} ${c.label}`);
    if (c.fix) out.push(s.dim(`      ${c.fix}`));
  }
  const fails = checks.filter((c) => c.state === 'fail').length;
  const warns = checks.filter((c) => c.state === 'warn').length;
  out.push('', fails ? `  ${fails} problem${fails === 1 ? '' : 's'} to fix.` : warns ? `  Ready, with ${warns} note${warns === 1 ? '' : 's'}.` : '  All good.', '');
  return out.join('\n');
}
