import { BRAND } from './brand.js';
import { mcpServerEntry, RULES_SNIPPET, type CommandKind } from './clients.js';

/** Result of merging our entry into an existing (or missing) file. `content` is null when nothing changes. */
export type Merge = { ok: true; content: string | null } | { ok: false; reason: string };

/** Add the MCP server to a JSON config (`.mcp.json`, `.cursor/mcp.json`), keeping every other entry. */
export function mergeJsonMcp(existing: string | null, platform: NodeJS.Platform = process.platform): Merge {
  let config: any = {};
  if (existing && existing.trim()) {
    try {
      config = JSON.parse(existing);
    } catch {
      return { ok: false, reason: 'not plain JSON (comments or trailing commas?)' };
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) return { ok: false, reason: 'not a JSON object' };
  }
  if (config.mcpServers?.[BRAND.mcpServerName]) return { ok: true, content: null };
  if (config.mcpServers !== undefined && (typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers))) {
    return { ok: false, reason: '`mcpServers` is not an object' };
  }
  config.mcpServers = { ...config.mcpServers, [BRAND.mcpServerName]: mcpServerEntry(platform) };
  return { ok: true, content: JSON.stringify(config, null, 2) + '\n' };
}

/** Add the MCP server to a Codex TOML config. Appends a table; never rewrites what is there. */
export function mergeTomlMcp(existing: string | null, platform: NodeJS.Platform = process.platform): Merge {
  const SERVER = mcpServerEntry(platform);
  const header = `[mcp_servers.${BRAND.mcpServerName}]`;
  const text = existing || '';
  if (text.split('\n').some((l) => l.trim() === header || l.trim() === `[mcp_servers."${BRAND.mcpServerName}"]`)) return { ok: true, content: null };
  const table = [header, `command = "${SERVER.command}"`, `args = [${SERVER.args.map((a) => JSON.stringify(a)).join(', ')}]`].join('\n');
  return { ok: true, content: (text ? text.replace(/\n*$/, '\n\n') : '') + table + '\n' };
}

export const RULES_MARKER = RULES_SNIPPET.split('\n')[0];

const CURSOR_RULE_HEADER = `---
description: How to pick up UI tasks sent from the browser with ${BRAND.name}
alwaysApply: true
---

`;

/** Append the agent rules to a Markdown rules file (CLAUDE.md, AGENTS.md) or create a Cursor rule. */
export function mergeRules(existing: string | null, kind: 'markdown' | 'cursor-rule'): Merge {
  if (existing?.includes(RULES_MARKER)) return { ok: true, content: null };
  if (kind === 'cursor-rule') return { ok: true, content: (existing ? existing.replace(/\n*$/, '\n\n') : CURSOR_RULE_HEADER) + RULES_SNIPPET + '\n' };
  return { ok: true, content: (existing ? existing.replace(/\n*$/, '\n\n') : '') + RULES_SNIPPET + '\n' };
}

/** Local files the bridge writes that must never be committed (session.json holds the bridge token). */
export const GITIGNORE_ENTRIES = [
  `${BRAND.dataDir}/session.json`,
  `${BRAND.dataDir}/tasks.json`,
  `${BRAND.dataDir}/checkpoints/`,
  `${BRAND.dataDir}/screenshots/`,
];

function ignoresWholeDir(lines: string[]): boolean {
  return lines.some((l) => [BRAND.dataDir, `${BRAND.dataDir}/`, `/${BRAND.dataDir}`, `/${BRAND.dataDir}/`, `${BRAND.dataDir}/*`, `**/${BRAND.dataDir}/`].includes(l));
}

/** Add the Agent Hover entries to .gitignore. Comments (comments.json) stay committable on purpose. */
export function mergeGitignore(existing: string | null): Merge {
  const lines = (existing || '').split('\n').map((l) => l.trim());
  if (ignoresWholeDir(lines)) return { ok: true, content: null };
  const missing = GITIGNORE_ENTRIES.filter((e) => !lines.includes(e) && !lines.includes('/' + e));
  if (!missing.length) return { ok: true, content: null };
  const block = `# ${BRAND.name}: local dev data (session.json holds the bridge token)\n` + missing.join('\n') + '\n';
  return { ok: true, content: (existing ? existing.replace(/\n*$/, '\n\n') : '') + block };
}

/** True when .gitignore keeps the session token out of git. */
export function gitignoreCoversSession(existing: string | null): boolean {
  const lines = (existing || '').split('\n').map((l) => l.trim());
  return ignoresWholeDir(lines) || lines.includes(GITIGNORE_ENTRIES[0]) || lines.includes('/' + GITIGNORE_ENTRIES[0]);
}

/** The listen loop; the same text as the MCP server's `listen` prompt (packages/mcp/src/index.ts, LISTEN_PROMPT). */
export const LISTEN_PROMPT = [
  'Listen for Agent Hover tasks.',
  '',
  'Call the agent-hover wait_for_agent_task tool. When it returns a task, make the change it describes, then call complete_agent_task with the task id, a one-paragraph summary and the files you changed.',
  'Then call wait_for_agent_task again. Keep going until I tell you to stop. If it returns without a task, call it again.',
].join('\n');

const COMMAND_DESCRIPTION = `Listen for UI tasks sent from the page with ${BRAND.name}`;

/** The /agent-hover command (or $agent-hover skill) for each agent's own format. */
export function commandFileContent(kind: CommandKind): string {
  if (kind === 'cursor-command') return LISTEN_PROMPT + '\n';
  if (kind === 'codex-skill') return `---\nname: agent-hover\ndescription: ${COMMAND_DESCRIPTION}. Use when the user asks to listen for ${BRAND.name} tasks.\n---\n\n${LISTEN_PROMPT}\n`;
  return `---\ndescription: ${COMMAND_DESCRIPTION}\n---\n\n${LISTEN_PROMPT}\n`;
}

/** Create the command file; leave one that is already there (ours, or the user's own with the same name). */
export function mergeCommandFile(existing: string | null, kind: CommandKind): Merge {
  if (existing === null) return { ok: true, content: commandFileContent(kind) };
  if (existing.includes(LISTEN_PROMPT.split('\n')[0])) return { ok: true, content: null };
  return { ok: false, reason: 'already exists with other content, so it was left alone' };
}
