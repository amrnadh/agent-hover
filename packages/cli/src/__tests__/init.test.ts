import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { MCP_CLIENTS, mcpClients } from '../clients.js';
import type { DoctorIO } from '../doctor.js';
import type { InitIO } from '../init.js';
import { PLAIN } from '../render.js';
import { gitignoreCoversSession, mergeGitignore, mergeJsonMcp, mergeRules, mergeTomlMcp, RULES_MARKER } from '../setup-files.js';
import { addPluginToViteConfig } from '../vite-config.js';
import { AGENT_SETUPS } from '../../../overlay/src/lib/agents.js';

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ah-init-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}
const read = (dir: string, f: string) => readFileSync(path.join(dir, f), 'utf8');

const VITE_TS = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});
`;

/** A fake terminal: no prompts, records commands instead of running them. */
function fakeIO(answers: string[] = [], home = mkdtempSync(path.join(tmpdir(), 'ah-home-'))): InitIO & { commands: string[] } {
  const commands: string[] = [];
  return {
    interactive: answers.length > 0,
    home,
    commands,
    ask: async () => answers.shift() ?? '',
    exec: (cmd, args) => { commands.push([cmd, ...args].join(' ')); return 0; },
    out: () => {},
  };
}

describe('vite config edit', () => {
  it('adds the import and the plugin to a standard config', () => {
    const r = addPluginToViteConfig(VITE_TS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("import react from '@vitejs/plugin-react';\nimport agentHover from '@agent-hover/vite';");
    expect(r.code).toContain('plugins: [react(), agentHover()],');
  });

  it('handles multi-line arrays, trailing commas, comments and strings with brackets', () => {
    const src = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    react({ babel: { plugins: ['x[1]'] } }),
    tailwind(),
    // pwa(), turn on later
  ],
  resolve: { alias: { '@': '/src' } },
}))
`;
    const r = addPluginToViteConfig(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("    tailwind(),\n    agentHover(),\n    // pwa(), turn on later\n  ],");
    // No semicolons in this file, so none on the new import either.
    expect(r.code).toContain("import tailwind from '@tailwindcss/vite'\nimport agentHover from '@agent-hover/vite'\n");
  });

  it('fills an empty array and leaves configured or unusual configs alone', () => {
    const empty = addPluginToViteConfig("import { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [] });\n");
    expect(empty.ok && empty.code).toContain('plugins: [agentHover()]');
    const done = "import agentHover from '@agent-hover/vite';\nexport default { plugins: [agentHover()] };";
    expect(addPluginToViteConfig(done)).toEqual({ ok: true, code: done });
    expect(addPluginToViteConfig("export default { plugins: getPlugins() }").ok).toBe(false);
    expect(addPluginToViteConfig("const a = { plugins: [] }; const b = { plugins: [] };").ok).toBe(false);
    expect(addPluginToViteConfig("const react = require('x');\nmodule.exports = { plugins: [react()] };").ok).toBe(false);
    // A `plugins: [` inside a comment is not the config.
    const commented = addPluginToViteConfig("// plugins: [old()]\nexport default { plugins: [a()] };");
    expect(commented.ok && commented.code).toContain('plugins: [a(), agentHover()]');
  });
});

