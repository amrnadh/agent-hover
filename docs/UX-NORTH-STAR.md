# Agent Hover — UX North Star

> The yardstick for every UI change from Stage 1 on. If a change does not make a step of the golden path better, it waits.
> Companion to [MASTER-BUILD-SPEC.md](MASTER-BUILD-SPEC.md) (what to build) and [feature-parity.md](feature-parity.md) (what must not be lost).

---

## 1. Principles

1. **Never cover what you point at.** Popovers, badges, and toasts position around the target, never over it.
2. **One primary action per surface.** The popover has one filled button (Send). Everything else is secondary or an icon.
3. **Status is always honest.** Never say "Sent" unless the bridge has the task. Never say "Done" unless the agent called `complete_agent_task`.
4. **Quiet when idle.** No animation, polling indicators, or color when nothing is happening. The dock is the only thing always on screen.
5. **Keyboard first, mouse friendly.** Every golden-path step works without the mouse (`Alt` → arrows → `Enter` → type → `⌘↵`).
6. **Zero interference with the host app.** Outside inspect mode the overlay intercepts nothing. Host CSS never leaks in.
7. **The agent does the work.** We provide context, delivery, and verification. We do not become an editor.
8. **Precision over decoration.** Tabular numbers, 1px lines, mono for code facts. No glow or gradient for its own sake.

## 2. The golden path

Target: **first successful task in under 2 minutes from `npm install`**, measured with real users.

| # | Step | The user should feel | Surface | Acceptance |
|---|------|----------------------|---------|------------|
| 1 | `npx agent-hover init` | "That was it?" | CLI | Under 30 s; Vite config, MCP config, and rules snippet written; idempotent |
| 2 | Open the app; the dock appears with a one-time hint | Calm, not intrusive | Dock | Dock visible within 1 s; hint dismisses itself; status dot is correct |
| 3 | Hold `Alt` and hover | Precise | Reticle + badge | No flicker on fast moves; badge never off-screen; ≤ 1 ms per frame |
| 4 | Click, type the instruction, `⌘↵` | Fast | Selection popover | Input auto-focused; popover never covers the target; Esc closes |
| 5 | Sent → Seen by {agent} → Working | Trust | Popover status + dock dot | Each transition visible within 1 s of the bridge event |
| 6 | Done · 3 files, with summary | Clarity | Popover + Tasks list | Summary and file links shown; files open in the IDE |
| 7 | Compare before/after → Keep or Undo | Safety | Compare panel | Undo restores exact prior content; confirmation lists files |

Side paths, polished after the golden path: multi-pin stack, notes, screenshots, measure.

## 3. Surface responsibilities (approved 0.2 design)

The clickable prototype at [design/prototype.html](design/prototype.html) is the visual and behavioural source of truth. Approved by the owner on 2026-10-11.

| Surface | Job | Must not |
|---------|-----|----------|
| **Dock** | Presence (status mark), Inspect, Comment, Tasks, Batch, ⋯ menu | Hold forms or long text |
| **Selector** | Show exactly what will be selected: blue outline, `<Name />` or `tag.class`, size | Animate on idle; cover the element |
| **Action pill** | Actions for the selection: Ask, Comment, + Batch, Copy, ⋯ | Grow into a card |
| **Composer** | Write the instruction and pick the destination | Stay open after sending |
| **Task marker + card** | Live status of a sent task, summary, files, (later) compare and undo | Carry unrelated actions |
| **Sidebar** | Deep context (Inspect), Tasks, Comments, Batch, Settings | Duplicate pill actions |
| **Comments** | Notes pinned where you clicked; can be sent as a task | Become a second task system |
| **Toasts** | Short confirmations with an optional View | Carry long-lived status |

## 4. The agent loop (the biggest flow gap)

Delivery is pull-based: the agent only sees a task when it calls an MCP tool. Closing that gap matters more than any visual detail.

- **Listen mode (planned):** a blocking MCP tool `wait_for_agent_task` that returns when a task is queued. The user says "listen for agent-hover tasks" once; the agent loops wait → claim → work → complete.
- **Claude Code plugin (planned):** MCP server + `UserPromptSubmit` hook that injects pending tasks + a `/hover` command.
- **Rules snippet (spec §7.14):** written by `init` for Cursor, Windsurf, Codex.
- **Real-agent checklist:** the golden path is verified by hand in Claude Code, Cursor, and Codex before each release.

## 5. Visual direction

- **Accent:** none. Blue (#0D99FF) is reserved for the on-page selector; the rest of the UI is neutral graphite (dark) and white (light) with ink buttons. Decided 2026-10-11.
- **Status colors:** green (done/connected), amber (working/no agent), red (failed/locked), tuned per theme in `styles/ui.css`.
- **Type:** system sans for UI, mono for code facts (file paths, sizes, token counts). No web fonts in the free version (spec §0.9).
- **Shape:** squircle radii (`--ah-radius-*`), 1px hairlines, restrained glass on the dock only.
- [BRAND.md](../BRAND.md) predates this document. Where they conflict (neon cyan accent, heavy glassmorphism everywhere), this document wins.

## 6. How UI work is reviewed

- Every UI task ships with dark and light screenshots in `docs/screenshots/<task>/` (existing gate process).
- Each golden-path step gets an e2e test that asserts the acceptance column above.
- Before release: 3–5 real users run the golden path cold. Time to first successful task is recorded.
