// Loaded by next.config (CommonJS or ESM, sometimes in two processes): no runtime imports, nothing started here.
// The bridge starts from instrumentation.ts (register.ts), which runs once, in the server process.

/**
 * The parts of NextConfig this file reads or sets (Next's own type is not imported, so any version works). No index
 * signature: Next's `NextConfig` interface must be assignable to it.
 */
export interface NextConfigLike {
  serverExternalPackages?: string[];
  distDir?: string;
}

type ConfigFunction<C> = (phase: string, context: any) => C | Promise<C>;

/**
 * Packages the dev server must load from node_modules instead of bundling: the bridge (an Express and WebSocket
 * server). `@agent-hover/next` itself is bundled, so `<AgentHover />` uses your app's React and `next/script`.
 */
export const EXTERNAL_PACKAGES = ['@agent-hover/bridge'];

function addAgentHover<C extends NextConfigLike>(config: C): C {
  // Only `next dev`: a production build stays exactly as it was (and needs none of this installed).
  if (process.env.NODE_ENV !== 'development') return config;
  // The source maps live in distDir; register() runs in this same process and reads it from here.
  if (typeof config.distDir === 'string' && config.distDir) process.env.AGENT_HOVER_NEXT_DIST_DIR = config.distDir;
  const external = config.serverExternalPackages ?? [];
  return {
    ...config,
    serverExternalPackages: [...external, ...EXTERNAL_PACKAGES.filter((p) => !external.includes(p))],
  };
}

/**
 * Adds Agent Hover to your Next.js config during `next dev`. It only lets the dev server load Agent Hover from
 * node_modules; `instrumentation.ts` starts it and `<AgentHover />` in your root layout shows it.
 *
 *   // next.config.ts
 *   import { withAgentHover } from '@agent-hover/next';
 *   export default withAgentHover({ ...your config });
 */
export function withAgentHover<C extends NextConfigLike>(config: C): C;
export function withAgentHover<C extends NextConfigLike>(config: ConfigFunction<C>): ConfigFunction<C>;
export function withAgentHover<C extends NextConfigLike>(config: C | ConfigFunction<C> = {} as C): C | ConfigFunction<C> {
  if (typeof config === 'function') {
    return async (phase: string, context: any) => addAgentHover(await config(phase, context));
  }
  return addAgentHover(config);
}

export default withAgentHover;
