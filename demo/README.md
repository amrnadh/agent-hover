# Sorrel (Agent Hover demo)

A small React + Vite app that shows Agent Hover at work. It is the stage for the GitHub demo video and the README screenshots, and the fixture for the e2e suite. Sorrel is a fictional invoicing product; every company, person, number and quote in it is made up.

From the repository root:

```bash
npm run build   # build the packages first
npm run dev     # http://localhost:5173
```

Press Alt (or the pointer in the dock) and click anything.

## Moments to try

The app has a few small, realistic flaws and gaps on purpose, one for each thing Agent Hover is good at. They are what the demo video fixes ([docs/media/VIDEOS.md](../docs/media/VIDEOS.md)). Don't "fix" them in the source.

| Where | What's off | Try |
|---|---|---|
| Hero headline | The hand-drawn underline under "on time" (`<Squiggle />`) is heavy. Hard to name, easy to point at. | Click it, Ask "make this thinner and lighter", then Compare and Undo |
| Overview tiles | "Avg. days to pay" is a one-off `div`; the other three are `<StatCard>`. | Batch it (Change) with "Outstanding" (Reference): "make the first one match the second" |
| Recent invoices | The Amount header is left-aligned over right-aligned numbers; one due date is `2026-09-29`. | Comment mode: pin both, then Send 2 open |
| Recent invoices header | Room next to the filters. | Ask "add an Export CSV button here" |
| Navbar | `<Logo />` is finished work. | ⋯ › Don't let agents change this |
| Hero buttons | “Book a demo” is rendered through the shared `<Button>`. | Copy its prompt: it says to change this usage, not `<Button>` itself |

`e2e/demo-scenes.spec.ts` checks these moments are still there.

The e2e suite also depends on `src/components/Hero.tsx`: the `Hero` component, `#hero-primary-cta` with the label “Book a demo” on its own line, `#hero-badge`, `#hero-secondary-cta`, and the hero `h1` being the first on the page.
