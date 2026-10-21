# Testing a version before it's published

How to try the current code in a real project, with real agents, exactly the way people will install it from npm.

`npm run registry:local` starts a private npm registry on your machine and publishes the five packages to it under a fresh version, for example `0.2.1-local.1792575628`. Anything else (React, Vite…) is passed through from npmjs. While npm points at it, `npx agent-hover init`, the plugin install, and every agent's `npx -y @agent-hover/mcp` get this code. A new version each time means nothing old is reused from a cache.

## 1. Start it

In this repo:

```bash
npm run registry:local
```

It builds, publishes, and prints the version. Then point npm at it (this affects every terminal and every agent, until step 5):

```bash
npm config set registry http://127.0.0.1:4873/
```

## 2. A real project

Use a real Vite + React app, or a copy of one. Commit everything first: Undo needs git.

```bash
npx agent-hover@<version> init
```

npx asks once whether to download that version (`-y` skips it). Then pick agents in the checklist (↑ ↓, space, Enter), e.g. Claude Code, Cursor, Codex and OpenCode.

- [ ] The checklist ticks the agents the project already uses, and Esc cancels without writing anything.
- [ ] The plan is grouped (this project, then each agent) and asks Yes/No before writing.
- [ ] `package.json` has `@agent-hover/vite` at the local version (`npm ls @agent-hover/vite`).
- [ ] Commands exist: `.claude/commands/`, `.cursor/commands/`, `.opencode/commands/` (`agent-hover.md`, `agent-hover-status.md`), `.agents/skills/` for Codex.
- [ ] `npm run dev`, open the app: the dock appears. Press Alt and click something: the pill shows a name and `file:line`.
- [ ] `npx agent-hover@<version> doctor` passes (run it with the dev server running).

## 3. Each agent

Start (or restart) the agent in the project folder after `init`.

| Agent | Connected? | Listen | Status |
|---|---|---|---|
| Claude Code (terminal) | Approve `.mcp.json` when asked; `/mcp` lists agent-hover | `/agent-hover` | `/agent-hover-status` |
| Claude Code (desktop app) | Same project folder | `/agent-hover` | `/agent-hover-status` |
| Cursor | Settings › MCP: agent-hover is on | `/agent-hover` in Agent chat | `/agent-hover-status` |
| Codex | Trust the project when asked; `/mcp` lists agent-hover | `$agent-hover` | `$agent-hover-status` |
| OpenCode | `opencode mcp list` shows agent-hover | `/agent-hover` | `/agent-hover-status` |

For each one:

- [ ] The dock shows it as connected, with the right name (tell us if it shows something odd, like "Mcp Client").
- [ ] Ask on an element and send: the marker and card go Sent → Seen → Working → Done, and the agent changes the right file.
- [ ] Keep, Undo (files really go back), Follow up.
- [ ] Status lists what's waiting without starting it.
- [ ] Quit the agent: it leaves the dock within a second or two.

With two agents open at once:

- [ ] Pick one in Ask: only that one receives the task.

## 4. Changes, voice, updates

- [ ] Tasks tab: Needs you / In progress / History, remove a waiting task, Send again, Try again, Clear.
- [ ] The mic in Ask (Chrome, Edge or Safari): it turns red and glows softly while listening, Esc stops.
- [ ] Update path: change some code here, run `npm run registry:local` again (new version), then in the project run `npm i -D @agent-hover/vite@latest` **without** restarting the dev server. The page should say "Restart your dev server to finish updating". Restart it, and restart the agents.

Write down anything that felt confusing, not only what broke.

## 5. Clean up

```bash
npm run registry:stop
```
```bash
npm config delete registry
```

Do both. If the registry stops while npm still points at it, every `npm install` on this machine fails.

After the real release, move the test project back to the published version: `npm i -D @agent-hover/vite@latest`.
