const SECRET = /token|secret|password|auth|cookie|api[-_]?key|session/i;

/** Short, safe preview of a runtime value: depth-limited, secrets redacted, functions named, cycles safe. */
export function previewValue(value: unknown, key = '', depth = 0): string {
  if (key && SECRET.test(key)) return '"[redacted]"';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return `[Function ${(value as Function).name || 'anonymous'}]`;
  if (typeof value === 'string') return JSON.stringify(value.length > 80 ? value.slice(0, 80) + '…' : value);
  if (typeof value !== 'object') return String(value);
  if ((value as any).$$typeof) return '<JSX />';
  if (typeof Element !== 'undefined' && value instanceof Element) return `<${value.tagName.toLowerCase()}>`;
  if (Array.isArray(value)) return depth > 1 ? `Array(${value.length})` : `[${value.slice(0, 4).map((v) => previewValue(v, '', depth + 1)).join(', ')}${value.length > 4 ? ', …' : ''}]`;
  const keys = Object.keys(value as object);
  if (depth > 1) return `{…${keys.length}}`;
  return `{ ${keys.slice(0, 4).map((k) => `${k}: ${previewValue((value as any)[k], k, depth + 1)}`).join(', ')}${keys.length > 4 ? ', …' : ''} }`;
}
