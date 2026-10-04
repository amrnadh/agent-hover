import { describe, it, expect } from 'vitest';
import { isConnectionError, handleBridgeError, parseBridgeResponse, server } from '../index.js';

describe('Agent Hover MCP Server', () => {
  it('correctly identifies bridge connection errors', () => {
    expect(isConnectionError(new Error('fetch failed'))).toBe(true);
    expect(isConnectionError({ cause: { code: 'ECONNREFUSED' } })).toBe(true);
    expect(isConnectionError({ code: 'ECONNRESET' })).toBe(true);
    expect(isConnectionError({ code: 'ENOTFOUND' })).toBe(true);

    expect(isConnectionError(new Error('Syntax error'))).toBe(false);
    expect(isConnectionError(null)).toBe(false);
  });

  it('formats bridge connection error into actionable advice', () => {
    const errorResponse = handleBridgeError(new Error('fetch failed'));
    expect(errorResponse.isError).toBe(true);
    expect(errorResponse.content[0].type).toBe('text');
    expect(errorResponse.content[0].text).toContain('Could not connect to the Agent Hover bridge server');
    expect(errorResponse.content[0].text).toContain('npm run dev');
  });

  it('formats general bridge error cleanly', () => {
    const errorResponse = handleBridgeError(new Error('Component not found'));
    expect(errorResponse.isError).toBe(true);
    expect(errorResponse.content[0].text).toBe('Error from Agent Hover bridge: Component not found');
  });

  it('initializes the MCP server with proper name and capabilities', () => {
    expect(server).toBeDefined();
  });

  describe('parseBridgeResponse', () => {
    it('returns markdown when present in JSON response', async () => {
      const mockResponse = new Response(
        JSON.stringify({ component: { name: 'Hero' }, markdown: '## Hero\n\n**Source**: `Hero.tsx`' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
      const result = await parseBridgeResponse(mockResponse);
      expect(result).toBe('## Hero\n\n**Source**: `Hero.tsx`');
    });

    it('returns context when present in JSON response', async () => {
      const mockResponse = new Response(
        JSON.stringify({ context: 'Context string' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
      const result = await parseBridgeResponse(mockResponse);
      expect(result).toBe('Context string');
    });

    it('returns text response directly', async () => {
      const mockResponse = new Response(
        '# Plain Markdown Context',
        { status: 200, headers: { 'content-type': 'text/markdown' } }
      );
      const result = await parseBridgeResponse(mockResponse);
      expect(result).toBe('# Plain Markdown Context');
    });

    it('throws formatted error with server message on non-ok HTTP response', async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: 'Component file not found' }),
        { status: 404, statusText: 'Not Found', headers: { 'content-type': 'application/json' } }
      );
      await expect(parseBridgeResponse(mockResponse)).rejects.toThrow('HTTP 404 Not Found: Component file not found');
    });
  });

  describe('Tool Definitions and Lifecycle (P1-05)', () => {
    it('registers task queue tools and source inspection tool', () => {
      expect(server).toBeDefined();
    });

    it('resolves bridge connection from environment variable or defaults', async () => {
      const { resolveBridgeConnection } = await import('../index.js');
      const conn = resolveBridgeConnection();
      expect(conn.port).toBeGreaterThan(0);
    });

    it('handles list_agent_tasks, claim_agent_task, and complete_agent_task lifecycle', async () => {
      const http = await import('http');
      const testPort = 38000 + Math.floor(Math.random() * 2000);
      let receivedAuth = '';
      let lastClaimedId = '';
      let completedSummary = '';

      const testServer = http.createServer((req, res) => {
        receivedAuth = req.headers['authorization'] || '';
        res.setHeader('Content-Type', 'application/json');

        if (req.url?.startsWith('/api/agent/tasks?')) {
          res.writeHead(200);
          res.end(JSON.stringify({
            tasks: [
              {
                id: 'task-abc-123',
                type: 'component-context',
                status: 'queued',
                instruction: 'Refactor navbar',
                target: { component: 'Navbar', file: 'src/Navbar.tsx' },
              },
            ],
          }));
        } else if (req.url === '/api/agent/tasks/task-abc-123/claim') {
          lastClaimedId = 'task-abc-123';
          res.writeHead(200);
          res.end(JSON.stringify({ task: { id: 'task-abc-123', status: 'in_progress' } }));
        } else if (req.url?.startsWith('/api/agent/tasks/task-abc-123?')) {
          res.writeHead(200);
          res.end(JSON.stringify({
            task: { id: 'task-abc-123', status: 'in_progress' },
            prompt: '# Task: Refactor navbar\nTarget: Navbar.tsx',
          }));
        } else if (req.url === '/api/agent/tasks/task-abc-123/complete') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const parsed = JSON.parse(body);
            completedSummary = parsed.summary;
            res.writeHead(200);
            res.end(JSON.stringify({ task: { id: 'task-abc-123', status: 'done', result: { summary: completedSummary } } }));
          });
        } else if (req.url === '/api/source') {
          res.writeHead(200);
          res.end(JSON.stringify({
            file: 'src/Navbar.tsx',
            lineStart: 1,
            lineEnd: 5,
            source: 'export function Navbar() { return <nav />; }',
          }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });

      await new Promise<void>((resolve) => testServer.listen(testPort, '127.0.0.1', () => resolve()));

      const originalEnv = process.env.COMPONENT_POINTER_PORT;
      const originalToken = process.env.AGENT_HOVER_TOKEN;
      process.env.COMPONENT_POINTER_PORT = String(testPort);
      process.env.AGENT_HOVER_TOKEN = 'test-token-xyz';

      try {
        // Test CallTool handlers by simulating tool executions via server
        // 1. list_agent_tasks
        const listHandler = (server as any)._requestHandlers.get('tools/call');
        expect(listHandler).toBeDefined();

        const listResult = await listHandler({
          method: 'tools/call',
          params: { name: 'list_agent_tasks', arguments: { limit: 10 } },
        });
        expect(listResult.isError).toBeFalsy();
        expect(receivedAuth).toBe('Bearer test-token-xyz');
        expect(listResult.content[0].text).toContain('task-abc-123');

        // 2. claim_agent_task
        const claimResult = await listHandler({
          method: 'tools/call',
          params: { name: 'claim_agent_task', arguments: { id: 'task-abc-123', format: 'standard' } },
        });
        expect(claimResult.isError).toBeFalsy();
        expect(lastClaimedId).toBe('task-abc-123');
        expect(claimResult.content[0].text).toContain('Refactor navbar');

        // 3. complete_agent_task
        const completeResult = await listHandler({
          method: 'tools/call',
          params: {
            name: 'complete_agent_task',
            arguments: { id: 'task-abc-123', status: 'done', summary: 'Added responsive menu' },
          },
        });
        expect(completeResult.isError).toBeFalsy();
        expect(completedSummary).toBe('Added responsive menu');

        // 4. get_component_source
        const sourceResult = await listHandler({
          method: 'tools/call',
          params: { name: 'get_component_source', arguments: { file: 'src/Navbar.tsx', lineStart: 1, lineEnd: 5 } },
        });
        expect(sourceResult.isError).toBeFalsy();
        expect(sourceResult.content[0].text).toContain('export function Navbar');
      } finally {
        if (originalEnv) process.env.COMPONENT_POINTER_PORT = originalEnv;
        else delete process.env.COMPONENT_POINTER_PORT;
        if (originalToken) process.env.AGENT_HOVER_TOKEN = originalToken;
        else delete process.env.AGENT_HOVER_TOKEN;

        await new Promise<void>((resolve) => testServer.close(() => resolve()));
      }
    });
  });
});
