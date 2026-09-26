# @agent-hover/mcp

> Model Context Protocol (MCP) server for [Agent Hover](https://github.com/Arc-coder07/agent-hover).

Connects AI coding agents (**Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**) directly to your running React development environment. Instead of manually copying and pasting prompt snippets, AI agents can query live component ASTs, inspect pinned relationships, retrieve rendered styles, and verify visual diffs programmatically over stdio.

## Installation

```bash
npm install @agent-hover/mcp
```

Or run on-demand via `npx`:

```bash
npx -y @agent-hover/mcp
```

## Agent Configuration

### Claude Desktop / Claude Code

Add the following to your `claude_desktop_config.json`:

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

### Windsurf

Add to `.codeium/windsurf/mcp_config.json`:

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

## Environment Variables

- `COMPONENT_POINTER_PORT`: Bridge server port started by `@agent-hover/vite` (default: `9850`).

## Tools

### 1. `get_component_context`
Get rich AST and code context for a React component at a specific file and line number. Returns props interfaces, hooks, imports, parent components, and token estimates.
- **Parameters:**
  - `file` (string, required): Relative path to component file (e.g., `src/components/Button.tsx`).
  - `line` (number, required): Line number within the component.
  - `level` (`"minimal"` | `"standard"` | `"full"`, optional): Context detail level (default: `"standard"`).

### 2. `get_pinned_set`
Get all currently pinned components with their auto-detected relationships (parent/child/sibling) and total token count. Components are pinned from the browser overlay using `Alt+Shift+Click`.
- **Parameters:**
  - `level` (`"minimal"` | `"standard"` | `"full"`, optional): Context detail level (default: `"standard"`).

### 3. `create_task_context`
Generate optimized context for a coding task based on pinned components, bundling relevant source code and instructions into a single token-budgeted prompt block.
- **Parameters:**
  - `instruction` (string, required): The coding task description (e.g., *"Make these card borders consistent"*).
  - `level` (`"minimal"` | `"standard"` | `"full"`, optional): Context detail level (default: `"standard"`).

### 4. `get_frozen_components`
Returns all components marked as "frozen" by the developer in the browser overlay. Components returned by this tool **MUST NOT** be modified by the AI agent.

### 5. `capture_screenshot`
Triggers an automated screenshot capture of a component's rendered bounding box directly in the running browser.
- **Parameters:**
  - `file` (string, required): Relative path to component file.
  - `component` (string, required): Component name.
  - `label` (`"before"` | `"after"`, required): Whether this capture is pre-change (`"before"`) or post-HMR change (`"after"`).

### 6. `verify_visual_change`
Compares before-and-after screenshots to compute pixel difference percentages and verification summaries, confirming that UI changes rendered as expected.
- **Parameters:**
  - `file` (string, required): Relative path to component file.
  - `component` (string, required): Component name.

## License

MIT