describe('setup file merges', () => {
  it('adds the MCP server to JSON without touching other servers, and only once', () => {
    const r = mergeJsonMcp(JSON.stringify({ mcpServers: { other: { command: 'x' } }, keep: true }));
    expect(r.ok).toBe(true);
    const json = JSON.parse((r as any).content);
    expect(json.mcpServers.other).toEqual({ command: 'x' });
    expect(json.mcpServers['agent-hover']).toEqual({ command: 'npx', args: ['-y', '@agent-hover/mcp'] });
    expect(json.keep).toBe(true);
    expect(mergeJsonMcp((r as any).content)).toEqual({ ok: true, content: null });
    expect(mergeJsonMcp('{ // comment\n}').ok).toBe(false);
    expect(JSON.parse((mergeJsonMcp(null) as any).content).mcpServers['agent-hover']).toBeTruthy();
  });

  it('starts the server through cmd on Windows, where npx is a script', () => {
    const json = JSON.parse(mergeJsonMcp(null, 'win32').ok ? (mergeJsonMcp(null, 'win32') as any).content : '{}');
    expect(json.mcpServers['agent-hover']).toEqual({ command: 'cmd', args: ['/c', 'npx', '-y', '@agent-hover/mcp'] });
    expect((mergeTomlMcp(null, 'win32') as any).content).toContain('command = "cmd"');
    expect(mcpClients('win32').find((c) => c.id === 'claude')!.command).toBe('claude mcp add agent-hover -- cmd /c npx -y @agent-hover/mcp');
    expect(JSON.parse((mergeJsonMcp(null, 'darwin') as any).content).mcpServers['agent-hover'].command).toBe('npx');
  });

  it('appends a TOML table once', () => {
    const r = mergeTomlMcp('model = "o3"\n');
    expect((r as any).content).toBe('model = "o3"\n\n[mcp_servers.agent-hover]\ncommand = "npx"\nargs = ["-y", "@agent-hover/mcp"]\n');
    expect(mergeTomlMcp((r as any).content)).toEqual({ ok: true, content: null });
  });

  it('appends rules once and creates Cursor rules with frontmatter', () => {
    const md = mergeRules('# Project\n', 'markdown');
    expect((md as any).content).toMatch(/^# Project\n\n## agent-hover tasks/);
    expect(mergeRules((md as any).content, 'markdown')).toEqual({ ok: true, content: null });
    expect((mergeRules(null, 'cursor-rule') as any).content).toMatch(/^---\ndescription: .*\nalwaysApply: true\n---\n\n## agent-hover tasks/);
  });

  it('ignores the session token and local data, keeping comments committable', () => {
    const r = mergeGitignore('node_modules\n');
    const text = (r as any).content as string;
    expect(text).toContain('.agent-hover/session.json');
    expect(text).toContain('.agent-hover/checkpoints/');
    expect(text).not.toContain('comments.json');
    expect(gitignoreCoversSession(text)).toBe(true);
    expect(mergeGitignore(text)).toEqual({ ok: true, content: null });
    expect(mergeGitignore('.agent-hover/\n')).toEqual({ ok: true, content: null });
    expect(gitignoreCoversSession('node_modules')).toBe(false);
  });
});

describe('agent-hover init', () => {
  const app = () => fixture({ 'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }), 'vite.config.ts': VITE_TS, '.gitignore': 'node_modules\n' });

  it('--dry-run shows the plan and writes nothing', async () => {
    const dir = app();
    const before = readdirSync(dir).sort();
    const io = fakeIO();
    let out = '';
    const r = await run(['init', '--dry-run', '--agent', 'claude'], dir, PLAIN, { init: { ...io, out: (t) => { out += t; } } });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('+ Install @agent-hover/vite');
    expect(r.stdout).toContain('+ Add the plugin to vite.config.ts');
    expect(r.stdout).toContain('create .mcp.json');
    expect(r.stdout).toContain('Dry run: nothing was changed');
    expect(readdirSync(dir).sort()).toEqual(before);
    expect(read(dir, 'vite.config.ts')).toBe(VITE_TS);
    expect(io.commands).toEqual([]);
    expect(out).toBe('');
  });

  it('--yes sets up Claude Code and Cursor; a second run changes nothing', async () => {
    const dir = app();
    const io = fakeIO();
    const r = await run(['init', '--yes', '--agent=claude,cursor'], dir, PLAIN, { init: io });
    expect(r.code).toBe(0);
    expect(io.commands).toEqual(['npm install -D @agent-hover/vite']);
    expect(read(dir, 'vite.config.ts')).toContain('plugins: [react(), agentHover()]');
    expect(JSON.parse(read(dir, '.mcp.json')).mcpServers['agent-hover']).toBeTruthy();
    expect(JSON.parse(read(dir, '.cursor/mcp.json')).mcpServers['agent-hover']).toBeTruthy();
    expect(read(dir, 'CLAUDE.md')).toContain(RULES_MARKER);
    expect(read(dir, '.cursor/rules/agent-hover.mdc')).toContain('alwaysApply: true');
    expect(read(dir, '.gitignore')).toContain('.agent-hover/session.json');

    // The package would now be in package.json; the second run has nothing left to do.
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: { '@agent-hover/vite': '^0.2.0' } }));
    const snapshot = Object.fromEntries(['vite.config.ts', '.mcp.json', 'CLAUDE.md', '.gitignore'].map((f) => [f, read(dir, f)]));
    const again = await run(['init', '--yes', '--agent=claude,cursor'], dir, PLAIN, { init: fakeIO() });
    expect(again.stdout).toContain('Everything is set up');
    for (const [f, text] of Object.entries(snapshot)) expect(read(dir, f)).toBe(text);
  });

  it('merges into existing config and keeps a backup', async () => {
    const dir = app();
    writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { db: { command: 'db-mcp' } } }));
    await run(['init', '--yes', '--no-install', '--agent', 'claude'], dir, PLAIN, { init: fakeIO() });
    expect(JSON.parse(read(dir, '.mcp.json')).mcpServers).toMatchObject({ db: { command: 'db-mcp' }, 'agent-hover': {} });
    expect(JSON.parse(read(dir, '.mcp.json.bak')).mcpServers).toEqual({ db: { command: 'db-mcp' } });
  });

  it('uses detected agents, asks before applying, and stops on "n"', async () => {
    const dir = app();
    mkdirSync(path.join(dir, '.cursor'));
    const declined = await run(['init'], dir, PLAIN, { init: fakeIO(['', 'n']) });
    expect(declined.stdout).toContain('Connect Cursor');
    expect(declined.code).toBe(1);
    expect(existsSync(path.join(dir, '.cursor/mcp.json'))).toBe(false);
  });

  it('prints manual steps for unusual configs and plans global configs in the home folder', async () => {
    const dir = fixture({ 'package.json': '{}', 'vite.config.ts': 'export default getConfig();\n' });
    const r = await run(['init', '--dry-run', '--agent', 'windsurf'], dir, PLAIN, { init: fakeIO() });
    expect(r.stdout).toContain('! Add the plugin to vite.config.ts');
    expect(r.stdout).toContain("import agentHover from '@agent-hover/vite';");
    expect(r.stdout).toContain('+ Connect Windsurf (MCP server, global config)');
    expect(r.stdout).toContain('create ~/.codeium/windsurf/mcp_config.json');
  });

  it('adds a one-word listen command for each agent, in its own format, once', async () => {
    const dir = app();
    const io = fakeIO();
    await run(['init', '--yes', '--no-install', '--agent=claude,cursor,codex,windsurf,antigravity'], dir, PLAIN, { init: io });
    expect(read(dir, '.claude/commands/agent-hover.md')).toMatch(/^---\ndescription: .+\n---\n\nListen for Agent Hover tasks\./);
    expect(read(dir, '.cursor/commands/agent-hover.md')).toMatch(/^Listen for Agent Hover tasks\./);
    expect(read(dir, '.agents/skills/agent-hover/SKILL.md')).toMatch(/^---\nname: agent-hover\ndescription: /);
    expect(read(dir, '.windsurf/workflows/agent-hover.md')).toContain('wait_for_agent_task');
    expect(read(dir, '.agent/workflows/agent-hover.md')).toContain('wait_for_agent_task');
    // Someone's own command with the same name is left alone.
    const other = fixture({ 'package.json': '{}', 'vite.config.ts': VITE_TS, '.claude/commands/agent-hover.md': 'my own\n' });
    const r = await run(['init', '--dry-run', '--no-install', '--agent', 'claude'], other, PLAIN, { init: fakeIO() });
    expect(r.stdout).toContain('already exists with other content');
    expect(read(other, '.claude/commands/agent-hover.md')).toBe('my own\n');
  });

  it('writes global configs for Antigravity and Windsurf, including an older Antigravity location only if it exists', async () => {
    const home = mkdtempSync(path.join(tmpdir(), 'ah-home-'));
    mkdirSync(path.join(home, '.gemini/antigravity'), { recursive: true });
    writeFileSync(path.join(home, '.gemini/antigravity/mcp_config.json'), JSON.stringify({ mcpServers: { db: { command: 'db' } } }));
    const dir = app();
    let asked = '';
    const io = { ...fakeIO(['', 'y'], home), ask: async (q: string) => { asked += q; return asked.includes('Apply') ? 'y' : ''; } };
    await run(['init', '--no-install', '--agent=antigravity,windsurf'], dir, PLAIN, { init: io });
    expect(asked).toContain('in your home folder');
    expect(JSON.parse(read(home, '.gemini/config/mcp_config.json')).mcpServers['agent-hover']).toBeTruthy();
    expect(JSON.parse(read(home, '.gemini/antigravity/mcp_config.json')).mcpServers).toMatchObject({ db: {}, 'agent-hover': {} });
    expect(JSON.parse(read(home, '.codeium/windsurf/mcp_config.json')).mcpServers['agent-hover']).toBeTruthy();
    // Without the older Antigravity file, only the current one is planned.
    const fresh = await run(['init', '--dry-run', '--agent', 'antigravity'], app(), PLAIN, { init: fakeIO() });
    expect(fresh.stdout).toContain('~/.gemini/config/mcp_config.json');
    expect(fresh.stdout).not.toContain('~/.gemini/antigravity');
  });

  it('refuses non-Vite projects and unknown agents', async () => {
    expect((await run(['init', '--yes'], fixture({ 'package.json': '{}' }), PLAIN, { init: fakeIO() })).stdout).toContain('No Vite config');
    expect((await run(['init', '--yes', '--agent', 'nope'], app(), PLAIN, { init: fakeIO() })).code).toBe(1);
  });

  it('needs --yes when there is no terminal to ask', async () => {
    const r = await run(['init', '--agent', 'claude'], app(), PLAIN, { init: fakeIO() });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('Run with --yes');
  });
});

