# @agent-hover/bridge

The local server behind [Agent Hover](https://github.com/amrnadh/agent-hover#readme), shared by [`@agent-hover/vite`](https://www.npmjs.com/package/@agent-hover/vite) and [`@agent-hover/next`](https://www.npmjs.com/package/@agent-hover/next). You don't install it yourself: those packages start it with your dev server.

It runs on `127.0.0.1` only, checks the page's origin, and requires a token that changes on every dev server start. It keeps the task queue, the checkpoints behind Compare and Undo, and finds the source of what you click. Your agent talks to it through [`@agent-hover/mcp`](https://www.npmjs.com/package/@agent-hover/mcp).

For integrations:

- `startBridge({ root, port, packageName, version, locationMapper, ignore, publicDir })`: one bridge per process.
- `overlayScripts({ port, token, editor })`: the scripts a page needs for the overlay.
- `BridgeServer`, `LocationMapper`: the server and the source-map hook each framework provides.

API reference: [docs/bridge-api.md](https://github.com/amrnadh/agent-hover/blob/main/docs/bridge-api.md).
