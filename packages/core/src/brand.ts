/**
 * Centralized brand configuration (D-12).
 * All user-facing strings, config snippets, and data directories derive from here.
 */
export const BRAND = {
  name: 'agent-hover',
  npmScope: '@agent-hover',
  mcpServerName: 'agent-hover',
  cliName: 'agent-hover',
  dataDir: '.agent-hover',
  envPrefix: 'AGENT_HOVER',
} as const;

export type BrandConfig = typeof BRAND;
