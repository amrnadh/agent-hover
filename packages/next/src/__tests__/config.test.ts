import { describe, it, expect, afterEach, vi } from 'vitest';
import { withAgentHover } from '../config.js';
import { getHandle, pageScripts, setHandle } from '../shared.js';

describe('withAgentHover', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.AGENT_HOVER_NEXT_DIST_DIR;
  });

  it('lets next dev load the bridge from node_modules, keeping your own external packages', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const config = withAgentHover({ reactStrictMode: true, serverExternalPackages: ['sharp'] });
    expect(config.reactStrictMode).toBe(true);
    expect(config.serverExternalPackages).toEqual(['sharp', '@agent-hover/bridge']);
    expect(withAgentHover(config).serverExternalPackages).toEqual(['sharp', '@agent-hover/bridge']);
  });

  it('leaves a production build untouched', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const config = { distDir: 'out' };
    expect(withAgentHover(config)).toBe(config);
    expect(process.env.AGENT_HOVER_NEXT_DIST_DIR).toBeUndefined();
  });

  it('wraps config functions and passes distDir on to the bridge', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const wrapped = withAgentHover(async (phase: string) => ({ distDir: 'build', env: { phase } }));
    const config = await wrapped('phase-development-server', {});
    expect(config).toMatchObject({ distDir: 'build', env: { phase: 'phase-development-server' }, serverExternalPackages: ['@agent-hover/bridge'] });
    expect(process.env.AGENT_HOVER_NEXT_DIST_DIR).toBe('build');
  });
});

describe('<AgentHover /> scripts', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setHandle(null);
  });

  it('come from the bridge register() started, only in next dev', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pageScripts()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    setHandle({ scripts: () => ({ screenshot: 's', overlay: 'o' }) });
    expect(getHandle()).not.toBeNull();
    expect(pageScripts()).toEqual({ screenshot: 's', overlay: 'o' });
    vi.stubEnv('NODE_ENV', 'production');
    expect(pageScripts()).toBeNull();
    warn.mockRestore();
  });
});
