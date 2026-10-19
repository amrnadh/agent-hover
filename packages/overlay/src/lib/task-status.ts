/** Human names for MCP client ids reported in `initialize` (e.g. "claude-code" → "Claude Code"). */
const KNOWN_AGENTS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'claude-ai': 'Claude',
  'claude-desktop': 'Claude Desktop',
  cursor: 'Cursor',
  'cursor-vscode': 'Cursor',
  codex: 'Codex',
  'codex-mcp-client': 'Codex',
  windsurf: 'Windsurf',
  antigravity: 'Antigravity',
  'gemini-cli': 'Gemini CLI',
  'mcp-agent': 'your agent',
  'mcp-client': 'your agent',
  agent: 'your agent',
};

export function prettyAgentName(id: string | undefined | null): string {
  if (!id) return 'your agent';
  const known = KNOWN_AGENTS[id.toLowerCase()];
  if (known) return known;
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export type StatusTone = 'neutral' | 'working' | 'success' | 'error';

export interface StatusView {
  text: string;
  tone: StatusTone;
  /** Agent's summary for finished tasks. */
  detail?: string;
  /** Longer explanation shown as a tooltip. */
  hint?: string;
}

export interface TaskLike {
  status: string;
  claimedBy?: string;
  /** The agent the task was sent to by name. */
  assignee?: string;
  result?: { summary?: string; filesChanged?: string[]; error?: string };
}

/**
 * Status line for a task (spec §7.9). `agent` is the connected agent, used before a task is claimed.
 * Delivery outcomes without a task ("copied", "queued without agent") are rendered by the caller.
 */
export function describeTaskStatus(task: TaskLike, agent?: string | null): StatusView {
  const who = prettyAgentName(task.claimedBy || task.assignee || agent);
  switch (task.status) {
    case 'queued':
      return agent ? { text: `Sent to ${who}`, tone: 'neutral' } : { text: 'Queued · no agent connected', tone: 'neutral' };
    case 'delivered':
      return { text: `Seen by ${who}`, tone: 'neutral' };
    case 'in_progress':
      return { text: `${who} is working…`, tone: 'working' };
    case 'done': {
      const n = task.result?.filesChanged?.length ?? 0;
      const files = n === 1 ? '1 file' : `${n} files`;
      return { text: n ? `Done · ${files}` : 'Done', tone: 'success', detail: task.result?.summary };
    }
    case 'failed':
      return { text: 'Failed', tone: 'error', detail: task.result?.error || task.result?.summary };
    case 'cancelled':
      return { text: 'Cancelled', tone: 'neutral' };
    case 'expired':
      return { text: 'Not picked up', tone: 'neutral', hint: 'No agent took this task within 30 minutes' };
    case 'superseded':
      return { text: 'Replaced by a newer task', tone: 'neutral' };
    default:
      return { text: task.status, tone: 'neutral' };
  }
}
