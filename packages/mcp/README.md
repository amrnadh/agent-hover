# @agent-hover/mcp

Model Context Protocol (MCP) server for [Agent Hover](https://github.com/agent-hover/agent-hover).

Allows AI coding agents (Claude Desktop, Cursor, etc.) to query rich React component context, inspect pinned component relationships, and generate task-focused context blocks programmatically over stdio.

## Installation

```bash
npm install @agent-hover/mcp
```

Or run directly via `npx`:

```bash
npx -y @agent-hover/mcp
```

## Agent Configuration

### Claude Desktop / Claude Code

Add the following to your Claude configuration (`claude_desktop_config.json`):

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

## Environment Variables

- `COMPONENT_POINTER_PORT`: Bridge server port started by `@agent-hover/vite` (default: `9850`).

## Tools

### `get_component_context`
Get rich context for a React component at a specific file and line number.
- **Parameters:**
  - `file` (string, required): Relative path to component file (e.g., `src/components/Button.tsx`)
  - `line` (number, required): Line number within the component
  - `level` (`"minimal"` | `"standard"` | `"full"`, optional): Context detail level (default: `"standard"`)

### `get_pinned_set`
Get all currently pinned components with their auto-detected relationships (parent/child/sibling) and total token estimate.
- **Parameters:**
  - `level` (`"minimal"` | `"standard"` | `"full"`, optional): Context detail level for each pinned component (default: `"standard"`)

### `create_task_context`
Generate optimized context for a coding task based on pinned components.
- **Parameters:**
  - `instruction` (string, required): The coding task description
  - `level` (`"minimal"` | `"standard"` | `"full"`, optional): Context detail level (default: `"standard"`)
