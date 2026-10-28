#!/usr/bin/env node
// Fresh-project smoke test, as a new user would meet Agent Hover: a new Vite + React app, the packages as npm
// would publish them (packed tarballs), `agent-hover init` for several agents (global configs go to a temp home),
// the dev server, `agent-hover doctor`, and an MCP server that connects and shows up as an agent.
// Needs the packages built (npm run build) and network access for React and Vite. Runs on macOS, Linux and Windows.
// Usage: node scripts/smoke-fresh.mjs [--keep]
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const keep = process.argv.includes('--keep');
const win = process.platform === 'win32';
// The real path: Windows CI's temp folder is C:\Users\RUNNER~1\…, a short name Vite won't serve files from.
const tmp = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'ah-smoke-')));
const tarballs = path.join(tmp, 'tarballs');
const app = path.join(tmp, 'app');
const home = path.join(tmp, 'home');
mkdirSync(tarballs);
mkdirSync(app);
mkdirSync(home);

const env = { ...process.env, HOME: home, USERPROFILE: home, AGENT_HOVER_NO_UPDATE_CHECK: '1' };
const step = (title) => console.log(`\n[smoke] ${title}`);
function run(cmd, args, cwd, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8', shell: win, ...opts });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  }
  return r.stdout || '';
}
const check = (ok, what) => { if (!ok) throw new Error(`expected: ${what}`); console.log(`  ✓ ${what}`); };
// The same React and Vite ranges the demo uses.
const demoPkg = JSON.parse(readFileSync(path.join(root, 'demo', 'package.json'), 'utf8'));
const range = (pkg) => demoPkg.dependencies?.[pkg] || demoPkg.devDependencies?.[pkg];

