# Agent Hover

[![npm downloads](https://img.shields.io/npm/dw/@agent-hover/vite)](https://www.npmjs.com/package/@agent-hover/vite)
[![npm downloads](https://img.shields.io/npm/dw/@agent-hover/core)](https://www.npmjs.com/package/@agent-hover/core)
[![npm downloads](https://img.shields.io/npm/dw/@agent-hover/mcp)](https://www.npmjs.com/package/@agent-hover/mcp)

> Point at your UI. Your agent understands it.

Agent Hover is a Vite plugin that turns your running React app into a navigable map of your codebase. Hover over any component to see its source, props, and relationships — then send precisely the context your AI agent needs to make the change correctly on the first try.

## Quick Start

```bash
npm install -D @agent-hover/vite
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import componentPointer from '@agent-hover/vite';

export default defineConfig({
  plugins: [react(), componentPointer()],
});
```

Then run your dev server and hold `Alt` to enter pointer mode.

## Features

- **Hover → Identify**: See component name + source file on hover
- **Click → Context Lens**: Full component context — source, props, imports, parent, token estimate
- **Pin → Multi-Select**: Pin components, auto-detect relationships, bundle context
- **MCP → Any Agent**: Send structured context to Claude, Cursor, Gemini, or any MCP-compatible agent
- **Token-Aware**: See exactly how many tokens the agent will receive before sending

## Packages

| Package | Description |
|---------|-------------|
| `@agent-hover/core` | Context intelligence engine (AST parsing, relationships, token estimation) |
| `@agent-hover/vite` | Vite plugin + local bridge server |
| `@agent-hover/overlay` | Browser overlay UI (Shadow DOM) |
| `@agent-hover/mcp` | MCP server for AI agent integration |

## Setup check

```bash
npx agent-hover
```

Checks your project and prints the steps that are left, including MCP config for each agent (`npx agent-hover mcp cursor`).

## Listen mode

Tell your agent once: **"Listen for agent-hover tasks."** It calls `wait_for_agent_task`, picks up each task you send from the browser, does it, reports back with `complete_agent_task`, and waits for the next one. The browser shows each step: Sent → Seen → Working → Done.

## MCP Setup

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "agent-hover": {
      "command": "npx",
      "args": ["-y", "@agent-hover/mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agent-hover": {
      "command": "npx",
      "args": ["-y", "@agent-hover/mcp"]
    }
  }
}
```

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Browser (Your App)                   │
│                                                        │
│  [Element Hover / Inspector]      [Pinned Tasks Stack] │
│          │                                 │           │
│          ▼                                 ▼           │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Agent Hover Overlay (Shadow DOM Client)      │  │
│  └──────────────────────┬───────────────────────────┘  │
└─────────────────────────┼──────────────────────────────┘
                          │ REST + WebSocket (Bearer token)
                          ▼
┌────────────────────────────────────────────────────────┐
│               Localhost Bridge Server v2               │
│               (Vite Dev Plugin Process)                │
│                                                        │
│  • Strict Origin / Host Validation                     │
│  • Session Authentication (.agent-hover/session.json)  │
│  • Task Store & State Machine (.agent-hover/tasks.json)│
│  • Agent Presence Tracking & Status Broadcasts         │
│  • AST Analysis & Source Inspector                     │
└─────────────────────────┬──────────────────────────────┘
                          │ MCP Protocol / Stdio
                          ▼
┌────────────────────────────────────────────────────────┐
│              AI Coding Agents & Editors                │
│  (Claude Code / Cursor / Windsurf / Antigravity)       │
└────────────────────────────────────────────────────────┘
```

## How It Works

1. The Vite plugin injects a lightweight, isolated Shadow DOM overlay into your dev app.
2. React Fiber traversal and source mapping detect component boundaries, files, line numbers, and runtime props.
3. The core engine parses source AST to extract props, imports, hooks, and relationships.
4. Tasks are dispatched to an authenticated local queue (`tasks.json`).
5. Your AI agent queries, claims, and completes tasks via the MCP server (`@agent-hover/mcp`) or clipboard fallback.

See [Bridge API Documentation](docs/bridge-api.md) for endpoint details and security specifications.

## License

MIT
