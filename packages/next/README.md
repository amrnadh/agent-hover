**Can't describe it? Point at it.**

You can see exactly what you want changed, but you don't know what it's called, and your agent can't tell which one you mean. Agent Hover for Next.js is a dev-only overlay: you click the element in your running app and say what should change. Your coding agent gets the exact file, the line that renders it, how it looks now and what it must not touch, so it changes the right thing.

The task stays on the element while the agent works. When it's done, check it there: compare before and after, keep it, undo it in one click, or follow up.

Works with Claude Code, Cursor, Codex, OpenCode, Antigravity, Windsurf and any other MCP agent.

## Quick start

In your Next.js project:

```bash
npx agent-hover init
```

`init` installs this package, makes the three additions below, connects your coding agent (MCP config plus a short rules note), and keeps Agent Hover's local files out of git. It shows every change and asks before writing anything. Add `--dry-run` to only see the plan.

Then start `next dev`, press **Alt** (or the pointer in the dock) and click any element. Press **Ask**, describe the change, and send it. In your agent, run **`/agent-hover`** or say **"Listen for agent-hover tasks."**

## Manual setup

```bash
npm install -D @agent-hover/next
```

**1. `next.config.ts`**: lets the dev server load Agent Hover's local server from `node_modules`.

```ts
import { withAgentHover } from '@agent-hover/next';

export default withAgentHover(nextConfig);
```

**2. `instrumentation.ts`** (in `src/` if your app lives there): starts it with `next dev`.

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
    await (await import('@agent-hover/next/register')).register();
  }
}
```

Options: `register({ port, editor, root, distDir })`. The bridge starts on port 9850, or the next free one.

**3. The dock.** App Router, at the end of `<body>` in `app/layout.tsx`:

```tsx
import { AgentHover } from '@agent-hover/next/script';

<body>
  {children}
  <AgentHover />
</body>
```

Pages Router, in `pages/_document.tsx` after `<NextScript />`:

```tsx
import { AgentHover } from '@agent-hover/next/document';

<body>
  <Main />
  <NextScript />
  <AgentHover />
</body>
```

Then register the MCP server with your agent: `npx agent-hover mcp <agent>` prints the config.

## How it finds the line

React 19 records where each element was created. In `next dev` that is a position in the dev build (a Turbopack chunk, a webpack module or a Server Component chunk); Agent Hover reads the dev build's source maps from `.next` and gives your agent the file and line in your source. It works for Client Components and Server Components. When a line can't be read, the component is found by its name.

## Requirements

- Next.js 15 or newer with React 19. App Router or Pages Router; Turbopack or webpack.
- Node 20 or newer.
- Dev only: nothing changes in production builds, and nothing runs in the Edge runtime.
- Compare and Undo need a git repository.

Full documentation: [github.com/amrnadh/agent-hover](https://github.com/amrnadh/agent-hover#readme).
