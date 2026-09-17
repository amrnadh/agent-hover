# Agent Hover

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
| `@agent-hover/vite` | Vite plugin + local bridge server + browser overlay |
| `@agent-hover/mcp` | MCP server for AI agent integration |

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

## How It Works

1. The Vite plugin injects a lightweight overlay into your dev app
2. `element-source` maps DOM elements to React components and source files at runtime
3. The core engine parses your source files (AST) to extract props, imports, hooks, and relationships
4. Context is formatted with token estimates and sent via clipboard, editor link, or MCP

## License

MIT
