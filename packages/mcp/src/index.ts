#!/usr/bin/env node

/**
 * @file index.ts
 * @description Agent Hover MCP (Model Context Protocol) Server.
 * Enables AI coding agents to query rich React component context,
 * inspect pinned component relationships, and generate task-focused context
 * by communicating with the Vite plugin bridge server.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverSession, BRAND } from "@agent-hover/core";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/** Default port for the Agent Hover bridge server */
const DEFAULT_BRIDGE_PORT = 9850;

/**
 * Resolves the bridge server connection:
 * 1. Discover session file (.agent-hover/session.json)
 * 2. Fall back to COMPONENT_POINTER_PORT / AGENT_HOVER_PORT environment variables
 * 3. Fall back to DEFAULT_BRIDGE_PORT (9850)
 */
function resolveBridgeConnection(): { port: number; token?: string } {
  try {
    const session = discoverSession();
    if (session) {
      return { port: session.port, token: session.token };
    }
  } catch {}

  const envPort = process.env.COMPONENT_POINTER_PORT || process.env[`${BRAND.envPrefix}_PORT`];
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      return { port: parsed, token: process.env[`${BRAND.envPrefix}_TOKEN`] };
    }
  }

  return { port: DEFAULT_BRIDGE_PORT };
}

function getBridgePort(): number {
  return resolveBridgeConnection().port;
}

function getBridgeBaseUrl(): string {
  const { port } = resolveBridgeConnection();
  return `http://127.0.0.1:${port}`;
}

/**
 * Helper to determine if an error indicates a connection failure to the bridge server.
 *
 * @param error - The caught error to evaluate
 * @returns true if the error is due to an unreachable bridge server
 */
function isConnectionError(error: unknown): boolean {
  if (!error) return false;
  const message = String((error as { message?: string })?.message || "");
  const causeCode = String((error as { cause?: { code?: string } })?.cause?.code || "");
  const code = String((error as { code?: string })?.code || "");

  return (
    causeCode === "ECONNREFUSED" ||
    code === "ECONNREFUSED" ||
    causeCode === "ENOTFOUND" ||
    code === "ENOTFOUND" ||
    causeCode === "ECONNRESET" ||
    code === "ECONNRESET" ||
    message.includes("fetch failed") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connect ECONNREFUSED")
  );
}

/**
 * Formats bridge connection errors or request errors into user-friendly tool responses.
 *
 * @param error - The encountered error
 * @returns MCP tool result payload with helpful error details
 */
function handleBridgeError(error: unknown) {
  const { port } = resolveBridgeConnection();
  if (isConnectionError(error)) {
    return {
      content: [
        {
          type: "text" as const,
          text:
            `Error: Could not connect to the Agent Hover bridge server at http://127.0.0.1:${port}.\n\n` +
            `Please make sure your Vite dev server is running with the Agent Hover plugin enabled:\n` +
            `  npm run dev\n\n` +
            `If your dev server is running on a different port, ensure .agent-hover/session.json is present or set COMPONENT_POINTER_PORT (current: ${port}).`,
        },
      ],
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [
      {
        type: "text" as const,
        text: `Error from Agent Hover bridge: ${message}`,
      },
    ],
    isError: true,
  };
}

/**
 * Parses the HTTP response from the bridge server.
 * Supports raw markdown text, plain text, and JSON structures containing markdown or context strings.
 *
 * @param response - Fetch Response object from the bridge server
 * @returns Formatted context string
 */
async function parseBridgeResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let serverMessage = "";
    try {
      const parsed = JSON.parse(errorBody);
      serverMessage = parsed.error || parsed.message || "";
    } catch {
      serverMessage = errorBody;
    }
    const details = serverMessage ? `: ${serverMessage}` : "";
    throw new Error(`HTTP ${response.status} ${response.statusText}${details}`);
  }

  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (typeof data === "string") {
      return data;
    }
    if (data && typeof data === "object") {
      // Check for common response field names
      if (typeof data.context === "string") return data.context;
      if (typeof data.markdown === "string") return data.markdown;
      if (typeof data.taskContext === "string") return data.taskContext;
      if (typeof data.result === "string") return data.result;
      if (typeof data.text === "string") return data.text;
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  }

  return await response.text();
}

