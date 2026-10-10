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
  "version": "0.1.1",
  "port": 9850
}
```

### Agent Presence Heartbeat
```http
POST /api/agent/presence
Authorization: Bearer <token>
Content-Type: application/json

{
  "client": "claude-code",
  "version": "1.0.0"
}
```
Response:
```json
{
  "ok": true,
  "registered": true
}
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
      "lastSeen": "2026-10-05T01:10:00.000Z"
    }
  ],
  "connected": true
}
```

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
  }
}
```
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
With `deliver=1` (sent by the MCP `list_agent_tasks` tool), returned `queued` tasks move to `delivered` so the overlay can show "Seen by {agent}". Without it the call never changes task state, which is what the overlay uses.

### Wait for Next Task (listen mode)
```http
GET /api/agent/tasks/next?wait=25
Authorization: Bearer <token>
```
Long-poll used by the MCP `wait_for_agent_task` tool. Returns the **oldest** `queued` task at once if there is one; otherwise holds the request until a task is created or `wait` seconds pass (0–30, default 0). The returned task is marked `delivered`, so each task is handed out once. If the client disconnects while waiting, nothing is delivered.

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
- **`presence.updated`**: Broadcast when connected agents register or expire after 25s of inactivity.
  ```json
  { "type": "presence.updated", "data": { "agents": [ ... ], "connected": true } }
  ```
- **`agent-task-dispatched`**: Emitted alongside `task.created` for backwards compatibility with v0.1 overlays.
- **`source-updated` / `source-reverted`**: Emitted when disk source changes or undo operations occur.
