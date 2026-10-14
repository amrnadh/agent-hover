# Contributing to Agent Hover

Thanks for helping. Bug reports with steps to reproduce, and small focused pull requests, are the most useful.

## Setup

Node 20 or newer, and git.

```bash
git clone https://github.com/amrnadh/agent-hover.git
cd agent-hover
npm install
npm run build
npm run dev        # the demo app on http://localhost:5173 with the overlay
```

The demo (`demo/`) is a small React + Vite app used for development and as the e2e fixture. After changing a package, rebuild it (`npm run build`, or `npm run dev --workspace=@agent-hover/overlay` for a watch build of the overlay) and reload the page; restart `npm run dev` after bridge changes.

To try the agent side, register the local MCP server with your agent (for Claude Code: `claude mcp add agent-hover -- node /path/to/agent-hover/packages/mcp/dist/index.js`) and start the agent in `demo/`.

## Layout

| Path | |
|------|--|
| `packages/core` | Shared types, source parsing, prompt formatting, session discovery |
| `packages/vite` | Vite plugin and bridge server (Express + WebSocket on 127.0.0.1), task store, git checkpoints |
| `packages/overlay` | The in-page UI, one shadow root. `src/client.ts` wires the modules in `app/`, `bridge/`, `features/`, `ui/`, `lib/` |
| `packages/mcp` | MCP server (stdio) |
| `packages/cli` | `npx agent-hover` (init, doctor, mcp, rules). No runtime dependencies on purpose |
| `docs/design/prototype.html` | The approved UI design; the overlay follows it |
| `docs/bridge-api.md` | Bridge HTTP and WebSocket API |

## Checks

```bash
npm run typecheck
npm test                     # unit tests (vitest)
npm run test:e2e:isolated    # e2e (Playwright) against a throwaway git copy of the demo on port 5175
npm run pack:check           # what each package would publish
npm run screenshots          # refresh the README images in docs/screenshots (tests otherwise save to test-results/)
```

Run the e2e suite with `test:e2e:isolated`: it never edits `demo/` and does not collide with a dev server you have running. The first time, install the browser with `npx playwright install chromium`. The suite includes the full agent loop through the real MCP server, an accessibility scan (axe) and a performance budget. `AH_BROWSERS=all npm run test:e2e:isolated -- --project=firefox --project=webkit` runs the user flows in Firefox and WebKit too (`npx playwright install firefox webkit`). CI runs all of it on every pull request.

## Guidelines

- **UI**: match `docs/design/prototype.html`. Blue (`--ui-select`) is for the on-page selector only; every other surface uses the neutral tokens in `packages/overlay/src/styles/ui.css`. Check dark and light, and a 390px-wide window.
- **Never interfere with the host app**: no global styles, letter shortcuts only while Agent Hover is in use, nothing in production builds.
- **Security**: the bridge only listens on 127.0.0.1, checks the origin and the session token, and validates every path against the project root. Undo restores files one by one; never add `git reset`, `clean` or `checkout` of the whole tree. No telemetry. See [SECURITY.md](SECURITY.md).
- **Prompts**: the text agents receive comes from `packages/overlay/src/lib/prompt-format.ts`; keep it short, ordered (what, where, now, constraints, source) and covered by `prompt-format.test.ts`.
- **Tests**: add a unit test for logic and an e2e test for anything a user clicks.
- **Changelog**: add a line under `## [Unreleased]` in `CHANGELOG.md` for user-visible changes.
- **Commits**: small, in the imperative (`fix(overlay): keep the pill on screen`).

## Releasing (maintainers)

Follow [docs/release-checklist.md](docs/release-checklist.md): automated checks, a manual run with real agents, then publishing in dependency order (`core`, `overlay`, `vite`, `mcp`, `agent-hover`). For a new version, first bump every package to the same version (including the internal `^x.y.z` dependencies and the root `package.json`).

## Security issues

Please do not open a public issue. Follow [SECURITY.md](SECURITY.md).
