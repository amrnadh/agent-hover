# Release checklist (0.2.0)

Everything above the line is automated (CI and `npm run …`); the rest needs a person.

## Automated (must be green)

- [x] `npm run typecheck`, `npm test` (unit), `npm run pack:check`
- [x] `npm run test:e2e:isolated`: main flow, dock and sidebar, comments and batch, compare and undo, screenshots and update notice, the full agent loop through the real MCP server (`v02-mcp-agent`), accessibility (axe, WCAG 2.1 A/AA, no serious or critical issues, dark and light), performance (no idle frames; ~0.13 ms of overlay script per pointer move)
- [x] `AH_BROWSERS=all npm run test:e2e:isolated -- --project=firefox --project=webkit`: the user flows in Firefox and WebKit (Safari's engine)
- [x] Fresh project: packed tarballs installed into a new Vite 8 + React 19 app, `npx agent-hover init --yes`, overlay works, `npx agent-hover doctor` all green, about 35 seconds from install to a checked setup

## Real agents (manual, ~10 minutes each)

Use the demo (`npm run build && npm run dev`) or any Vite + React app with the local build. To use the local MCP server instead of the published one, point the agent at `node /path/to/agent-hover/packages/mcp/dist/index.js`.

For each of **Claude Code**, **Cursor** and **Codex**:

1. Register the MCP server (`npx agent-hover init --agent <claude|cursor|codex>` in the app, or `npx agent-hover mcp <agent>`), then restart the agent in the app folder.
2. The dock's status dot turns green and the connection popover names the agent.
3. Run `/agent-hover` in the agent (or tell it "Listen for agent-hover tasks.")
4. Select an element → Ask → "Make this button larger" → Send. The marker goes Sent → Seen → Working → Done; the card shows the agent's summary and the changed file.
5. Open Compare (before/after), then Undo: the file is back exactly as before (`git diff` is empty).
6. Send two comments with "Send N open" and a 3-element Batch: each arrives as one task with all the context.
7. Note anything the agent misunderstood in the prompt and open an issue with the copied prompt.

Also try Copy with no agent connected: paste the prompt into ChatGPT or Claude.ai and check that it is self-contained.

## Publish

1. `npm run build && npm run pack:check`
2. `npm login` (once), then in this order:
   ```bash
   npm publish --workspace=@agent-hover/core
   npm publish --workspace=@agent-hover/overlay
   npm publish --workspace=@agent-hover/vite
   npm publish --workspace=@agent-hover/mcp
   npm publish --workspace=agent-hover
   ```
3. Move the `## [Unreleased]` entries in `CHANGELOG.md` under `## [0.2.0] - <date>`.
4. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`; create the GitHub release from the changelog.
5. GitHub › Settings › General › Social preview: upload `docs/brand/logo/social.png`.
   If the UI changed, re-record the demo first (`npm run record:demo`, see `docs/media/VIDEOS.md`). For an inline player, drag `docs/media/agent-hover-demo.mp4` into the README editor on github.com.
6. Check `npx agent-hover@latest --version` prints 0.2.0 and a fresh `npx agent-hover init` installs 0.2.0.
