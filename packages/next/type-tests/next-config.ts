// Type test (npm run typecheck): withAgentHover takes and returns Next's own config types, as users write them.
import type { NextConfig } from 'next';
import { withAgentHover } from '../src/config.js';

const config: NextConfig = { reactStrictMode: true, images: { remotePatterns: [] } };
const wrapped: NextConfig = withAgentHover(config);

const fn = async (phase: string): Promise<NextConfig> => ({ distDir: phase });
const wrappedFn: (phase: string, context: any) => Promise<NextConfig> | NextConfig = withAgentHover(fn);

const literal: NextConfig = withAgentHover({ devIndicators: false, serverExternalPackages: ['sharp'] } satisfies NextConfig);

export { wrapped, wrappedFn, literal };
