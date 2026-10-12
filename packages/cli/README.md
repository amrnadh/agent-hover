# agent-hover

[![npm](https://img.shields.io/npm/v/agent-hover)](https://www.npmjs.com/package/agent-hover)

Set up and check [Agent Hover](https://github.com/Arc-coder07/agent-hover): click any element in your running React app and send precise context to Claude Code, Cursor, Codex and other agents.

```bash
npx agent-hover init
```

| Command | What it does |
|---------|--------------|
| `npx agent-hover init` | Installs `@agent-hover/vite`, adds it to your Vite config, connects your agents (MCP config + a rules note), and adds `.agent-hover` data to `.gitignore`. Shows every change and asks first. |
| `npx agent-hover doctor` | Checks Node, the plugin, the running dev server, the session token, the agent connection, MCP registration and git. |
| `npx agent-hover` | The setup steps that are left in this project. |
| `npx agent-hover mcp [agent]` | MCP config for `claude`, `cursor`, `codex`, `windsurf`, `antigravity`, `claude-desktop`. |
| `npx agent-hover rules` | The rules snippet for CLAUDE.md / AGENTS.md so agents pick up browser tasks. |

### init options

| Flag | |
|------|--|
| `--agent claude,cursor` | Agents to connect. Default: the ones this project already uses (CLAUDE.md, .cursor, AGENTS.md…), else Claude Code. |
| `--dry-run` | Show the changes without making them. |
| `--yes` | Apply without asking (needed when there is no terminal, e.g. in scripts). |
| `--no-install` | Skip installing the package. |

`init` only writes project files: `vite.config.*`, `.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml`, `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/agent-hover.mdc`, `.gitignore`. It merges into existing files (JSON configs keep a `.bak`), never removes anything, and running it again changes nothing. Agents that only have a global config (Windsurf, Antigravity, Claude Desktop) get the exact snippet printed instead. If your Vite config is unusual, it prints the two lines to add rather than guessing.

No dependencies, so `npx` starts instantly.

## License

MIT
