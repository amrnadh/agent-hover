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

/** Default port for the Agent Hover bridge server */
const DEFAULT_BRIDGE_PORT = 9850;

/**
 * Resolves the bridge server port from environment variable or falls back to default.
 */
function getBridgePort(): number {
  const envPort = process.env.COMPONENT_POINTER_PORT;
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed;
    }
  }
  return DEFAULT_BRIDGE_PORT;
}

const bridgePort = getBridgePort();
const bridgeBaseUrl = `http://localhost:${bridgePort}`;

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
  if (isConnectionError(error)) {
    return {
      content: [
        {
          type: "text" as const,
          text:
            `Error: Could not connect to the Agent Hover bridge server at ${bridgeBaseUrl}.\n\n` +
            `Please make sure your Vite dev server is running with the Agent Hover plugin enabled:\n` +
            `  npm run dev\n\n` +
            `If your dev server is running on a different port, set the COMPONENT_POINTER_PORT environment variable (current: ${bridgePort}).`,
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
  const response = await fetch(`${bridgeBaseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/markdown, text/plain, application/json, */*",
    },
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
  const response = await fetch(`${bridgeBaseUrl}${endpoint}`, {
    method: "GET",
    headers: {
      Accept: "text/markdown, text/plain, application/json, */*",
    },
  });

  return parseBridgeResponse(response);
}

/**
 * Initialize the Agent Hover MCP server instance.
 */
const server = new Server(
  {
    name: "agent-hover",
    version: "0.1.1",
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
        name: "get_latest_agent_task",
        description: "Get the latest component context, instruction, or note sent by the developer from the Agent Hover browser UI using the 'Send to Agent' button.",
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
server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

export { isConnectionError, handleBridgeError, getBridgePort, server };

/**
 * Connect the server to stdio transport and begin listening for JSON-RPC messages.
 */
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Agent Hover MCP server running on stdio (bridge port: ${bridgePort})`
  );
  
  // Send heartbeat to bridge server
  const sendHeartbeat = async () => {
    try {
      await fetch(`${bridgeBaseUrl}/api/mcp/hello`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: process.pid, version: '0.1.1' }),
      });
    } catch (_) {
      // Bridge may not be running yet
    }
  };
  sendHeartbeat();
  setInterval(sendHeartbeat, 15000);
}

// Start the server, logging any unhandled startup errors to stderr
if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    console.error("Fatal error starting Agent Hover MCP server:", error);
    process.exit(1);
  });
}
