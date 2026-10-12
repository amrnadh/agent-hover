<img src="https://raw.githubusercontent.com/Arc-coder07/agent-hover/main/docs/brand/logo/mark-ink.svg" width="56" height="56" alt="Agent Hover">

# @agent-hover/vite

[![npm](https://img.shields.io/npm/v/@agent-hover/vite)](https://www.npmjs.com/package/@agent-hover/vite)

> Point at your UI. Your agent understands it.

The Vite plugin for [Agent Hover](https://github.com/Arc-coder07/agent-hover). In `vite dev` it adds a small overlay to your React app (click any element, Ask, track the task, compare, undo) and starts a local bridge that your coding agent talks to through [`@agent-hover/mcp`](https://www.npmjs.com/package/@agent-hover/mcp).

![Agent Hover](https://github.com/Arc-coder07/agent-hover/raw/main/docs/media/agent-hover.gif)

## Setup

The quickest way, in your project:

```bash
npx agent-hover init
```

Or by hand:

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

Run `npm run dev`, open the app, press **Alt** and click anything. See the [main README](https://github.com/Arc-coder07/agent-hover#readme) for the full flow and agent setup.

The plugin only runs in dev (`apply: 'serve'`); production builds are unchanged.

## Options

| Option | Type | Default | |
| :--- | :--- | :--- | :--- |
| `port` | `number` | `9850` | Bridge port (HTTP + WebSocket on 127.0.0.1). Moves to the next free port if taken. |
| `editor` | `'auto' \| 'cursor' \| 'vscode' \| 'windsurf' \| 'zed' \| 'webstorm' \| 'antigravity'` | `'auto'` | Default editor for "Open in editor". Can be changed in the overlay's Settings. |

## What the bridge does

- Serves component context (source, props, hooks) to the overlay and to MCP.
- Keeps the task queue in `.agent-hover/tasks.json` (Sent → Seen → Working → Done).
- Takes a git checkpoint when an agent claims a task, so the overlay can show the changed files and undo them (`.agent-hover/checkpoints/`).
- Saves screenshots to `.agent-hover/screenshots/` and comments to `.agent-hover/comments.json`.

It accepts requests from your dev server's origin only, with a per-session token in `.agent-hover/session.json`. Keep `session.json`, `tasks.json`, `checkpoints/` and `screenshots/` out of git (`init` does this). Once a day it checks npm for a newer version (no project data; set `AGENT_HOVER_NO_UPDATE_CHECK=1` to turn it off).

API reference: [docs/bridge-api.md](https://github.com/Arc-coder07/agent-hover/blob/main/docs/bridge-api.md).

## License

MIT
