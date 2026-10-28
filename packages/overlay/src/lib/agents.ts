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
  /** How you start listening in it (the command `init` adds); none means you say it. */
  listen?: string;
  /** What to do after `init`, so the agent loads the server: the step, then how. Shown in Settings only. */
  restart: [string, string];
}

const SERVER = 'agent-hover';
const ARGS = ['-y', '@agent-hover/mcp'];
const JSON_SNIPPET = JSON.stringify({ mcpServers: { [SERVER]: { command: 'npx', args: ARGS } } }, null, 2);
const TOML_SNIPPET = [`[mcp_servers.${SERVER}]`, 'command = "npx"', `args = [${ARGS.map((a) => JSON.stringify(a)).join(', ')}]`].join('\n');
const ADD = `${SERVER} -- npx ${ARGS.join(' ')}`;
const OPENCODE_SNIPPET = JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { [SERVER]: { type: 'local', command: ['npx', ...ARGS], enabled: true } } }, null, 2);

const GLOBAL = 'It reads a global config, and finds the dev server you have running.';

export const AGENT_SETUPS: AgentSetup[] = [
  { id: 'claude', title: 'Claude Code', command: `claude mcp add ${ADD}`, configPath: '.mcp.json (project) or ~/.claude.json (global)', snippet: JSON_SNIPPET, listen: '/agent-hover', restart: ['Restart Claude Code', 'in the project (terminal or desktop app) and approve .mcp.json when asked.'] },
  { id: 'cursor', title: 'Cursor', configPath: '.cursor/mcp.json (project) or ~/.cursor/mcp.json (global)', snippet: JSON_SNIPPET, listen: '/agent-hover', restart: ['Reload Cursor', 'and check that agent-hover is on in Settings › MCP.'] },
  { id: 'codex', title: 'Codex', command: `codex mcp add ${ADD}`, configPath: '~/.codex/config.toml (global) or .codex/config.toml (project)', snippet: TOML_SNIPPET, listen: '$agent-hover', restart: ['Restart Codex', 'in the project and trust it when asked.'] },
  { id: 'opencode', title: 'OpenCode', configPath: 'opencode.json (project) or ~/.config/opencode/opencode.json (global)', snippet: OPENCODE_SNIPPET, listen: '/agent-hover', restart: ['Restart OpenCode', 'in the project. opencode mcp list shows agent-hover as connected.'] },
  { id: 'windsurf', title: 'Windsurf', configPath: '~/.codeium/windsurf/mcp_config.json', snippet: JSON_SNIPPET, listen: '/agent-hover', restart: ['Restart Windsurf.', GLOBAL] },
  { id: 'antigravity', title: 'Antigravity', command: `agy mcp add ${ADD}`, configPath: '~/.gemini/config/mcp_config.json', snippet: JSON_SNIPPET, listen: '/agent-hover', restart: ['Restart Antigravity.', GLOBAL] },
  { id: 'claude-desktop', title: 'Claude Desktop', configPath: 'claude_desktop_config.json (Settings → Developer → Edit Config)', snippet: JSON_SNIPPET, restart: ['Restart Claude Desktop.', GLOBAL] },
];

/** The setup for a connected agent's MCP client name (claude-code, codex-mcp-client…). */
export function setupForClient(client: string): AgentSetup | undefined {
  const c = client.toLowerCase();
  const id = c.startsWith('claude-code') ? 'claude' : c.startsWith('codex') ? 'codex' : c === 'claude-ai' ? 'claude-desktop' : c.startsWith('cursor') ? 'cursor' : c;
  return AGENT_SETUPS.find((a) => a.id === id);
}

export const EDITORS: Array<[string, string]> = [
  ['cursor', 'Cursor'],
  ['vscode', 'VS Code'],
  ['windsurf', 'Windsurf'],
  ['zed', 'Zed'],
  ['webstorm', 'WebStorm'],
  ['antigravity', 'Antigravity'],
];
