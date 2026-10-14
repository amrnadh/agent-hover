# Security Policy and Localhost Threat Model

## Overview

Agent Hover runs a localhost HTTP/WebSocket bridge server during development to enable communication between your running web application (browser overlay) and AI coding agents (via the Model Context Protocol or CLI).

Because the bridge server runs on your local machine with access to your project workspace, security is designed with defense-in-depth to protect against malicious web pages, unauthorized local processes, and path/command injection attacks.

---

## Localhost Threat Model

### 1. Capabilities of the Bridge Server

During an active development session, the Agent Hover bridge server has permission to:
- Read source code and component context within the active project root.
- Launch your configured code editor (VS Code, Cursor, Windsurf, Antigravity, etc.) to a specific file and line.
- Apply targeted source edits within the project workspace, and restore files from a per-task git checkpoint when you press Undo (read-only git plumbing plus per-file writes; never `reset`, `clean` or `checkout`).
- Capture, store, and serve component screenshots in the local `.agent-hover/screenshots/` directory.
- Relay inspection tasks and component context between the browser overlay and connected AI agents.

The bridge server does **not**:
- Execute arbitrary shell commands.
- Send telemetry, or send anything about your project anywhere. The only outbound request is an update check: one `GET https://registry.npmjs.org/@agent-hover%2Fvite/latest` at most once a day (cached in the OS temp folder). It carries no project data and is skipped in CI or when `AGENT_HOVER_NO_UPDATE_CHECK=1` is set.
- Read or modify files outside the project root directory.

---

### 2. Threats and Defenses

| Threat Vector | Attack Scenario | Defense & Mitigation |
|---|---|---|
| **Malicious Web Page (Drive-by CSRF / CORS)** | A malicious website opened in your browser attempts to query `http://localhost:9850/api/save-source` or read your source code. | **Strict Origin Allowlist & CORS**: Only requests from the exact dev server origin (e.g. `http://localhost:5173`) are allowed. Wildcards (`*`) are never used. Requests with invalid or untrusted origins are immediately rejected with `403 Forbidden`. |
| **DNS Rebinding** | An external attacker maps `attacker.com` to `127.0.0.1` and bypasses browser same-origin policies. | **Strict Host Header Validation**: The bridge verifies that incoming `Host` headers strictly equal `127.0.0.1:<port>` or `localhost:<port>`. Spoofed or rebound host headers return `403 Forbidden`. |
| **Unauthenticated Local Access** | An unauthorized local process attempts to read or mutate project files through the bridge. | **Cryptographic Session Token**: Each development session generates a cryptographically random 32-byte bearer token saved in `.agent-hover/session.json` (file mode `0600`). Requests must provide `Authorization: Bearer <token>` or token parameter on WebSocket upgrade. |
| **Command Injection (F-01)** | Hostile input passed to the IDE opener attempts to execute shell commands (e.g. `file; rm -rf /`). | **No-Shell Process Spawning**: Editor launching uses `execFile` with argument arrays directly invoking verified editor binaries without an intermediate shell. Line numbers and column numbers are validated as positive integers. |
| **Path Traversal & Symlink Escape (F-08)** | Path traversal sequences (`../../etc/passwd`) or symlinks targeting outside the project root attempt to read or overwrite sensitive system files. | **Strict Path Confinement**: Every path is normalized and validated against `projectRoot`. Directory traversal (`../`), absolute paths outside root, restricted directories (`node_modules`, `.git`), hidden files (e.g. `.env`), and symlink escapes targeting outside the root are rejected with `403 Forbidden`. File edit sizes are capped at 5 MB. |
| **Replacement Token Corruption (F-03)** | Replacement text containing `$1`, `$&`, `$$` in user input corrupts source code. | **Function-Form AST Replacements**: Replacements use function callbacks `String.prototype.replace(pattern, () => newText)` and direct string slicing, preventing unintended replacement token substitution. |

---

### 3. File Permissions and Data Storage

- `.agent-hover/session.json`: Contains the active session port and token. Created with restricted permissions (`0600`, readable only by the current user).
- `.agent-hover/screenshots/`: Stores captured component screenshots locally.
- `.agent-hover/tasks.json`: Stores pending and completed agent tasks locally.
- All files in `.agent-hover/` should remain in `.gitignore`.

---

## Reporting a Vulnerability

Please report security issues privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (https://github.com/amrnadh/agent-hover/security/advisories/new). Only the maintainers can see the report.

- Include the affected package and version, steps to reproduce, and what an attacker could do.
- You will get an answer within a few days. Fixes are released as a patch version and credited in the advisory unless you prefer otherwise.
- Please do not open a public issue or disclose the problem until a fix is released.
