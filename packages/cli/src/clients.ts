import { BRAND, MCP_PACKAGE } from './brand.js';

export interface McpClient {
  id: string;
  title: string;
  /** One-line command that registers the server, when the client has one. */
  command?: string;
  /** Where the config snippet goes. */
  configPath: string;
  snippet: string;
}

const serverArgs = ['-y', MCP_PACKAGE];

const jsonSnippet = JSON.stringify(
  { mcpServers: { [BRAND.mcpServerName]: { command: 'npx', args: serverArgs } } },
  null,
  2,
);

const tomlSnippet = [
  `[mcp_servers.${BRAND.mcpServerName}]`,
  'command = "npx"',
  `args = [${serverArgs.map((a) => JSON.stringify(a)).join(', ')}]`,
].join('\n');

const addArgs = `${BRAND.mcpServerName} -- npx ${serverArgs.join(' ')}`;

// Keep in sync with the MCP setup modal in packages/overlay/src/ui/mcp-modal.ts.
export const MCP_CLIENTS: McpClient[] = [
  {
    id: 'claude',
    title: 'Claude Code',
    command: `claude mcp add ${addArgs}`,
    configPath: '.mcp.json (project) or ~/.claude.json (global)',
    snippet: jsonSnippet,
  },
  {
    id: 'cursor',
    title: 'Cursor',
    configPath: '.cursor/mcp.json (project) or ~/.cursor/mcp.json (global)',
    snippet: jsonSnippet,
  },
  {
    id: 'codex',
    title: 'Codex',
    command: `codex mcp add ${addArgs}`,
    configPath: '~/.codex/config.toml (global) or .codex/config.toml (project)',
    snippet: tomlSnippet,
  },
  {
    id: 'windsurf',
    title: 'Windsurf',
    configPath: '~/.codeium/windsurf/mcp_config.json',
    snippet: jsonSnippet,
  },
  {
    id: 'antigravity',
    title: 'Antigravity',
    command: `agy mcp add ${addArgs}`,
    configPath: '~/.gemini/config/mcp_config.json',
    snippet: jsonSnippet,
  },
  {
    id: 'claude-desktop',
    title: 'Claude Desktop',
    configPath: 'claude_desktop_config.json (Settings → Developer → Edit Config)',
    snippet: jsonSnippet,
  },
];

export function findClient(id: string): McpClient | undefined {
  const key = id.toLowerCase();
  return MCP_CLIENTS.find((c) => c.id === key || c.title.toLowerCase() === key);
}

/** Agent rules snippet (spec §7.14) that teaches the agent how to handle browser tasks. */
export const RULES_SNIPPET = `## ${BRAND.name} tasks
When I say I sent a task from the browser (or mention ${BRAND.name}):
1. Call \`list_agent_tasks\` and pick the relevant queued task.
2. Call \`claim_agent_task\` for it and follow its instructions and scope exactly.
3. Make the change. Respect FROZEN components; do not modify them.
4. Call \`complete_agent_task\` with a one-paragraph summary and the files you changed.

When I say "listen for ${BRAND.name} tasks", loop: call \`wait_for_agent_task\` (it claims the task for you),
do the task, call \`complete_agent_task\`, then call \`wait_for_agent_task\` again. Stop when I say I'm done.`;
