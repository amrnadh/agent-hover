import { BRAND, DISPLAY_NAME, VITE_PACKAGE } from './brand.js';
import { MCP_CLIENTS, RULES_SNIPPET, type McpClient } from './clients.js';
import { installCommand, type ProjectInfo } from './project.js';

export interface Style {
  bold(s: string): string;
  dim(s: string): string;
  ok(s: string): string;
  todo(s: string): string;
}

const ansi = (open: number, close: number) => (s: string) => `\x1b[${open}m${s}\x1b[${close}m`;
export const COLOR: Style = { bold: ansi(1, 22), dim: ansi(2, 22), ok: ansi(32, 39), todo: ansi(33, 39) };
export const PLAIN: Style = { bold: (s) => s, dim: (s) => s, ok: (s) => s, todo: (s) => s };

const indent = (text: string, n = 4) => text.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

function check(s: Style, done: boolean, label: string): string {
  return done ? `  ${s.ok('✓')} ${label}` : `  ${s.todo('○')} ${label}`;
}

export function renderOverview(p: ProjectInfo, s: Style): string {
  const out: string[] = [];
  out.push('', `  ${s.bold(DISPLAY_NAME)} ${s.dim('· point at your UI, your agent understands it')}`, '');
  const ready = p.pluginInstalled && p.pluginConfigured && p.mcpConfigured.length > 0;
  if (p.viteConfig && !ready) out.push(`  ${s.bold(`npx ${BRAND.cliName} init`)} sets all of this up for you.`, '');

  if (p.hasPackageJson) {
    out.push(s.dim('  This project'));
    out.push(check(s, !!p.viteConfig, p.viteConfig ? `Vite config found (${p.viteConfig})` : 'No Vite config found (Agent Hover needs Vite + React)'));
    if (p.viteConfig) out.push(check(s, p.usesReact, p.usesReact ? 'React detected' : 'React not found in dependencies'));
    out.push(check(s, p.pluginInstalled, p.pluginInstalled ? `${VITE_PACKAGE} installed` : `${VITE_PACKAGE} not installed`));
    out.push(check(s, p.pluginConfigured, p.pluginConfigured ? 'Plugin added to the Vite config' : 'Plugin not in the Vite config yet'));
    out.push(check(s, p.mcpConfigured.length > 0, p.mcpConfigured.length ? `MCP server registered (${p.mcpConfigured.join(', ')})` : 'MCP server not registered in this project'));
    out.push('');
  }

  const configFile = p.viteConfig ?? 'vite.config.ts';
  const step = (n: number, title: string, done: boolean) => s.bold(`  ${n}. ${title}`) + (done ? ' ' + s.ok('✓ done') : '');

  out.push(step(1, 'Install the Vite plugin', p.pluginInstalled));
  if (!p.pluginInstalled) out.push(indent(installCommand(p.packageManager, VITE_PACKAGE)));
  out.push('');
  out.push(step(2, `Add it to ${configFile}`, p.pluginConfigured));
  if (!p.pluginConfigured) {
    out.push(
      indent(
        [
          `import agentHover from '${VITE_PACKAGE}';`,
          '',
          'export default defineConfig({',
          '  plugins: [react(), agentHover()],',
          '});',
        ].join('\n'),
      ),
    );
  }
  out.push('');
  out.push(step(3, 'Connect your coding agent', p.mcpConfigured.length > 0));
  if (!p.mcpConfigured.length) out.push(indent(MCP_CLIENTS[0].command!));
  out.push(indent(s.dim(`Other agents: ${BRAND.cliName} mcp <${MCP_CLIENTS.map((c) => c.id).join('|')}>`)), '');
  out.push(s.bold('  4. Use it'));
  out.push(indent('Run your dev server, hold Alt, and click a component.'));
  out.push(indent('Type what to change and press Send. In your agent, run /agent-hover ($agent-hover in Codex) or say:'));
  out.push(indent(s.dim('"Listen for agent-hover tasks."')));
  out.push(indent('It picks up each task you send, does it, and waits for the next.'), '');
  out.push(s.dim(`  ${BRAND.cliName} doctor  check the setup and the agent connection`));
  out.push(s.dim(`  ${BRAND.cliName} rules   print a snippet for CLAUDE.md / AGENTS.md so agents pick up tasks`));
  out.push(s.dim(`  ${BRAND.cliName} help    all commands`), '');
  return out.join('\n');
}

export function renderClient(c: McpClient, s: Style): string {
  const out = ['', `  ${s.bold(c.title)}`, ''];
  if (c.command) out.push(indent(c.command), '', s.dim(`  Or add to ${c.configPath}:`));
  else out.push(s.dim(`  Add to ${c.configPath}:`));
  out.push('', indent(c.snippet), '');
  return out.join('\n');
}

export function renderClientList(s: Style): string {
  const out = ['', `  ${s.bold('Connect a coding agent')}`, ''];
  for (const c of MCP_CLIENTS) out.push(`  ${c.id.padEnd(16)}${c.title}`);
  out.push('', s.dim(`  Run ${BRAND.cliName} mcp <name> for the exact config.`), '');
  return out.join('\n');
}

export function renderRules(s: Style): string {
  return ['', s.dim('  Add this to CLAUDE.md, AGENTS.md, .cursorrules, or your agent\'s rules file:'), '', RULES_SNIPPET, ''].join('\n');
}

export function renderHelp(version: string, s: Style): string {
  return [
    '',
    `  ${s.bold(DISPLAY_NAME)} ${s.dim('v' + version)}`,
    '',
    `  ${BRAND.cliName}               setup steps, checked against this project`,
    `  ${BRAND.cliName} init          set it up: install, Vite config, agent MCP config, .gitignore`,
    `      --agent claude,cursor   which agents to connect (default: detected, else Claude Code)`,
    `      --dry-run               show the changes without making them`,
    `      --yes                   apply without asking`,
    `      --no-install            skip installing the package`,
    `  ${BRAND.cliName} doctor        check the setup, the dev server and the agent connection`,
    `  ${BRAND.cliName} mcp [agent]   MCP config for Claude Code, Cursor, Codex, and more`,
    `  ${BRAND.cliName} rules         agent rules snippet so agents pick up browser tasks`,
    `  ${BRAND.cliName} --version`,
    '',
    s.dim('  Only init writes files, and it shows every change and asks first.'),
    '',
  ].join('\n');
}
