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

## 3. Surface responsibilities

| Surface | Job | Must not |
|---------|-----|----------|
| **Dock** | Presence (status dot), inspect toggle, pins count, entry to the sidebar | Hold forms or long text |
| **Reticle + badge** | Show exactly what will be selected: component, file:line, size | Animate on idle; cover the element |
| **Selection popover** | The one place to instruct and send for a selected element; shows that element's task status | Duplicate sidebar content |
| **Sidebar** | Deep context (props, hooks, source), Tasks, Pins stack, Notes, Settings | Duplicate the popover's Send/Copy (except the Pins stack send) |
| **Notes** | Leave a comment on an element for later or for the agent | Become a second task system; a note can be *sent* as a task |
| **Toasts** | Short confirmations ("Copied") and connection changes | Carry task status (that lives in the popover and Tasks list) |

## 4. The agent loop (the biggest flow gap)

Delivery is pull-based: the agent only sees a task when it calls an MCP tool. Closing that gap matters more than any visual detail.

- **Listen mode (planned):** a blocking MCP tool `wait_for_agent_task` that returns when a task is queued. The user says "listen for agent-hover tasks" once; the agent loops wait → claim → work → complete.
- **Claude Code plugin (planned):** MCP server + `UserPromptSubmit` hook that injects pending tasks + a `/hover` command.
- **Rules snippet (spec §7.14):** written by `init` for Cursor, Windsurf, Codex.
- **Real-agent checklist:** the golden path is verified by hand in Claude Code, Cursor, and Codex before each release.

## 5. Visual direction

- **Accent:** one accent across themes. *Decision pending:* the current blue (`#0090ff`) blends into most host apps, which are usually blue too, so the reticle loses contrast exactly where it matters. Candidates under review: laser lime, signal orange, ultra magenta, ion teal.
- **Status colors:** move off default Tailwind values (emerald/rose/amber/violet) to a tuned set derived from the accent, so the UI does not look stock.
- **Type:** system sans for UI, mono for code facts (file paths, sizes, token counts). No web fonts in the free version (spec §0.9).
- **Shape:** squircle radii (`--ah-radius-*`), 1px hairlines, restrained glass on the dock only.
- [BRAND.md](../BRAND.md) predates this document. Where they conflict (neon cyan accent, heavy glassmorphism everywhere), this document wins.

## 6. How UI work is reviewed

- Every UI task ships with dark and light screenshots in `docs/screenshots/<task>/` (existing gate process).
- Each golden-path step gets an e2e test that asserts the acceptance column above.
- Before release: 3–5 real users run the golden path cold. Time to first successful task is recorded.
