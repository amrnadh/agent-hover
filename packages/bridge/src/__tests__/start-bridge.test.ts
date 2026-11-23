import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { currentBridge, overlayScripts, startBridge, stopBridge } from '../index.js';

describe('startBridge', () => {
  const roots: string[] = [];
  const project = async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-start-'));
    roots.push(root);
    return root;
  };

  afterEach(async () => {
    await stopBridge();
    for (const r of roots.splice(0)) await fs.rm(r, { recursive: true, force: true });
  });

  it('runs one bridge per process: the same project reuses it, a restart replaces it', async () => {
    const root = await project();
    const [a, b] = await Promise.all([startBridge({ root, port: 0 }), startBridge({ root, port: 0 })]);
    expect(a).toBe(b);
    expect(currentBridge()).toBe(a);
    expect(existsSync(path.join(root, '.agent-hover', 'session.json'))).toBe(true);

    const c = await startBridge({ root, port: 0, restart: true });
    expect(c).not.toBe(a);
    expect(currentBridge()).toBe(c);
    const res = await fetch(`http://127.0.0.1:${a.getPort()}/api/health`).catch(() => null);
    expect(res).toBeNull(); // the old one stopped
  });

  it('reports its package and version, and stops with its session file', async () => {
    const root = await project();
    const bridge = await startBridge({ root, port: 0, packageName: '@agent-hover/next', version: '9.9.9', publicDir: path.join(root, 'public') });
    const health = await (await fetch(`http://127.0.0.1:${bridge.getPort()}/api/health`)).json();
    expect(health).toMatchObject({ version: '9.9.9', publicDir: 'public' });
    await stopBridge();
    expect(currentBridge()).toBeNull();
    expect(existsSync(path.join(root, '.agent-hover', 'session.json'))).toBe(false);
  });

  it('uses the location mapper it was given, and skips .next in the source search', async () => {
    const root = await project();
    await fs.mkdir(path.join(root, '.next', 'server'), { recursive: true });
    await fs.writeFile(path.join(root, '.next', 'server', 'Hero.tsx'), 'export function Hero() {}');
    await fs.mkdir(path.join(root, 'app'), { recursive: true });
    await fs.writeFile(path.join(root, 'app', 'Hero.tsx'), 'export function Hero() {}');
    const bridge = await startBridge({
      root,
      port: 0,
      locationMapper: async (url, line) => (url.endsWith('chunk.js') ? { file: 'app/Hero.tsx', line, column: 1 } : null),
    });
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${bridge.getPort()}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${bridge.getToken()}` },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    expect(await post('/api/source-location', { url: 'http://localhost:3000/_next/static/chunks/chunk.js', line: 4, column: 2 })).toEqual({ status: 200, body: { file: 'app/Hero.tsx', line: 4, column: 1 } });
    const resolved = await post('/api/resolve', { componentName: 'Hero' });
    expect(resolved.body).toMatchObject({ resolved: true, file: 'app/Hero.tsx' });
  });
});

describe('overlayScripts', () => {
  it('inlines the overlay with the bridge port, editor and token', () => {
    const { overlay, screenshot } = overlayScripts({ port: 9851, token: 'tok"en', editor: 'cursor' });
    expect(overlay).toContain('__AGENT_HOVER_BOOTSTRAP__(9851, "cursor", "tok\\"en")');
    expect(screenshot.length).toBeGreaterThan(1000);
  });
});
