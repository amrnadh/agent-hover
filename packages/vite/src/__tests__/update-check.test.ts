import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkForUpdate, isNewer, packageVersion } from '../update-check.js';

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
    expect(await checkForUpdate('0.2.0', { cacheFile, fetchImpl, env })).toEqual({ current: '0.2.0', latest: '0.3.0' });
    expect(await checkForUpdate('0.2.0', { cacheFile, fetchImpl, env })).toEqual({ current: '0.2.0', latest: '0.3.0' });
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
    expect(never).not.toHaveBeenCalled();
  });

  it('reads the version from package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    expect(packageVersion()).toBe(pkg.version);
  });
});
