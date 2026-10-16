import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND } from '../brand.js';
import { BRAND as CORE_BRAND } from '../../../core/src/brand.js';
import { run } from '../cli.js';
import { MCP_CLIENTS } from '../clients.js';
import { inspectProject, installCommand } from '../project.js';
import { PLAIN } from '../render.js';

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ah-cli-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

describe('agent-hover CLI', () => {
  it('keeps brand strings in sync with core (D-12)', async () => {
    expect(BRAND).toEqual(CORE_BRAND);
  });

  it('prints setup steps outside a project without inspecting anything', async () => {
    const r = await run([], fixture({}), PLAIN);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('npm install -D @agent-hover/vite');
    expect(r.stdout).toContain(MCP_CLIENTS[0].command!); // claude mcp add agent-hover -- npx -y … (cmd /c npx on Windows)
    expect(r.stdout).not.toContain('This project');
  });

  it('reports project status for a configured Vite + React app', async () => {
    const dir = fixture({
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: { '@agent-hover/vite': '^0.1.1' } }),
      'pnpm-lock.yaml': '',
      'vite.config.ts': "import agentHover from '@agent-hover/vite';",
      '.mcp.json': JSON.stringify({ mcpServers: { 'agent-hover': {} } }),
    });
    const info = inspectProject(dir);
    expect(info).toMatchObject({ packageManager: 'pnpm', viteConfig: 'vite.config.ts', pluginInstalled: true, pluginConfigured: true, usesReact: true, mcpConfigured: ['.mcp.json'] });
    const r = await run([], dir, PLAIN);
    expect(r.stdout).toContain('1. Install the Vite plugin ✓ done');
    expect(r.stdout).not.toContain('add -D @agent-hover/vite');
    expect(r.stdout).toContain('✓ MCP server registered (.mcp.json)');
  });

  it('flags missing pieces in an unconfigured project', async () => {
    const r = await run([], fixture({ 'package.json': '{}' }), PLAIN);
    expect(r.stdout).toContain('○ No Vite config found');
    expect(r.stdout).toContain('○ MCP server not registered');
    expect(r.stdout).toContain('npm install -D @agent-hover/vite');
  });

  it('uses the detected package manager in install steps', async () => {
    const r = await run([], fixture({ 'package.json': '{}', 'pnpm-lock.yaml': '' }), PLAIN);
    expect(r.stdout).toContain('pnpm add -D @agent-hover/vite');
  });

  it('survives a malformed package.json', async () => {
    expect(inspectProject(fixture({ 'package.json': '{ nope' })).hasPackageJson).toBe(true);
  });

  it('prints config for every MCP client by id', async () => {
    for (const c of MCP_CLIENTS) {
      const r = await run(['mcp', c.id], process.cwd(), PLAIN);
      expect(r.code).toBe(0);
      for (const line of c.snippet.split('\n')) expect(r.stdout).toContain(line);
    }
    expect((await run(['mcp', 'CODEX'], process.cwd(), PLAIN)).stdout).toContain('[mcp_servers.agent-hover]');
  });

  it('rejects unknown agents and commands with exit code 1', async () => {
    expect(await run(['mcp', 'nope'], process.cwd(), PLAIN)).toMatchObject({ code: 1 });
    const r = await run(['frobnicate'], process.cwd(), PLAIN);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Unknown command');
  });

  it('prints the rules snippet and version', async () => {
    expect((await run(['rules'], process.cwd(), PLAIN)).stdout).toContain('claim_agent_task');
    expect((await run(['rules'], process.cwd(), PLAIN)).stdout).toContain('wait_for_agent_task');
    expect((await run(['--version'], process.cwd(), PLAIN)).stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it('uses the right install command per package manager', async () => {
    expect(installCommand('yarn', 'x')).toBe('yarn add -D x');
    expect(installCommand('bun', 'x')).toBe('bun add -d x');
  });
});
