# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
TypeScript / Node.js (Vite plugin backend/core AST logic)

## Users
Internal usage by `@agent-hover/vite` and other potential bundler plugins.

## Product Purpose
Provides the core AST parsing and code injection logic required to locate JSX/TSX source lines and inject them into DOM elements at build time.

## Positioning
Headless, fast, and bundler-agnostic parser engine.

## Capabilities and Constraints
- Operates at build-time.
- Parses React, Preact, and potentially Vue/Svelte ASTs.
- No UI components.
