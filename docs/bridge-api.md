# Agent Hover Bridge API v2

The Agent Hover bridge is an authenticated, local-only HTTP and WebSocket server running inside the Vite dev process on `127.0.0.1` (default port 9850, auto-incrementing if occupied).

It serves as the communication hub between:
1. The **Browser Overlay** running inside your web app.
2. AI coding agents via the **MCP Server** (`@agent-hover/mcp`).
3. External tools and CLI integrations.

---

## 1. Authentication & Security Model

- **Localhost Binding:** Binds strictly to `127.0.0.1`.
- **Session File:** On server start, a random 32-byte cryptographically secure session token is generated and written to `.agent-hover/session.json` with restricted permissions (`0600`).
  ```json
  {
    "version": 1,
    "port": 9850,
    "token": "<base64url-token>",
    "pid": 12345,
    "projectRoot": "/path/to/project",
    "startedAt": "2026-10-05T01:00:00.000Z"
  }
  ```
- **Session Cleanup:** `.agent-hover/session.json` is automatically deleted on graceful server exit.
- **Finding the session (MCP server):** the same session is also written to `~/.agent-hover/bridges/<project hash>.json` (`0600`; the folder moves with `AGENT_HOVER_HOME`) and removed on exit. The MCP server uses, in order: `AGENT_HOVER_SESSION` (a session file path); `.agent-hover/session.json` in its working folder or above; the same in the workspace folders the agent reports (MCP roots); the running bridges listed in `~/.agent-hover/bridges/`, preferring one inside a workspace folder, else the newest. A session whose `pid` has exited is skipped; a `pid` it may not signal (`EPERM`, as inside an agent's sandbox) counts as running.
- **Authorization Header:** All endpoints (except public `GET /api/health` and preflight `OPTIONS`) require:
  ```http
  Authorization: Bearer <token>
  ```
  or header `X-AH-Token: <token>`.
- **Origin Validation:** Origins must be local dev server URLs (`localhost`, `127.0.0.1`, `[::1]`). Requests with untrusted origins are rejected with `403 Forbidden`.
- **Host Validation:** Host header must match `localhost` or `127.0.0.1` to prevent DNS-rebinding attacks.
- **Path Confinement:** Endpoints that read or edit source files enforce path confinement within `projectRoot`, blocking directory traversal (`../`) and forbidden directories (`node_modules`, `.git`, `.env`).

---

## 2. Task Lifecycle & State Machine

```
queued ──list/get by agent──▶ delivered ──claim──▶ in_progress ──▶ done | failed
  │  ╲────────────claim──────────────────────────▲
  ├─ user cancel ─▶ cancelled        (also from delivered)
  ├─ same supersedesKey sent ─▶ superseded   (queued/delivered only)
  └─ TTL elapsed ─▶ expired          (any non-terminal state)
```

- **Terminal States:** `done`, `failed`, `cancelled`, `expired`, `superseded`.
- **Deduplication:** Sending a task with an existing `supersedesKey` marks earlier `queued` or `delivered` tasks with that key as `superseded`.
- **Persistence:** In-memory queue backed by atomic disk writes to `.agent-hover/tasks.json` (capped at 200 tasks).
- **History:** when the bridge starts, finished tasks older than 7 days are removed (with their checkpoints), except changes still waiting for review.
- **Review:** a `done` task that changed files carries `review: { state: "kept" | "undone" | "followed-up", at, followUp? }` once you decide.

---

## 3. REST API Reference

### Health Check (Public)
```http
GET /api/health
```
Response:
```json
{
  "ok": true,
  "status": "ok",
  "version": "0.2.1",
  "api": 2,
  "port": 9850,
  "updateAvailable": null
}
```
- `version` comes from the installed `@agent-hover/vite` package.
- `api` is the bridge's API level. The page compares it with the level it needs and, when the bridge is older (no `api` means 1), asks you to restart the dev server. That happens after an update: the page loads the new overlay at once, while the bridge runs old code until the dev server restarts. Level 2 (0.2.1) added removing tasks and Send again.
- `updateAvailable` is `{ "current", "latest", "command", "releaseUrl" }` once the daily registry check finds a newer stable release: `command` is the install command for the project's package manager, `releaseUrl` the GitHub release. The check uses the npm registry your npm settings name, caches its answer in `~/.agent-hover/update-check.json` for a day, and is off in CI or with `AGENT_HOVER_NO_UPDATE_CHECK=1` or `NO_UPDATE_NOTIFIER=1`. It is also sent in `state-update` WebSocket messages.

### Agent Presence Heartbeat
```http
POST /api/agent/presence
Authorization: Bearer <token>
Content-Type: application/json

{
  "client": "claude-code",
  "version": "1.0.0",
  "instance": "7f6c…"
}
```
Response:
```json
{
  "ok": true,
  "registered": true
}
```
The MCP server sends this every 10 seconds; `instance` tells two sessions of the same agent apart. An agent that hasn't been heard from for 25 seconds is dropped. When the agent closes, the MCP server says goodbye so the page drops it at once:
```http
DELETE /api/agent/presence
Authorization: Bearer <token>
Content-Type: application/json

{ "instance": "7f6c…" }
```

```http
GET /api/agent/presence
Authorization: Bearer <token>
```
Response:
```json
{
  "agents": [
    {
      "client": "claude-code",
      "version": "1.0.0",
      "sessions": 2,
      "lastSeen": "2026-10-05T01:10:00.000Z"
    }
  ],
  "connected": true
}
```
Agents are grouped by `client`; `sessions` counts the instances.

### Create Task
```http
POST /api/agent/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "component-context",
  "instruction": "Fix alignment of navigation items",
  "target": {
    "component": "Navbar",
    "file": "src/Navbar.tsx",
    "lineStart": 15
  },
  "payload": {
    "prompt": "..."
  },
  "assignee": "cursor"
}
```
`assignee` (optional) sends the task to one agent by its MCP client name: only that agent gets it from `next` or `?client=` lists. Without it any agent may take it.

Response: `201 Created`
```json
{
  "task": {
    "id": "task_1791144000000_abcd1234",
    "type": "component-context",
    "status": "queued",
    "createdAt": "...",
    "expiresAt": "...",
    "instruction": "Fix alignment of navigation items",
    "target": { "component": "Navbar", "file": "src/Navbar.tsx", "lineStart": 15 },
    "payload": { ... }
  }
}
```

### List Tasks
```http
GET /api/agent/tasks?status=queued,delivered&limit=50[&deliver=1]
Authorization: Bearer <token>
```
Response: `200 OK`
```json
{
  "tasks": [ ... ]
}
```
With `deliver=1` (sent by the MCP `list_agent_tasks` tool), returned `queued` tasks move to `delivered` so the overlay can show "Seen by {agent}". Without it the call never changes task state, which is what the overlay uses. With `client=<name>`, only tasks for that agent or for any agent are listed.

### Wait for Next Task (listen mode)
```http
GET /api/agent/tasks/next?wait=25&client=claude-code
Authorization: Bearer <token>
```
Long-poll used by the MCP `wait_for_agent_task` tool. `client` is the asking agent: it gets tasks assigned to it or to any agent. Returns the **oldest** `queued` task at once if there is one; otherwise holds the request until a task is created or `wait` seconds pass (0–30, default 0). The returned task is marked `delivered`, so each task is handed out once. If the client disconnects while waiting, nothing is delivered.

Response: `200 OK`
```json
{ "task": { ... }, "timedOut": false }
```
or, when nothing arrived in time:
```json
{ "task": null, "timedOut": true }
```

### Get Task & Formatted Prompt
```http
GET /api/agent/tasks/:id?format=compact|standard|deep
Authorization: Bearer <token>
```
Response: `200 OK`
```json
{
  "task": { ... },
  "prompt": "# Task [task_id]\n..."
}
```

### Claim Task
```http
POST /api/agent/tasks/:id/claim
Authorization: Bearer <token>
Content-Type: application/json

{
  "client": "claude-code"
}
```
Response: `200 OK`
```json
{
  "task": {
    "id": "...",
    "status": "in_progress",
    "claimedBy": "claude-code",
    "updatedAt": "..."
  }
}
```

### Complete Task
```http
POST /api/agent/tasks/:id/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "done",
  "summary": "Centered navigation links and adjusted flex gaps",
  "filesChanged": ["src/Navbar.tsx"]
}
```
Response: `200 OK`
```json
{
  "task": {
    "id": "...",
    "status": "done",
    "result": {
      "summary": "Centered navigation links and adjusted flex gaps",
      "filesChanged": ["src/Navbar.tsx"]
    }
  }
}
```

### Cancel Task
```http
POST /api/agent/tasks/:id/cancel
Authorization: Bearer <token>
```
Response: `200 OK` (Only allowed if status is `queued` or `delivered`).

### Review a Finished Change
```http
POST /api/agent/tasks/:id/review
Authorization: Bearer <token>
Content-Type: application/json

{ "action": "keep" }
```
`action` is `keep` or `follow-up` (with `followUp`: the new task's id). Only a `done` task can be reviewed (`409` otherwise). Undo records `undone` itself. Returns `{ task }`.

### Send Again
```http
POST /api/agent/tasks/:id/retry
Authorization: Bearer <token>
```
Creates a new `queued` task with the same request, target, payload and assignee, with `payload.retryOf` set to the old id. Allowed for `failed`, `expired`, `cancelled` and `superseded` tasks (`409` otherwise). A task that never ran leaves the list; a failed one stays, so its Undo stays possible. Returns `{ task, removed }`.

### Remove Tasks
```http
POST /api/agent/tasks/remove
Authorization: Bearer <token>
Content-Type: application/json

{ "ids": ["task_…"] }
```
or `{ "finished": true }` for every finished task with nothing left to decide (`failed`, `cancelled`, `expired`, `superseded`, and `done` tasks that were reviewed or changed no files). A waiting task is withdrawn; a task an agent is working on can't be removed (`409`). Each task's Undo checkpoint goes with it. Returns `{ removed: [ids] }` and broadcasts `task.removed`.

### Changes Since Claim (Compare / Undo)
```http
GET /api/agent/tasks/:id/changes
Authorization: Bearer <token>
```
When a task is claimed, the bridge records a git checkpoint in `.agent-hover/checkpoints/<id>.json`: `HEAD`, the tracked working-tree state (`git stash create`, which does not touch the working tree or index) and untracked files as blobs. This returns the files changed since then:
```json
{ "available": true, "files": [ { "path": "app/src/Hero.tsx", "display": "src/Hero.tsx", "status": "modified", "additions": 3, "deletions": 1, "reported": true } ] }
```
`reported: false` means the agent's `filesChanged` did not list the file (you, or another tool, may have edited it). Without git, or without a checkpoint, `available` is `false` with a `reason`.

```http
POST /api/agent/tasks/:id/undo
Authorization: Bearer <token>
Content-Type: application/json

{ "files": ["app/src/Hero.tsx"] }
```
Restores each listed file (all changed files when `files` is omitted) to its checkpoint content, deletes files created since, and restores deleted ones. Per file only: never `reset --hard`, `clean` or `checkout .`, and never touches HEAD or the index. Returns `{ restored, removed, errors }` and broadcasts `task.undone`. Refused with `409` while the task is `in_progress`.

When `complete_agent_task` is called without `filesChanged`, the bridge fills it from the checkpoint diff.

### Exact Source Location (React 19)
```http
POST /api/source-location
Authorization: Bearer <token>
Content-Type: application/json

{ "url": "http://localhost:5173/src/components/Hero.tsx?t=1729", "line": 30, "column": 9 }
```
Maps a position in a served module (from React 19's element creation stack) back through the dev server's source map to the original file: `{ "file": "src/components/Hero.tsx", "line": 54, "column": 9 }`, or `null` for dependencies and unknown modules.

### Component Source Slice
```http
POST /api/source
Authorization: Bearer <token>
Content-Type: application/json

{
  "file": "src/Navbar.tsx",
  "lineStart": 10,
  "lineEnd": 30
}
```
Response: `200 OK`
```json
{
  "file": "src/Navbar.tsx",
  "lineStart": 10,
  "lineEnd": 30,
  "totalLines": 85,
  "source": "..."
}
```

### Deprecated Compatibility Aliases
- `POST /api/agent/send`: Legacy task dispatch endpoint. Internally creates a task in the TaskStore.
- `GET /api/agent/latest`: Returns the newest queued task and marks it delivered.

---

## 4. WebSocket API

Connect to:
```
ws://127.0.0.1:<port>?token=<token>
```

### Server → Client Events

- **`tasks.snapshot`**: Sent immediately upon connection with the current queue state.
  ```json
  { "type": "tasks.snapshot", "data": [ ... ] }
  ```
- **`task.created`**: Broadcast when a new task is enqueued.
  ```json
  { "type": "task.created", "data": { ...task } }
  ```
- **`task.updated`**: Broadcast whenever a task changes status (`delivered`, `in_progress`, `done`, `failed`, `cancelled`, `expired`, `superseded`).
  ```json
  { "type": "task.updated", "data": { ...task } }
  ```
- **`task.removed`**: Broadcast when tasks leave the list (removed, sent again, or a week old).
  ```json
  { "type": "task.removed", "data": { "ids": ["task_…"] } }
  ```
- **`task.undone`**: Broadcast after Undo, with `{ id, restored, removed, errors }`.
- **`presence.updated`**: Broadcast when connected agents register, say goodbye, or expire after 25s of inactivity.
  ```json
  { "type": "presence.updated", "data": { "agents": [ ... ], "connected": true } }
  ```
- **`agent-task-dispatched`**: Emitted alongside `task.created` for backwards compatibility with v0.1 overlays.
- **`source-updated` / `source-reverted`**: Emitted when disk source changes or undo operations occur.
