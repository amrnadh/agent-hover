# Changelog

All notable changes to Agent Hover will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Agents that start outside your project connect.** A running dev server now also lists itself in `~/.agent-hover/bridges/` (only you can read it, like `.agent-hover/session.json`). The MCP server looks for the dev server in its working folder, then in the workspace folders the agent reports (MCP roots), then in that list. Antigravity, Windsurf and Claude Desktop, which use a global config, used to get "401 Unauthorized". A 401 now says what to check. Set `AGENT_HOVER_HOME` to move the list.
- **Settings › Agents, step by step.** Pick an agent and get three steps: the `init` command for it (with Copy), how to restart it so it loads the server, and its own listen and status commands. The by-hand config is folded underneath. Connected agents show how you start them listening.
- **OpenCode.** `init --agent opencode` registers the MCP server in `opencode.json` (its own `mcp` format), adds the task note to `AGENTS.md` (written once when Codex is set up too) and `/agent-hover` commands in `.opencode/commands/`. Settings › Agents and `npx agent-hover mcp opencode` show the setup.
- **`/agent-hover-status`** (`$agent-hover-status` in Codex) lists waiting and running tasks without starting any. `init` writes it next to `/agent-hover` for every agent. Claude Code's desktop app can't send MCP prompt names like `/mcp__agent-hover__status` (it reads the underscores as formatting), so the plain commands are the way to go there.
- **You can see when the mic is listening.** The mic turns red and glows softly (a little faster while it hears you), and an empty text box says "Listening…". **Esc** stops listening and keeps what was said.
- **`init` asks properly.** Pick agents from a checklist (↑ ↓, space, a for all, Enter), with the ones your project already uses ticked and where each one's config goes shown next to it; then a Yes/No before anything is written. Esc or Ctrl+C cancels. The plan is grouped (this project, then each agent), and the next steps name each agent's own start command. Without a terminal (scripts, CI) it works as before: `--agent` and `--yes`.
- **Try unpublished versions in a real project.** `npm run registry:local` starts a private npm registry on your machine with the current code under a fresh version; point npm at it and `npx agent-hover init`, the plugin install and every agent's MCP server use that code. See `docs/testing-before-release.md`.
- **Tasks grouped by what they need from you.**
  - The Tasks tab shows **Needs you** (changes to review, failures), **In progress**, and **History**, which starts folded and carries **Clear** (asks once). Rows show the status and the exact `file:line`; open one for the element, the agent's summary, its files and actions.
  - The Tasks tab badge counts what needs you, and the dock's Tasks dot turns red for a failure.
  - ↑ ↓ move between rows in Tasks and Comments, Enter opens one, Delete removes it.
- **Remove tasks.**
  - Any task but one an agent is working on can leave the list: from the task card's ⋯ menu, or the trash icon on a row. A waiting task is withdrawn, so no agent picks it up later. A change you haven't kept or undone asks first, because its Undo goes with it.
  - **Clear** in History removes every task with nothing left to decide; changes waiting for review stay.
  - Finished tasks older than a week leave the list on their own (changes still waiting for review stay).
  - Bridge: `POST /api/agent/tasks/remove` with `{ ids }` or `{ finished: true }`. A task's Undo checkpoint goes with it however it leaves.
- **Send again and Try again.** A task no agent picked up (now "Not picked up" instead of "Expired") or one you cancelled can be sent again as a new task, to the same element and agent; a failed one gets **Try again**. Both offer **Copy prompt** for any AI tool. Bridge: `POST /api/agent/tasks/:id/retry`; the new task records `retryOf`.
- **Restart notice after an update.** The page loads a new Agent Hover right away, but the dev server keeps running the old one until it restarts, so new buttons used to fail with a raw error. The bridge now reports its API level in `/api/health`; when it's older than the page, the dock and sidebar say "Restart your dev server to finish updating", and a request the old bridge doesn't know says the same instead of a parse error.
- **Task card keys.** With a task card open: **K** Keep, **U** Undo, **F** Follow up, **R** Try again / Send again. While an agent works, the card counts how long it has been at it. The toast when a change is done offers **Review**.
- **`/agent-hover` starts listening.**
  - `agent-hover init` adds a one-word command for each agent: `.claude/commands/agent-hover.md` (Claude Code), `.cursor/commands/agent-hover.md` (Cursor), `.windsurf/workflows/` (Windsurf), `.agent/workflows/` (Antigravity), and a `$agent-hover` skill for Codex (`.agents/skills/`).
  - The MCP server now tells agents how to listen when they connect, and offers `listen` and `status` prompts (`/mcp__agent-hover__listen` in Claude Code).
