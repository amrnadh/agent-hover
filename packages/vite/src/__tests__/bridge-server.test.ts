import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import http from 'http';
import { BridgeServer } from '../bridge-server.js';
import type { PinEntry, FreezeEntry, ElementComment } from '@agent-hover/core';

describe('BridgeServer Integration Tests', () => {
  let tempDir: string;
  let server: BridgeServer;
  let activePort: number;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-hover-bridge-test-'));
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('starts on an available port and responds to health check', async () => {
    const testPort = 21000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();

    expect(activePort).toBe(testPort);
    expect(server.getPort()).toBe(testPort);

    const res = await fetch(`http://localhost:${activePort}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.version).toBe('0.1.1');
  });

  it('manages pins via POST, GET, and DELETE /api/pins', async () => {
    const testPort = 23000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();

    const mockPin: PinEntry = {
      id: 'pin-123',
      context: {
        id: 'test-id',
        contextLevel: 'standard',
        component: { name: 'Header', type: 'function', exportType: 'default' },
        source: { file: 'src/Header.tsx', absolutePath: '/project/src/Header.tsx', startLine: 1, endLine: 20 },
        tokens: { minimal: 10, standard: 30, full: 50, current: 30 },
      },
      order: 1,
      addedAt: new Date().toISOString(),
    };

    // Add pin
    const postRes = await fetch(`http://localhost:${activePort}/api/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockPin),
    });
    expect(postRes.status).toBe(200);

    // Get pins
    const getRes = await fetch(`http://localhost:${activePort}/api/pins`);
    expect(getRes.status).toBe(200);
    const pinSet = await getRes.json();
    expect(pinSet.pins.length).toBe(1);
    expect(pinSet.pins[0].id).toBe('pin-123');

    // Remove pin
    const delRes = await fetch(`http://localhost:${activePort}/api/pins`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'pin-123' }),
    });
    expect(delRes.status).toBe(200);

    const afterDelRes = await fetch(`http://localhost:${activePort}/api/pins`);
    const afterDelData = await afterDelRes.json();
    expect(afterDelData.pins.length).toBe(0);
  });

  it('manages freeze entries via POST, GET, and DELETE /api/freeze', async () => {
    const testPort = 25000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();

    const mockFreeze: FreezeEntry = {
      file: 'src/Header.tsx',
      component: 'Header',
      frozenAt: new Date().toISOString(),
      reason: 'Stable header',
    };

    // Add freeze
    const postRes = await fetch(`http://localhost:${activePort}/api/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockFreeze),
    });
    expect(postRes.status).toBe(200);

    // Get freeze entries
    const getRes = await fetch(`http://localhost:${activePort}/api/freeze`);
    const data = await getRes.json();
    expect(data.frozenEntries.length).toBe(1);
    expect(data.frozenEntries[0].component).toBe('Header');

    // Delete freeze
    const delRes = await fetch(`http://localhost:${activePort}/api/freeze`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: 'src/Header.tsx', component: 'Header' }),
    });
    expect(delRes.status).toBe(200);

    const afterDelRes = await fetch(`http://localhost:${activePort}/api/freeze`);
    const afterDelData = await afterDelRes.json();
    expect(afterDelData.frozenEntries.length).toBe(0);
  });

  it('manages comments via POST and GET /api/comments', async () => {
    const testPort = 27000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();

    const mockComment: ElementComment = {
      id: 'comment-1',
      file: 'src/Card.tsx',
      component: 'Card',
      text: 'Change this card border to 2px solid neutral-200',
      createdAt: new Date().toISOString(),
    };

    const postRes = await fetch(`http://localhost:${activePort}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockComment),
    });
    expect(postRes.status).toBe(200);

    const getRes = await fetch(`http://localhost:${activePort}/api/comments`);
    const data = await getRes.json();
    expect(data.comments.length).toBe(1);
    expect(data.comments[0].text).toContain('2px solid');
  });

  it('automatically retries on the next port if target port is occupied (EADDRINUSE)', async () => {
    const collisionPort = 29000 + Math.floor(Math.random() * 2000);

    // Occupy the port with a temporary HTTP server
    const blockerServer = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('occupied');
    });

    await new Promise<void>((resolve) => {
      blockerServer.listen(collisionPort, () => resolve());
    });

    try {
      server = new BridgeServer(tempDir, collisionPort);
      activePort = await server.start();

      // Should have automatically hopped to collisionPort + 1
      expect(activePort).toBe(collisionPort + 1);
      expect(server.getPort()).toBe(collisionPort + 1);

      const res = await fetch(`http://localhost:${activePort}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
    } finally {
      await new Promise<void>((resolve) => blockerServer.close(() => resolve()));
    }
  });
});
