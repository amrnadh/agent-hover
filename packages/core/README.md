# @agent-hover/core

[![npm](https://img.shields.io/npm/v/@agent-hover/core)](https://www.npmjs.com/package/@agent-hover/core)

Shared engine for [Agent Hover](https://github.com/Arc-coder07/agent-hover): source parsing (component boundaries, props, hooks, imports via `@babel/parser`), token counts, task and prompt formatting, shared types, and bridge session discovery. Used by `@agent-hover/vite` and `@agent-hover/mcp`; you do not need to install it yourself.

```ts
import { ContextBuilder, TokenEstimator, formatContextMarkdown } from '@agent-hover/core';

const builder = new ContextBuilder(process.cwd());
const context = await builder.buildContext('src/components/Button.tsx', 12, 'standard');
console.log(new TokenEstimator().estimateContext(context).current, 'tokens');
console.log(formatContextMarkdown(context, 'standard'));
```

## License

MIT
