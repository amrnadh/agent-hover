# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Vanilla TypeScript / Shadow DOM (Vite plugin UI injection)

## Users
Software engineers, UI developers, and designers working in React/Vite ecosystems across advanced IDEs (Antigravity IDE, Cursor, Windsurf, VS Code).

## Product Purpose
A frictionless dev-tooling overlay that bridges the gap between browser visual state and IDE code state. It allows developers to point and click on UI components in their dev server to instantly jump to the corresponding code file and line in their IDE without manual searching.

## Positioning
The most tactical, fast, and precise DOM-to-IDE bridge available. It operates entirely locally and natively understands modern IDE deep links.

## Operating Context
Lives as a floating widget on top of the user's own application during development. It must be unobtrusive, highly performant, and never interfere with the host application's z-index, layout, or event bubbling when inactive.

## Capabilities and Constraints
- Native IDE detection (VS Code, Cursor, Windsurf, Antigravity IDE)
- Glassmorphic UI injected via Shadow DOM to prevent CSS bleeding
- Must remain incredibly lightweight (minimal DOM nodes)

## Brand Commitments
- "Dark Developer / Builder" aesthetic.
- Precision, speed, and tactical operation.
- No generic "AI slop" visuals (no soft purples, no generic Inter font, no cheap gradients).

## Product Principles
1. **Zero Friction:** The bridge must be instantaneous.
2. **Invisible Until Needed:** The UI must be out of the way of the host app.
3. **Tactical Precision:** The visual feedback (highlights, tooltips) must be surgical and exact.
