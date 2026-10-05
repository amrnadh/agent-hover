# Agent Hover — Feature Parity Matrix

> Master Reference: Phase 2 Addendum (Section B).  
> Tracking all existing controls, capabilities, and surfaces from the v0.1.1 baseline through the v0.2 rebuild.  
> **Rule**: No feature may be removed or silently dropped. Any change in location or behavior must be explicitly recorded and verified.

---

## 1. Primary Controls & Capabilities

| Feature / Capability | Old Location (v0.1.1) | New Location (v0.2 Plan) | Status | Notes |
|---|---|---|---|---|
| **Inspect Mode Toggle** | Dock `#cp-dock-toggle`, Shortcut `Alt` | Dock inspect toggle, HUD, Shortcut `Alt` / `Alt+C` | Verified | Toggles inspect crosshair; `Alt` key single-press tracking prevents collisions with `Alt+Arrow`. |
| **Inspect Crosshair & Reticle** | `#cp-highlight` + `#cp-label` | Capture layer + `#cp-reticle` with 6×6 corner L-brackets & top-left badge | Verified | Precision 1px outline, tabular numbers (`font-variant-numeric: tabular-nums`), collision-aware flip near top of viewport. |
| **Spacing Overlay & Distance Guides** | Inspector `#cp-toggle-spacing`, `#cp-margin-band`, `#cp-padding-band`, `#cp-axis-guides`, `#cp-distance-layer` | Inspector Tab 1 (Inspect) & Reticle options | Verified | Renders margin/padding bands and distance guides between elements in pixels. |
| **Measure Mode** | Dock `#cp-dock-measure` | Dock toolbar / Inspector tool | Verified | Computes edge-to-edge pixel distances to adjacent elements. |
| **In-Browser Text / Source Editing** | `#cp-text-editor`, `#cp-text-apply`, `#cp-text-revert`, rich-text toolbar (`Cmd+B`, `Cmd+I`, `Cmd+U`) | Inspector / Text Edit modal with diff & 1-step undo | Verified | Edits inline text, sends replacement to `/api/source-update` with `$n` fix (F-03), offers 1-step revert. |
| **Screenshot Modes (Component / Viewport / Full Page)** | `#cp-flyout-snap-btn`, `#cp-dock-snap`, `#cp-snap-dropdown` (`data-mode="component|viewport|fullpage"`) | Selection HUD camera icon & Dock snap menu | Verified | Captures target via modern-screenshot (or dom-to-image fallback), handles full-page scroll assembly. |
| **Screenshot Toast Actions** | Toast `#cp-snap-preview` with `#cp-snap-copy` (PNG), `#cp-snap-download`, `#cp-snap-thumb-btn` | Floating toast with auto-dismiss progress bar | Verified | Copies binary PNG to system clipboard, downloads file to disk, or opens full-resolution lightbox. |
| **Screenshot Lightbox** | `#cp-snap-lightbox` (`#cp-lightbox-img`, `#cp-lightbox-copy`, `#cp-lightbox-download`, `#cp-lightbox-close`) | Modal `#cp-snap-lightbox` | Verified | Full-resolution modal viewer with ESC dismissal and download/copy actions. |
| **Inline Note Popover** | `#cp-note-popover` (`#cp-note-input`, `#cp-note-save`, `#cp-note-resolve`, `#cp-note-delete`, target capsule) | Popover attached to selected element / Notes Tab | Verified | Attach sticky notes to specific component files/lines, mark active or resolved, persisted in `comments.json`. |
| **Copy All Notes** | Inspector notes section `#cp-notes-copy-all` | Sidebar Tab 3 (Notes) `#cp-notes-copy-all` | Verified | Formats all active and resolved notes into structured AI prompt string. |
| **Context Level Selector** | Inspector `#cp-context-level` (Compact / Standard / Deep) | Selection HUD split copy button & Sidebar Tab 1 | Verified | Controls level of detail (props, hooks, parent tree, styles) included in clipboard and task payload. |
| **Preferred IDE Selector** | Settings `#cp-pref-editor-cursor`, `#cp-pref-editor-vscode`, `#cp-pref-editor-windsurf` | Sidebar Tab 4 (Bridge & Settings) | Verified | Launches files at line/column in Cursor, VS Code, Windsurf, WebStorm, Zed, or Antigravity without shell injection. |
| **Open in IDE Action** | Inspector `#cp-editor-btn`, Selection Chip `#cp-sel-ide-btn`, Shortcut `Alt+O` | Selection HUD `#cp-hud-ide`, Shortcut `Alt+O` | Verified | Deep-links currently selected component to configured editor. |
| **MCP Configuration Modal & Snippets** | Settings `#cp-mcp-setup-btn`, modal `#cp-mcp-modal` with tabs for Claude, Cursor, Windsurf, Codex, Antigravity | Sidebar Tab 4 (Bridge & Settings) dedicated MCP section | Verified | Generates copyable client configuration snippets derived centrally from `BRAND`. |
| **Pin Component** | Inspector `#cp-pin-btn`, Selection Chip `#cp-sel-pin-btn`, Shortcut `Alt+P` | Selection HUD pin icon, Shortcut `Alt+P` | Verified | Adds component to pinned stack with role, file path, line number, and custom task description. |
| **Pin Roles (TARGET / REFERENCE / FROZEN)** | Pin stack `#cp-pin-list` | Sidebar Tab 2 (Pins) stack items | Verified | Explicit role tags per pin: TARGET (modify), REFERENCE (read context), FROZEN (do not alter). |
| **Pinned Task Goal Input & Brief Generation** | `#cp-task-input`, `#cp-gen-task` ("Copy All Tasks in Order") | Sidebar Tab 2 (Pins) goal input and brief button | Verified | Aggregates all pinned items and overall goal into an ordered implementation prompt. |
| **Send Pinned Tasks to Agent** | `#cp-pin-send-agent` | Sidebar Tab 2 (Pins) primary send button | Verified | Dispatches `pinned-stack` structured task to bridge task queue (`/api/tasks`). |
| **Send Single Component to Agent** | Inspector `#cp-send-agent-btn`, Selection Chip `#cp-sel-send-btn` | Selection HUD primary "Send to Agent" button | Verified | Dispatches `component-prompt` task with structured payload, live status indicator, and D-06 clipboard fallback. |
| **Copy AI Context (Single Component)** | Inspector `#cp-copy-ai`, Selection Chip `#cp-sel-copy-btn` | Selection HUD split Copy Context button | Verified | Formats and copies component context immediately to system clipboard. |
| **Selection Frame / Chip** | `#cp-selection-frame`, `#cp-selection-chip` | Precision Selection HUD (P2-07) | Verified | Replaced with non-overlapping HUD with 16px prompt input, status badge, and tertiary icons. |
| **Update-Check Banner** | Settings `#cp-update-banner` + `#cp-settings-update-dot` | Sidebar Tab 4 & Dock status | Verified | Displays banner with latest npm version and update command when update is available. |
| **Sidebar Float / Dock Mode Toggle** | `#cp-flyout-mode-toggle` | Sidebar Tab header float/dock toggle | Verified | Toggles sidebar between docked drawer and draggable floating window. |
| **Theme Toggle** | `#cp-flyout-theme`, Settings `#cp-theme-set-dark`, `#cp-theme-set-light` | Dock menu & Sidebar Tab 4 theme selector | Verified | Supports Dark, Light, and System (auto-matches `prefers-color-scheme`). |
| **Token Meter & Savings Counter** | Inspector `#cp-token-meter`, `#cp-token-count`, `#cp-token-savings` | Sidebar Tab 1 (Inspect) token progress bar | Verified | Shows context size in tokens and estimated token savings compared to full codebase indexing. |
| **Component Breadcrumb & Hierarchy** | Inspector `#cp-flyout-breadcrumb`, parent comp card | Sidebar Tab 1 (Inspect) & Inspector reticle badge | Verified | Full React component hierarchy tree; keyboard navigation via `Alt+↑` / `Alt+↓`. |
| **Props & Hooks Inspection** | Inspector props table and hooks accordion | Sidebar Tab 1 (Inspect) | Verified | Shows formatted prop types/values (depth <= 4) and React hook states with secret redaction. |
| **Dock Status & Agent Presence** | `#cp-mcp-dot` | Dock presence dot (green/amber/gray) | Verified | Real-time presence reporting for connected MCP clients (Cursor, Claude Code, etc.). |
| **Dock Dragging & Dismissal** | `#cp-dock-handle`, shortcut `Cmd+Shift+X` | Dock drag grip, shortcut `Cmd/Ctrl+Shift+X` | Verified | Draggable along viewport edges; persists position per origin in `localStorage`. |

---

## 2. Verification Checklist for P2-01 Extraction

- [x] All 29 capabilities and controls listed above are present in the extracted `@agent-hover/overlay` package.
- [x] Zero controls were removed or omitted during extraction.
- [x] All existing element IDs referenced by tests (`#agent-hover-root`, `#cp-dock-toggle`, `#cp-flyout`, `#cp-send-agent-btn`, `#cp-dock-pins`, `#cp-pin-bar`, `#cp-task-input`, `#cp-pin-send-agent`) are maintained.
- [x] Baseline e2e smoke tests (`e2e/overlay-smoke.spec.ts`) pass without modification.
