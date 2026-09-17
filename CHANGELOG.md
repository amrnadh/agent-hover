# Changelog

All notable changes to Agent Hover will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
