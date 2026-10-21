**See every UI change your agent makes, right on the page. Keep it or undo it.**

Agent Hover is a dev-only Vite plugin for React apps. Ask for a change on any element of your running app, and your coding agent gets the exact file, the line that renders it, how it looks now and what it must not touch. The task stays on the element while the agent works (Sent → Seen → Working → Done). Then review it there: compare before and after, keep it, undo it in one click, or follow up. Lock finished components, and Agent Hover tells you if an agent changed one anyway.

Works with Claude Code, Cursor, Codex, OpenCode, Antigravity, Windsurf and any other MCP agent. No agent connected? Every prompt can be copied into ChatGPT, Claude.ai, v0, Lovable or Bolt.

## Quick start

In your Vite + React project:

```bash
npx agent-hover init
```

`init` installs this package, adds it to your Vite config, connects your coding agent (MCP config plus a short rules note), and keeps Agent Hover's local files out of git. It shows every change and asks before writing anything. Add `--dry-run` to only see the plan.

Then:

1. Start your dev server (`npm run dev`) and open the app.
2. Press **Alt** (or the pointer in the dock at the bottom of the page) and click any element.
3. Press **Ask**, describe the change, and press **⌘/Ctrl + Enter**.
4. Restart your agent once so it loads the MCP server, then run **`/agent-hover`** (**`$agent-hover`** in Codex) or tell it **"Listen for agent-hover tasks."** It picks up each task you send, makes the change, reports back, and waits for the next one.

Check the whole setup at any time:

```bash
npx agent-hover doctor
```

## Manual setup

```bash
npm install -D @agent-hover/vite
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import agentHover from '@agent-hover/vite';

export default defineConfig({
  plugins: [react(), agentHover()],
});
```

Then register the MCP server with your agent:

| Agent | How |
|-------|-----|
| Claude Code | `claude mcp add agent-hover -- npx -y @agent-hover/mcp` (or `.mcp.json` in the project) |
| Codex | `codex mcp add agent-hover -- npx -y @agent-hover/mcp` (or `.codex/config.toml`) |
| Antigravity | `agy mcp add agent-hover -- npx -y @agent-hover/mcp` |
| Cursor | `.cursor/mcp.json` in the project (JSON below) |
| OpenCode | `opencode.json` in the project: `"mcp": { "agent-hover": { "type": "local", "command": ["npx", "-y", "@agent-hover/mcp"] } }` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` (JSON below) |
| Claude Desktop | `claude_desktop_config.json` (Settings › Developer › Edit Config) |

```json
{
  "mcpServers": {
    "agent-hover": { "command": "npx", "args": ["-y", "@agent-hover/mcp"] }
  }
}
```

`npx agent-hover mcp <agent>` prints the exact command and config for each one (`claude`, `cursor`, `codex`, `windsurf`, `antigravity`, `claude-desktop`).

## Using it

- **Ask.** Turn on Inspect (Alt) and click an element; a small pill appears with Ask, Comment, Batch, Copy and more. Describe the change and send it to your connected agent, or choose Copy prompt to paste it into any AI tool.
- **Track.** A marker on the element follows the task: Sent → Seen → Working → Done. Click it for the agent's summary and the files it changed. Markers come back after a reload.
- **Review.** A finished change waits on its element. **Compare** shows a before/after slider of the element. **Keep** settles it. **Undo** restores exactly the files that changed, after showing you the list: when the agent starts a task, Agent Hover takes a git checkpoint of your project (including uncommitted and untracked files, without touching them). **Follow up** asks again about the same element with the earlier request and the agent's summary in the prompt.
- **Comment.** Press **C** and click anywhere to drop a numbered note. Send notes one at a time or all open ones as a single task.
- **Batch.** Press **B** on several elements and mark each as Change, Reference or Don't touch, then describe one goal ("make these three cards consistent").
- **Inspect.** Press **D** for the sidebar: component, clickable breadcrumb, live props (secrets are redacted), hooks, text, box model and key styles, source, and the token count of what would be sent.
- **Lock.** In the pill's ⋯ menu, "Don't let agents change this" adds the component to every prompt's do-not-modify list. If a finished task changed a locked component's file anyway, its marker turns amber and the card names the component, with Undo right there.
- **Screenshots.** Element (pill ⋯ menu), visible area or full page (dock ⋯ menu). Each is copied to the clipboard and saved to `.agent-hover/screenshots/` so agents can open it.

### Listen mode

Run **`/agent-hover`** (**`$agent-hover`** in Codex), or tell your agent **"Listen for agent-hover tasks."** It calls `wait_for_agent_task`, which waits for the next task you send, claims it and returns the full prompt. The agent makes the change, calls `complete_agent_task` with a summary, and waits again. Tell it you're done to stop.

Prefer to trigger each task yourself? Send from the page, then tell the agent "I sent you an agent-hover task". `init` also adds a short note to `CLAUDE.md`, `AGENTS.md` or `.cursor/rules/` so agents know how to pick tasks up.

### What your agent receives

A short, ordered brief instead of a vague description:

```md
# Change request: <button> “Book a demo” in <Hero />

