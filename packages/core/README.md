# @agent-hover/core

> Context intelligence engine for [Agent Hover](https://github.com/Arc-coder07/agent-hover).

`@agent-hover/core` powers the AST parsing, component relationship graph, token estimation, and markdown prompt formatting for Agent Hover. It analyzes React codebases statically and dynamically to extract rich structural context for AI coding agents.

## Installation

```bash
npm install @agent-hover/core
```

## Features

- **AST Context Extraction (`ContextBuilder`)**:
  Parses JSX/TSX components using `@babel/parser` to extract:
  - Component declarations, start and end line ranges
  - Props interfaces, types, and default values
  - State hooks, effect hooks, and custom hooks
  - Import statements and dependencies
  - Parent/child DOM and component relationships
- **Multi-Level Token Budgeting (`TokenEstimator`)**:
  Computes exact BPE token counts using `gpt-tokenizer` across three context detail levels:
  - `minimal` (~200 tokens): Component signature, props interface, and primary JSX structure.
  - `standard` (~500 tokens): Complete component body, hooks, imports, and styling details.
  - `full` (~1500 tokens): Full source file, ancestor hierarchy, and related imports.
- **Relationship Resolution (`RelationshipResolver`)**:
  Builds project-wide import graphs using `fast-glob` to determine parent/child and sibling component associations across multi-component pinned sets.
- **Source Code Editing (`SourceEditor`)**:
  Safe textual replacements, line edits, and undo-stack management for ephemeral and persistent changes.

## Quick Example

```ts
import { ContextBuilder, TokenEstimator, formatContextMarkdown } from '@agent-hover/core';

const builder = new ContextBuilder(process.cwd());
const context = await builder.buildContext('src/components/Button.tsx', 12, 'standard');

const estimator = new TokenEstimator();
const tokens = estimator.estimateContext(context);

console.log(`Current context budget: ${tokens.current} tokens`);

const markdown = formatContextMarkdown(context, 'standard');
console.log(markdown);
```

## License

MIT
