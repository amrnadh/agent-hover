# Changelog

All notable changes to Agent Hover will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **New overlay UI (0.2 design, docs/design/prototype.html)**, rebuilt on the existing engine:
  - **Selector**: blue hover outline and label (`<Component />` or `tag.class` + size); selection frame with corner ticks; locked components in red; hold ⌘/Ctrl over another element to see distances.
  - **Action pill** on click: element and file, Ask, Comment, + Batch, Copy, ⋯ (open in editor, screenshot, “Don't let agents change this”, parent/child, details), close.
  - **Composer** (Ask or Enter): instruction, destination (a connected agent or Copy prompt), ⌘/Ctrl+Enter. Closes after sending.
  - **Task markers and task card**: each sent task shows on its element (sent, seen, working, done, failed) with a timeline, the agent's summary and changed files. Markers come back after a reload.
  - **Dock**: status mark with connection popover, Inspect, Comment, Tasks, Batch, ⋯ menu, drag grip; vertical option, minimize (⌘/Ctrl+Shift+X), first-run hint.
  - **Sidebar**: Inspect (identity, breadcrumb, runtime props with secrets redacted, hooks, text, layout and box model, source; token count, detail level, Copy), Tasks, Comments, Batch; Settings view; float or docked; resizable.
  - **Comments**: Comment mode drops numbered pins exactly where you click; resolve, delete, send one or all to your agent.
  - **Batch**: collect several elements with roles (Change, Reference, Don't touch) and send them as one task.
  - **Settings**: agent setup for Claude Code, Cursor, Codex, Windsurf, Antigravity and Claude Desktop; Send behaviour (send if connected, else copy / always copy); context detail; theme; dock orientation; editor (Cursor, VS Code, Windsurf, Zed, WebStorm, Antigravity); keyboard shortcuts.
- **Listen mode**: MCP tool `wait_for_agent_task` waits for the next task sent from the browser, claims it, and returns its prompt, so the agent can loop without the user prompting each task. Backed by a long-poll bridge endpoint `GET /api/agent/tasks/next`.
- **`agent-hover` CLI package** (`npx agent-hover`): read-only setup check plus MCP config per agent (`mcp <agent>`) and the agent rules snippet (`rules`).
- Comments store an optional pin position (`offsetX`, `offsetY`); older comments still load.

### Changed
- **Overlay split into modules**: the 4,948-line `client.ts` closure became focused modules under `app/`, `bridge/`, `features/`, `ui/`, `lib/`.
- Blue is used only for the on-page selector; every other surface is neutral (white on dark, near-black on light).
- The sidebar no longer opens on every click; open it with Details (⋯ menu or D), the dock, or Tasks/Batch.
- Source resolution skips library wrappers (motion components, providers) and uses the nearest component in your project.
- Letter shortcuts only work while Agent Hover is in use, so they never take over the host app's own shortcuts.
- The overlay bundle is re-read when rebuilt, so the dev server picks it up on reload.

### Removed
- Inline text editing (double-click to edit source) and the in-sidebar source editor.
- The spacing-bands toggle (the box model is in Inspect › Layout; hold ⌘/Ctrl for distances).
- The 0.1 selection chip, Stage 1 popover, MCP setup modal (now Settings › Agents) and their styles (`overlay.css` 2,064 → 664 lines).

### Fixed
- Tasks never reached the `delivered` state, so the browser could not show "Seen by {agent}". `list_agent_tasks` now marks returned queued tasks delivered.
- Agent presence used a generic `mcp-agent` name and was listed twice; the MCP server now reports the client's real name (e.g. `claude-code`) once. The overlay also fetched presence from a non-existent endpoint on load.
- Element labels showed the whole class list (double-escaped regex left over from the template-literal overlay); a stray literal `\n` in a generated stylesheet.
- Shortcuts fired while typing in overlay inputs (focus inside the shadow root was not detected), and a shortcut letter could be typed into the input it opened.
- Send/Copy could use the previous selection's cached component context.

## [0.1.0] - 2026-09-17

### Added
- **Fiber-Aware Component Resolution**: Walk React fiber return trees to resolve outermost meaningful components and full component ancestry breadcrumbs.
- **Minimal Selection Frame & Spacing Overlay**: High-precision 1.5px frame with resize handles, dimension pills, and opt-in box-model margin/padding bands and dashed viewport axis guides.
- **Direct-to-Disk AST Source Editor**: Double-click text to visually edit and commit changes directly to source code on disk via Babel AST parsing with automatic syntax validation and instant undo.
- **Context Generation Workflows**:
  - `⚡ Copy for AI Prompt`: Actionable prompt templates with cursor instruction placeholders, relative file line ranges, component hierarchy, props interface, and agent guardrail boundaries.
  - `📋 Copy Spec`: Structured GitHub Markdown tables for props, hooks, imports, and source snippets.
  - `⚡ Inline Task Brief Composer`: Embedded multi-component prompt builder in the pinned stack bar with zero disruptive browser popups.
- **Component Freeze & Protection**: Lock components to generate explicit `⛔ FROZEN COMPONENTS — DO NOT MODIFY` directives that forbid autonomous agents from editing protected files.
- **Keyboard Shortcuts HUD (`?`)**: Quick reference overlay for inspecting, editing, ancestry navigation, and panel shortcuts.
- **1-Click IDE Jump**: Deep-linking to Cursor (`cursor://`), VS Code (`vscode://`), Windsurf, and Antigravity.