describe('agent-hover doctor', () => {
  let server: Server | null = null;
  afterEach(() => { server?.close(); server = null; });

  const io = (overrides: Partial<DoctorIO> = {}): DoctorIO => ({
    fetch: globalThis.fetch,
    home: fixture({}),
    nodeVersion: '22.1.0',
    isPidAlive: () => true,
    ...overrides,
  });

  async function fakeBridge(token: string, agents: unknown[]) {
    server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/health') return res.end(JSON.stringify({ ok: true, version: '0.2.0' }));
      if (req.headers.authorization !== `Bearer ${token}`) { res.statusCode = 401; return res.end('{}'); }
      res.end(JSON.stringify({ agents }));
    });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    return (server!.address() as any).port as number;
  }

  it('passes a fully set up project with a running bridge and a connected agent', async () => {
    const port = await fakeBridge('t0k', [{ client: 'claude-code' }]);
    const dir = fixture({
      'package.json': JSON.stringify({ dependencies: { react: '19' }, devDependencies: { '@agent-hover/vite': '0.2.0' } }),
      'node_modules/@agent-hover/vite/package.json': JSON.stringify({ version: '0.2.0' }),
      'vite.config.ts': "import agentHover from '@agent-hover/vite';",
      '.mcp.json': '{"mcpServers":{"agent-hover":{}}}',
      'CLAUDE.md': RULES_MARKER,
      '.gitignore': '.agent-hover/\n',
      '.git/HEAD': 'ref: refs/heads/main',
      '.agent-hover/session.json': JSON.stringify({ port, token: 't0k', pid: 1 }),
    });
    const r = await run(['doctor'], dir, PLAIN, { doctor: io() });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(`✓ Bridge running on port ${port} (0.2.0)`);
    expect(r.stdout).toContain('✓ Agent connected: claude-code');
    expect(r.stdout).toContain('✓ MCP server registered for Claude Code');
    expect(r.stdout).toContain('All good.');
  });

  it('explains what is missing, and fails on a rejected token', async () => {
    const port = await fakeBridge('right', []);
    const dir = fixture({
      'package.json': '{}',
      'vite.config.ts': 'export default {}',
      '.agent-hover/session.json': JSON.stringify({ port, token: 'wrong', pid: 1 }),
    });
    const r = await run(['doctor'], dir, PLAIN, { doctor: io({ nodeVersion: '18.19.0' }) });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('✗ Node 18.19.0');
    expect(r.stdout).toContain('✗ @agent-hover/vite is not a dependency');
    expect(r.stdout).toContain('✗ The session token was rejected');
    expect(r.stdout).toContain('✗ MCP server not registered');
    expect(r.stdout).toContain('! .gitignore does not cover .agent-hover/session.json');
  });

  it('finds a global MCP registration and reports a stopped dev server', async () => {
    const home = fixture({ '.cursor/mcp.json': '{"mcpServers":{"agent-hover":{}}}' });
    const dir = fixture({ 'package.json': '{}', 'vite.config.ts': '', '.agent-hover/session.json': JSON.stringify({ port: 1, token: 'x', pid: 999999 }) });
    const r = await run(['doctor'], dir, PLAIN, { doctor: io({ home, isPidAlive: () => false }) });
    expect(r.stdout).toContain('✓ MCP server registered for Cursor');
    expect(r.stdout).toContain('! Dev server not running (stale session file)');
  });
});

describe('listen command', () => {
  it('is the same text as the MCP server\'s listen prompt', async () => {
    const { LISTEN_PROMPT } = await import('../setup-files.js');
    const mcp = await import('../../../mcp/src/index.js');
    expect(LISTEN_PROMPT).toBe(mcp.LISTEN_PROMPT);
  });
});

describe('Settings › Agents', () => {
  it('shows the same setup as the CLI', () => {
    // The overlay shows the macOS/Linux form; Windows gets a note there (cmd /c npx).
    const cli = mcpClients('darwin').map(({ id, title, command, configPath, snippet }) => ({ id, title, command, configPath, snippet }));
    expect(AGENT_SETUPS.map(({ id, title, command, configPath, snippet }) => ({ id, title, command, configPath, snippet }))).toEqual(cli);
  });
});
