**The MCP server for Agent Hover.**

It connects your coding agent to the Agent Hover plugin ([`@agent-hover/vite`](https://www.npmjs.com/package/@agent-hover/vite)) running in your Vite dev server. Tasks you send by clicking elements in your app reach the agent with full context, and the agent's progress (Seen, Working, Done) shows on the page.

Works with Claude Code, Cursor, Codex, OpenCode, Antigravity, Windsurf, Claude Desktop and any other MCP client.

## Setup

The quickest way, in your project:

```bash
npx agent-hover init
```

By hand:

```bash
claude mcp add agent-hover -- npx -y @agent-hover/mcp   # Claude Code
codex mcp add agent-hover -- npx -y @agent-hover/mcp    # Codex
agy mcp add agent-hover -- npx -y @agent-hover/mcp      # Antigravity
```

Cursor (`.cursor/mcp.json`), Windsurf (`~/.codeium/windsurf/mcp_config.json`) and Claude Desktop (`claude_desktop_config.json`) use JSON:

```json
{
  "mcpServers": {
    "agent-hover": { "command": "npx", "args": ["-y", "@agent-hover/mcp"] }
  }
}
```

`npx agent-hover mcp <agent>` prints the exact command and config for each agent.

Then restart the agent **in your project folder**, with the dev server running. The server finds the dev server through `.agent-hover/session.json` (it looks in the agent's working folder and the folders above it).

OpenCode (`opencode.json`) has its own format; `npx agent-hover mcp opencode` prints it, and `npx agent-hover init --agent opencode` writes it.

## Listen mode

Run **`/agent-hover`** in your agent (**`$agent-hover`** in Codex; `npx agent-hover init` adds the command), or tell it **"Listen for agent-hover tasks."** **`/agent-hover-status`** shows what is waiting. The server also offers `listen` and `status` prompts (`/mcp__agent-hover__listen` in the Claude Code terminal; the desktop app can't send those names, so use the plain commands there).

It calls `wait_for_agent_task`, which waits until you send a task from the page, claims it and returns the full prompt. The agent makes the change, calls `complete_agent_task` with a short summary, and waits for the next task. The page shows each step on the element. Tell the agent you're done to stop.

Without listen mode, send from the page and tell the agent "I sent you an agent-hover task"; it lists and claims it with `list_agent_tasks` and `claim_agent_task`.

## Tools

| Tool | |
|------|--|
| `wait_for_agent_task` | Listen mode: wait for the next task from the page, claim it, return its prompt |
| `list_agent_tasks` | Tasks sent from the page |
| `claim_agent_task` | Start a task: returns its prompt and marks it Working (this is when the Undo checkpoint is taken) |
| `complete_agent_task` | Finish a task with a summary; `filesChanged` is optional (git fills it in) |
| `get_component_context` | Source, props, hooks and imports of a component at a file and line |
| `get_component_source` | A slice of a component file (limited to the project) |
| `list_components` | Components rendered on the current page, with files and lines |
| `get_frozen_components` | Components locked in the page ("Don't let agents change this"); do not modify them |
| `get_pinned_set`, `create_task_context` | Context for several elements collected in the page |
| `capture_screenshot`, `verify_visual_change` | Before/after screenshots of a component and their pixel difference |
| `get_latest_agent_task` | Deprecated: use `list_agent_tasks` and `claim_agent_task` |

## Updating

The server runs through `npx`, so restarting your agent picks up the latest release. To pin a version, put it in the args: `["-y", "@agent-hover/mcp@0.2.0"]` (or `@latest`). Update the plugin in your project too:

```bash
npm install -D @agent-hover/vite@latest
```

## Environment

| Variable | |
|----------|--|
| `AGENT_HOVER_SESSION` | Path to a `.agent-hover/session.json`, when the agent runs outside the project folder (for example in a monorepo root) |
| `AGENT_HOVER_PORT`, `AGENT_HOVER_TOKEN` | Connect to a bridge directly |

## Troubleshooting

`npx agent-hover doctor` (with the dev server running) checks the connection end to end.

- **The page shows no agent connected.** Restart the agent in the project folder after registering the server, and make sure the dev server is running.
- **Tasks stay at "Sent".** The agent isn't listening: run `/agent-hover`, or tell it "Listen for agent-hover tasks".

## License

MIT