let devServer = null;
try {
  step('pack the packages');
  for (const dir of ['core', 'overlay', 'vite', 'mcp', 'cli']) {
    run('npm', ['pack', '--silent', '--ignore-scripts', '--pack-destination', tarballs], path.join(root, 'packages', dir), { stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const tgz = readdirSync(tarballs).map((f) => path.join(tarballs, f));

  step('create a Vite + React app');
  writeFileSync(path.join(app, 'package.json'), JSON.stringify({
    name: 'smoke-app', private: true, type: 'module', scripts: { dev: 'vite' },
    dependencies: { react: range('react'), 'react-dom': range('react-dom') },
    devDependencies: { vite: range('vite'), '@vitejs/plugin-react': range('@vitejs/plugin-react') },
  }, null, 2));
  writeFileSync(path.join(app, 'vite.config.ts'), `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`);
  writeFileSync(path.join(app, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n');
  mkdirSync(path.join(app, 'src'));
  writeFileSync(path.join(app, 'src', 'main.jsx'), `import { createRoot } from 'react-dom/client';\nfunction App() { return <button id="cta">Hello</button>; }\ncreateRoot(document.getElementById('root')).render(<App />);\n`);
  writeFileSync(path.join(app, '.gitignore'), 'node_modules\n');
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], app);
  // What `init` would install from npm, here from the tarballs (the new version is not published yet).
  run('npm', ['install', '-D', '--no-audit', '--no-fund', '--loglevel=error', ...tgz], app);

  step('agent-hover init');
  const initOut = run('npx', ['agent-hover', 'init', '--yes', '--no-install', '--agent', 'claude,cursor,codex,antigravity'], app);
  const has = (rel, base = app) => existsSync(path.join(base, rel));
  const text = (rel, base = app) => readFileSync(path.join(base, rel), 'utf8');
  check(text('vite.config.ts').includes('agentHover()'), 'the plugin is in vite.config.ts');
  check(JSON.parse(text('.mcp.json')).mcpServers['agent-hover'], 'Claude Code: .mcp.json');
  check(JSON.parse(text('.cursor/mcp.json')).mcpServers['agent-hover'], 'Cursor: .cursor/mcp.json');
  check(text('.codex/config.toml').includes('[mcp_servers.agent-hover]'), 'Codex: .codex/config.toml');
  check(JSON.parse(text('.gemini/config/mcp_config.json', home)).mcpServers['agent-hover'], 'Antigravity: global config in the home folder');
  for (const f of ['.claude/commands/agent-hover.md', '.cursor/commands/agent-hover.md', '.agents/skills/agent-hover/SKILL.md', '.agent/workflows/agent-hover.md']) check(has(f), `listen command: ${f}`);
  if (win) check(text('.mcp.json').includes('"cmd"'), 'Windows: agents start the server through cmd');
  check(/Start listening: .*\/agent-hover/.test(initOut), 'init tells you to run /agent-hover');

  step('dev server, doctor, and an agent connecting');
  devServer = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: app, env, shell: win, detached: !win, stdio: 'ignore' });
  const sessionFile = path.join(app, '.agent-hover', 'session.json');
  for (let i = 0; i < 120 && !existsSync(sessionFile); i++) await new Promise((r) => setTimeout(r, 500));
  check(existsSync(sessionFile), 'the bridge wrote its session file');
  const res = await fetch('http://localhost:5199/');
  const page = await res.text();
  if (!page.includes('__AGENT_HOVER_BOOTSTRAP__')) console.error(`  page (${res.status}): ${page.slice(0, 400)}`);
  check(page.includes('__AGENT_HOVER_BOOTSTRAP__'), 'the page loads the overlay');
  const doctor = spawnSync('npx', ['agent-hover', 'doctor'], { cwd: app, env, encoding: 'utf8', shell: win });
  check(doctor.status === 0 && doctor.stdout.includes('Bridge running'), 'doctor passes');

  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const client = new Client({ name: 'claude-code', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.join(app, 'node_modules', '@agent-hover', 'mcp', 'dist', 'index.js')],
    cwd: app, env, stderr: 'ignore',
  }));
  check(client.getInstructions()?.includes('wait_for_agent_task'), 'the MCP server tells the agent how to listen');
  check((await client.listPrompts()).prompts.some((p) => p.name === 'listen'), 'the MCP server offers the listen prompt');
  const { port, token } = JSON.parse(readFileSync(sessionFile, 'utf8'));
  const presence = async () => (await fetch(`http://127.0.0.1:${port}/api/agent/presence`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())).agents;
  let agents = [];
  for (let i = 0; i < 40 && !agents.length; i++) { agents = await presence(); if (!agents.length) await new Promise((r) => setTimeout(r, 250)); }
  check(agents.some((a) => a.client === 'claude-code'), 'the agent shows up as connected');
  await client.close();
  for (let i = 0; i < 20 && (await presence()).length; i++) await new Promise((r) => setTimeout(r, 250));
  check(!(await presence()).length, 'closing the agent removes it at once');

  // A global MCP config (Antigravity, Windsurf) starts the server outside the project: it finds the dev server
  // through the list in the home folder.
  const outside = new Client({ name: 'antigravity', version: '1.0.0' });
  await outside.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.join(app, 'node_modules', '@agent-hover', 'mcp', 'dist', 'index.js')],
    cwd: home, env, stderr: 'ignore',
  }));
  agents = [];
  for (let i = 0; i < 40 && !agents.length; i++) { agents = await presence(); if (!agents.length) await new Promise((r) => setTimeout(r, 250)); }
  check(agents.some((a) => a.client === 'antigravity'), 'an agent started outside the project connects too');
  const listed = await outside.callTool({ name: 'list_agent_tasks', arguments: {} });
  check(!listed.isError, 'and its requests are authorized');
  await outside.close();

  console.log('\n[smoke] all good');
} catch (err) {
  console.error(`\n[smoke] failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (devServer?.pid) {
    try {
      if (win) spawnSync('taskkill', ['/pid', String(devServer.pid), '/T', '/F']);
      else process.kill(-devServer.pid, 'SIGTERM');
    } catch { /* already gone */ }
  }
  if (keep) console.log(`[smoke] kept ${tmp}`);
  else setTimeout(() => rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }), 500);
}
