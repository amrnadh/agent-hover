import type { NextConfig } from 'next';
import { withAgentHover } from '@agent-hover/next';

const nextConfig: NextConfig = {
  // Next's own badge would sit in the corner the demo's screenshots and e2e checks expect empty.
  devIndicators: false,
  // No AGENTS.md in the demo: the repository's own agent notes apply.
  agentRules: false,
  // e2e copies (scripts/e2e-isolated.mjs) are git repositories of their own inside this one, which hides the
  // repository's lockfile and node_modules from Turbopack; it passes the repository root here.
  ...(process.env.AH_TURBOPACK_ROOT ? { turbopack: { root: process.env.AH_TURBOPACK_ROOT } } : {}),
};

export default withAgentHover(nextConfig);