- **Pick which agent gets a task.** With several agents connected, the agent you pick in Ask (or the first one) is the only one that receives the task. Comments and Batch go to the same agent. Two sessions of one agent show as one agent with a session count.
- **Exact file and line on React 19.**
  - React 19 dropped the source information Agent Hover read in React 18. The element's own creation stack is now mapped back through the dev server's source maps to the exact file and line, in Chrome, Firefox and Safari.
  - This includes components that don't live in a file of their own name.
  - An element drawn by a shared UI block (`ui/button.tsx`) points to where the block is used (`<Button>` in `Hero.tsx`).
- **Voice.** A mic button in Ask and in new comments: speak instead of typing. It uses the browser's speech recognition, on the device when the browser can; otherwise it says once where the audio goes. It's hidden where the browser has no speech recognition (Firefox). It listens in your browser's language, and Settings › Voice turns it off.
- **`init` writes global configs** for Antigravity (`~/.gemini/config/mcp_config.json`, plus the older `~/.gemini/antigravity/` file if you have one) and Windsurf, after showing them in the plan and asking.
- **Windows support.**
  - Agents start the MCP server through `cmd /c npx`.
  - Open in editor uses the editor's own link, since the editors' command-line tools are `.cmd` scripts there.
  - Paths are compared case-insensitively, git's `C:/` paths are understood, and CI runs the unit tests, a fresh-project setup and the browser tests on Windows.
- **Review on the page.** A finished task that changed files now waits on its element until you decide, instead of its marker fading after 30 minutes.
  - The marker gets a ring, the timeline gains a last step (Review, then Kept, Undone or Followed up), and the dock's Tasks dot stays on, without pulsing.
  - The task card leads with **Keep**, then Compare, Undo and **Follow up**.
  - Follow up opens Ask on the same element, and the new prompt carries a "Previous attempt" section (the earlier request, the agent's summary and its files), so the agent builds on the change instead of starting over. The new task records `followUpOf`.
  - The Tasks tab lists these under "Needs you".
  - Your decision is saved with the task (`review` on the task, `POST /api/agent/tasks/:id/review`), so it survives reloads. Undo records itself. Keep leaves the checkpoint in place, so Undo stays possible until checkpoints are pruned.
- **Lock is checked, not only asked.** If a finished task changed the file of a component you locked, its marker turns amber with a lock and the card names the component, with Undo right there.
- **New page cursor.** In Inspect, Comment and Batch the pointer is the dock's Inspect dart, filled, with a small badge for what a click does: a framed square (select), a speech bubble (comment) or a blue + (add to batch). It replaces the crosshair, which stays as the fallback (`packages/overlay/src/lib/cursor.ts`). The active Inspect or Comment button in the dock fills to match, and the demo recorder draws the same cursors.
- **Click to collect.** With Inspect on and the Batch tab open, clicking an element adds it to the batch, and clicking it again takes it out; the cursor shows the + while this is on.

### Changed
- **Update notices like other npm tools.** When a new version is out, the dev server prints a box under Vite's own startup lines: the versions, the update command for your package manager (npm, pnpm, yarn or bun, from the lockfile, including a monorepo root), and a link to the release notes. The page shows the same in one toast per version, the dock popover and Settings › About (with Copy and What's new), and `agent-hover doctor` repeats it. The check asks the registry npm is set to use (a company mirror too), at most once a day (cached in `~/.agent-hover`), and again every day for dev servers that stay up. It stays off in CI, with `AGENT_HOVER_NO_UPDATE_CHECK=1`, or with the usual `NO_UPDATE_NOTIFIER=1`.
- **One `file:line` everywhere.** The pill, Ask, the task card, comments and the task sent to the agent all use the element's own line (React 19) or else its component's; Ask and comments used the component's first line while the pill showed the element's.
- **Undo only when something changed.** Tasks that changed no files (a question the agent answered, a failure before any edit) no longer offer Undo.
- **Comment card matches the task card**: status and time on top, the note as the title, the element and `file:line` underneath, **Send to agent** first. Delete asks once.
- **Markers stay out of your app's way.** A task marker or comment pin whose element is covered (your app's own dialog, a sticky header) is hidden, a marker on a block of text sits at the end of the text instead of the far edge of the block, and a comment from the pill or **C** pins to the element's top-left corner, outside it, clear of the task marker.
- **Empty states give you the next step**: Pick an element (Inspect), Add a comment (Comments), Pick elements (Batch). Alt says whether it turned Inspect on or off.
- **Plain names.** Cards and lists say what you selected in words: “Book a demo” button, “Pricing” link, `<StatCard />`. A library wrapper such as `motion.a` is named by the element it draws. The code name (`button#hero-primary-cta`) stays in the hover tag, in prompts, under the name in Inspect, and in the pill's tooltip.
- **Task card.**
  - It leads with your request, with the element and file underneath and the status and time on one line.
  - Keep and Undo come first; Compare and Follow up are quieter.
  - View in Tasks, Show on page, Cancel and Remove moved to a ⋯ menu.
  - The card no longer covers the action pill.