/**
 * Performs an HTTP POST request to the bridge server.
 *
 * @param endpoint - API endpoint path (e.g., /api/context)
 * @param payload - JSON-serializable body data
 * @returns Parsed response string
 */
async function postToBridge(endpoint: string, payload: unknown): Promise<string> {
  const conn = resolveBridgeConnection();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/markdown, text/plain, application/json, */*",
  };
  if (conn.token) {
    headers["Authorization"] = `Bearer ${conn.token}`;
  }

  const response = await fetch(`http://127.0.0.1:${conn.port}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  return parseBridgeResponse(response);
}

/**
 * Performs an HTTP GET request to the bridge server.
 *
 * @param endpoint - API endpoint path and query string (e.g., /api/pins?level=standard)
 * @returns Parsed response string
 */
async function getFromBridge(endpoint: string): Promise<string> {
  const conn = resolveBridgeConnection();
  const headers: Record<string, string> = {
    Accept: "text/markdown, text/plain, application/json, */*",
  };
  if (conn.token) {
    headers["Authorization"] = `Bearer ${conn.token}`;
  }

  const response = await fetch(`http://127.0.0.1:${conn.port}${endpoint}`, {
    method: "GET",
    headers,
  });

  return parseBridgeResponse(response);
}

/**
 * Performs a request to the bridge and returns the parsed JSON body.
 * Used where the tool composes its own text instead of passing the bridge response through.
 */
async function bridgeJson<T>(method: "GET" | "POST", endpoint: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const conn = resolveBridgeConnection();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (conn.token) headers["Authorization"] = `Bearer ${conn.token}`;
  const response = await fetch(`http://127.0.0.1:${conn.port}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch {}
    throw new Error(`HTTP ${response.status}${message ? `: ${message}` : ""}`);
  }
  return response.json() as Promise<T>;
}

/** Name the connected MCP client reported in `initialize` (e.g. "claude-code"), shown in the overlay. */
function agentClientName(): string {
  return server.getClientVersion()?.name || "mcp-agent";
}

/** Listen mode defaults. 50 s stays under the 60 s tool timeout some clients (e.g. Codex) use by default. */
const LISTEN_DEFAULT_SECONDS = 50;
const LISTEN_MAX_SECONDS = 600;
/** Each bridge long-poll is capped at 30 s; keep a margin below it. */
const LISTEN_POLL_SECONDS = 25;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** This package's version, from its package.json. */
const VERSION: string = (() => {
  try {
    return JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")).version;
  } catch {
    return "0.0.0";
  }
})();

/**
 * Initialize the Agent Hover MCP server instance.
 */
const server = new Server(
  {
    name: "agent-hover",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Register available MCP tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_component_context",
        description:
          "Get rich context for a React component at a specific file and line number. Returns component name, source code, props interface, imports, hooks, parent component, styling info, and token estimate.",
        inputSchema: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description:
                "Relative path to the component file (e.g., src/components/Button.tsx)",
            },
            line: {
              type: "number",
              description: "Line number within the component",
            },
            level: {
              type: "string",
              enum: ["minimal", "standard", "full"],
              description:
                "Context detail level. minimal (~200 tok), standard (~500 tok), full (~1500 tok). Default: standard",
            },
          },
          required: ["file", "line"],
        },
      },
      {
        name: "get_pinned_set",
        description:
          "Get all currently pinned components with their auto-detected relationships (parent/child/sibling) and total token estimate. Pin components first using the browser overlay (Alt+Shift+Click).",
        inputSchema: {
          type: "object",
          properties: {
            level: {
              type: "string",
              enum: ["minimal", "standard", "full"],
              description:
                "Context detail level for each pinned component. Default: standard",
            },
          },
        },
      },
      {
        name: "create_task_context",
        description:
          "Generate optimized context for a coding task based on pinned components. Bundles the relevant source code, relationships, and your instruction into a single context block sized for token efficiency.",
        inputSchema: {
          type: "object",
          properties: {
            instruction: {
              type: "string",
              description:
                "The coding task description (e.g., 'Make these cards use consistent border radius')",
            },
            level: {
              type: "string",
              enum: ["minimal", "standard", "full"],
              description:
                "Context detail level. Default: standard",
            },
          },
          required: ["instruction"],
        },
      },
      {
        name: "get_frozen_components",
        description:
          "Get a list of components that the developer has explicitly frozen. These components MUST NOT be modified by the AI agent.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "capture_screenshot",
        description:
          "Trigger a screenshot capture of a component's rendered bounding box in the browser. Use label 'before' before making changes, and 'after' once HMR has applied your changes. The overlay will automatically scroll the component into view and capture it. Both before and after must be captured before verify_visual_change can return a diff.",
        inputSchema: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description: "Relative path to the component file (e.g., src/components/Button.tsx)",
            },
            component: {
              type: "string",
              description: "Component name (e.g., Button)",
            },
            label: {
              type: "string",
              enum: ["before", "after"],
              description: "Whether this is a 'before' (pre-change) or 'after' (post-change) capture",
            },
          },
          required: ["file", "component", "label"],
        },
      },
      {
        name: "verify_visual_change",
        description:
          "Get the visual diff result after capturing before/after screenshots. Returns the percentage of pixels that changed and a human-readable assessment. Use this to verify your CSS/layout changes actually produced the expected visual result.",
        inputSchema: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description: "Relative path to the component file",
            },
            component: {
              type: "string",
              description: "Component name",
            },
          },
          required: ["file", "component"],
        },
      },
      {
        name: "list_components",
        description: "List all visible React components on the current page with their names, source files, and line numbers. Use this as the first step to understand what components are rendered.",
        inputSchema: {
          type: "object",
          properties: {
            filter: {
              type: "string",
              description: "Optional case-insensitive substring filter for component names",
            },
            limit: {
              type: "number",
              description: "Maximum number of components to return (default: 50)",
            },
            includeLibrary: {
              type: "boolean",
              description: "Include components from node_modules (default: false)",
            },
          },
        },
      },
      {
        name: "list_agent_tasks",
        description:
          "List tasks sent by the developer from the browser. Call this when the user says they sent a task from the browser, or to inspect pending UI instructions. Returned queued tasks are marked as delivered.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "array",
              items: { type: "string" },
              description: "Filter by status (queued, delivered, in_progress, done, failed). Default: ['queued', 'delivered']",
            },
            limit: {
              type: "number",
              description: "Maximum number of tasks to return (default: 50)",
            },
          },
        },
      },
      {
        name: "claim_agent_task",
        description:
          "Claim a task from the delivery queue to start working on it. Returns the task details and rendered prompt context. Transitions task to in_progress.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique ID of the task to claim",
            },
            format: {
              type: "string",
              enum: ["compact", "standard", "deep"],
              description: "Prompt formatting detail level. Default: standard",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "complete_agent_task",
        description:
          "Mark a claimed task as done or failed with a summary of changes and list of modified files.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique ID of the task to complete",
            },
            status: {
              type: "string",
              enum: ["done", "failed"],
              description: "Outcome status of the task. Default: done",
            },
            summary: {
              type: "string",
              description: "Summary of the changes made or reason for failure",
            },
            filesChanged: {
              type: "array",
              items: { type: "string" },
              description: "Files you modified, relative to the project root. Optional: when omitted, Agent Hover lists the files git saw change since you claimed the task.",
            },
            error: {
              type: "string",
              description: "Error details if the task failed",
            },
          },
          required: ["id", "summary"],
        },
      },
      {
        name: "get_component_source",
        description:
          "Get a path-validated source slice of a component file.",
        inputSchema: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description: "Relative path to the component file (e.g. src/Button.tsx)",
            },
            lineStart: {
              type: "number",
              description: "Starting line number (1-based, inclusive)",
            },
            lineEnd: {
              type: "number",
              description: "Ending line number (1-based, inclusive)",
            },
          },
          required: ["file"],
        },
      },
      {
        name: "wait_for_agent_task",
        description:
          "Listen mode: wait until the developer sends a task from the browser, then claim it and return its full instructions. " +
          "Use this when the user asks you to listen or watch for agent-hover tasks. Loop: call wait_for_agent_task, do the task, " +
          "call complete_agent_task with a summary and the files you changed, then call wait_for_agent_task again. " +
          "If nothing arrives before the timeout it returns a short 'no task yet' message; call it again to keep listening, " +
          "or stop if the user has said they are done.",
        inputSchema: {
          type: "object",
          properties: {
            timeoutSeconds: {
              type: "number",
              description: `How long to wait before returning with no task (default ${LISTEN_DEFAULT_SECONDS}, max ${LISTEN_MAX_SECONDS}). Raise it if your client allows long tool calls.`,
            },
            claim: {
              type: "boolean",
              description: "Claim the task immediately so the browser shows it as in progress (default: true).",
            },
            format: {
              type: "string",
              enum: ["compact", "standard", "deep"],
              description: "Prompt detail level. Default: standard",
            },
          },
        },
      },
      {
        name: "get_latest_agent_task",
        description: "Get the latest component context, instruction, or note sent from the browser UI. Deprecated: prefer list_agent_tasks and claim_agent_task for reliable queue delivery.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

/**
 * Handle execution of MCP tools.
 */
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_component_context": {
        const file = args?.file as string | undefined;
        const line = args?.line as number | undefined;
        const level = (args?.level as string | undefined) ?? "standard";

        if (!file || typeof file !== "string") {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: 'file' parameter is required and must be a string.",
              },
            ],
            isError: true,
          };
        }

        if (typeof line !== "number" || isNaN(line)) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: 'line' parameter is required and must be a number.",
              },
            ],
            isError: true,
          };
        }

        const context = await postToBridge("/api/context", {
          file,
          line,
          level,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: context,
            },
          ],
        };
      }

      case "get_pinned_set": {
        const level = (args?.level as string | undefined) ?? "standard";
        const pins = await getFromBridge(`/api/pins?level=${encodeURIComponent(level)}`);

        return {
          content: [
            {
              type: "text" as const,
              text: pins,
            },
          ],
        };
      }

      case "create_task_context": {
        const instruction = args?.instruction as string | undefined;
        const level = (args?.level as string | undefined) ?? "standard";

        if (!instruction || typeof instruction !== "string") {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: 'instruction' parameter is required and must be a string.",
              },
            ],
            isError: true,
          };
        }

        const taskContext = await postToBridge("/api/task", {
          instruction,
          level,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: taskContext,
            },
          ],
        };
      }

      case "get_frozen_components": {
        const result = await postToBridge("/api/freeze", { action: 'list' });
        
        return {
          content: [
            {
              type: "text" as const,
              text: result,
            },
          ],
        };
      }

      case "capture_screenshot": {
        const file = args?.file as string;
        const component = args?.component as string;
        const label = args?.label as string;

        if (!file || !component || !label) {
          return {
            content: [{ type: "text" as const, text: "Error: 'file', 'component', and 'label' parameters are required." }],
            isError: true,
          };
        }

        const result = await postToBridge("/api/screenshot/trigger", { file, component, label });
        return {
          content: [{ type: "text" as const, text: result }],
        };
      }

      case "verify_visual_change": {
        const file = args?.file as string;
        const component = args?.component as string;

        if (!file || !component) {
          return {
            content: [{ type: "text" as const, text: "Error: 'file' and 'component' parameters are required." }],
            isError: true,
          };
        }

        const componentId = `${file}:${component}`;
        const result = await getFromBridge(`/api/screenshot/${encodeURIComponent(componentId)}`);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      }

      case "list_components": {
        const filter = (args?.filter as string | undefined) ?? "";
        const limit = (args?.limit as number | undefined) ?? 50;
        const includeLibrary = (args?.includeLibrary as boolean | undefined) ?? false;
        
        const params = new URLSearchParams();
        if (filter) params.set('filter', filter);
        params.set('limit', String(limit));
        if (includeLibrary) params.set('includeLibrary', 'true');
        
        const result = await getFromBridge(`/api/components?${params.toString()}`);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      }

      case "list_agent_tasks": {
        const status = args?.status as string[] | undefined;
        const limit = args?.limit as number | undefined;
        const params = new URLSearchParams();
        if (status && Array.isArray(status) && status.length > 0) {
          params.set("status", status.join(","));
        } else {
          params.set("status", "queued,delivered");
        }
        if (typeof limit === "number") {
          params.set("limit", String(limit));
        }
        // The agent has now seen these tasks: queued ones become "delivered" in the browser.
        params.set("deliver", "1");
        const result = await getFromBridge(`/api/agent/tasks?${params.toString()}`);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      }

      case "claim_agent_task": {
        const id = args?.id as string | undefined;
        const format = (args?.format as string | undefined) || "standard";
        if (!id || typeof id !== "string") {
          return {
            content: [{ type: "text" as const, text: "Error: 'id' parameter is required." }],
            isError: true,
          };
        }
        await postToBridge(`/api/agent/tasks/${encodeURIComponent(id)}/claim`, { client: agentClientName() });
        const taskWithPrompt = await getFromBridge(
          `/api/agent/tasks/${encodeURIComponent(id)}?format=${encodeURIComponent(format)}`
        );
        return {
          content: [{ type: "text" as const, text: taskWithPrompt }],
        };
      }

      case "complete_agent_task": {
        const id = args?.id as string | undefined;
        const status = (args?.status as string | undefined) || "done";
        const summary = args?.summary as string | undefined;
        const filesChanged = args?.filesChanged as string[] | undefined;
        const error = args?.error as string | undefined;
        if (!id || !summary) {
          return {
            content: [{ type: "text" as const, text: "Error: 'id' and 'summary' parameters are required." }],
            isError: true,
          };
        }
        const result = await postToBridge(`/api/agent/tasks/${encodeURIComponent(id)}/complete`, {
          status,
          summary,
          filesChanged,
          error,
        });
        return {
          content: [{ type: "text" as const, text: result }],
        };
      }

      case "get_component_source": {
        const file = args?.file as string | undefined;
        const lineStart = args?.lineStart as number | undefined;
        const lineEnd = args?.lineEnd as number | undefined;
        if (!file || typeof file !== "string") {
          return {
            content: [{ type: "text" as const, text: "Error: 'file' parameter is required." }],
            isError: true,
          };
        }
        const result = await postToBridge("/api/source", { file, lineStart, lineEnd });
        return {
          content: [{ type: "text" as const, text: result }],
        };
      }

      case "wait_for_agent_task": {
        const requested = typeof args?.timeoutSeconds === "number" ? args.timeoutSeconds : LISTEN_DEFAULT_SECONDS;
        const timeoutSeconds = Math.min(Math.max(Math.round(requested), 1), LISTEN_MAX_SECONDS);
        const claim = args?.claim !== false;
        const format = (args?.format as string | undefined) || "standard";
        const signal = extra?.signal;
        const progressToken = request.params._meta?.progressToken;
        const deadline = Date.now() + timeoutSeconds * 1000;
        let bridgeError: unknown = null;

        while (Date.now() < deadline && !signal?.aborted) {
          const remaining = Math.ceil((deadline - Date.now()) / 1000);
          try {
            const { task } = await bridgeJson<{ task: { id: string; instruction?: string } | null }>(
              "GET",
              `/api/agent/tasks/next?wait=${Math.min(LISTEN_POLL_SECONDS, remaining)}`,
              undefined,
              signal,
            );
            bridgeError = null;
            if (task) {
              const id = encodeURIComponent(task.id);
              if (claim) await bridgeJson("POST", `/api/agent/tasks/${id}/claim`, { client: agentClientName() });
              const { prompt } = await bridgeJson<{ prompt: string }>("GET", `/api/agent/tasks/${id}?format=${encodeURIComponent(format)}`);
              const next = claim
                ? `When finished, call complete_agent_task with id "${task.id}", a one-paragraph summary, and filesChanged. Then call wait_for_agent_task again to keep listening.`
                : `Call claim_agent_task with id "${task.id}" to start it.`;
              return {
                content: [{ type: "text" as const, text: `${claim ? "Claimed" : "Received"} task ${task.id} from the browser.\n\n${prompt}\n\n---\n${next}` }],
              };
            }
          } catch (error) {
            if (signal?.aborted) break;
            if (!isConnectionError(error)) throw error;
            // Dev server not running (yet): keep listening and retry shortly.
            bridgeError = error;
            await sleep(Math.min(3000, Math.max(deadline - Date.now(), 0)));
          }
          if (progressToken !== undefined && extra?.sendNotification) {
            await extra
              .sendNotification({
                method: "notifications/progress",
                params: { progressToken, progress: timeoutSeconds - Math.ceil((deadline - Date.now()) / 1000), total: timeoutSeconds },
              })
              .catch(() => {});
          }
        }

        if (bridgeError) return handleBridgeError(bridgeError);
        return {
          content: [{ type: "text" as const, text: `No task yet (listened ${timeoutSeconds}s). Call wait_for_agent_task again to keep listening.` }],
        };
      }

      case "get_latest_agent_task": {
        const result = await getFromBridge("/api/agent/latest");
        return {
          content: [{ type: "text" as const, text: result }],
        };
      }

      default:
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return handleBridgeError(error);
  }
});

export { isConnectionError, handleBridgeError, getBridgePort, parseBridgeResponse, server, resolveBridgeConnection };

/**
 * Connect the server to stdio transport and begin listening for JSON-RPC messages.
 */
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const conn = resolveBridgeConnection();
  console.error(
    `Agent Hover MCP server running on stdio (bridge port: ${conn.port})`
  );
  
  // Send presence heartbeat to bridge server every 10s (P1-05 / §7.6)
  const sendHeartbeat = async () => {
    try {
      const active = resolveBridgeConnection();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (active.token) headers['Authorization'] = `Bearer ${active.token}`;
      const presence = await fetch(`http://127.0.0.1:${active.port}/api/agent/presence`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ client: agentClientName(), version: VERSION }),
      });
      // Legacy heartbeat only for bridges older than presence (P1-06); sending both would list the agent twice.
      if (presence.status === 404) {
        await fetch(`http://127.0.0.1:${active.port}/api/mcp/hello`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ pid: process.pid, version: VERSION }),
        });
      }
    } catch (_) {
      // Bridge dev server may not be active yet
    }
  };
  // Register presence once the client has identified itself (initialize), so the browser shows its real name.
  server.oninitialized = () => {
    sendHeartbeat();
  };
  const heartbeatTimer = setInterval(() => {
    if (server.getClientVersion()) sendHeartbeat();
  }, 10000);
  heartbeatTimer.unref();
}

// Start the server, logging any unhandled startup errors to stderr
if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    console.error("Fatal error starting Agent Hover MCP server:", error);
    process.exit(1);
  });
}
