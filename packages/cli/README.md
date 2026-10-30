**Set up and check Agent Hover in one command.**

Agent Hover lets you click any element in your running React app, say what should change, and send precise context (file, line, current look, props, rules) to Claude Code, Cursor, Codex, Antigravity or any MCP agent, or copy it into any AI chat. The plugin itself is [`@agent-hover/vite`](https://www.npmjs.com/package/@agent-hover/vite); this CLI sets it up and checks it.

```bash
npx agent-hover init
```

No dependencies, so `npx` starts instantly.

## Commands

| Command | What it does |
|---------|--------------|
| `npx agent-hover init` | Installs `@agent-hover/vite`, adds it to your Vite config, connects your agents, and keeps local data out of git |
| `npx agent-hover doctor` | Checks the setup, the running dev server and the agent connection, and says how to fix each problem |
| `npx agent-hover` | Lists the setup steps still missing in this project |
| `npx agent-hover mcp [agent]` | Prints the MCP command and config for `claude`, `cursor`, `codex`, `opencode`, `windsurf`, `antigravity` or `claude-desktop` |
| `npx agent-hover rules` | Prints the rules note that teaches agents to pick up tasks (for CLAUDE.md, AGENTS.md or Cursor rules) |
| `npx agent-hover --version` | The CLI version |
| `npx agent-hover help` | All commands |

## init

```bash
npx agent-hover init                       # asks which agents you use, shows the plan, asks before writing
npx agent-hover init --dry-run             # only show what would change
npx agent-hover init --agent claude,cursor --yes
```

| Flag | |
|------|--|
| `--agent claude,cursor` | Agents to connect. Default: the ones the project already uses (`CLAUDE.md`, `.cursor/`, `AGENTS.md`…), otherwise Claude Code |
| `--dry-run` | Show the changes without making them |
| `--yes` | Apply without asking (needed in scripts, where there is no terminal to ask) |
| `--no-install` | Skip installing the package |

What it changes:

| File | Change |
|------|--------|
| `package.json` | Adds `@agent-hover/vite` (with your package manager: npm, pnpm, yarn or bun) |
| `vite.config.*` | Imports `agentHover` and adds `agentHover()` to `plugins` |
| `.mcp.json` | Registers the MCP server for Claude Code |
| `.cursor/mcp.json` | Registers it for Cursor |
| `.codex/config.toml` | Registers it for Codex |
| `opencode.json` | Registers it for OpenCode (an `opencode.jsonc` with comments is left alone; `init` prints the entry to add) |
| `/agent-hover` and `/agent-hover-status` commands | `.claude/commands/`, `.cursor/commands/`, `.opencode/commands/`, `.windsurf/workflows/`, `.agent/workflows/`, and `$agent-hover` / `$agent-hover-status` skills for Codex in `.agents/skills/` |
| `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/agent-hover.mdc` | Adds the short note on picking up tasks |
| `.gitignore` | Adds `.agent-hover/session.json`, `tasks.json`, `checkpoints/`, `screenshots/` |
| `~/.gemini/config/mcp_config.json`, `~/.codeium/windsurf/mcp_config.json` | Antigravity and Windsurf only read a global config, so `init` adds the server there, after listing it in the plan and asking (these are the only files outside your project it touches) |
| Claude Desktop | Nothing is written: `init` prints the snippet for `claude_desktop_config.json` |

It merges into files that exist (JSON configs keep a `.bak` copy), never removes anything, and running it again changes nothing. If your Vite config isn't a plain `plugins: [...]` list, it prints the two lines to add instead of guessing.

After `init`:

1. Start your dev server and open the app. Press **Alt** (or the pointer in the dock) and click anything.
2. Restart your agent so it loads the MCP server (Claude Code asks you to approve `.mcp.json` once).
3. Run **`/agent-hover`** in your agent (**`$agent-hover`** in Codex), or tell it **"Listen for agent-hover tasks."** Then select an element, press **Ask**, and send. **`/agent-hover-status`** shows what is waiting.

## doctor

```bash
npx agent-hover doctor
```

Checks, in order: Node version, Vite config, React, `@agent-hover/vite` installed and in the config, the dev server (running, reachable, same version as installed), the session token, connected agents, MCP registration (project and global configs, read only), the rules note, `.gitignore`, and git (needed for Undo). Exits with code 1 when something needs fixing. Run it with the dev server running to check the agent connection too.

## Updating

```bash
npm install -D @agent-hover/vite@latest   # the plugin, overlay and engine
npx agent-hover@latest doctor             # the newest CLI, and a check that everything matches
```

Restart your dev server after updating, and restart your agent to pick up the latest MCP server.

## Requirements

Node 20 or newer, a Vite 5+ project with React 18 or 19.

## License

MIT
