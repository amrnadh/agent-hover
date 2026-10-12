<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo/mark-light.svg">
    <img src="docs/brand/logo/mark-ink.svg" width="88" height="88" alt="">
  </picture>
</p>

# Agent Hover

[![npm](https://img.shields.io/npm/v/@agent-hover/vite?label=%40agent-hover%2Fvite)](https://www.npmjs.com/package/@agent-hover/vite)
[![CI](https://github.com/Arc-coder07/agent-hover/actions/workflows/ci.yml/badge.svg)](https://github.com/Arc-coder07/agent-hover/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)

**Point at your UI. Your agent understands it.**

Click any element in your running React app, say what should change, and your coding agent gets the exact file, the line that renders it, how it looks right now, its props, and the rules to stay in scope. Then watch the task go from Sent to Done on the element itself, compare before and after, and undo if you don't like it.

Works with Claude Code, Cursor, Codex and any other MCP agent, or with plain Copy for ChatGPT, Claude.ai, v0, Lovable and Bolt.

![Agent Hover: select an element, ask, and the agent's progress shows on the page](docs/media/agent-hover.gif)

## Quick start

In your Vite + React project:

```bash
npx agent-hover init
```

It installs `@agent-hover/vite`, adds it to your Vite config, connects your agent (MCP config and a short rules note), and keeps local data out of git. It shows every change and asks first; `--dry-run` only shows them.

Then:

1. Start your dev server (`npm run dev`) and open the app.
2. Press **Alt** (or the pointer in the dock) and click anything.
3. Press **Ask**, type what to change, press **⌘/Ctrl + Enter**.
4. Tell your agent once: **"Listen for agent-hover tasks."** It picks up each task you send, does it, reports back, and waits for the next one.

Something not working? `npx agent-hover doctor` checks the plugin, the dev server, the token and the agent connection, and tells you what to fix.

<details>
<summary>Manual setup</summary>

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

Register the MCP server with your agent. For Claude Code:

```bash
claude mcp add agent-hover -- npx -y @agent-hover/mcp
```

`npx agent-hover mcp <agent>` prints the config for `cursor`, `codex`, `windsurf`, `antigravity` and `claude-desktop`.
</details>

## How it works

**Point.** Hover shows the component and size; click selects it and opens a small action pill: Ask, Comment, add to Batch, Copy, and more (open in editor, screenshot, lock from agents, parent/child, details).

![Action pill on a selected element](docs/screenshots/v0.2/01-pill.png)

**Ask.** Describe the change. It goes to your connected agent, or to the clipboard when none is connected (or when you prefer Copy).

**Track.** A marker on the element follows the task: Sent → Seen → Working → Done. Open it for the agent's summary and the files it changed. Markers come back after a reload.

![Task card with the agent's summary](docs/screenshots/v0.2/02-task-done.png)

**Compare and Undo.** When the agent picks up a task, Agent Hover takes a git checkpoint of your work tree (including uncommitted and untracked files, without touching them). The task card shows a before/after slider of the element, and **Undo** restores exactly the files that changed, after showing you the list.

![Before and after comparison](docs/screenshots/v0.2/06-compare.png)

**Comment and Batch.** Press **C** to drop numbered notes anywhere and send them one at a time or all at once. Press **B** to collect several elements into one task, each marked Change, Reference or Don't touch ("make these three cards consistent").

**Inspect.** The sidebar shows the component, a clickable breadcrumb, live props (secrets redacted), hooks, text, box model and key styles, and the source, with the token count of what would be sent.

## What your agent receives

A short, ordered brief instead of a vague description. Real output for "Make this button larger with a subtle arrow icon":

```md
# Change request: <button> “Book a demo” in <Hero />

## What to do
Make this button larger with a subtle arrow icon

## Where
- Element: `button#hero-primary-cta` with text “Book a demo”
- Rendered by: `<Hero />` in `src/components/Hero.tsx`, lines 13–75
- In the source, the element is around line 50
- It is rendered through `<Button>` (line 49), a shared component: change this usage
  (className or props) rather than `<Button>` itself, unless the request is about every Button.

## The element now
- Rendered: 135×44px · font 14px/500 · color #ffffff on #17181a · padding 0px 24px · radius full · flex row, gap 8px

## Constraints
- Change this element only; keep the rest of <Hero /> as it is.
- Follow the existing styling approach (Tailwind utility classes in this file).

## Source: src/components/Hero.tsx (lines 13–75)
…
```

Long components send only the ~90 lines around the element by default (Settings › Context detail: Compact, Standard or Deep).

## Works with

| Tool | How |
|------|-----|
| Claude Code | MCP, project `.mcp.json` (set up by `init`) |
| Cursor | MCP, project `.cursor/mcp.json` (set up by `init`) |
| Codex | MCP, project `.codex/config.toml` (set up by `init`) |
| Windsurf, Antigravity, Claude Desktop | MCP, global config (`npx agent-hover mcp <agent>` prints it) |
| ChatGPT, Claude.ai, v0, Lovable, Bolt, anything else | Copy: every prompt is self-contained |

## Keyboard

| Key | Action |
|-----|--------|
| Alt | Inspect on / off |
| Enter | Ask about the selection |
| C | Comment mode (or comment on the selection) |
| B | Add the selection to the batch |
| ⌘/Ctrl + C | Copy the selection's context |
| O | Open in your editor |
| ↑ / ↓ | Select parent / child |
| Hold ⌘/Ctrl | Show distances |
| Hold Shift | Click through to the page |
| T | Tasks |
| ⌘/Ctrl + Shift + X | Hide / show the dock |
| Esc | Close the innermost thing |

Letter shortcuts only work while Agent Hover is in use, so they never take over your app's own shortcuts.

## Requirements

- Node 20 or newer, Vite 5 or newer (tested up to Vite 8), React 18 or 19.
- Chrome, Edge, Firefox and Safari.
- Dev only: the plugin runs with `vite dev` and adds nothing to production builds.
- Compare and Undo need a git repository; everything else works without one.
- Next.js support is next on the roadmap.

## Privacy and security

- Everything runs on your machine. The bridge listens on `127.0.0.1` only, checks the page's origin, and requires a per-session token (stored in `.agent-hover/session.json`, which `init` adds to `.gitignore`).
- No telemetry. The only outbound request is a once-a-day update check to the npm registry, with no project data; turn it off with `AGENT_HOVER_NO_UPDATE_CHECK=1`.
- Undo never runs `git reset`, `clean` or `checkout`; it restores the listed files one by one from the checkpoint.

Details: [SECURITY.md](SECURITY.md) and the [bridge API](docs/bridge-api.md).

## Packages

| Package | |
|---------|--|
| [`agent-hover`](packages/cli) | `npx agent-hover`: init, doctor, MCP config per agent |
| [`@agent-hover/vite`](packages/vite) | Vite plugin and local bridge (task queue, checkpoints) |
| [`@agent-hover/mcp`](packages/mcp) | MCP server your agent talks to |
| [`@agent-hover/overlay`](packages/overlay) | The in-page UI (shadow DOM) |
| [`@agent-hover/core`](packages/core) | Context engine: source parsing, prompt formatting, token counts |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in the [CHANGELOG](CHANGELOG.md).

## License

MIT
