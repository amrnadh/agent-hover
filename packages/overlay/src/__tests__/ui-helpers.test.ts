import { describe, expect, it } from 'vitest';
import { AGENT_SETUPS } from '../lib/agents.js';
import { MCP_CLIENTS } from '../../../cli/src/clients.js';
import { previewValue } from '../ui/panels/inspect.js';
import { timeAgo, esc } from '../lib/ui.js';
import { icon } from '../lib/icon.js';

describe('agent setup table', () => {
  it('matches the CLI table so Settings and `npx agent-hover mcp` never disagree', () => {
    expect(AGENT_SETUPS.map(({ id, title, command, configPath, snippet }) => ({ id, title, command, configPath, snippet }))).toEqual(
      MCP_CLIENTS.map(({ id, title, command, configPath, snippet }) => ({ id, title, command, configPath, snippet })),
    );
  });
});

describe('previewValue (Inspect props)', () => {
  it('redacts secret-looking keys', () => {
    expect(previewValue('abc123', 'apiKey')).toBe('"[redacted]"');
    expect(previewValue('x', 'sessionToken')).toBe('"[redacted]"');
  });
  it('names functions and summarises nested values', () => {
    function handleUpgrade() {}
    expect(previewValue(handleUpgrade)).toBe('[Function handleUpgrade]');
    expect(previewValue({ a: { b: { c: 1 } } })).toBe('{ a: { b: {…1} } }');
    expect(previewValue([1, 2, 3, 4, 5])).toBe('[1, 2, 3, 4, …]');
  });
  it('truncates long strings', () => {
    expect(previewValue('x'.repeat(100))).toBe(JSON.stringify('x'.repeat(80) + '…'));
  });
  it('handles circular objects without throwing', () => {
    const a: any = { name: 'a' };
    a.self = a;
    expect(() => previewValue(a)).not.toThrow();
  });
});

describe('ui helpers', () => {
  it('escapes HTML', () => {
    expect(esc('<b a="1">&</b>')).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;');
  });
  it('formats relative times', () => {
    expect(timeAgo(Date.now() - 5_000)).toBe('just now');
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe('5m ago');
    expect(timeAgo(Date.now() - 3 * 3_600_000)).toBe('3h ago');
  });
  it('renders known icons and an empty svg for unknown names', () => {
    expect(icon('send')).toContain('<path');
    expect(icon('nope')).toContain('<svg');
  });
});
