# agent-hover

Setup guide for [Agent Hover](https://github.com/Arc-coder07/agent-hover): point at any element in your running React app and send precise context to Claude Code, Cursor, Codex, and other MCP agents.

```bash
npx agent-hover
```

Checks the current project (Vite config, plugin, React, MCP registration) and prints the exact steps that are left.

| Command | What it does |
|---------|--------------|
| `npx agent-hover` | Setup steps, checked against the current project |
| `npx agent-hover mcp [agent]` | MCP config for `claude`, `cursor`, `codex`, `windsurf`, `antigravity`, `claude-desktop` |
| `npx agent-hover rules` | Rules snippet for CLAUDE.md / AGENTS.md / .cursorrules so agents pick up browser tasks |

Read-only: nothing here writes files. An `init` command that configures everything automatically is planned.

## Packages

| Package | Description |
|---------|-------------|
| [`@agent-hover/vite`](https://www.npmjs.com/package/@agent-hover/vite) | Vite plugin + local bridge server |
| [`@agent-hover/mcp`](https://www.npmjs.com/package/@agent-hover/mcp) | MCP server for AI agent integration |
| [`@agent-hover/core`](https://www.npmjs.com/package/@agent-hover/core) | Context engine |

MIT License
