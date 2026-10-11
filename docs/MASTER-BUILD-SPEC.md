# agent-hover — Master Build Spec (Free Open-Source v0.2)

> Hand this file to the coding agent as the single source of truth for the free, open-source npm version.
> "agent-hover" is the **working name**. The final name is undecided, so never hardcode it in more than one place (see D-12).

---

## 0. How to use this document (instructions to the coding agent)

1. **Work one phase at a time, in order** (Phase 0 → 1 → 2 → 3 → 4). Do not start a phase until the previous phase's acceptance criteria pass.
2. **Verify before fixing.** The audit findings in §5 came from an automated review, and line numbers may be stale or wrong. For every finding: reproduce or confirm it in the current code first. If it is not real, say so and skip it. Do not "fix" things that are not broken.
3. **Small, reviewable commits.** One task ID (e.g. `P1-03`) per commit or PR. Commit message starts with the task ID.
4. **Never break the compatibility contracts in §4.3** without the deprecation path described there.
5. **Every behavior change needs a test** (see §8). Add the safety-net tests in Phase 0 *before* refactoring anything.
6. **Do not rewrite large files in one go.** `packages/vite/src/index.ts` is a ~7,300-line template literal. Extract it in small mechanical slices (P2-01), not in one rewrite.
7. **Ask instead of guessing.** If a decision is not in §3 or §10, stop and ask. Do not invent product behavior.
8. **Update docs as you go** (README, CHANGELOG, SECURITY.md). Do not leave docs for the end.
9. **No telemetry, no network calls to third parties, no external font or CDN requests** in the free version.
10. After finishing each phase, post a short report: what changed, what was skipped and why, what is risky.

---

## 1. Vision and positioning

**One-line pitch:** *Point, instruct, verify.* Point at any element in your running app, tell your coding agent what to change, and verify what it did, with undo.

**Who it is for:** developers using AI coding agents (Claude Code, Cursor, Windsurf, Antigravity, etc.), especially people who vibe-code and need the agent to understand *which* component they mean and need a safe way to check and undo its work.

**What makes it different from "click element → copy context" tools:**
- The agent does the work; this tool provides **context, delivery, and verification**. It is not an editor and not an IDE.
- A **reliable delivery loop**: tasks have IDs and status, and the browser shows whether an agent actually received and worked on them.
- A **verification loop**: before/after comparison and per-task undo.
- **Better context**: runtime values, errors, scope awareness (this instance vs. everywhere).
- **Safe by default**: authenticated localhost bridge.

**Business context (for awareness only; do NOT build any of it now):** the free package is the distribution channel. A paid cloud/team layer (shared feedback links, team queue) may come later as a *separate, closed-source or source-available* package after validation. The free core stays MIT.

---

## 2. Scope

### In scope (this document)
- Security hardening and bug fixes from the audit
- Bridge v2: authenticated, queue-based, status-aware, with agent presence
- Overlay overhaul: isolation, design system, dock, inspector, popover, sidebar, keyboard, accessibility
- Differentiators: before/after + undo, shared-component scope, runtime snapshot, intent chips
- One-command setup (`init`, `doctor`), docs, tests, CI, publish readiness

### Explicitly out of scope
- Any cloud service, accounts, billing, team features, shareable links
- A browser extension (later)
- Our own coding agent, chat UI, or IDE
- Figma-style drag-and-edit visual editing
- Vue / Svelte / Angular support (Next.js comes first after launch; see Phase 5)
- Telemetry or analytics of any kind

---

## 3. Decisions log (locked, do not relitigate)

