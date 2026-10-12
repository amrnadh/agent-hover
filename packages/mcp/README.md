<img src="https://raw.githubusercontent.com/Arc-coder07/agent-hover/main/docs/brand/logo/mark-ink.svg" width="56" height="56" alt="Agent Hover">

# @agent-hover/mcp

[![npm](https://img.shields.io/npm/v/@agent-hover/mcp)](https://www.npmjs.com/package/@agent-hover/mcp)

The MCP server for [Agent Hover](https://github.com/Arc-coder07/agent-hover). It connects your coding agent (Claude Code, Cursor, Codex, Windsurf, Antigravity, Claude Desktop, or any MCP client) to the Agent Hover bridge running in your Vite dev server, so tasks you send from the browser reach the agent and its progress shows up on the page.

## Setup

`npx agent-hover init` writes the config for you. By hand:

```bash
claude mcp add agent-hover -- npx -y @agent-hover/mcp   # Claude Code
codex mcp add agent-hover -- npx -y @agent-hover/mcp    # Codex
```

Cursor (`.cursor/mcp.json`), Windsurf, Antigravity and Claude Desktop use JSON:

```json
{
  "mcpServers": {
    "agent-hover": { "command": "npx", "args": ["-y", "@agent-hover/mcp"] }
  }
}
```

`npx agent-hover mcp <agent>` prints the exact file and snippet for each tool.

The server finds the running bridge through `.agent-hover/session.json` in your project (it walks up from the agent's working directory). Start the agent in your project folder, with the dev server running.

## Listen mode

Tell your agent once: **"Listen for agent-hover tasks."** It calls `wait_for_agent_task`, which waits for the next task you send from the browser, claims it and returns the full prompt. The agent makes the change, calls `complete_agent_task` with a summary, and waits again.

## Tools

| Tool | |
|------|--|
| `wait_for_agent_task` | Listen mode: wait for the next task from the browser, claim it, return its prompt |
| `list_agent_tasks` | Tasks sent from the browser (queued ones are marked delivered) |
| `claim_agent_task` | Start a task: returns its prompt and marks it in progress (the bridge takes the Undo checkpoint here) |
| `complete_agent_task` | Finish a task with a summary; `filesChanged` is optional (git fills it in) |
| `get_component_context` | Source, props, hooks and imports for a component at a file and line |
| `get_component_source` | A path-checked slice of a component file |
| `list_components` | Components rendered on the current page, with files and lines |
| `get_frozen_components` | Components locked in the browser; agents must not modify them |
| `get_pinned_set`, `create_task_context` | Context for several elements collected in the browser |
| `capture_screenshot`, `verify_visual_change` | Before/after screenshots of a component and their pixel difference |
| `get_latest_agent_task` | Deprecated; use `list_agent_tasks` / `claim_agent_task` |

## Environment

- `AGENT_HOVER_SESSION`: path to a `session.json`, when the agent runs outside the project folder.
- `AGENT_HOVER_PORT` and `AGENT_HOVER_TOKEN`: connect to a bridge directly.

## License

MIT