## What to do
Make this button larger with a subtle arrow icon

## Where
- Element: `button#hero-primary-cta` with text “Book a demo”
- Rendered by: `<Hero />` in `src/components/Hero.tsx`, lines 8–139
- In the source, the element is around line 82
- It is rendered through `<Button>` (line 81), a shared component: change this usage
  (className or props) rather than `<Button>` itself, unless the request is about every Button.

## The element now
- Rendered: 135×40px · font 14px/500 · color #ffffff on #252b31 · padding 20px 24px · radius full

## Constraints
- Change this element only; keep the rest of <Hero /> as it is.
- Follow the existing styling approach (Tailwind utility classes in this file).

## Source: src/components/Hero.tsx (lines 8–139)
…
```

Long components send only the ~90 lines around the element by default. Change the detail level (Compact, Standard, Deep) in Settings.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Alt | Inspect on / off |
| Enter | Ask about the selection |
| C | Comment mode (or comment on the selection) |
| B | Add the selection to the batch |
| ⌘/Ctrl + C | Copy the selection's context |
| O | Open in your editor |
| D | Details sidebar |
| ↑ / ↓ | Select parent / child |
| Hold ⌘/Ctrl | Show distances |
| Hold Shift | Click through to the page |
| T | Tasks |
| ? | Shortcuts |
| ⌘/Ctrl + Shift + X | Hide / show the dock |
| Esc | Close the innermost thing |

Letter shortcuts only work while Agent Hover is in use, so they never take over your app's own shortcuts.

## Commands

| Command | What it does |
|---------|--------------|
| `npx agent-hover init` | Set everything up: install, Vite config, MCP config, rules note, `.gitignore`. Flags: `--agent claude,cursor`, `--dry-run`, `--yes`, `--no-install` |
| `npx agent-hover doctor` | Check Node, the plugin, the running dev server, the session token, connected agents, MCP registration and git |
| `npx agent-hover` | The setup steps still missing in this project |
| `npx agent-hover mcp [agent]` | MCP command and config for an agent |
| `npx agent-hover rules` | The rules note for CLAUDE.md, AGENTS.md or Cursor rules |

## Updating

```bash
npm install -D @agent-hover/vite@latest
```

Then restart your dev server. This also updates the overlay and the shared engine. Agent Hover tells you when a new version is out: a one-time notice, a line in the dock's connection popover (click the logo), and the update command in Settings › About.

- **MCP server:** it runs through `npx`, so restarting your agent picks up the latest release. To pin a version, use `@agent-hover/mcp@0.2.0` (or `@latest`) in the MCP config's args.
- **CLI:** `npx agent-hover@latest <command>` always runs the newest one.
- `npx agent-hover doctor` shows the installed and the running version, and says if a restart is needed.

## Configuration

Plugin options:

| Option | Default | |
|--------|---------|--|
| `port` | `9850` | Port of the local bridge (HTTP and WebSocket on 127.0.0.1). Moves to the next free port if it is taken. |
| `editor` | `'auto'` | Default editor for "Open in editor": `'cursor'`, `'vscode'`, `'windsurf'`, `'zed'`, `'webstorm'`, `'antigravity'`. |

```ts
agentHover({ port: 9850, editor: 'cursor' })
```

In the page, the gear in the sidebar (or dock ⋯ › Settings) has: connected agents and their setup, what Send does (send when an agent is connected, else copy; or always copy), context detail, theme (system, dark, light), dock orientation (horizontal or vertical), the editor to open files in, and keyboard shortcuts.

Environment variables:

| Variable | |
|----------|--|
| `AGENT_HOVER_NO_UPDATE_CHECK=1` | Turn off the daily update check (it is also off in CI) |
| `AGENT_HOVER_SESSION` | Path to a `.agent-hover/session.json`, for agents started outside the project folder |
| `AGENT_HOVER_PORT`, `AGENT_HOVER_TOKEN` | Connect the MCP server to a bridge directly |

## Files

Agent Hover keeps its local data in `.agent-hover/` in your project:

| File | |
|------|--|
| `session.json` | Bridge port and token for this dev server run. **Keep it out of git.** |
| `tasks.json` | Task queue and history |
| `checkpoints/` | Git checkpoints for Undo |
| `screenshots/` | Saved screenshots |
| `comments.json` | Comments. Commit it if you want to share notes with your team |

`init` adds `session.json`, `tasks.json`, `checkpoints/` and `screenshots/` to `.gitignore`.

## Troubleshooting

Start with `npx agent-hover doctor`: it checks each step and says how to fix it.

- **No dock on the page.** The plugin only runs with `vite dev` (`npm run dev`), never in production builds. Check that `agentHover()` is in the `plugins` list.
- **The agent isn't connected** (the dot on the logo isn't green). Make sure the dev server is running, the MCP server is registered, and the agent was restarted in your project folder. Agents find the dev server through `.agent-hover/session.json`; in a monorepo, start the agent in the app's folder or set `AGENT_HOVER_SESSION`.
- **Tasks stay at "Sent".** The agent isn't listening. Run `/agent-hover`, or tell it "Listen for agent-hover tasks".
- **Undo is unavailable.** Undo needs a git repository, and the task must have been picked up through Agent Hover (that's when the checkpoint is taken).
- **The port is taken.** The bridge moves to the next free port and the page follows it; set `port` to choose one.

## Uninstall

```bash
npm uninstall @agent-hover/vite
```

Remove `agentHover()` and its import from your Vite config, remove the `agent-hover` entry from your agent's MCP config (for Claude Code: `claude mcp remove agent-hover`), and delete the `.agent-hover/` folder.

## Requirements

- Node 20 or newer, Vite 5 or newer, React 18 or 19.
- macOS, Linux and Windows 10/11.
- Chrome, Edge, Firefox or Safari.
- Compare and Undo need a git repository; everything else works without one.
- Next.js support is planned.

## Privacy and security

- Everything runs on your machine. The bridge listens on `127.0.0.1` only, accepts requests from your dev server's page only, and requires a token that changes on every dev server start.
- File access is limited to your project folder.
- No telemetry. The only outbound request is a once-a-day check of the npm registry for a newer version, with no project data. Turn it off with `AGENT_HOVER_NO_UPDATE_CHECK=1`.
- Voice uses your browser's speech recognition: on the device when the browser can, otherwise Chrome and Edge send the audio to Google or Microsoft and Safari to Apple (you are told once, before the first use). Agent Hover never receives or stores audio.
- Undo never runs `git reset`, `git clean` or `git checkout`; it restores the listed files one by one.

## Packages

| Package | |
|---------|--|
| [`@agent-hover/vite`](https://www.npmjs.com/package/@agent-hover/vite) | This plugin and the local bridge |
| [`@agent-hover/mcp`](https://www.npmjs.com/package/@agent-hover/mcp) | MCP server your agent talks to |
| [`agent-hover`](https://www.npmjs.com/package/agent-hover) | CLI: `init`, `doctor`, MCP config per agent |
| [`@agent-hover/overlay`](https://www.npmjs.com/package/@agent-hover/overlay) | The in-page UI (installed with this plugin) |
| [`@agent-hover/core`](https://www.npmjs.com/package/@agent-hover/core) | Shared engine (installed with this plugin) |

## License

MIT
