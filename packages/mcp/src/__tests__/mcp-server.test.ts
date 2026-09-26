import { describe, it, expect } from 'vitest';
import { isConnectionError, handleBridgeError, server } from '../index.js';

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
});
