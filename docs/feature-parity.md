# Agent Hover — Feature Parity Matrix

> Master Reference: Master Build Spec v0.2 (§5, §7.9, §7.10) & Phase 2 Addendum.  
> Tracking all existing controls, capabilities, and surfaces from the v0.1.1 baseline through the v0.2 rebuild.  
> **Rule**: No feature may be removed or silently dropped without explicit approval and documentation.

---

## 1. Primary Controls & Capabilities

| Feature / Capability | Old Location (v0.1.1) | Route / Type in Code | Status | How Exercised / Verified | Planned (P2-0x) | Notes |
|---|---|---|---|---|---|---|
| **Inspect Mode Toggle** | Dock `#cp-dock-toggle`, Shortcut `Alt` | Client-side DOM toggle | **Verified (Gate 2.5)** | Exercised in `e2e/overlay-smoke.spec.ts` & `e2e/gate-2-5.spec.ts` (clicks `#cp-dock-toggle`, verifies crosshair and soft accent tint) | `P2-05`, `P2-06`, `P2-09` | Toggles inspect crosshair; `Alt` key single-press tracking prevents collisions with `Alt+Arrow`. Active state uses soft accent tint. |
| **Inspect Crosshair & Reticle** | `#cp-highlight` + `#cp-label` | Client-side DOM | **Verified (Gate 2.5)** | Exercised in `e2e/gate-2-5.spec.ts` (hovers elements, verifies active highlight bounds) | `P2-06` | Precision 1px outline, tabular numbers (`font-variant-numeric: tabular-nums`), collision-aware flip near top of viewport. |
| **Spacing Overlay & Distance Guides** | Inspector `#cp-toggle-spacing`, `#cp-margin-band`, `#cp-padding-band`, `#cp-axis-guides`, `#cp-distance-layer` | Client-side DOM | **Verified (Gate 2.5)** | Exercised in `e2e/gate-2-5.spec.ts` test #3 (verifies margin band 24px, padding band 16px, axis projection lines >= 4, distance lines/pills) | `P2-06` | Renders margin/padding bands and distance guides between elements in pixels with host-offset compensation for reparented dialogs. |
| **Measure Mode** | Dock `#cp-dock-measure` | Client-side DOM | **Verified (Gate 2.5)** | Exercised in `e2e/gate-2-5.spec.ts` test #3 (renders `.cp-dist-line` and `.cp-dist-pill` with `\d+px` between selected badge and hovered headline) | `P2-05`, `P2-06` | Computes edge-to-edge pixel distances to adjacent elements; tabular numbers for pill text. |
| **In-Browser Text / Source Editing** | `#cp-text-editor`, `#cp-text-apply`, `#cp-text-revert`, rich-text toolbar (`Cmd+B`, `Cmd+I`, `Cmd+U`) | `POST /api/source-update` | **Preserved, not verified** (UI) | Core logic tested via `packages/core/src/__tests__/source-editor.test.ts` (10 tests pass with F-03 `$n` fix); browser text-editor UI pending P2-08 | `P2-08` | Edits inline text, sends replacement to `/api/source-update` with `$n` fix, offers 1-step revert. |
| **Screenshot Modes (Component / Viewport / Full Page)** | `#cp-flyout-snap-btn`, `#cp-dock-snap`, `#cp-snap-dropdown` (`data-mode="component\|viewport\|fullpage"`) | `POST /api/screenshot/save` | **Preserved, not verified** (UI) | Bridge endpoint tested in `packages/vite/src/__tests__/bridge-server.test.ts` (saves screenshot to disk); UI dropdown mode switching pending P2-07 | `P2-07` | Captures target via modern-screenshot (or dom-to-image fallback), handles full-page scroll assembly. |
| **Screenshot Toast Actions (Copy, Download, Lightbox)** | Toast `#cp-snap-preview` with `#cp-snap-copy` (PNG), `#cp-snap-download`, `#cp-snap-thumb-btn` | `GET /api/screenshot/download/:filename` | **Preserved, not verified** (UI) | Tested via unit tests in `bridge-server.test.ts` & `dom.test.ts` (`dataUrlToBlob`); UI toast actions pending P2-07 | `P2-07` | Copies binary PNG to system clipboard, downloads file to disk, or opens full-resolution lightbox. |
| **Open Screenshots Folder** | Toast `#cp-snap-open-folder` | `POST /api/screenshot/open-folder` | **Verified (Unit)** | Exercised in `packages/vite/src/__tests__/editor-launcher.test.ts` (`buildFolderLaunchPlan` with no shell argument array) | `P2-07` | Opens local `.agent-hover/screenshots` using `execFileAsync` (`open` / `xdg-open` / `explorer.exe`) with path strictly confined to project root. |
| **Screenshot Lightbox** | `#cp-snap-lightbox` (`#cp-lightbox-img`, `#cp-lightbox-copy`, `#cp-lightbox-download`, `#cp-lightbox-close`) | Client-side modal | **Preserved, not verified** | Code-level parity preserved in `client.ts` (`openLightbox`, `closeLightbox`); UI lightbox interaction pending P2-09 | `P2-09` | Full-resolution modal viewer with ESC dismissal and download/copy actions. |
| **Inline Note Popover** | `#cp-note-popover` (`#cp-note-input`, `#cp-note-save`, `#cp-note-resolve`, `#cp-note-delete`, target capsule) | `POST /api/comments`, `GET /api/comments` | **Preserved, not verified** (UI) | Bridge tested in `bridge-server.test.ts` (`manages comments via POST and GET /api/comments`); UI popover interaction pending P2-07/P2-08 | `P2-07`, `P2-08` | Attach sticky notes to specific component files/lines, mark active or resolved, persisted in `comments.json`. |
| **Copy All Notes** | Inspector notes section `#cp-notes-copy-all` | Client-side prompt builder | **Preserved, not verified** | Code-level parity preserved in `client.ts` (copies formatted notes markdown to clipboard) | `P2-08` | Formats all active and resolved notes into structured AI prompt string. |
| **Context Level Selector** | Inspector `#cp-context-level` (Compact / Standard / Deep) | Client-side context level | **Preserved, not verified** | Code-level parity preserved in `client.ts` (drives detail level in `formatContextForAiPrompt`) | `P2-07`, `P2-08` | Controls level of detail (props, hooks, parent tree, styles) included in clipboard and task payload. |
| **Preferred IDE Selector** | Settings `#cp-pref-editor-cursor`, `#cp-pref-editor-vscode`, `#cp-pref-editor-windsurf` | `localStorage` preference | **Preserved, not verified** (UI) | Unit tested in `editor-launcher.test.ts`; Settings tab UI selector pending P2-08 | `P2-08` | Launches files at line/column in Cursor, VS Code, Windsurf, WebStorm, Zed, or Antigravity without shell injection. |
| **Open in IDE Action** | Inspector `#cp-editor-btn`, Selection Chip `#cp-sel-ide-btn`, Shortcut `Alt+O` | `POST /api/open-editor` | **Verified (Unit)** | Tested in `packages/vite/src/__tests__/editor-launcher.test.ts` (4 unit tests pass for hostile injection defense) | `P2-07`, `P2-09` | Deep-links currently selected component to configured editor using `execFile` argument array. |
| **MCP Configuration Modal & Snippets** | Settings `#cp-mcp-setup-btn`, modal `#cp-mcp-modal` with tabs for Claude, Cursor, Windsurf, Codex, Antigravity | Client-side modal / `BRAND` | **Preserved, not verified** | Code-level parity preserved in `client.ts`; UI modal pending P2-08 | `P2-08` | Generates copyable client configuration snippets derived centrally from `BRAND`. |
| **Pin Component** | Inspector `#cp-pin-btn`, Selection Chip `#cp-sel-pin-btn`, Shortcut `Alt+P` | `POST /api/pins` | **Verified (E2E)** | Tested in `packages/vite/src/__tests__/bridge-server.test.ts` & `e2e/overlay-smoke.spec.ts` | `P2-07`, `P2-08` | Adds component to pinned stack with role, file path, line number, and custom task description. |
| **Pin Roles (TARGET / REFERENCE / FROZEN)** | Pin stack `#cp-pin-list` | `FreezeEntry`, `AgentTaskPayload.pins` | **Verified (Unit)** | Tested in `bridge-server.test.ts` (`manages freeze entries via POST, GET, DELETE /api/freeze`) | `P2-08` | Explicit role tags per pin: TARGET (modify), REFERENCE (read context), FROZEN (do not alter). |
| **Pinned Task Goal Input & Brief Generation** | `#cp-task-input`, `#cp-gen-task` ("Copy All Tasks in Order") | `POST /api/tasks` (type: `'pinned-stack'`) | **Verified (E2E)** | Exercised in `e2e/overlay-smoke.spec.ts` (fills `#cp-task-input`, dispatches to bridge) | `P2-08` | Aggregates all pinned items and overall goal into an ordered implementation prompt. |
| **Send Pinned Tasks to Agent** | `#cp-pin-send-agent` | `POST /api/tasks` (type: `'pinned-stack'`) | **Verified (E2E)** | Exercised in `e2e/overlay-smoke.spec.ts` test #2 (verifies bridge receives task of type `'pinned-stack'`) | `P2-08` | Dispatches `pinned-stack` structured task to bridge task queue (`/api/tasks`). |
| **Send Single Component to Agent** | Inspector `#cp-send-agent-btn`, Selection Chip `#cp-sel-send-btn` | `POST /api/tasks` (type: `'component-context'`) | **Verified (E2E)** | Exercised in `e2e/overlay-smoke.spec.ts` test #1 (clicks `#cp-send-agent-btn`, asserts bridge task) | `P2-07` | Dispatches `component-context` task with structured payload, live status indicator, and D-06 clipboard fallback. |
| **Copy AI Context (Single Component)** | Inspector `#cp-copy-ai`, Selection Chip `#cp-sel-copy-btn` | Client-side clipboard writer | **Preserved, not verified** | Code-level parity preserved in `client.ts` (`formatContextForAiPrompt`) | `P2-07` | Formats and copies component context immediately to system clipboard. |
| **Selection Frame / Chip** | `#cp-selection-frame`, `#cp-selection-chip` | Client-side DOM | **Preserved, not verified** | Code-level parity preserved in `client.ts` (`updateSelectionFrame`) | `P2-07` | Replaced in P2-07 with non-overlapping Selection HUD with 16px prompt input, status badge, and tertiary icons. |
| **Update-Check Banner** | Settings `#cp-update-banner` + `#cp-settings-update-dot` | WS event `agent-hover:update-available` | **Preserved, not verified** | Code-level parity preserved in `client.ts` (`handleUpdateAvailable`) | `P2-08` | Displays banner with latest npm version and update command when update is available. |
| **Sidebar Float / Dock Mode Toggle** | `#cp-flyout-mode-toggle` | Client-side layout state | **Preserved, not verified** | Code-level parity preserved in `client.ts` (`applyFlyoutMode`) | `P2-08` | Toggles sidebar between docked drawer and draggable floating window. |
| **Theme Toggle** | Settings `#cp-theme-set-dark`, `#cp-theme-set-light`, `#cp-theme-set-system` | Client-side theme class | **Verified (Gate 2.5)** | Exercised in `e2e/gate-2-5.spec.ts` and `e2e/p2-04-tokens.spec.ts` (tests dark, light, and system modes) | `P2-04`, `P2-08` | Supports Dark, Light, and System (auto-matches `prefers-color-scheme`). Default is System. |
| **Token Meter & Savings Counter** | Inspector `#cp-token-meter`, `#cp-token-count`, `#cp-token-savings` | `@agent-hover/core` token estimator | **Verified (Unit)** | Tested via `packages/core/src/__tests__/token-estimator.test.ts` (2 tests pass) | `P2-08` | Shows context size in tokens and estimated token savings compared to full codebase indexing. |
| **Component Breadcrumb & Hierarchy** | Inspector `#cp-flyout-breadcrumb`, parent comp card | Client-side React Fiber walk | **Verified (E2E)** | Exercised in `e2e/overlay-smoke.spec.ts` (clicks parent comp card `#cp-parent-comp-card`) | `P2-06`, `P2-08` | Full React component hierarchy tree; keyboard navigation via `Alt+↑` / `Alt+↓`. |
| **Props & Hooks Inspection** | Inspector props table and hooks accordion | Client-side Fiber inspection | **Preserved, not verified** | Code-level parity preserved in `client.ts` (renders props table and hooks list) | `P2-08` | Shows formatted prop types/values (depth <= 4) and React hook states with secret redaction. |
| **Dock Status & Agent Presence** | `#cp-mcp-dot` | WS events `agent-presence-updated`, `agent-registered` | **Verified (E2E & Unit)** | Tested in `bridge-server.test.ts` & `e2e/p2-05-dock.spec.ts` (status dot reflects bridge/agent status) | `P2-05` | Informational only, `cursor: default`, no click handler, tooltip shows status. |
| **Dock Dragging & Positioning** | `#cp-dock-handle`, padding drag, shortcut `Cmd+Shift+X` | Client-side drag & shortcut handler | **Verified (Gate 2.5)** | Exercised in `e2e/gate-2-5.spec.ts` (4px threshold, edge clamping, position persistence, reset position button) | `P2-05`, `P2-09` | Right grip handle (`#cp-dock-handle`) + empty padding dragging with 4px threshold (< 4px = click, >= 4px = drag). Legacy centered drag pill removed per owner feedback A.7. |
| **Dock Minimization** | Settings "Minimize Dock", `#ah-dock-minimized`, shortcut `Cmd+Shift+X` | Client-side minimization controller | **Verified (Gate 2.5)** | Exercised in `e2e/gate-2-5.spec.ts` (minimizes dock to small round brand button at same position; click restores dock) | `P2-05` | Dock dismiss 'x' button removed per owner feedback A.6. Dock minimizes to round button with status dot; never becomes invisible without a click target. |

