import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { sniffPlaceMime, stageAsset, sweepAssets } from '../place-assets.js';
import { BridgeServer } from '../bridge-server.js';

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);

describe('sniffPlaceMime', () => {
  it('recognises the allowed images and videos by their bytes', () => {
    expect(sniffPlaceMime(PNG)).toBe('image/png');
    expect(sniffPlaceMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffPlaceMime(text('GIF89a....'))).toBe('image/gif');
    expect(sniffPlaceMime(text('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffPlaceMime(text('\0\0\0\x18ftypmp42'))).toBe('video/mp4');
    expect(sniffPlaceMime(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f))).toBe('video/webm');
  });

  it('recognises SVG after a declaration, comments or a doctype', () => {
    expect(sniffPlaceMime(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('image/svg+xml');
    expect(sniffPlaceMime(text('﻿<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg>\n<svg viewBox="0 0 1 1"></svg>'))).toBe(
      'image/svg+xml'
    );
  });

  it('rejects anything else, whatever its name says', () => {
    expect(sniffPlaceMime(text('<!doctype html><html><script>alert(1)</script>'))).toBeNull();
    expect(sniffPlaceMime(text('<svgx>'))).toBeNull();
    expect(sniffPlaceMime(text('%PDF-1.7'))).toBeNull();
    expect(sniffPlaceMime(new Uint8Array())).toBeNull();
  });
});

describe('staging and sweeping', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-place-'));
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes the file under .agent-hover/place with the extension of its real type', async () => {
    const a = await stageAsset(root, PNG);
    expect(a.path).toMatch(/^\.agent-hover\/place\/[0-9a-f]{8}\.png$/);
    expect(a.mime).toBe('image/png');
    expect(a.bytes).toBe(PNG.length);
    expect(Buffer.compare(await fs.readFile(path.join(root, a.path)), Buffer.from(PNG))).toBe(0);
  });

  it('refuses unsupported files with 415', async () => {
    await expect(stageAsset(root, text('<html></html>'))).rejects.toMatchObject({ status: 415 });
  });

  it('removes old assets no task uses, keeps used and recent ones', async () => {
    const used = await stageAsset(root, PNG);
    const old = await stageAsset(root, PNG);
    const fresh = await stageAsset(root, PNG);
    const now = Date.now() + 2 * 60 * 60 * 1000;
    await fs.utimes(path.join(root, fresh.path), new Date(now), new Date(now));
    const removed = await sweepAssets(root, new Set([used.path]), now);
    expect(removed).toEqual([old.path]);
    await expect(fs.stat(path.join(root, used.path))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, fresh.path))).resolves.toBeTruthy();
  });
});

describe('POST /api/place/assets', () => {
  let root: string;
  let server: BridgeServer;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-place-route-'));
  });
  afterEach(async () => {
    await server?.stop();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('stages an upload, reports the public folder, and needs the token', async () => {
    server = new BridgeServer(root, 41000 + Math.floor(Math.random() * 2000), { publicDir: path.join(root, 'public') });
    const port = await server.start();
    const url = `http://127.0.0.1:${port}/api/place/assets`;

    const noAuth = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: PNG });
    expect(noAuth.status).toBe(401);

    const ok = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${server.getToken()}` },
      body: PNG,
    });
    expect(ok.status).toBe(200);
    const asset = await ok.json();
    expect(asset.path).toMatch(/^\.agent-hover\/place\/.+\.png$/);
    expect(asset.publicDir).toBe('public');

    const bad = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${server.getToken()}` },
      body: text('<html>not an image</html>'),
    });
    expect(bad.status).toBe(415);

    const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
    expect(health.publicDir).toBe('public');
  });
});
