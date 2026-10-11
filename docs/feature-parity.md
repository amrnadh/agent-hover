# Agent Hover: feature parity, 0.1 → 0.2

> Rule: no 0.1 capability is dropped without the owner's approval. This table maps every 0.1 control to where it lives in 0.2 (approved design: [design/prototype.html](design/prototype.html)).

| 0.1 capability | 0.2 location | Verified by |
|---|---|---|
| Inspect mode (Alt, dock) | Dock Inspect, `Alt` | `e2e/v02-main-flow.spec.ts`, `e2e/p2-03-capture-layer.spec.ts` |
| Hover highlight + label | Selector (blue outline, `<Name />` / `tag.class` + size) | `v02-main-flow` |
| Click to select, parent/child | Selection frame; `↑`/`↓`; ⋯ › Select parent/child; Inspect breadcrumb | `v02-main-flow`, `v02-dock-sidebar` |
| Copy AI context | Pill Copy, `⌘/Ctrl+C`, Inspect footer Copy | `v02-main-flow` (Copy destination) |
| Send to agent | Pill Ask → composer → Send | `v02-main-flow` |
| Live task status | Element marker, task card, Tasks tab, dock dot, toasts | `v02-main-flow` |
| Open in IDE | Pill file chip, ⋯ › Open in editor, `O`, Inspect file link, task files | unit (`editor-launcher`), manual |
| Screenshot (component / viewport / full page) | ⋯ › Screenshot element; dock ⋯ › visible area / full page; copied + saved, toast → View opens the lightbox (copy, download, show in folder) | e2e `v02-screenshots-update` |
| Notes / comments | Comment mode (dock, `C`), pill Comment, pins anywhere, Comments tab, send to agent | `v02-comments-batch` |
| Pin stack (TARGET / REFERENCE / FROZEN) | Batch (`B`, + Batch): roles Change / Reference / Don't touch, one goal | `v02-comments-batch` |
| Freeze component (Ctrl-click) | ⋯ › “Don't let agents change this” (red outline + “Locked” label) | manual |
| Context level (Compact / Standard / Deep) | Inspect footer; Settings › When you press Send | `v02-dock-sidebar` |
| Token meter | Inspect footer | `v02-dock-sidebar` |
| Props / hooks / layout / source | Inspect sections (runtime props, secrets redacted) | `v02-dock-sidebar`, unit (`previewValue`) |
| Theme (system / dark / light) | Settings › Appearance | `v02-dock-sidebar` |
| Dock drag, snap, persist, reset | Dock grip / padding; Settings › Reset dock position | `v02-dock-sidebar` |
| Dock minimize | ⋯ › Minimize, `⌘/Ctrl+Shift+X` | `v02-dock-sidebar` |
| Dock vertical / horizontal | Settings › Appearance | `v02-dock-sidebar` |
| Sidebar float / dock | Sidebar header float button | `v02-dock-sidebar` |
| Preferred editor | Settings › Open files in (6 editors) | manual |
| MCP setup modal | Settings › Agents (6 tools, copy button) | unit (`agents` table in sync with CLI) |
| Update notice | Daily registry check by the bridge; one toast per version, dock connection popover, Settings › About with the update command | e2e `v02-screenshots-update`, unit `update-check` |
| Isolation (shadow DOM, modal dialogs, hostile CSS) | unchanged | `e2e/p2-02-isolation.spec.ts` |
| Shift passthrough, wheel forwarding | unchanged | `e2e/p2-03-capture-layer.spec.ts` |

## Removed with owner approval (2026-10-11)

| 0.1 feature | Why |
|---|---|
| Inline text editing (double-click to edit source) and the in-sidebar source editor | The agent does the work; an editor in the overlay competed with it and added the largest widget. |
| Spacing-bands toggle and always-on distance guides | Box model is in Inspect › Layout; hold ⌘/Ctrl to see distances on demand. |
| Selection chip with every action, Stage 1 popover | Replaced by the action pill + composer flow. |