---

## 2. Deprecations & Removals (Owner Feedback Gate 2.5)

1. **Legacy Centered Drag Pill (`.cp-dock-handle`)**:
   - **Reason**: Broken/inactive centered drag pill. Replaced by dedicated right grip (`#cp-dock-handle`) and drag support from empty pill padding with a 4px threshold (< 4px click, $\ge$ 4px drag).
   - **Approval**: Requested and approved by owner in Gate 2.5 item A.7.
2. **Dock Close / Dismiss 'x' Button (`#ah-dock-dismiss`)**:
   - **Reason**: Dock must never become completely invisible with no click target. Replaced by "Minimize Dock" in Settings tab and `Cmd/Ctrl+Shift+X`.
   - **Behavior**: Minimizes dock to a small round brand button with status dot at the same position; clicking the round button restores the dock.
   - **Approval**: Requested and approved by owner in Gate 2.5 item A.6.

---

## 3. Stabilization Pass & Parity Restorations (Gate 2.6)

1. **Legacy Multi-Pill Dock Callout (`#cp-dock-callout`)**:
   - **Root Cause**: Overlapped Pins button and sat below dock, intercepting pointer hits.
   - **Resolution**: Removed completely in S1. Replaced with `#ah-dock-tooltip` (350ms delay, `pointer-events: none !important`) and `#ah-toast-callout` (notification toast).
   - **Verification**: Verified in `e2e/gate-2-6.spec.ts` S1 hit-test (all buttons hit-test to themselves or direct children with 0 overlapping elements).
