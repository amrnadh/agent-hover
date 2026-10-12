import { VITE_PACKAGE } from './brand.js';

export type ViteEdit = { ok: true; code: string } | { ok: false; reason: string };

const IMPORT_LINE = `import agentHover from '${VITE_PACKAGE}';`;
const CALL = 'agentHover()';

/** Index just after the string/comment starting at `i`, or -1 when `i` does not start one. */
function skipLiteral(src: string, i: number): number {
  const c = src[i];
  if (c === '/' && src[i + 1] === '/') {
    const end = src.indexOf('\n', i);
    return end === -1 ? src.length : end;
  }
  if (c === '/' && src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2);
    return end === -1 ? src.length : end + 2;
  }
  if (c === '"' || c === "'" || c === '`') {
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === '\\') { j++; continue; }
      if (src[j] === c) return j + 1;
      // Template literal expressions can hold anything; give up on them by treating `${` as opaque text.
    }
    return src.length;
  }
  return -1;
}

/**
 * Find the `]` that closes the array opening at `open`, ignoring brackets in strings and comments.
 * Also returns the index of the last code character inside it (so we never insert after a comment).
 */
function scanArray(src: string, open: number): { close: number; lastCode: number } | null {
  let depth = 0;
  let lastCode = -1;
  for (let i = open; i < src.length; i++) {
    const skip = skipLiteral(src, i);
    if (skip !== -1) {
      if (src[i] !== '/' && depth >= 1) lastCode = skip - 1; // a string is code, a comment is not
      i = skip - 1;
      continue;
    }
    const c = src[i];
    if (c === '[' || c === '(' || c === '{') depth++;
    else if (c === ']' || c === ')' || c === '}') {
      depth--;
      if (depth === 0) return c === ']' ? { close: i, lastCode } : null;
    }
    if (depth >= 1 && i !== open && !/\s/.test(c)) lastCode = i;
  }
  return null;
}

/** Positions of `plugins: [` outside strings and comments. */
function findPluginArrays(src: string): number[] {
  const found: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const skip = skipLiteral(src, i);
    if (skip !== -1) { i = skip - 1; continue; }
    const m = /^plugins\s*:\s*\[/.exec(src.slice(i, i + 40));
    if (m && !/[\w$]/.test(src[i - 1] || '')) found.push(i + m[0].length - 1);
  }
  return found;
}

/** End index of the last top-level import statement, or -1. */
function lastImportEnd(src: string): number {
  let end = -1;
  const re = /^import\b[^;]*?(?:from\s*)?['"][^'"\n]+['"][ \t]*;?/gm;
  for (let m = re.exec(src); m; m = re.exec(src)) end = m.index + m[0].length;
  return end;
}

/**
 * Add `agentHover()` to a Vite config's `plugins` array and import it. Only edits configs it fully
 * understands (one `plugins: [...]` array literal, ES module imports); anything else is left to the user.
 */
export function addPluginToViteConfig(src: string): ViteEdit {
  if (src.includes(VITE_PACKAGE)) return { ok: true, code: src };
  if (/\bagentHover\b/.test(src)) return { ok: false, reason: 'the config already uses the name agentHover' };
  if (/\brequire\s*\(/.test(src) && !/^import\b/m.test(src)) return { ok: false, reason: 'CommonJS configs are not edited automatically' };

  // Ignore `plugins` arrays nested inside another one, e.g. react({ babel: { plugins: [...] } }).
  const found = findPluginArrays(src).map((open) => ({ open, scan: scanArray(src, open) }));
  const arrays = found.filter((a) => !found.some((b) => b !== a && b.scan && b.open < a.open && a.open < b.scan.close));
  if (arrays.length === 0) return { ok: false, reason: 'no `plugins: [...]` array found' };
  if (arrays.length > 1) return { ok: false, reason: 'more than one `plugins` array' };
  const { open, scan } = arrays[0];
  if (!scan) return { ok: false, reason: 'could not read the `plugins` array' };

  let code: string;
  if (scan.lastCode === -1) {
    code = src.slice(0, open + 1) + CALL + src.slice(open + 1);
  } else {
    const trailingComma = src[scan.lastCode] === ',';
    const multiline = src.slice(open, scan.close).includes('\n');
    let insert: string;
    if (multiline) {
      const lineStart = src.lastIndexOf('\n', scan.lastCode) + 1;
      const indent = /^[ \t]*/.exec(src.slice(lineStart))![0];
      insert = (trailingComma ? '' : ',') + '\n' + indent + CALL + (trailingComma ? ',' : '');
    } else {
      insert = (trailingComma ? ' ' : ', ') + CALL;
    }
    code = src.slice(0, scan.lastCode + 1) + insert + src.slice(scan.lastCode + 1);
  }

  // Match the file's style: quotes and semicolons of its last import.
  const importEnd = lastImportEnd(code);
  const lastImport = importEnd === -1 ? '' : code.slice(code.lastIndexOf('\n', importEnd - 1) + 1, importEnd);
  const quote = /from\s*"/.test(lastImport) ? '"' : "'";
  const semi = !lastImport || lastImport.trimEnd().endsWith(';') ? ';' : '';
  const line = `import agentHover from ${quote}${VITE_PACKAGE}${quote}${semi}`;
  code = importEnd === -1 ? line + '\n' + code : code.slice(0, importEnd) + '\n' + line + code.slice(importEnd);
  return { ok: true, code };
}

export const VITE_MANUAL_STEPS = [
  IMPORT_LINE,
  '',
  'export default defineConfig({',
  `  plugins: [react(), ${CALL}],`,
  '});',
].join('\n');
