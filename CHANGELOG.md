# Changelog

All notable changes to Agent Hover will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Overlay split into modules (P2-01 completion)**: the 4,948-line `packages/overlay/src/client.ts` closure is now 25 focused modules under `app/`, `bridge/`, `features/`, `ui/`, and `lib/`, sharing one `OverlayApp` context (bridge fetch, shadow root, element refs, state, cross-module API). Mechanical, behavior-preserving; all unit and e2e tests pass unchanged.
- Added `docs/UX-NORTH-STAR.md`: UX principles, the golden path with acceptance criteria, and surface responsibilities.

### Added
- **Listen mode**: MCP tool `wait_for_agent_task` waits for the next task sent from the browser, claims it, and returns its prompt, so the agent can loop without the user prompting each task. Backed by a long-poll bridge endpoint `GET /api/agent/tasks/next`.
- **`agent-hover` CLI package** (`npx agent-hover`): read-only setup check plus MCP config per agent (`mcp <agent>`) and the agent rules snippet (`rules`).

### Fixed
- Tasks never reached the `delivered` state, so the browser could not show "Seen by {agent}". `list_agent_tasks` now marks returned queued tasks delivered.
- Agent presence used a generic `mcp-agent` name and was listed twice (presence + legacy heartbeat). The MCP server now reports the client's real name (e.g. `claude-code`) once.

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
