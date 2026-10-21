import { BRAND, MCP_PACKAGE } from './brand.js';

export interface McpClient {
  id: string;
  title: string;
  /** One-line command that registers the server, when the client has one. */
  command?: string;
  /** Where the config snippet goes. */
  configPath: string;
  snippet: string;
  /** Project-level MCP config `init` can write. Agents without one only have a global config (printed, never written). */
  projectConfig?: { file: string; format: 'json' | 'toml' | 'opencode' };
  /** Rules file `init` adds the task instructions to. */
  rulesFile?: { file: string; kind: 'markdown' | 'cursor-rule' };
  /** Project file that gives the agent a one-word way to start listening (`invoke`). A second one next to it shows
   * the tasks (statusCommand). */
  commandFile?: { file: string; kind: CommandKind; invoke: string };
  /** Global MCP config `init` writes after asking, relative to the home folder. The first is created if missing;
   * the others are only updated when they already exist (older locations the agent may still read). */
  globalConfig?: string[];
}

/** 'markdown-command': Markdown with a `description` front matter (Claude Code, OpenCode). */
export type CommandKind = 'markdown-command' | 'cursor-command' | 'codex-skill' | 'workflow';

/**
 * The status command next to a listen command: /agent-hover-status ($agent-hover-status in Codex). A plain name,
 * because some clients can't run MCP prompts by name: Claude Code's desktop app reads the underscores in
 * /mcp__agent-hover__status as formatting and refuses to send it.
 */
export function statusCommand(cmd: NonNullable<McpClient['commandFile']>): { file: string; kind: CommandKind; invoke: string } {
  return { file: cmd.file.replace(/agent-hover(\/SKILL\.md|\.md)$/, 'agent-hover-status$1'), kind: cmd.kind, invoke: cmd.invoke + '-status' };
}

/** OpenCode's config: an `mcp` map whose local servers take the whole command line as one array. */
export function opencodeMcpEntry(platform: NodeJS.Platform = process.platform) {
  const server = mcpServerEntry(platform);
  return { type: 'local', command: [server.command, ...server.args], enabled: true };
}
export const OPENCODE_SCHEMA = 'https://opencode.ai/config.json';

/** How agents start the MCP server. On Windows npx is a .cmd script, so agents need cmd /c to run it. */
export function mcpServerEntry(platform: NodeJS.Platform = process.platform): { command: string; args: string[] } {
  return platform === 'win32'
    ? { command: 'cmd', args: ['/c', 'npx', '-y', MCP_PACKAGE] }
    : { command: 'npx', args: ['-y', MCP_PACKAGE] };
}

// Mirrored in packages/overlay/src/lib/agents.ts (Settings › Agents); a test fails if they drift apart.
export function mcpClients(platform: NodeJS.Platform = process.platform): McpClient[] {
  const server = mcpServerEntry(platform);
  const jsonSnippet = JSON.stringify({ mcpServers: { [BRAND.mcpServerName]: server } }, null, 2);
  const tomlSnippet = [
    `[mcp_servers.${BRAND.mcpServerName}]`,
    `command = "${server.command}"`,
    `args = [${server.args.map((a) => JSON.stringify(a)).join(', ')}]`,
  ].join('\n');
  const addArgs = `${BRAND.mcpServerName} -- ${[server.command, ...server.args].join(' ')}`;
  const opencodeSnippet = JSON.stringify({ $schema: OPENCODE_SCHEMA, mcp: { [BRAND.mcpServerName]: opencodeMcpEntry(platform) } }, null, 2);
  return [
  {
    id: 'claude',
    title: 'Claude Code',
    command: `claude mcp add ${addArgs}`,
    configPath: '.mcp.json (project) or ~/.claude.json (global)',
    snippet: jsonSnippet,
    projectConfig: { file: '.mcp.json', format: 'json' },
    rulesFile: { file: 'CLAUDE.md', kind: 'markdown' },
    commandFile: { file: '.claude/commands/agent-hover.md', kind: 'markdown-command', invoke: '/agent-hover' },
  },
  {
    id: 'cursor',
    title: 'Cursor',
    configPath: '.cursor/mcp.json (project) or ~/.cursor/mcp.json (global)',
    snippet: jsonSnippet,
    projectConfig: { file: '.cursor/mcp.json', format: 'json' },
    rulesFile: { file: '.cursor/rules/agent-hover.mdc', kind: 'cursor-rule' },
    commandFile: { file: '.cursor/commands/agent-hover.md', kind: 'cursor-command', invoke: '/agent-hover' },
  },
  {
    id: 'codex',
    title: 'Codex',
    command: `codex mcp add ${addArgs}`,
    configPath: '~/.codex/config.toml (global) or .codex/config.toml (project)',
    snippet: tomlSnippet,
    projectConfig: { file: '.codex/config.toml', format: 'toml' },
    rulesFile: { file: 'AGENTS.md', kind: 'markdown' },
    commandFile: { file: '.agents/skills/agent-hover/SKILL.md', kind: 'codex-skill', invoke: '$agent-hover' },
  },
  {
    id: 'opencode',
    title: 'OpenCode',
    configPath: 'opencode.json (project) or ~/.config/opencode/opencode.json (global)',
    snippet: opencodeSnippet,
    projectConfig: { file: 'opencode.json', format: 'opencode' },
    rulesFile: { file: 'AGENTS.md', kind: 'markdown' },
    commandFile: { file: '.opencode/commands/agent-hover.md', kind: 'markdown-command', invoke: '/agent-hover' },
  },
  {
    id: 'windsurf',
    title: 'Windsurf',
    configPath: '~/.codeium/windsurf/mcp_config.json',
    snippet: jsonSnippet,
    commandFile: { file: '.windsurf/workflows/agent-hover.md', kind: 'workflow', invoke: '/agent-hover' },
    globalConfig: ['.codeium/windsurf/mcp_config.json'],
  },
  {
    id: 'antigravity',
    title: 'Antigravity',
    command: `agy mcp add ${addArgs}`,
    configPath: '~/.gemini/config/mcp_config.json',
    snippet: jsonSnippet,
    commandFile: { file: '.agent/workflows/agent-hover.md', kind: 'workflow', invoke: '/agent-hover' },
    globalConfig: ['.gemini/config/mcp_config.json', '.gemini/antigravity/mcp_config.json'],
  },
  {
    id: 'claude-desktop',
    title: 'Claude Desktop',
    configPath: 'claude_desktop_config.json (Settings → Developer → Edit Config)',
    snippet: jsonSnippet,
  },
];
}

export const MCP_CLIENTS: McpClient[] = mcpClients();

export function findClient(id: string): McpClient | undefined {
  const key = id.toLowerCase();
  return MCP_CLIENTS.find((c) => c.id === key || c.title.toLowerCase() === key);
}

/** Agent rules snippet (spec §7.14) that teaches the agent how to handle browser tasks. */
export const RULES_SNIPPET = `## ${BRAND.name} tasks
When I say I sent a task from the browser (or mention ${BRAND.name}):
1. Call \`list_agent_tasks\` and pick the relevant queued task.
2. Call \`claim_agent_task\` for it and follow its instructions and scope exactly.
3. Make the change. Never modify components the task lists as locked.
4. Call \`complete_agent_task\` with a one-paragraph summary and the files you changed.

When I say "listen for ${BRAND.name} tasks", loop: call \`wait_for_agent_task\` (it claims the task for you),
do the task, call \`complete_agent_task\`, then call \`wait_for_agent_task\` again. Stop when I say I'm done.`;