| ID | Decision |
|----|----------|
| D-01 | Free version is open source, **MIT** licensed. Core, vite, and mcp packages stay MIT. |
| D-02 | Positioning: **"Point, instruct, verify."** UI copy and README follow this. |
| D-03 | Delivery model: **queue with IDs and statuses**, replacing the single `latestAgentTask` slot. |
| D-04 | The bridge is **authenticated** (random per-session token), bound to `127.0.0.1`, with strict Origin and Host validation. |
| D-05 | **Structured payload** (JSON) is the source of truth. The prompt string is rendered from it (by core formatters) at the requested detail level. The overlay still renders a local prompt for clipboard copy. |
| D-06 | **Clipboard rule:** "Copy" always copies. "Send to Agent" writes to the clipboard **only if no agent is connected or the bridge is unreachable** (setting: `copyOnSend: 'auto' \| 'always' \| 'never'`, default `auto`). |
| D-07 | **Dock = primary interface**: a compact horizontal pill, bottom-center (vertical option in Settings). **Sidebar = secondary slide-out drawer** (tabs Inspect · Tasks · Comments · Batch + Settings, 380px default, resizable 320–520px). *Amended 2026-10-11 to the approved 0.2 design (docs/design/prototype.html).* |
| D-08 | Click shows the **action pill**; the **composer** opens only on Ask/Enter and closes after sending; task progress lives on an **element marker**, the dock and the Tasks tab. The sidebar never duplicates pill actions (its only action is Copy in Inspect, plus Send in Batch). *Amended 2026-10-11.* |
| D-09 | Overlay is extracted from the template literal into a **compiled package** (`@agent-hover/overlay`, bundled to an IIFE) *before* the visual overhaul. |
| D-10 | Blue (#0D99FF) only for the on-page selector; all other UI neutral ink (graphite dark, white light). Real contrast compliance (WCAG AA minimum). *Amended 2026-10-11.* |
| D-11 | `npx <pkg> init` configures everything (Vite plugin, MCP config, .gitignore). `doctor` diagnoses problems. |
| D-12 | **Brand strings centralized.** One module (`packages/core/src/brand.ts`) exports `BRAND = { name, npmScope, mcpServerName, cliName, dataDir, envPrefix }`. All user-facing strings, config snippets, and the data directory derive from it so a rename is a one-file change. Default `dataDir` stays `.agent-hover`. |
| D-13 | Because delivery is pull-based (agent must call an MCP tool), `init` can also **write a short rules snippet** (for CLAUDE.md / .cursorrules / etc.) telling the agent how to handle tasks. Optional, asks first. |
| D-14 | Scope default (see §7.8): when a component appears in more than one place on the page, the default scope is **"this instance only"**, with a visible toggle to "everywhere". (Owner may flip this in §10.) |
| D-15 | Undo/checkpoint requires a **git repository**. Without git, the feature is disabled with a clear explanation. It does not fall back to anything risky. |
| D-16 | Next.js is the first additional framework after launch. Not part of v0.2. |

---

## 4. Current state snapshot

### 4.1 Architecture
```
External agent (MCP client: Claude Code / Cursor / Windsurf / Antigravity ...)
        │ stdio JSON-RPC
        ▼
@agent-hover/mcp  (stdio server, 8 tools)
        │ HTTP (default port 9850)
        ▼
@agent-hover/vite (Vite plugin + Express/ws bridge-server.ts, in-memory state, disk I/O)
        │ injects                         │ uses
        ▼                                 ▼
Shadow DOM overlay (packages/vite/src/index.ts, ~7.3k lines)   @agent-hover/core
        │ React Fiber traversal                                 (token budget, formatters, relationship
        ▼                                                        resolver, source editor, style detection)
Live React tree (__reactFiber$, _debugSource, memoizedProps, hooks)
```
Plus `demo/`: a React + Vite + Tailwind showcase site (also used as the e2e test target).

### 4.2 Current MCP tools (8)
`get_component_context`, `get_pinned_set`, `create_task_context`, `get_frozen_components`, `capture_screenshot`, `verify_visual_change`, `list_components`, `get_latest_agent_task`.

### 4.3 Compatibility contracts (must keep working for at least one minor version)
- `POST /api/agent/send` with legacy body `{ prompt, type, component, file, timestamp }` → still accepted; internally creates a task (see §7.2). Mark deprecated in code and docs.
- `GET /api/agent/latest` → still works; returns the newest `queued` task (marks it `delivered`). Deprecated.
- MCP tool `get_latest_agent_task` → keep, same name and result shape; implemented on top of the queue. Deprecated in its description text (point to `list_agent_tasks`).
- All 7 other MCP tools keep names and result shapes.
- WebSocket event `agent-task-dispatched` → keep emitting alongside the new events for one minor version.
- Data files in `.agent-hover/` (e.g. `comments.json`) keep their format.

### 4.4 Known inconsistency to resolve first
One review described the default dock as a **left-edge vertical** element, while the feature inventory describes it as **bottom-center**. Check the code and use whichever is true as the "before" baseline. The target is bottom-center (D-07).

---

## 5. Audit findings to verify and fix

Severity: **C**ritical, **H**igh, **M**edium, **L**ow. Locations are from the audit; confirm them.

| ID | Sev | Finding | Fix |
|----|-----|---------|-----|
| F-01 | C | **Command injection** in IDE deep-link: `child_process.exec` builds a shell string from `ideCommand`, file path, line, column (`bridge-server.ts` ~L969). | Use `execFile` / `spawn` with an **argument array**, no shell. Validate `line`/`column` are positive integers. Validate the path (F-08). Use a whitelist of known editor commands (cursor, code, windsurf, webstorm, zed, antigravity) plus a user-configured command that is also run without a shell. |
| F-02 | C | **Weak CORS/Origin check**: `origin.includes('localhost')` accepts `attacker-localhost.com` (`bridge-server.ts` ~L133–136). Combined with `POST /api/source-update`, a malicious page could write project files. | Replace with the full model in §7.1 (token + exact Origin allowlist + Host check). Parse with `new URL(origin)`; compare hostname and port exactly. |
| F-03 | H | **`$n` replacement bug** in the source editor: `String.replace(original, newText)` interprets `$1`, `$&`, etc. in `newText` (`core/src/source-editor.ts` ~L144). | Use the function form `val.replace(originalText, () => newText)`. **Keep first-occurrence semantics.** Do not switch to `replaceAll` unless the product explicitly intends to replace every occurrence. Additionally, reject the edit if `originalText` is not found, and surface an "ambiguous: found N matches" error if N > 1 (let the caller pass an occurrence index or surrounding context). |
| F-04 | M | **Single-line import regex** misses multi-line destructured imports (`core/src/relationship-resolver.ts` ~L23), so dependency graphs are incomplete. | Parse whole-file content (dotAll regex at minimum; prefer a real parser such as `es-module-lexer` or the TypeScript AST). Also handle `export ... from`, dynamic `import()` with string literals, and type-only imports. |
| F-05 | H | **Runtime ReferenceError**: `generatePinsMarkdown` is undefined in the `#cp-pin-send-agent` handler (`index.ts` ~L4375). "Send Pinned Tasks to Agent" is broken. | Call the same `/api/task` flow that `#cp-gen-task` uses, then dispatch the result as a `pinned-stack` task via the new queue API. Add an e2e test. |
| F-06 | H | **Click interception**: global capture-phase `preventDefault + stopPropagation` while inspecting breaks all host interaction, with no passthrough (`index.ts` ~L6203). | Replace with a dedicated capture layer inside the shadow root (see P2-03) and a hold-to-interact modifier (default `Shift`, configurable). Never swallow events outside inspect mode. |
| F-07 | M | **Host pollution**: injects `<style id="cp-inspector-cursor">` into `document.head` and adds a class to `<html>` (`index.ts` ~L3117–3128). | Remove. The cursor is set on the capture layer inside the shadow root. Nothing is added to the host document except the single overlay container element. |
| F-08 | H | **Path safety**: file paths from requests (open-editor, source-update, screenshots folder) are not confined to the project. | Resolve with `fs.realpath`; require the result to be inside `projectRoot`; deny `node_modules`, `.git`, and dotfiles except the data dir; enforce a max file size for edits; reject symlink escapes. |
| F-09 | M | **Z-index collisions**: arbitrary values (999990–999999) are covered by host modals using huge z-indexes. | Use the Popover API top layer where supported (see P2-02) with the token z-index scale as fallback. |
| F-10 | M | **Font sizes** like 9.5/10.5/11.5/12.5px cause blurry text. No tabular numbers on counters. | Integer-only type scale (§7.10). `font-variant-numeric: tabular-nums` on all numeric readouts (token counts, line numbers, coordinates, badges). |
| F-11 | M | **Contrast failures** (e.g. light-mode muted text ≈ 2.5:1). | Use the token set in §7.10 and verify with an automated contrast check in tests. |
| F-12 | L | **Accent drifts between themes** (sky blue vs indigo). | Single blue-family accent (D-10). |
| F-13 | M | **No consistent focus ring**; some elements use `outline: none`. | Standard `:focus-visible` ring token on every interactive element. |
| F-14 | M | **Focus not trapped** in the sidebar; Tab leaks into the host page. | Focus management (P2-09). |
| F-15 | M | **Perf**: stacked `backdrop-filter: blur(28px) saturate(190%)` panels plus continuous `requestAnimationFrame` cause jank on integrated GPUs. | Limit blur to dock and popover, reduce radius (≤12px), drop `saturate`, coalesce pointer work into one rAF, no rAF loop when idle. |
| F-16 | M | **Typing detection**: global keydown handler's `isTyping` check ignores shadow DOM focus. | `const a = shadow.activeElement || document.activeElement` and include `isContentEditable` + `role=textbox`. Use `event.composedPath()[0]`. |
| F-17 | L | **Duplicate actions** (Copy/Send/IDE) across chip, inspector bar, pin bar. | D-08. |
| F-18 | M | **Monolithic 7.3k-line template literal**: no type checking, no tests, no npm deps. | Extract to a compiled package (P2-01). |
| F-19 | L | **MCP config snippet for Cursor** points at `path/to/packages/mcp/dist/index.js`. | All client snippets use the published command (`npx -y <mcp-package>`), generated from `BRAND`. |
| F-20 | H | **No delivery feedback / single task slot / no lifecycle** (see Phase 1). | Bridge v2. |

---

## 6. Phase plan

Task IDs: `P<phase>-<nn>`. Each task lists acceptance criteria (AC).

---

### Phase 0: Safety net and critical fixes

Goal: make the current version safe and testable before changing anything big.

**P0-01 Test harness.** Set up Vitest for `core`, an integration test setup for the bridge (spin up on a random port), and Playwright pointed at `demo/` for overlay smoke tests. CI-runnable with one command (`pnpm test` or `npm test`).
- AC: `npm test` runs all three and passes on a clean checkout.

**P0-02 Baseline e2e smoke test (before any refactor).** Playwright: open demo → enable inspect → hover/select a component → click Send to Agent → assert the bridge received a task → assert the pin stack opens.
- AC: test passes against the current code. This is the regression net for P2-01.

**P0-03 Fix F-01** (command injection) with a unit test using hostile paths (`"; touch /tmp/x; "`, backticks, `$(...)`, newlines).
**P0-04 Fix F-02 minimal** (strict Origin + Host parsing, bind `127.0.0.1`) now; the full token model lands in P1.
**P0-05 Fix F-08** (path confinement) with tests for `../`, absolute paths outside the root, symlink escape.
**P0-06 Fix F-03** (`$n` replacement) with tests: `$1`, `$&`, `$$`, `$'`, multi-line, not-found, ambiguous.
**P0-07 Fix F-04** (multi-line imports) with fixtures.
**P0-08 Fix F-05** (pin stack send) with an e2e test.

AC for the phase: all P0 tests pass; manual check that the original features still work; `SECURITY.md` drafted with the localhost threat model (what the bridge can do, why the token exists).

---

### Phase 1: Bridge v2 (delivery that is reliable and honest)

Goal: tasks have IDs and status, the browser knows whether an agent saw them, and the bridge is authenticated.

**P1-01 Session file + token (§7.1).** On start, generate a 32-byte random token and choose a port (default 9850; if taken, pick a free port). Write `.agent-hover/session.json` (§7.3) with file mode `0600`; delete it on shutdown. Inject `{ port, token }` into the overlay at build/serve time. Ensure the data dir's `session.json` is in `.gitignore` (init does this; the bridge also warns if it is not ignored).
- AC: two projects running concurrently get different ports and never cross-talk.

**P1-02 Auth middleware.** Every route except `GET /api/health` requires `Authorization: Bearer <token>` (or `X-AH-Token`). WebSocket upgrade requires the token (query param `?token=` or subprotocol). Enforce Origin allowlist and Host check (§7.1). JSON body limit 1 MB; screenshot endpoints 10 MB.
- AC: tests prove a request with a wrong/missing token, a wrong Origin, or a spoofed Host (`attacker-localhost.com`, DNS-rebinding style) is rejected with 401/403 and never touches disk or state.

**P1-03 Task store (§7.2, §7.4).** In-memory map + persistence to `.agent-hover/tasks.json` (cap 200 recent tasks, atomic write: write temp file then rename). State machine per §7.4. TTL expiry (default 30 min, configurable). `supersedesKey` dedupe. Cancel endpoint.
- AC: unit tests cover every legal and illegal transition; restart of the dev server preserves queued tasks; sending the same `supersedesKey` replaces the queued predecessor (status `superseded`).

**P1-04 Endpoints (§7.2) + legacy shims.** Implement the new endpoints; keep `/api/agent/send` and `/api/agent/latest` as deprecated aliases (§4.3). Add WebSocket events (§7.5) while still emitting `agent-task-dispatched`.
- AC: old overlay build (from before this phase) still works against the new bridge in a compatibility test.

**P1-05 MCP tools (§7.6).** Add `list_agent_tasks`, `claim_agent_task`, `complete_agent_task`, `get_component_source`. Rewrite `get_latest_agent_task` on top of the queue. MCP server discovers the bridge via the session file (§7.3). Registers presence with a heartbeat.
- AC: with a fake MCP client in a test, the full lifecycle works: list → claim → complete, and the overlay-side status updates arrive over the WebSocket.

**P1-06 Presence (§7.7).** Bridge tracks connected agents (name from the MCP `initialize` clientInfo), expires them after 25 s without a heartbeat, broadcasts `presence.updated`.

**P1-07 Structured payload (§7.2).** Overlay sends structured JSON; bridge stores it; `GET /api/agent/tasks/:id?format=compact|standard|deep` renders the prompt using the core formatters. Keep `payload.prompt` as the legacy pre-rendered fallback.

**P1-08 Overlay: send flow and honest feedback.** Implement the button/toast state mapping in §7.9. Apply the clipboard rule D-06. Add a setting `copyOnSend`.
- AC: e2e covers: bridge down → "Copied to clipboard"; bridge up/no agent → queued + clipboard; bridge up/agent present → no clipboard write; status progresses visibly through delivered → working → done when the fake MCP client acts.

**P1-09 Docs:** `docs/bridge-api.md` (endpoints, auth, state machine, WS events). Update the README architecture diagram.

---

### Phase 2: Overlay: extraction, design system, UX

Goal: move to a maintainable, tested overlay, then make it feel like a precision tool (Linear/Raycast/Vercel level).

**P2-01 Extract the overlay (D-09, F-18). Mechanical, no behavior change.**
Create `packages/overlay` (TypeScript, bundled with Vite/Rollup to a single IIFE string asset). Migrate in slices, running the P0-02 smoke test after each slice: (1) CSS → `styles/` files, (2) pure helpers (selectors, formatting, geometry), (3) fiber inspection, (4) state store, (5) UI modules (dock, inspector, chip/HUD, sidebar, notes, screenshots, MCP modal). The vite plugin then injects the built asset instead of the template literal.
- AC: smoke test and all existing features behave identically; `index.ts` in the vite package shrinks to plugin wiring; overlay code is type-checked and has unit tests for pure helpers.
- **EXECUTION RULE**: Must be done by ONE worker sequentially. Do NOT parallelize across multiple workers to prevent merge conflicts in the 7,340-line file.

**P2-02 Isolation and mounting (F-07, F-09).**
- One host element; `attachShadow({ mode: 'open' })` (open is fine; document why).
- `:host { all: initial; display: block; }` plus the token block (§7.10).
- Use the **Popover API** (`popover="manual"` + `showPopover()`) for floating layers where supported so they render in the top layer above host modals; re-assert top-layer order when a host `<dialog>` opens (MutationObserver on `dialog[open]`). Fallback: z-index tokens.
- Nothing added to `document.head` or `<html>`.
- AC: a test page with a `<dialog>.showModal()` and a `z-index: 2147483647` element still shows the overlay on top; host CSS (`* { letter-spacing: 5px }`, `body { text-transform: uppercase }`) does not alter the overlay.

**P2-03 Capture layer (F-06).** In inspect mode only, mount a full-viewport transparent layer inside the shadow root with `cursor: crosshair`; use `document.elementsFromPoint()` (skipping the overlay itself) to find targets. Holding the passthrough modifier (default `Shift`) sets `pointer-events: none` on the layer so the host page works normally. Outside inspect mode, the overlay must not intercept any events.
- AC: with inspect off, typing in host inputs, clicking links, and modals all work; with inspect on, clicks select instead of triggering host handlers; holding the modifier restores host interaction.

**P2-04 Design tokens (§7.10).** Replace all ad-hoc colors, sizes, radii, shadows, and z-indexes with tokens. Integer-only type scale. Tabular numbers (F-10). `prefers-color-scheme` aware with manual override (existing theme toggle persists). Add `prefers-reduced-motion` handling.

**P2-05 Floating Dock (D-07).**
- Horizontal pill, **bottom-center**, 40px high, `--ah-radius-full`.
- Segments: brand mark + status dot | Inspect toggle | Pins (with animated count badge) | Settings/menu | drag handle.
- Status dot: green = bridge up and agent present; amber = bridge up, no agent; gray = bridge down. Tooltip shows details (`Bridge :<port> · <Client name>`).
- Draggable along any edge (persist position), dismissible (`Cmd/Ctrl+Shift+X` toggles visibility; also an "×" in the menu).
- Must never overlap critical host UI by default; position persists per origin.
- AC: dock status reflects presence changes within 1 s of the WebSocket event.

**P2-06 Element inspector (reticle + badge).**
- Solid 1px accent outline, four 6×6 corner L-brackets (no dotted border).
- Badge anchored top-left: `<Component /> · File.tsx:42 · 304 × 168`, tabular numbers, mono font. **Collision-aware flip**: if within 32px of the viewport top, render below/inside.
- No flicker during fast scroll or nested flex/grid: coalesce updates in a single rAF, re-measure on scroll/resize via passive listeners, and ignore sub-pixel jitter (<0.5px).
- **Hierarchy stepping:** `Alt+↑` selects the parent component, `Alt+↓` the child; breadcrumb in the badge updates. Use `event.code` (not `event.key`; macOS Option produces special characters).
- Hover lock: click locks the selection until Esc or clicking another element.

**P2-07 Selection HUD / prompt popover (replaces the floating chip).**
- `calculateOptimalPosition(targetRect, hudSize)`: prefer bottom → top → right → left; clamp to the viewport with a 12px margin; **never cover the target** (if no side fits, dock the HUD to the viewport edge nearest the target and draw a connector line).
- Contents: component identity line; **instruction input** (16px, multi-line, `Cmd/Ctrl+Enter` submits); intent chips (Phase 3); primary **Send to Agent**; secondary **Copy Context** (split button: Compact / Standard / Deep); tertiary icon buttons: Pin (`Alt+P`), Note (`Alt+N`), Screenshot, Open in IDE (`Alt+O`), close.
- Shows live status of the last task for this element (§7.9).

**P2-08 Sidebar (D-07, D-08, F-17).**
- Default width **360px**, drag-rail to resize 320–520px (double-click resets), persisted.
- Tabs (press `1`–`4` when focus is in the sidebar and not typing):
  1. **Inspect**: breadcrumb, props table with types, hooks, token meter with progress bar, source preview. *No duplicated action bar.*
  2. **Pins**: stack list with drag reorder, role per item (TARGET / REFERENCE / FROZEN), overall goal input, "Send stack to agent" and "Copy stack as task". Tasks list section at top of Pins tab.
  3. **Notes**: filter (All / Active / Resolved), click to jump to element, "Copy all notes".
  4. **Bridge & Settings**: connection health, connected agents, editor selector (Cursor, VS Code, Windsurf, WebStorm, Zed, Antigravity), MCP config snippets per client with copy, `copyOnSend`, theme, passthrough modifier, update-check banner.
- Float/dock toggle retained.

**P2-09 Keyboard, focus, accessibility (F-13, F-14, F-16).**
- Shortcut map in §7.11. Escape handler is a **stack**: close lightbox → close note popover → close HUD/clear selection → close sidebar.
- Focus trap in the sidebar and modals; return focus to the previous element on close.
- Standard `:focus-visible` ring on all interactive elements.
- ARIA: `role="toolbar"` on the dock, `role="dialog"` + labelled for popover/modals, `aria-live="polite"` region for toasts/status, `aria-pressed` on toggles, accessible names on all icon-only buttons.
- AC: an axe-core scan of the overlay (in the Playwright test) reports no serious or critical violations; all features reachable by keyboard alone.

**P2-10 Motion.** 120–200 ms, `cubic-bezier(0.16, 1, 0.3, 1)` for enter/exit and `cubic-bezier(0.2, 0, 0, 1)` for standard; spring scale on badge counts; skeleton for async loads (source preview, screenshots); disabled under `prefers-reduced-motion`. No animation on idle.

**P2-11 Performance budget.** Idle overlay: zero rAF loops, no layout thrash. Hover tracking at ≤ 1 ms per frame on the demo app. Measure with a Playwright performance trace and record numbers in the PR.

---

### Phase 3: Differentiators

**P3-01 Before/after + per-task undo (D-15; §7.12).**
Flow: Send → at claim time the bridge creates a **checkpoint**; the overlay captures a "before" crop of the element; when the task completes and HMR settles, the overlay captures "after" (re-resolving the same selector/component; if it cannot, it shows "target changed" and offers viewport capture). A compare panel (slider + side by side) offers **Keep** or **Undo**. Undo restores only files changed since the checkpoint, after a confirmation that lists the files.
- AC: e2e with a scripted fake agent that edits a demo file; Undo returns the file to its exact prior content; user edits made *during* the task are flagged in the confirmation (file listed as "also modified by you"); in a non-git folder the feature is disabled with a clear message.

**P3-02 Shared-component scope (D-14; §7.8).** Count other instances of the same component on the current page (fiber type match) and files that import it (fixed relationship resolver). Show "Used in N places on this page · M files". Show **scope toggle** (This instance / Everywhere) in the HUD whenever N > 1 (default: "this instance only"). Scope is included in the payload and rendered into the prompt as an explicit constraint. Hover the toggle to highlight all instances on the page.
- AC: prompt for "instance" scope explicitly tells the agent not to change shared behavior globally (e.g. add a prop, wrap, or override locally) and to say so if that is impossible.

**P3-03 Runtime snapshot (§7.13).** Collect route, viewport, theme, recent console errors/warnings, failed network requests (metadata only), and safely-serialized prop/hook values with redaction. Settings: `runtimeContext: 'off' | 'minimal' | 'full'` (default `minimal`).
- AC: secrets-pattern test (keys matching `/token|secret|password|auth|cookie|api[-_]?key|session/i`) is redacted; depth/size caps enforced; circular references handled; functions rendered as `[Function name]`.

**P3-04 Intent chips.** `Fix bug · Restyle · Add feature · Refactor · Explain · Add test`. The chip selects a prompt template in core (different header, constraints, and which extras are attached: Fix bug → runtime snapshot; Restyle → computed styles + design tokens detected; Explain → "do not modify files, explain only"; Add test → props/state examples). Intent is a field in the payload.

**P3-05 Task result display.** Show the agent's `summary` and `filesChanged` (from `complete_agent_task`) in the HUD/Tasks list, with "Open file in IDE" links (via the safe open-editor route).

---

### Phase 4: Setup, docs, packaging, launch readiness

**P4-01 `init` command (D-11, D-13).** `npx <pkg> init`:
1. Detect package manager and Vite config; add the plugin using a safe AST edit (e.g. `magicast`); if it cannot edit safely, print exact manual instructions.
2. Detect installed agents and offer to write MCP config: Claude Code (`.mcp.json` or `claude mcp add`), Cursor (`.cursor/mcp.json`), Windsurf, Claude Desktop (global). **Merge JSON; never overwrite** existing entries; back up the file first.
3. Offer to append the rules snippet (§7.14) to `CLAUDE.md` / `.cursorrules` / etc.
4. Add `.agent-hover/session.json`, `.agent-hover/tasks.json`, `.agent-hover/snapshots/` to `.gitignore` (keep `comments.json` trackable).
5. `--dry-run`, `--yes`, `--agent <name>` flags. Idempotent (running twice changes nothing).
- AC: tested against fixture projects (fresh Vite+React, project with an existing `.cursor/mcp.json`).

**P4-02 `doctor` command.** Checks: plugin present, dev server reachable, session file valid, token accepted, agent presence, MCP config present per client, port conflicts, git available (for undo). Prints actionable fixes.

**P4-03 README + assets.** Pitch (D-02), 20-second demo GIF (select → send → status → before/after → undo), 60-second quickstart, how it works diagram, security model, comparison-free feature list, FAQ, troubleshooting (agent doesn't pick up tasks → rules snippet, `doctor`).

**P4-04 Repo health:** `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, issue templates, Changesets for versioning.

**P4-05 Packaging.** Correct `exports`, `types`, `files`, `engines`, `peerDependencies` (vite, react as optional peers); ESM + CJS where needed; `npm pack` dry-run inspected; publish with provenance (`npm publish --provenance`) from CI. Engines: Node 20+, Node 22+, Node 24. Vite >= 5.0.0.

**P4-06 CI.** GitHub Actions: install → lint → typecheck → unit → bridge integration → Playwright e2e → build → `npm pack` check. Matrix: Node 20/22/24, ubuntu + macos.

**P4-07 Demo app.** Ensure `demo/` remains an effective functional test harness for overlay, inspector, dock, and sidebar. Remove misleading marketing claims or fictional paid tiers without breaking UI layout components.

**P4-08 Rename readiness.** Verify D-12: change `BRAND` in one place, rebuild, and confirm no leftover old strings (add a CI grep check).

---

## 7. Specifications

### 7.1 Security model
- Bridge listens on `127.0.0.1` only.
- Per-session random token (32 bytes, base64url). Required on all routes except `GET /api/health` (returns only `{ ok: true }`) and on the WebSocket upgrade.
- **Origin allowlist:** computed from the actual dev server origin(s) (Vite `server.host/port`, `resolvedUrls`) plus `http://localhost:<devPort>` and `http://127.0.0.1:<devPort>`. Compare with `new URL(origin)` (protocol + hostname + port). Requests with a missing Origin are allowed **only** with a valid token (the MCP process has no Origin).
- **Host header check:** must be `127.0.0.1:<port>` or `localhost:<port>` (anti DNS-rebinding).
- CORS: respond with the exact matching origin, never `*`. Handle preflight.
- Body size limits (1 MB JSON, 10 MB for images). Basic rate limit (e.g. 60 req/s per connection).
- Any route that touches disk or spawns a process (`source-update`, `open-editor`, screenshots, checkpoint/undo) re-validates paths (F-08) and uses no shell.
- Threat model written in `SECURITY.md`: what a local attacker/malicious web page could attempt, and what stops it.

### 7.2 Task model and endpoints
```ts
type TaskType = 'component-context' | 'dom-element' | 'pinned-stack' | 'note';
type TaskStatus =
  | 'queued' | 'delivered' | 'in_progress'
  | 'done' | 'failed' | 'cancelled' | 'expired' | 'superseded';
type Intent = 'fix' | 'restyle' | 'feature' | 'refactor' | 'explain' | 'test' | 'general';
type Scope = 'instance' | 'component' | 'unspecified';

interface AgentTask {
  id: string;                 // uuid/ulid
  type: TaskType;
  status: TaskStatus;
  createdAt: string; updatedAt: string; expiresAt: string;  // ISO
  supersedesKey?: string;     // e.g. `${type}:${file}:${component}`
  intent?: Intent;
  scope?: Scope;
  instruction?: string;       // what the user typed
  target: {
    component?: string; file?: string; lineStart?: number; lineEnd?: number;
    selector?: string; hierarchy?: string[]; instanceCount?: number;
  };
  payload: {
    props?: unknown; hooks?: unknown; styles?: unknown; notes?: string[];
    source?: string;                       // omitted unless format requires
    runtime?: RuntimeSnapshot;             // §7.13
    pins?: Array<{ component: string; file: string; role: 'TARGET'|'REFERENCE'|'FROZEN' }>;
    goal?: string;                         // pinned-stack
    screenshotId?: string;
    prompt?: string;                       // legacy pre-rendered fallback
  };
  tokenEstimate?: number;
  claimedBy?: string;                      // agent client name
  checkpointId?: string;                   // §7.12
  result?: { summary?: string; filesChanged?: string[]; error?: string };
}
```
Endpoints (all JSON, token required unless noted):
- `POST /api/agent/tasks` → `201 { task }`
- `GET /api/agent/tasks?status=queued,delivered&limit=50` → `{ tasks }`
- `GET /api/agent/tasks/:id?format=compact|standard|deep` → `{ task, prompt }` (prompt rendered by core)
- `POST /api/agent/tasks/:id/claim` body `{ client }` → task `in_progress`
- `POST /api/agent/tasks/:id/complete` body `{ status: 'done'|'failed', summary?, filesChanged?, error? }`
- `POST /api/agent/tasks/:id/cancel` (only `queued`/`delivered`)
- `POST /api/agent/presence` body `{ client, version }` (heartbeat) · `GET /api/agent/presence`
- `GET /api/health` (no token) → `{ ok: true }`
- Deprecated aliases: `POST /api/agent/send`, `GET /api/agent/latest` (§4.3)
- Existing endpoints (`/api/task`, `/api/open-editor`, `/api/source-update`, screenshots, notes) keep their paths but gain auth and path validation.

### 7.3 Session file
`.agent-hover/session.json` (mode `0600`, gitignored, removed on clean shutdown):
```json
{ "version": 1, "port": 9850, "token": "…", "pid": 12345, "projectRoot": "/abs/path", "startedAt": "ISO" }
```
MCP server resolution order: `AGENT_HOVER_SESSION` env var (explicit path) → walk up from `process.cwd()` looking for `<dataDir>/session.json` → error with a helpful message ("dev server not running"). Validate that `pid` is alive; ignore stale files.

### 7.4 State machine
```
queued ──list/get by agent──▶ delivered ──claim──▶ in_progress ──▶ done | failed
  │  ╲────────────claim──────────────────────────▲
  ├─ user cancel ─▶ cancelled        (also from delivered)
  ├─ same supersedesKey sent ─▶ superseded   (queued/delivered only)
  └─ TTL elapsed ─▶ expired          (any non-terminal state)
```
Terminal: `done, failed, cancelled, expired, superseded`. Illegal transitions return `409` with the current status. Every transition updates `updatedAt` and broadcasts `task.updated`.

### 7.5 WebSocket events
Server → client: `tasks.snapshot` (on connect), `task.created`, `task.updated`, `presence.updated`, plus legacy `agent-task-dispatched` (deprecated). Client → server: none required in v0.2 (overlay uses REST).

### 7.6 MCP tools (new and changed)
- `list_agent_tasks({ status?: TaskStatus[], limit?: number })` → tasks (summaries); marks returned `queued` tasks as `delivered`.
- `claim_agent_task({ id })` → full task + rendered prompt (`format` param: `compact|standard|deep`, default `standard`); sets `in_progress`, triggers checkpoint (§7.12).
- `complete_agent_task({ id, status?: 'done'|'failed', summary: string, filesChanged?: string[], error?: string })`.
- `get_component_source({ file, lineStart?, lineEnd? })` → source slice (path-validated).
- `get_latest_agent_task` → unchanged shape; deprecated; returns newest queued and marks delivered.
- **Tool descriptions matter**: write them so an agent knows the workflow: *"When the user says they sent a task from the browser, call `list_agent_tasks`, then `claim_agent_task`, make the change, then call `complete_agent_task` with a short summary and the files you changed."*
- On connect, the MCP process sends presence heartbeats every 10 s.

### 7.7 Presence
Bridge keeps `{ client, version, lastSeen }` per agent; an entry expires after 25 s without heartbeat. The overlay receives `presence.updated` and updates the dock dot and messages.

### 7.8 Shared-component scope
- `instanceCount` = number of mounted instances of the same component type on the current page (fiber scan).
- `importedByFiles` from the relationship resolver (post-F-04).
- Prompt wording by scope:
  - `instance`: "Change only the instance at `<selector/location>`. Do not alter behavior or styles other instances rely on. If the component must change, add an optional prop or local override and explain."
  - `component`: "This component is used in N places; changes apply to all. Check usages in <files>."
- UI: chip "Used in N places on this page"; toggle appears only when N > 1; hovering highlights all instances.

### 7.9 Overlay status mapping (Send to Agent)
| Situation | Button / toast |
|-----------|----------------|
| Bridge unreachable | "Copied to clipboard" (toast), no queue |
| Bridge up, no agent present | "Queued · no agent connected" + clipboard copy (per D-06) |
| `queued`, agent present | "Sent to {client}" |
| `delivered` | "Seen by {client}" |
| `in_progress` | "Working…" (violet pulse) |
| `done` | "Done · {n} files" (+ Compare / Undo) |
| `failed` | "Failed: {error}" (red) |
| `expired` / `cancelled` | neutral message, no alarm |
Status text is announced through the `aria-live` region.

### 7.10 Design tokens (CSS variables on the shadow root)
```css
:host {
  all: initial; display: block;
  font-family: var(--ah-font-sans);
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;

  --ah-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
  --ah-font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --ah-text-2xs: 11px; --ah-text-xs: 12px; --ah-text-sm: 13px; --ah-text-base: 14px; --ah-text-lg: 16px;
  --ah-leading-tight: 1.25; --ah-leading-normal: 1.5;

  --ah-ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ah-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ah-duration-instant: 100ms; --ah-duration-fast: 160ms; --ah-duration-normal: 220ms;

  --ah-radius-xs: 4px; --ah-radius-sm: 6px; --ah-radius-md: 10px; --ah-radius-lg: 14px; --ah-radius-full: 9999px;

  --ah-z-canvas: 2147483600; --ah-z-overlay: 2147483610; --ah-z-sidebar: 2147483620;
  --ah-z-floating: 2147483630; --ah-z-modal: 2147483640;

  /* Dark (default) */
  --ah-surface-canvas: #090a0b; --ah-surface-base: #111214; --ah-surface-elevated: #18191c;
  --ah-surface-overlay: rgba(18,20,24,0.82); --ah-surface-sunken: #0c0d0e; --ah-surface-input: #1a1c20;
  --ah-border-subtle: rgba(255,255,255,0.08); --ah-border-standard: rgba(255,255,255,0.12);
  --ah-border-emphasis: rgba(255,255,255,0.22); --ah-border-focus: #0090ff;
  --ah-text-primary: #f2f4f8; --ah-text-secondary: #9aa0a6; --ah-text-muted: #6b7280; --ah-text-on-accent: #ffffff;
  --ah-accent-primary: #0090ff; --ah-accent-hover: #0080e5;
  --ah-accent-subtle: rgba(0,144,255,0.12); --ah-accent-glow: rgba(0,144,255,0.25);
  --ah-emerald: #10b981; --ah-emerald-subtle: rgba(16,185,129,0.12);
  --ah-rose: #f43f5e;    --ah-rose-subtle: rgba(244,63,94,0.12);
  --ah-amber: #f59e0b;   --ah-amber-subtle: rgba(245,158,11,0.12);
  --ah-violet: #8b5cf6;  --ah-violet-subtle: rgba(139,92,246,0.12);
  --ah-shadow-dock: 0 16px 40px -8px rgba(0,0,0,.70), 0 4px 12px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.10);
  --ah-shadow-card: 0 20px 48px -12px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.08);
  --ah-shadow-popover: 0 12px 32px -4px rgba(0,0,0,.60), 0 0 0 1px rgba(255,255,255,.10);
}
:host(.light-mode) {
  --ah-surface-canvas: #f8f9fa; --ah-surface-base: #ffffff; --ah-surface-elevated: #f1f3f5;
  --ah-surface-overlay: rgba(255,255,255,0.88); --ah-surface-sunken: #e9ecef; --ah-surface-input: #ffffff;
  --ah-border-subtle: rgba(0,0,0,0.08); --ah-border-standard: rgba(0,0,0,0.14);
  --ah-border-emphasis: rgba(0,0,0,0.28); --ah-border-focus: #0070f3;
  --ah-text-primary: #111827; --ah-text-secondary: #4b5563; --ah-text-muted: #6b7280; --ah-text-on-accent: #ffffff;
  --ah-accent-primary: #0070f3; --ah-accent-hover: #0060df;
  --ah-accent-subtle: rgba(0,112,243,0.10); --ah-accent-glow: rgba(0,112,243,0.20);
  --ah-emerald: #059669; --ah-emerald-subtle: rgba(5,150,105,0.10);
  --ah-rose: #e11d48;    --ah-rose-subtle: rgba(225,29,72,0.10);
  --ah-amber: #d97706;   --ah-amber-subtle: rgba(217,119,6,0.10);
  --ah-violet: #7c3aed;  --ah-violet-subtle: rgba(124,58,237,0.10);
  --ah-shadow-dock: 0 16px 36px -6px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.05), inset 0 1px 0 #fff;
  --ah-shadow-card: 0 20px 40px -10px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.08);
  --ah-shadow-popover: 0 12px 28px -4px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.08);
}
```

### 7.11 Keyboard map
| Action | Shortcut |
|--------|----------|
| Toggle inspect mode | `Alt` (existing) / `Alt+C` |
| Show/hide overlay | `Cmd/Ctrl+Shift+X` |
| Submit instruction / Send | `Cmd/Ctrl+Enter` (works while typing) |
| Step to parent / child component | `Alt+↑` / `Alt+↓` |
| Pin component | `Alt+P` |
| Add note | `Alt+N` |
| Open in IDE | `Alt+O` |
| Interact with host page while inspecting | hold `Shift` (configurable) |
| Switch sidebar tab | `1`–`4` (focus in sidebar) |
| Undo last overlay edit | `Cmd/Ctrl+Z` (only when focus is inside the overlay) |
| Dismiss / back | `Esc` (stack order in P2-09) |

### 7.12 Checkpoint and undo
- Requires a git repo (D-15). Detect with `git rev-parse --is-inside-work-tree`.
- At `claim`: create checkpoint via `git stash create` commit + untracked file hashes + `HEAD`. Store under `.agent-hover/checkpoints/<id>.json`.
- At `complete`: compute `changedFiles`.
- **Undo:** show confirmation listing files; restore each changed tracked file from checkpoint commit; delete files created since checkpoint; flag files user edited during task.
- Never run destructive git commands (`reset --hard`, `clean -fd`, `checkout .`). Operate per file only. No shell.
- Clean up checkpoints older than 7 days or beyond the last 50.

### 7.13 Runtime snapshot
```ts
interface RuntimeSnapshot {
  url: string;               // path + hash only; query values redacted
  viewport: { w: number; h: number; dpr: number };
  theme?: 'light' | 'dark';
  consoleErrors?: Array<{ level: 'error'|'warn'; message: string; at: string }>;   // last 20, message ≤ 500 chars
  failedRequests?: Array<{ method: string; path: string; status: number|'network-error'; at: string }>; // last 20; no headers/bodies
  propValues?: unknown;      // safe-serialized, depth ≤ 4, total ≤ 8 KB
  hookValues?: unknown;      // same caps
}
```
Redact keys matching `/token|secret|password|auth|cookie|api[-_]?key|session/i`.

### 7.14 Agent rules snippet
```
## agent-hover tasks
When I say I sent a task from the browser (or mention agent-hover):
1. Call `list_agent_tasks` and pick the relevant queued task.
2. Call `claim_agent_task` for it and follow its instructions and scope exactly.
3. Make the change. Respect FROZEN components; do not modify them.
4. Call `complete_agent_task` with a one-paragraph summary and the files you changed.
```

### 7.15 Clipboard payloads
Formatters: `formatContextForAiPrompt`, `formatDomElementPrompt`, `formatTaskContext`, notes markdown, MCP config snippets. Keep existing sections stable.
