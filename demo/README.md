# Sorrel (Agent Hover demo)

A small React + Vite app for developing and testing [Agent Hover](../README.md). It is the fixture for the e2e suite and the app shown in the README video and screenshots. Sorrel is a fictional invoicing product; every company, person, number and quote in it is made up.

From the repository root:

```bash
npm run build   # build the packages first
npm run dev     # http://localhost:5173
```

Press Alt (or the pointer in the dock) and click anything.

The e2e suite and `npm run record:demo` depend on a few things in `src/components/Hero.tsx`: the `Hero` component, `#hero-primary-cta` with the label “Book a demo” on its own line, `#hero-badge`, `#hero-secondary-cta`, and the hero `h1` being the first on the page.
