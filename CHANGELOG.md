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
- **Compare and Undo (P3-01)**: when the agent claims a task, the bridge takes a git checkpoint (HEAD, uncommitted tracked state via `git stash create`, untracked files as blobs; nothing in your working tree, index or HEAD changes). The task card shows a before/after slider of the element and **Undo**, which lists the files to restore (with +/− counts and a warning for files the agent did not report) and restores them one by one. Never uses `reset --hard`, `clean` or `checkout .`. Disabled with an explanation outside git. Endpoints `GET /api/agent/tasks/:id/changes`, `POST /api/agent/tasks/:id/undo`; `filesChanged` is filled from git when the agent omits it.
- **Better prompts**: every prompt (Ask, Copy, comments, batch) now leads with what to do, then where (file, the line that renders the element, and a warning when it comes from a shared component such as `<Button>`), how the element looks now, the component's props and current values, notes left on that element, constraints (stay scoped, follow the file's styling, locked components), and the source. Long components send only the 90 lines around the element at Standard detail (Deep sends everything).
- **Listen mode**: MCP tool `wait_for_agent_task` waits for the next task sent from the browser, claims it, and returns its prompt, so the agent can loop without the user prompting each task. Backed by a long-poll bridge endpoint `GET /api/agent/tasks/next`.
- **`npx agent-hover init`**: installs `@agent-hover/vite`, adds `agentHover()` to the Vite config (only when the config is a plain `plugins: [...]` array; otherwise prints the two lines to add), registers the MCP server in project config for Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`) and Codex (`.codex/config.toml`), adds the task rules to `CLAUDE.md` / `.cursor/rules/agent-hover.mdc` / `AGENTS.md`, and adds the local data files to `.gitignore`. Agents are detected from the project or chosen with `--agent`; `--dry-run`, `--yes`, `--no-install`. Shows every change and asks first, merges instead of overwriting (JSON configs keep a `.bak`), and a second run changes nothing.
- **`npx agent-hover doctor`**: checks Node, the plugin (installed and in the config), the running dev server and its version, the session token, connected agents, MCP registration (project and global configs, read only), rules, `.gitignore` and git.
- **`agent-hover` CLI package** (`npx agent-hover`): setup steps checked against the project, MCP config per agent (`mcp <agent>`) and the agent rules snippet (`rules`). No dependencies.
- Comments store an optional pin position (`offsetX`, `offsetY`); older comments still load.
- **Update notice**: the bridge checks npm for a newer `@agent-hover/vite` at most once a day (no project data sent; off in CI or with `AGENT_HOVER_NO_UPDATE_CHECK=1`). The overlay shows one toast per new version, a line in the dock's connection popover, and the update command in Settings › About. Also reported by `GET /api/health`.

### Changed
- **Overlay split into modules**: the 4,948-line `client.ts` closure became focused modules under `app/`, `bridge/`, `features/`, `ui/`, `lib/`.
- New mark: a monochrome, dithered "lifted element" that follows the theme (`packages/overlay/src/brand/mark.svg`, generated with the other logo assets by `docs/brand/make-logo.mjs`). The dock is a rounded rectangle instead of a pill, and the connection dot sits top-right.
- Blue is used only for the on-page selector; every other surface is neutral (white on dark, near-black on light).
- The sidebar no longer opens on every click; open it with Details (⋯ menu or D), the dock, or Tasks/Batch.
- Source resolution skips library wrappers (motion components, providers) and uses the nearest component in your project.
- Letter shortcuts only work while Agent Hover is in use, so they never take over the host app's own shortcuts.
- The overlay bundle is re-read when rebuilt, so the dev server picks it up on reload.
- **Screenshots**: each shot (element, visible area, full page) is copied to the clipboard and saved to `.agent-hover/screenshots/`; a toast confirms it and View opens a lightbox in the new style (copy image, download, show in folder). Escape closes the lightbox first.
- All packages are 0.2.0 with `exports`, `engines` (Node 20+), and no source maps or tests in the published files; `npm run pack:check` verifies what each package would publish.
- README, package READMEs and CONTRIBUTING rewritten for 0.2, with a recorded demo (`npm run record:demo` regenerates it).
- CI (GitHub Actions): build, typecheck, unit tests and pack check on Ubuntu and macOS with Node 20 and 22, plus the e2e suite in Chromium and the user flows in Firefox and WebKit.
- Release QA: an e2e test of the full agent loop through the real MCP server, an accessibility scan (axe, WCAG 2.1 A/AA) of every overlay surface in dark and light, a performance budget (no idle frames, overlay hover cost), and `docs/release-checklist.md`.
- Final logo (Lift) and brand assets in `docs/brand/logo/`: theme-following SVG mark, favicons, app icon, lockups and a social preview image, all generated by `docs/brand/make-logo.mjs`.
- `npm run test:e2e:isolated` runs the e2e suite on a throwaway git copy of the demo, so it never edits `demo/` or collides with a running dev server.
- The demo app uses fictional company names and no compliance or AI-model claims.
- Version numbers come from each package's `package.json` (bridge `/api/health`, MCP server, overlay About) instead of hard-coded strings.

### Removed
- Inline text editing (double-click to edit source) and the in-sidebar source editor.
- The spacing-bands toggle (the box model is in Inspect › Layout; hold ⌘/Ctrl for distances).
- The 0.1 selection chip, Stage 1 popover, MCP setup modal (now Settings › Agents), screenshot mode dropdown and preview card, and all 0.1 styles: `overlay.css` and the legacy token file are gone; the overlay ships one stylesheet (`ui.css`).

### Fixed
- Prompts for elements passed into another component as children (`<Card><button/></Card>`) now point at the component that writes them (`App`, with the right line) instead of the wrapper they render in; the "shared component" hint no longer appears when the element's own tag is written in place.
- Settings code snippets can be scrolled with the keyboard (axe: scrollable-region-focusable).
- Compare drew the before and after images at different scales when the element changed size; both now use one scale, aligned top-left.
- The hover outline no longer stays on the page while the pointer is over the pill, a card, the dock or the sidebar.
- The Undo checkpoint works on machines without a git identity (`user.email`).
- The plugin no longer injects the unused dom-to-image library into every page.
- The default destination is now the most recently active agent; before, an agent that reconnected kept the place it had when it first connected.
- Taking the Undo checkpoint no longer fails when your editor is running git at the same moment (it waits for `index.lock`).
- Opening a comment while the composer was open (or the other way round) stacked both cards; only one card is open at a time now.
- Pressing “Minimize dock” twice moved the round dock button to the top-left corner with no way back; minimizing is now idempotent, the button stays on screen and can be dragged.
- Prompts headed “Component Task: <Hero />” when you selected one button inside Hero, included notes from unrelated elements in the same file, and ended with a token-budget line; the MCP `compact` format returned only the title and `deep` ignored the overlay's prompt.
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
