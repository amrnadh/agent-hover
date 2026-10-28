import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkForUpdate, formatUpdateNotice, isNewer, packageVersion, registryUrl, updateCommand } from '../update-check.js';

describe('update check', () => {
  const cacheFile = path.join(os.tmpdir(), `ah-update-${process.pid}-${Date.now()}.json`);
  const env = {};
  const registry = (version: string) => vi.fn(async () => new Response(JSON.stringify({ version }), { status: 200 })) as unknown as typeof fetch;

  afterEach(() => fs.rmSync(cacheFile, { force: true }));

  it('compares stable versions and never offers pre-releases', () => {
    expect(isNewer('0.2.1', '0.2.0')).toBe(true);
    expect(isNewer('0.10.0', '0.9.9')).toBe(true);
    expect(isNewer('0.2.0', '0.2.0')).toBe(false);
    expect(isNewer('0.1.9', '0.2.0')).toBe(false);
    expect(isNewer('0.3.0-beta.1', '0.2.0')).toBe(false);
    expect(isNewer('0.2.0', '0.2.0-beta.1')).toBe(true);
    expect(isNewer('garbage', '0.2.0')).toBe(false);
  });

  it('reports a newer release and caches the answer for a day', async () => {
    const fetchImpl = registry('0.3.0');
    const found = { current: '0.2.0', latest: '0.3.0', releaseUrl: 'https://github.com/amrnadh/agent-hover/releases/tag/v0.3.0' };
    expect(await checkForUpdate('0.2.0', { cacheFile, fetchImpl, env })).toMatchObject(found);
    expect(await checkForUpdate('0.2.0', { cacheFile, fetchImpl, env })).toMatchObject(found);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await checkForUpdate('0.2.0', { cacheFile, fetchImpl, env, now: Date.now() + 25 * 60 * 60 * 1000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('says nothing when up to date, offline, or turned off', async () => {
    expect(await checkForUpdate('0.3.0', { cacheFile, fetchImpl: registry('0.3.0'), env })).toBeNull();
    const offline = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await checkForUpdate('0.2.0', { cacheFile: cacheFile + '.x', fetchImpl: offline, env })).toBeNull();
    const never = registry('9.0.0');
    expect(await checkForUpdate('0.2.0', { cacheFile, fetchImpl: never, env: { AGENT_HOVER_NO_UPDATE_CHECK: '1' } })).toBeNull();
    expect(await checkForUpdate('0.2.0', { cacheFile, fetchImpl: never, env: { CI: 'true' } })).toBeNull();
    expect(await checkForUpdate('0.2.0', { cacheFile, fetchImpl: never, env: { NO_UPDATE_NOTIFIER: '1' } })).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });

  it('reads the version from package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    expect(packageVersion()).toBe(pkg.version);
  });

  it('asks the registry npm is set to use, and gives the command for the project\'s package manager', async () => {
    expect(registryUrl({})).toBe('https://registry.npmjs.org/');
    expect(registryUrl({ npm_config_registry: 'https://npm.example.com' })).toBe('https://npm.example.com/');
    expect(registryUrl({ npm_config_registry: 'https://npm.example.com/', 'npm_config_@agent-hover:registry': 'https://scoped.example.com/' })).toBe('https://scoped.example.com/');
    const fetchImpl = registry('0.3.0');
    await checkForUpdate('0.2.0', { cacheFile, fetchImpl, env: { npm_config_registry: 'https://npm.example.com/' } });
    expect((fetchImpl as any).mock.calls[0][0]).toBe('https://npm.example.com/@agent-hover%2Fvite/latest');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-pm-'));
    const app = path.join(root, 'apps', 'web');
    fs.mkdirSync(app, { recursive: true });
    expect(updateCommand(app)).toBe('npm i -D @agent-hover/vite@latest');
    fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), '');
    expect(updateCommand(app)).toBe('pnpm add -D @agent-hover/vite@latest'); // a monorepo's lockfile at the root
    fs.writeFileSync(path.join(app, 'yarn.lock'), '');
    expect(updateCommand(app)).toBe('yarn add -D @agent-hover/vite@latest');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('prints a box in the terminal with the versions, the command and the release notes', () => {
    const box = formatUpdateNotice({ current: '0.2.0', latest: '0.2.1', command: 'pnpm add -D @agent-hover/vite@latest', releaseUrl: 'https://github.com/amrnadh/agent-hover/releases/tag/v0.2.1' });
    const lines = box.split('\n').filter((l) => l.trim());
    expect(lines[0].trim()).toMatch(/^╭─+╮$/);
    expect(box).toContain('Agent Hover update available  0.2.0 → 0.2.1');
    expect(box).toContain('Run pnpm add -D @agent-hover/vite@latest');
    expect(box).toContain("What's new: https://github.com/amrnadh/agent-hover/releases/tag/v0.2.1");
    // Every row the same width, so the right edge lines up.
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });
});
