/**
 * MCP setup per coding tool, shown in Settings › Agents.
 * Mirrors MCP_CLIENTS in packages/cli/src/clients.ts (the overlay is a browser bundle and cannot import the
 * CLI); `__tests__/agents.test.ts` fails if the two drift apart.
 */
export interface AgentSetup {
  id: string;
  title: string;
  command?: string;
  configPath: string;
  snippet: string;
}

const SERVER = 'agent-hover';
const ARGS = ['-y', '@agent-hover/mcp'];
const JSON_SNIPPET = JSON.stringify({ mcpServers: { [SERVER]: { command: 'npx', args: ARGS } } }, null, 2);
const TOML_SNIPPET = [`[mcp_servers.${SERVER}]`, 'command = "npx"', `args = [${ARGS.map((a) => JSON.stringify(a)).join(', ')}]`].join('\n');
const ADD = `${SERVER} -- npx ${ARGS.join(' ')}`;

export const AGENT_SETUPS: AgentSetup[] = [
  { id: 'claude', title: 'Claude Code', command: `claude mcp add ${ADD}`, configPath: '.mcp.json (project) or ~/.claude.json (global)', snippet: JSON_SNIPPET },
  { id: 'cursor', title: 'Cursor', configPath: '.cursor/mcp.json (project) or ~/.cursor/mcp.json (global)', snippet: JSON_SNIPPET },
  { id: 'codex', title: 'Codex', command: `codex mcp add ${ADD}`, configPath: '~/.codex/config.toml (global) or .codex/config.toml (project)', snippet: TOML_SNIPPET },
  { id: 'windsurf', title: 'Windsurf', configPath: '~/.codeium/windsurf/mcp_config.json', snippet: JSON_SNIPPET },
  { id: 'antigravity', title: 'Antigravity', command: `agy mcp add ${ADD}`, configPath: '~/.gemini/config/mcp_config.json', snippet: JSON_SNIPPET },
  { id: 'claude-desktop', title: 'Claude Desktop', configPath: 'claude_desktop_config.json (Settings → Developer → Edit Config)', snippet: JSON_SNIPPET },
];

export const EDITORS: Array<[string, string]> = [
  ['cursor', 'Cursor'],
  ['vscode', 'VS Code'],
  ['windsurf', 'Windsurf'],
  ['zed', 'Zed'],
  ['webstorm', 'WebStorm'],
  ['antigravity', 'Antigravity'],
];