2. **Dock Button `transition: all` Radius Lag**:
   - **Root Cause**: `.ah-dock-btn` had `transition: all` which animated `border-radius` from 9999px down to 8px across 160ms, appearing unrounded during interaction/tests.
   - **Resolution**: Replaced `transition: all` with explicit property transitions (`color`, `background`, `border-color`, `box-shadow`) in `dock.css`.
   - **Verification**: Verified in `e2e/gate-2-6.spec.ts` S3 (instant 8px rounded-square active Inspect state).
3. **Selection Action Chip Visibility Regression (`#cp-selection-chip`)**:
   - **Root Cause**: Introduced `setupPopover(cp-selection-chip)` in P2-02 added HTML5 `popover="manual"` and CSS `:not(.open) { display: none !important }`, causing the chip to remain permanently hidden since it is a relative child of `#cp-selection-frame`.
   - **Resolution**: Removed `setupPopover` and `.open` requirement in S4, restoring pure baseline DOM positioning.
   - **Verification**: Verified in `e2e/gate-2-6.spec.ts` S4 (label formatting with component/tag + first class, 320px max-width, ellipsis).
4. **Layout Card Color Format**:
   - **Resolution**: Added canvas 1x1 sRGB conversion in S7 (`formatColorToHex`), displaying swatch plus hex code (e.g., `#879192`), eliminating raw `oklab()` and `color-mix()`.
   - **Verification**: Verified in `e2e/gate-2-6.spec.ts` S7.

