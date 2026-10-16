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
    expect(data.version).toBe(JSON.parse(await fs.readFile(path.resolve(__dirname, '../../package.json'), 'utf8')).version);
  });

  it('manages pins via POST, GET, and DELETE /api/pins', async () => {
    const testPort = 23000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();

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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(mockPin),
    });
    expect(postRes.status).toBe(200);

    // Get pins
    const getRes = await fetch(`http://localhost:${activePort}/api/pins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const pinSet = await getRes.json();
    expect(pinSet.pins.length).toBe(1);
    expect(pinSet.pins[0].id).toBe('pin-123');

    // Remove pin
    const delRes = await fetch(`http://localhost:${activePort}/api/pins`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: 'pin-123' }),
    });
    expect(delRes.status).toBe(200);

    const afterDelRes = await fetch(`http://localhost:${activePort}/api/pins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const afterDelData = await afterDelRes.json();
    expect(afterDelData.pins.length).toBe(0);
  });

  it('manages freeze entries via POST, GET, and DELETE /api/freeze', async () => {
    const testPort = 25000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();

    const mockFreeze: FreezeEntry = {
      file: 'src/Header.tsx',
      component: 'Header',
      frozenAt: new Date().toISOString(),
      reason: 'Stable header',
    };

    // Add freeze
    const postRes = await fetch(`http://localhost:${activePort}/api/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(mockFreeze),
    });
    expect(postRes.status).toBe(200);

    // Get freeze entries
    const getRes = await fetch(`http://localhost:${activePort}/api/freeze`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await getRes.json();
    expect(data.frozenEntries.length).toBe(1);
    expect(data.frozenEntries[0].component).toBe('Header');

    // Delete freeze
    const delRes = await fetch(`http://localhost:${activePort}/api/freeze`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file: 'src/Header.tsx', component: 'Header' }),
    });
    expect(delRes.status).toBe(200);

    const afterDelRes = await fetch(`http://localhost:${activePort}/api/freeze`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const afterDelData = await afterDelRes.json();
    expect(afterDelData.frozenEntries.length).toBe(0);
  });

  it('manages comments via POST and GET /api/comments', async () => {
    const testPort = 27000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();

    const mockComment: ElementComment = {
      id: 'comment-1',
      file: 'src/Card.tsx',
      component: 'Card',
      text: 'Change this card border to 2px solid neutral-200',
      createdAt: new Date().toISOString(),
    };

    const postRes = await fetch(`http://localhost:${activePort}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(mockComment),
    });
    expect(postRes.status).toBe(200);

    const getRes = await fetch(`http://localhost:${activePort}/api/comments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
      blockerServer.listen(collisionPort, '127.0.0.1', () => resolve());
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

  it('saves screenshot to disk and allows downloading it', async () => {
    const testPort = 31000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();

    // 1x1 transparent PNG in base64
    const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=';

    const saveRes = await fetch(`http://localhost:${activePort}/api/screenshot/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dataUrl: sampleDataUrl, filename: 'test_card' }),
    });
    expect(saveRes.status).toBe(200);
    const saveData = await saveRes.json();
    expect(saveData.success).toBe(true);
    expect(saveData.path).toContain('.agent-hover/screenshots/test_card_');
    expect(saveData.filename).toBeDefined();

    // Verify file actually exists on disk
    const fsMod = await import('fs/promises');
    const pathMod = await import('path');
    const stat = await fsMod.stat(pathMod.join(tempDir, saveData.path));
    expect(stat.size).toBeGreaterThan(0);

    // Verify download endpoint
    const dlRes = await fetch(`http://localhost:${activePort}/api/screenshot/download/${saveData.filename}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dlRes.status).toBe(200);
    const dlBuffer = await dlRes.arrayBuffer();
    expect(dlBuffer.byteLength).toBe(stat.size);
  });

  it('strictly validates Origin and Host headers (F-02 security test)', async () => {
    const testPort = 33000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();

    // 1. Legitimate request from localhost dev server
    const validRes = await fetch(`http://127.0.0.1:${activePort}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(validRes.status).toBe(200);

    // 2. Hostile Origin attempting suffix match (e.g. attacker-localhost.com)
    const hostileOriginRes = await fetch(`http://127.0.0.1:${activePort}/api/health`, {
      headers: { Origin: 'http://attacker-localhost.com' },
    });
    expect(hostileOriginRes.status).toBe(403);

    // 3. Hostile subdomain (e.g. localhost.attacker.com)
    const hostileSubdomainRes = await fetch(`http://127.0.0.1:${activePort}/api/health`, {
      headers: { Origin: 'http://localhost.attacker.com' },
    });
    expect(hostileSubdomainRes.status).toBe(403);

    // 4. Host header spoofing / DNS rebinding attempt via raw http.request
    const rawStatusCode = await new Promise<number>((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: activePort,
        path: '/api/health',
        method: 'GET',
        headers: { host: 'evil-rebound.com:9850' },
      }, (res) => resolve(res.statusCode || 0));
      req.on('error', reject);
      req.end();
    });
    expect(rawStatusCode).toBe(403);
  });

  it('rejects path traversal and restricted path attempts on endpoints (F-08)', async () => {
    const testPort = 35000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();

    // 1. Path traversal in /api/context
    const contextRes = await fetch(`http://127.0.0.1:${activePort}/api/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file: '../../etc/passwd', line: 1 }),
    });
    expect(contextRes.status).toBe(403);

    // 2. Traversal in /api/open-editor
    const editorRes = await fetch(`http://127.0.0.1:${activePort}/api/open-editor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file: '/etc/passwd', line: 1 }),
    });
    expect(editorRes.status).toBe(403);

    // 3. Restricted directory in /api/edit-source
    const editRes = await fetch(`http://127.0.0.1:${activePort}/api/edit-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file: 'node_modules/pkg/index.js', originalText: 'a', newText: 'b' }),
    });
    expect(editRes.status).toBe(403);

    // 4. Hidden file in /api/save-source
    const saveRes = await fetch(`http://127.0.0.1:${activePort}/api/save-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file: '.env', newSource: 'SECRET=none' }),
    });
    expect(saveRes.status).toBe(403);
  });

  it('rejects unauthenticated requests on protected endpoints (P1-02)', async () => {
    const testPort = 37000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();

    // Missing token
    const noTokenRes = await fetch(`http://localhost:${activePort}/api/pins`);
    expect(noTokenRes.status).toBe(401);

    // Invalid token
    const badTokenRes = await fetch(`http://localhost:${activePort}/api/pins`, {
      headers: { Authorization: 'Bearer totally-invalid-token' },
    });
    expect(badTokenRes.status).toBe(401);
  });

  it('creates session file on start and cleans it up on stop (P1-01)', async () => {
    const testPort = 39000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();

    const sessionFilePath = path.join(tempDir, '.agent-hover', 'session.json');
    const sessionRaw = await fs.readFile(sessionFilePath, 'utf-8');
    const session = JSON.parse(sessionRaw);
    expect(session.version).toBe(1);
    expect(session.port).toBe(activePort);
    expect(session.token).toBe(server.getToken());
    expect(session.pid).toBe(process.pid);

    await server.stop();
    const sessionExists = await fs.access(sessionFilePath).then(() => true).catch(() => false);
    expect(sessionExists).toBe(false);
  });

  it('delivers tasks through the task queue endpoints (P1-04)', async () => {
    const testPort = 41000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();

    // 1. Initial tasks list is empty
    const initialRes = await fetch(`http://localhost:${activePort}/api/agent/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(initialRes.status).toBe(200);
    const initialData = await initialRes.json();
    expect(initialData.tasks).toEqual([]);

    // 2. Dispatch a task
    const postTaskRes = await fetch(`http://localhost:${activePort}/api/agent/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: 'component-context',
        instruction: 'Fix the padding on Button',
        target: { component: 'Button', file: 'src/Button.tsx', lineStart: 10 },
      }),
    });
    expect(postTaskRes.status).toBe(201);
    const postData = await postTaskRes.json();
    const createdTask = postData.task;
    expect(createdTask.id).toBeDefined();
    expect(createdTask.status).toBe('queued');
    expect(createdTask.instruction).toBe('Fix the padding on Button');

    // 3. Claim the task
    const claimRes = await fetch(`http://localhost:${activePort}/api/agent/tasks/${createdTask.id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client: 'claude-code' }),
    });
    expect(claimRes.status).toBe(200);
    const claimData = await claimRes.json();
    const claimedTask = claimData.task;
    expect(claimedTask.status).toBe('in_progress');
    expect(claimedTask.claimedBy).toBe('claude-code');

    // 4. Complete the task
    const completeRes = await fetch(`http://localhost:${activePort}/api/agent/tasks/${createdTask.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ summary: 'Added p-4 to Button container' }),
    });
    expect(completeRes.status).toBe(200);
    const completeData = await completeRes.json();
    const completedTask = completeData.task;
    expect(completedTask.status).toBe('done');
    expect(completedTask.result?.summary).toBe('Added p-4 to Button container');
  });

  it('records your review of a finished task: keep, follow-up, and only once it is done', async () => {
    const testPort = 41000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();
    const call = async (method: string, url: string, body?: unknown) => {
      const res = await fetch(`http://localhost:${activePort}/api${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, data: await res.json() };
    };

    const { data: { task } } = await call('POST', '/agent/tasks', { instruction: 'Make it larger', target: { selector: '#cta' } });
    // Not finished yet: nothing to review.
    expect((await call('POST', `/agent/tasks/${task.id}/review`, { action: 'keep' })).status).toBe(409);
    await call('POST', `/agent/tasks/${task.id}/claim`, { client: 'claude-code' });
    await call('POST', `/agent/tasks/${task.id}/complete`, { summary: 'Done', filesChanged: ['src/a.tsx'] });
    expect((await call('POST', `/agent/tasks/${task.id}/review`, { action: 'approve' })).status).toBe(400);

    const kept = await call('POST', `/agent/tasks/${task.id}/review`, { action: 'keep' });
    expect(kept.status).toBe(200);
    expect(kept.data.task.review.state).toBe('kept');
    expect(Date.parse(kept.data.task.review.at)).not.toBeNaN();

    const follow = await call('POST', `/agent/tasks/${task.id}/review`, { action: 'follow-up', followUp: 'task_next' });
    expect(follow.data.task.review).toMatchObject({ state: 'followed-up', followUp: 'task_next' });
    // Saved with the task, so it survives a reload of the page.
    expect((await call('GET', `/agent/tasks/${task.id}`)).data.task.review.state).toBe('followed-up');
    expect((await call('POST', '/agent/tasks/task_missing/review', { action: 'keep' })).status).toBe(404);
  });

  it('groups agent sessions, drops one at once when it says goodbye, and routes tasks sent to one agent', async () => {
    const testPort = 41000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();
    const call = async (method: string, url: string, body?: unknown) => {
      const res = await fetch(`http://localhost:${activePort}/api${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return res.json();
    };

    // Two Claude Code sessions and one Cursor: two agents, Claude Code with 2 sessions.
    await call('POST', '/agent/presence', { client: 'claude-code', instance: 'a' });
    await call('POST', '/agent/presence', { client: 'claude-code', instance: 'b' });
    await call('POST', '/agent/presence', { client: 'cursor', instance: 'c' });
    let { agents } = await call('GET', '/agent/presence');
    expect(agents.map((a: any) => `${a.client}:${a.sessions}`).sort()).toEqual(['claude-code:2', 'cursor:1']);

    // One session closes: the other keeps Claude Code connected. Then Cursor closes.
    expect((await call('DELETE', '/agent/presence', { instance: 'a' })).removed).toBe(true);
    expect((await call('DELETE', '/agent/presence', { instance: 'c' })).removed).toBe(true);
    ({ agents } = await call('GET', '/agent/presence'));
    expect(agents.map((a: any) => `${a.client}:${a.sessions}`)).toEqual(['claude-code:1']);

    // A task sent to Cursor is invisible to Claude Code; a task for any agent goes to whoever asks.
    const forCursor = (await call('POST', '/agent/tasks', { instruction: 'For Cursor', assignee: 'cursor' })).task;
    expect(forCursor.assignee).toBe('cursor');
    expect((await call('GET', '/agent/tasks/next?client=claude-code')).task).toBeNull();
    expect((await call('GET', '/agent/tasks?deliver=1&client=claude-code')).tasks).toEqual([]);
    const forAny = (await call('POST', '/agent/tasks', { instruction: 'For anyone' })).task;
    expect((await call('GET', '/agent/tasks/next?client=claude-code')).task.id).toBe(forAny.id);
    expect((await call('GET', '/agent/tasks/next?client=cursor')).task.id).toBe(forCursor.id);
  });

  it('records agent presence and reports connected agents (P1-06)', async () => {
    const testPort = 43000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const token = server.getToken();

    const presenceRes = await fetch(`http://localhost:${activePort}/api/agent/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client: 'claude-code', version: '1.0.0' }),
    });
    expect(presenceRes.status).toBe(200);
    const presenceData = await presenceRes.json();
    expect(presenceData.registered).toBe(true);

    const getPresenceRes = await fetch(`http://localhost:${activePort}/api/agent/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getPresenceRes.status).toBe(200);
    const presenceList = await getPresenceRes.json();
    expect(presenceList.connected).toBe(true);
    expect(presenceList.agents.length).toBe(1);
    expect(presenceList.agents[0].client).toBe('claude-code');

    // Most recently active first: the overlay's default destination is the agent you used last.
    const hello = (client: string) => fetch(`http://localhost:${activePort}/api/agent/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client }),
    });
    await hello('cursor');
    await new Promise((r) => setTimeout(r, 5));
    await hello('claude-code');
    const ordered = await fetch(`http://localhost:${activePort}/api/agent/presence`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(ordered.agents.map((a: any) => a.client)).toEqual(['claude-code', 'cursor']);
  });
  it('marks listed queued tasks delivered only when an agent asks (?deliver=1)', async () => {
    const testPort = 45000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const auth = { Authorization: `Bearer ${server.getToken()}` };
    const base = `http://localhost:${activePort}/api/agent/tasks`;

    await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ instruction: 'Tighten spacing' }),
    });

    const uiRead = await (await fetch(base, { headers: auth })).json();
    expect(uiRead.tasks[0].status).toBe('queued');

    const agentRead = await (await fetch(`${base}?deliver=1`, { headers: auth })).json();
    expect(agentRead.tasks[0].status).toBe('delivered');
  });

  it('long-polls for the next queued task in listen mode (GET /api/agent/tasks/next)', async () => {
    const testPort = 47000 + Math.floor(Math.random() * 2000);
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const auth = { Authorization: `Bearer ${server.getToken()}` };
    const base = `http://localhost:${activePort}/api/agent/tasks`;
    const create = (instruction: string) =>
      fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ instruction }),
      });

    // Nothing queued and no wait: returns at once.
    const empty = await (await fetch(`${base}/next`, { headers: auth })).json();
    expect(empty).toEqual({ task: null, timedOut: true });

    // A waiting request resolves as soon as a task is created.
    const started = Date.now();
    const pending = fetch(`${base}/next?wait=10`, { headers: auth }).then((r) => r.json());
    await new Promise((r) => setTimeout(r, 150));
    await create('Make the CTA bigger');
    const got = await pending;
    expect(Date.now() - started).toBeLessThan(5000);
    expect(got.timedOut).toBe(false);
    expect(got.task.instruction).toBe('Make the CTA bigger');
    expect(got.task.status).toBe('delivered');

    // Queued tasks are handed out oldest first, each only once.
    await create('first');
    await new Promise((r) => setTimeout(r, 5));
    await create('second');
    const a = await (await fetch(`${base}/next`, { headers: auth })).json();
    const b = await (await fetch(`${base}/next`, { headers: auth })).json();
    const c = await (await fetch(`${base}/next`, { headers: auth })).json();
    expect([a.task.instruction, b.task.instruction, c.task]).toEqual(['first', 'second', null]);

    // Times out with no task.
    const timed = await (await fetch(`${base}/next?wait=1`, { headers: auth })).json();
    expect(timed).toEqual({ task: null, timedOut: true });
  });

  it('requires auth for the listen endpoint', async () => {
    const testPort = 29000 + Math.floor(Math.random() * 2000); // below Windows' dynamic range (49152+), often reserved
    server = new BridgeServer(tempDir, testPort);
    activePort = await server.start();
    const res = await fetch(`http://localhost:${activePort}/api/agent/tasks/next`);
    expect(res.status).toBe(401);
  });
});

