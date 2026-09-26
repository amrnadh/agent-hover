# @agent-hover/vite

> Point at your UI. Your agent understands it.

Vite dev-mode plugin and local bridge server for [Agent Hover](https://github.com/Arc-coder07/agent-hover). Turns your running React application into a navigable, token-aware visual map that connects directly to AI agents.

## Installation

```bash
npm install -D @agent-hover/vite
```

## Setup

Add `agentHover` (or `componentPointer`) to your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import agentHover from '@agent-hover/vite';

export default defineConfig({
  plugins: [
    react(),
    agentHover({
      port: 9850,       // Default bridge port (auto-retries on collision)
      editor: 'auto',   // 'auto' | 'cursor' | 'vscode' | 'webstorm' | 'zed' | 'windsurf'
    }),
  ],
});
```

Start your Vite development server:

```bash
npm run dev
```

> **Note:** The plugin uses `apply: 'serve'` and is **completely excluded** from production builds (`vite build`). Zero bundle overhead in production.

## Features

- **Inspector Mode (`Alt`)**: Hover over any rendered React component to highlight its bounding box, view its source file, line number, and component hierarchy.
- **Precision Dark/Light Themes**:
  - **Carbon (Dark · Premium)**: Matte carbon capsule dock, elevated squircle active tiles, and high-contrast precision pointers.
  - **Opal (Light · Glass)**: Translucent frosted glass capsule dock with crisp solid white tiles.
- **Live Spacing Overlay**: View continuous, DevTools-grade box model overlays for margins (rose tint) and paddings (emerald tint) without any dashed splits.
- **Component Pinning (`Alt+Shift+Click`)**: Multi-select components on screen to bundle their source context, props, imports, and auto-detected relationships.
- **Token-Aware AI Prompts**: Copy optimized AI context prompts sized by token budget (`minimal` ~200 tok, `standard` ~500 tok, `full` ~1500 tok).
- **Graceful Port Resilience**: Automatically detects occupied ports (`EADDRINUSE`) and binds to the next available port, forwarding it to the in-browser overlay dynamically.

## Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `port` | `number` | `9850` | Port for the local bridge server (HTTP + WebSocket). Auto-increments if port is occupied. |
| `editor` | `'auto' \| 'cursor' \| 'vscode' \| 'webstorm' \| 'zed' \| 'windsurf' \| 'antigravity'` | `'auto'` | Target IDE protocol for source navigation links. |
| `openInEditor` | `boolean` | `true` | Whether to automatically open the component file on `Alt+Shift+Click`. |

## Related Packages

- [`@agent-hover/core`](https://www.npmjs.com/package/@agent-hover/core): Context intelligence engine (AST parsing, relationships, and token budgeting).
- [`@agent-hover/mcp`](https://www.npmjs.com/package/@agent-hover/mcp): Model Context Protocol server for Claude Desktop, Cursor, and Windsurf.

## License

MIT
