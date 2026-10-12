/**
 * Brand strings for the CLI (D-12).
 * Mirrors `BRAND` in packages/core/src/brand.ts. The CLI stays dependency-free so `npx` is instant,
 * so it cannot import core; `__tests__/brand.test.ts` fails if the two drift apart.
 */
export const BRAND = {
  name: 'agent-hover',
  npmScope: '@agent-hover',
  mcpServerName: 'agent-hover',
  cliName: 'agent-hover',
  dataDir: '.agent-hover',
  envPrefix: 'AGENT_HOVER',
} as const;

export const DISPLAY_NAME = 'Agent Hover';
export const VITE_PACKAGE = `${BRAND.npmScope}/vite`;
export const MCP_PACKAGE = `${BRAND.npmScope}/mcp`;
