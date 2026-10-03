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
});