- **Batch.**
  - Each element is a small card with its name and code name.
  - Its role (Change, Reference, Don't touch) is a three-way toggle instead of a dropdown.
  - Move and remove appear on hover.
  - The goal and Send stay at the bottom of the sidebar.
- **Sidebar.** The tab row fits without cutting off Inspect, counts are small badges, and the open tab stays in view. Comment numbers in the list look like the pins on the page.
- **Focus.** Keyboard focus rings are graphite (blue is only for the on-page selector), and text boxes show focus with their border.
- An agent that closes leaves the page at once. The MCP server says goodbye on exit, and the bridge also tells the page when an agent times out, instead of the page noticing up to 40 seconds later.
- An explicit `AGENT_HOVER_PORT` / `AGENT_HOVER_TOKEN` now wins over a session file found above the working directory. This also fixes the MCP tests, which failed while the demo dev server was running.
- CI uses the current GitHub Actions (checkout, setup-node and upload-artifact v7). The repository scripts (`typecheck`, `clean`, `screenshots`) run on Windows too.
- The README, the `@agent-hover/vite` and `@agent-hover/mcp` npm descriptions, and the README GIF lead with what happens after you ask: the task on the element, review, Keep or Undo, and locks. The GIF is re-cut from the existing recording and starts at Send. `npm run record:demo` keeps this cut with a `gifStart` mark and a new caption at that moment.
- Tests save screenshots to `test-results/` instead of rewriting the images in `docs/screenshots/` on every run; `npm run screenshots` refreshes the README images. Old 0.1-era screenshots and internal planning documents left the repository.
- The repository moved to `github.com/amrnadh/agent-hover`. Every package's npm page now links to it (`repository`, `homepage`, `bugs`).
- `@agent-hover/core` uses `tinyglobby` instead of `fast-glob`, which drops the vulnerable `braces` dependency.
- The demo app is now **Sorrel**, a fictional invoicing product with a coded product preview in the hero. It replaces the Nexora page and its hotlinked background video, so the README video and screenshots show a believable app and nothing loads from a third-party server. It stages one moment per feature on purpose: an underline you can't name, a one-off tile next to `<StatCard>`s, a misaligned header and an odd date, room for a new button, and a logo to lock (`demo/README.md`; `e2e/demo-scenes.spec.ts` keeps them in place).
- **GitHub demo video**: `npm run record:demo` records six scenes (point instead of describe, like this not that, notes, add a feature, lock), each on a fresh demo copy, and joins them into `docs/media/agent-hover-demo.mp4`; scene 1 is the README GIF. `npm run record:demo -- 2` re-records one scene. `docs/media/VIDEOS.md` describes the demo video and the separate launch video.

### Fixed
- An agent running in a sandbox (Cursor, Antigravity) treated the running dev server as stopped, because the sandbox doesn't let it check other processes, and sent no token: every tool failed with 401.
- Task markers could go missing after a page reload or after the agent's change hot-reloaded the element, until you scrolled (mostly Safari/WebKit). Markers are placed again while the page settles, and when a task's element appears later (another route in a single-page app).
- Compare's "before" image is now taken when you open Ask, not after Send, so a fast agent can no longer change the page while it is being captured (which left Compare missing or showing the changed element).
- Screenshots and Compare's after image no longer hide the whole overlay while they capture; a slow capture (Linux WebKit) made the UI disappear for its duration. A capture now gives up after 10 seconds instead of waiting forever.
- The bridge imported `fast-glob` without declaring it, so finding source files (file and line in prompts, open in editor) only worked when another package installed it. It now uses `tinyglobby`, declared by `@agent-hover/vite`. `npm run pack:check` fails when published code imports a package that is not in its dependencies.
- Moving the pointer onto a task marker or a comment pin left the page's last hover outline on screen; it now clears, as it does over the dock and cards.
- Components that render an SVG (icons, decorations) had no box: hovering showed `svg.…` instead of the component, and selecting the component found nothing to outline. SVG roots now count, in the overlay and in `list_components`.
- Screenshot element and Compare drew SVG elements as blank images; they now capture the box around the SVG and crop it.
- In Compare, the "After" label stretched over the whole after image as a dark layer; it is a small tag again.
- Pressing B on an element already in the batch added it a second time if you had selected it again in between; it now takes it out, as the button says.

## [0.2.0] - 2026-10-12

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
