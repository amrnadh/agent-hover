# Videos

Agent Hover has two kinds of video, made for different moments. Keep them separate.

| | GitHub demo | Launch video |
|---|---|---|
| When | Every release, or every few versions | A major release, or a version close to ideal |
| Shows | What the current version does | Why Agent Hover matters |
| Made with | `npm run record:demo` (scripted, repeatable) | A real agent, edited by hand |
| Lives in | README (`docs/media/`) | Launch post, site, social |

## GitHub demo

Recorded from the demo app (Sorrel, `demo/`) by `e2e/record-demo.spec.ts`, one Playwright test per scene, joined by `scripts/record-demo.mjs`. A scripted agent claims each task and really edits the demo's files, so HMR, task statuses, Compare and Undo are real; only the agent's side is scripted so every take comes out the same.

| Scene | Caption | Feature |
|---|---|---|
| 00 | Title card | |
| 01 | Don't know what it's called? Point at it. | Ask on an un-nameable element (the hero underline, `<Squiggle />`), task marker, Compare, Undo |
| 02 | Like this, not that: point at both. | Batch: the one-off tile (Change) and a `<StatCard>` (Reference) |
| 03 | Small things? Leave a note right where they are. | Comment pins on the Amount header and an odd date, sent as one task |
| 04 | Not just styling: ask for what's missing. | Ask on the table header to add an Export CSV button |
| 05 | Finished something? Keep agents off it. | Lock `<Logo />` |
| 06 | `npx agent-hover init` | End card |

The demo app stages each moment on purpose (see `demo/README.md`); `e2e/demo-scenes.spec.ts` keeps them in place.

```bash
npm run record:demo
```

Re-record one or more scenes (the others come from the last run's cached clips):

```bash
npm run record:demo -- 2 4
```

Output:
- `docs/media/agent-hover-demo.mp4`: all scenes, about 1:36.
- `docs/media/agent-hover.gif` and `agent-hover.mp4`: scene 1 up to Compare, for the top of the README.

GitHub only plays videos inline when they are uploaded through its editor. After re-recording, drag `agent-hover-demo.mp4` into the README editor on github.com to get a player, or keep the link.

When the UI or a flow changes: update the scene in `e2e/record-demo.spec.ts` (its scripted edits fail loudly if the demo code they expect has moved), re-record that scene, and check the frames.

## Launch video (not made yet)

Make it for a major release, when the product is close to how it should be. The goal is a short film that makes the idea land, not a feature tour.

- **Story: describing vs pointing.** Open on a vibecoder typing a long, vague description into a chat ("the wavy line under the heading, the green one, make it… less"), the agent changing the wrong thing, then the same fix in three seconds by pointing at it. Then the moments the GitHub demo shows, faster, ending on Compare and Undo.
- **Real agent, not scripted.** Claude Code (or Cursor) visibly running next to the browser, in listen mode, picking up the tasks. Use a real project or the demo app, and keep the cuts honest: speed ramps are fine, faked results are not.
- **Production:** 60–90 s main cut plus a 15 s social cut; voiceover or captions; light music; a screen recorder with smooth zoom (e.g. Screen Studio); 1080p or higher; the brand mark and `npx agent-hover init` at the end.
- **Storyboard:** problem (10 s) → point and ask (15 s) → the agent works, marker goes to Done (10 s) → Compare and Undo (10 s) → Batch "like this" (10 s) → notes and add (10 s) → works with your agent (5 s) → end card (5 s).
