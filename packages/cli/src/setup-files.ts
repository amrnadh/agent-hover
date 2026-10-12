import { BRAND, MCP_PACKAGE } from './brand.js';
import { RULES_SNIPPET } from './clients.js';

/** Result of merging our entry into an existing (or missing) file. `content` is null when nothing changes. */
export type Merge = { ok: true; content: string | null } | { ok: false; reason: string };

const SERVER = { command: 'npx', args: ['-y', MCP_PACKAGE] };

/** Add the MCP server to a JSON config (`.mcp.json`, `.cursor/mcp.json`), keeping every other entry. */
export function mergeJsonMcp(existing: string | null): Merge {
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
  config.mcpServers = { ...config.mcpServers, [BRAND.mcpServerName]: SERVER };
  return { ok: true, content: JSON.stringify(config, null, 2) + '\n' };
}

/** Add the MCP server to a Codex TOML config. Appends a table; never rewrites what is there. */
export function mergeTomlMcp(existing: string | null): Merge {
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
