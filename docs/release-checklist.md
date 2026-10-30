# Release checklist (0.2.1)

Everything under "Automated" runs in CI and with `npm run …`; the rest needs a person.

## Prepare

- [x] Every package at the new version, internal dependencies at `^<version>` (`packages/*/package.json`, root `package.json`, `package-lock.json`).
- [x] `## [Unreleased]` in `CHANGELOG.md` becomes `## [<version>] - <date>`, with a fresh empty `[Unreleased]` above it.
- [x] Release notes in `docs/releases/v<version>.md` (the GitHub release uses them).
- [x] Docs match the code: `docs/bridge-api.md`, the package READMEs, `docs/testing-before-release.md`.

## Automated (must be green)

- [x] `npm run typecheck`, `npm test` (unit), `npm run pack:check`
- [x] `npm run test:e2e:isolated`: main flow, dock and sidebar, task flow (remove, Send again, Try again, restart notice), comments and batch, compare and undo, screenshots and update notice, voice, the full agent loop through the real MCP server (`v02-mcp-agent`), accessibility (axe, WCAG 2.1 A/AA, dark and light), performance
- [x] `AH_BROWSERS=all npm run test:e2e:isolated -- --project=firefox --project=webkit`: the same flows in Firefox and WebKit (Safari's engine)
- [x] Fresh project (`node scripts/smoke-fresh.mjs`, CI on macOS, Linux and Windows): packed packages in a new Vite + React app, `init` for four agents, `doctor`, an agent connecting from the project and one from outside it
- [x] CI green on the release PR

## Real agents (manual)

Follow [testing-before-release.md](testing-before-release.md): `npm run registry:local` publishes the release to a registry on your machine, so `npx agent-hover init` and every agent get exactly what npm will serve.

- [x] Claude Code (desktop app), Codex, Cursor: listen, a task end to end, Keep / Undo, `/agent-hover-status`
- [x] OpenCode: connects (`opencode mcp list`)
- [ ] Antigravity: re-test after the 401 fix (it connects from a global config now)

## Publish

1. `npm run build && npm run pack:check`
2. `npm login` (once), then in this order (dependencies first):
   ```bash
   npm publish --workspace=@agent-hover/core
   npm publish --workspace=@agent-hover/overlay
   npm publish --workspace=@agent-hover/vite
   npm publish --workspace=@agent-hover/mcp
   npm publish --workspace=agent-hover
   ```
3. Tag and push: `git tag v<version> && git push origin v<version>`.
4. GitHub release from the notes: `gh release create v<version> --title "Agent Hover <version>" --notes-file docs/releases/v<version>.md`. The update notice links to this page, so it must exist.
5. If the UI changed: refresh the README images (`npm run screenshots`) and the demo (`npm run record:demo`, see `docs/media/VIDEOS.md`); GitHub › Settings › General › Social preview gets the current poster.

## After publishing

- [ ] `npx agent-hover@latest --version` prints the new version, and a fresh `npx -y agent-hover init` installs it.
- [ ] A project on the previous version shows the update notice: the box under Vite's output after starting the dev server, the page toast, Settings › About with the right command and What's new. (The check runs at most once a day; delete `~/.agent-hover/update-check.json` to see it at once.)
- [ ] Update that project (`npm i -D @agent-hover/vite@latest`) without restarting the dev server: the page asks for a restart. Restart, and everything works.
