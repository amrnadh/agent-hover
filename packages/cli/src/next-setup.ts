import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { NEXT_PACKAGE } from './brand.js';
import { lastImportEnd, skipLiteral } from './vite-config.js';

export const NEXT_CONFIGS = ['next.config.ts', 'next.config.mjs', 'next.config.js', 'next.config.cjs', 'next.config.mts'];
const SOURCE_EXTS = ['tsx', 'jsx', 'ts', 'js'];

export type Edit = { ok: true; code: string } | { ok: false; reason: string };

export interface NextInfo {
  /** Major version from package.json's range (`^16.1.0` → 16), when readable. */
  major: number | null;
  /** next.config.* (project-relative), if there is one. */
  config: string | null;
  configConfigured: boolean;
  /** The App Router folder (`app` or `src/app`), if any. */
  appDir: string | null;
  /** The Pages Router folder (`pages` or `src/pages`), if any. */
  pagesDir: string | null;
  /** The root layout (`app/layout.tsx`, …), if any. */
  layout: string | null;
  layoutConfigured: boolean;
  /** `pages/_document.*`: the one that exists, or the one init would create. */
  document: string | null;
  documentExists: boolean;
  documentConfigured: boolean;
  /** `instrumentation.ts` (or `src/instrumentation.ts`): the one that exists, or the one init would create. */
  instrumentation: string;
  instrumentationExists: boolean;
  instrumentationConfigured: boolean;
  typescript: boolean;
  /** Everything above is in place. */
  configured: boolean;
}

const readText = (file: string) => { try { return readFileSync(file, 'utf8'); } catch { return null; } };

function firstExisting(root: string, base: string): string | null {
  for (const ext of SOURCE_EXTS) if (existsSync(path.join(root, `${base}.${ext}`))) return `${base}.${ext}`;
  return null;
}

/** Read-only inspection of a Next.js app: where its config, router folders and instrumentation are. */
export function inspectNext(root: string, nextRange?: string): NextInfo {
  const has = (rel: string) => existsSync(path.join(root, rel));
  const mentions = (rel: string | null, what: string) => !!rel && !!readText(path.join(root, rel))?.includes(what);
  const major = /(\d+)/.exec(nextRange || '');
  // Next looks in src/ only when there is no app/ or pages/ at the root.
  const rootRouter = has('app') || has('pages');
  const appDir = has('app') ? 'app' : !rootRouter && has('src/app') ? 'src/app' : null;
  const pagesDir = has('pages') ? 'pages' : !rootRouter && has('src/pages') ? 'src/pages' : null;
  const srcDir = (appDir ?? pagesDir ?? '').startsWith('src/');
  const typescript = has('tsconfig.json');
  const config = NEXT_CONFIGS.find((f) => has(f)) ?? null;
  const layout = appDir ? firstExisting(root, `${appDir}/layout`) : null;
  const existingDocument = pagesDir ? firstExisting(root, `${pagesDir}/_document`) : null;
  const document = pagesDir ? existingDocument ?? `${pagesDir}/_document.${typescript ? 'tsx' : 'js'}` : null;
  const prefix = srcDir ? 'src/' : '';
  const existingInstrumentation = ['ts', 'js'].map((e) => `${prefix}instrumentation.${e}`).find(has) ?? null;
  const instrumentation = existingInstrumentation ?? `${prefix}instrumentation.${typescript ? 'ts' : 'js'}`;

  const info: NextInfo = {
    major: major ? Number(major[1]) : null,
    config,
    configConfigured: mentions(config, NEXT_PACKAGE),
    appDir,
    pagesDir,
    layout,
    layoutConfigured: mentions(layout, NEXT_PACKAGE),
    document,
    documentExists: !!existingDocument,
    documentConfigured: mentions(existingDocument, NEXT_PACKAGE),
    instrumentation,
    instrumentationExists: !!existingInstrumentation,
    instrumentationConfigured: mentions(existingInstrumentation, NEXT_PACKAGE),
    typescript,
    configured: false,
  };
  info.configured = info.configConfigured && info.instrumentationConfigured
    && (!appDir || info.layoutConfigured) && (!pagesDir || info.documentConfigured);
  return info;
}

/** Positions of `pattern` outside strings and comments. */
function findCode(src: string, pattern: RegExp): number[] {
  const found: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const skip = skipLiteral(src, i);
    if (skip !== -1) { i = skip - 1; continue; }
    if (/[\w$.]/.test(src[i - 1] || '') || !pattern.test(src.slice(i, i + 40))) continue;
    found.push(i);
  }
  return found;
}

/** Where a new line of imports goes: after the last import, else after leading comments and directives. */
function insertImport(src: string, line: string): string {
  const importEnd = lastImportEnd(src);
  if (importEnd !== -1) {
    const lastImport = src.slice(src.lastIndexOf('\n', importEnd - 1) + 1, importEnd);
    const quote = /"[^"\n]*"\s*;?\s*$/.test(lastImport) ? '"' : "'";
    const semi = lastImport.trimEnd().endsWith(';') ? ';' : '';
    return src.slice(0, importEnd) + '\n' + line.replace(/'/g, quote).replace(/;$/, semi) + src.slice(importEnd);
  }
  // Past `// @ts-check` and 'use strict', but not past a JSDoc block, which belongs to the code under it.
  const lead = /^(?:\s*(?:\/\/[^\n]*|(['"])use \w+\1;?))*\s*/.exec(src)![0];
  return src.slice(0, lead.length) + line + '\n' + (lead ? '' : '\n') + src.slice(lead.length);
}

/** Index just after the expression starting at `start`: a `;` at depth 0, the next top-level statement, or the end. */
function expressionEnd(src: string, start: number): number {
  let depth = 0;
  let lastCode = start;
  for (let i = start; i < src.length; i++) {
    const skip = skipLiteral(src, i);
    if (skip !== -1) {
      if (src[i] !== '/') lastCode = skip - 1;
      i = skip - 1;
      continue;
    }
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (depth < 0) return lastCode + 1;
    if (depth === 0 && c === ';') return lastCode + 1;
    if (depth === 0 && c === '\n' && /^\s*(export|import|const|let|var|function|class|module\.exports)\b/.test(src.slice(i + 1, i + 40))) return lastCode + 1;
    if (!/\s/.test(c)) lastCode = i;
  }
  return lastCode + 1;
}

/**
 * Wrap the exported Next.js config in `withAgentHover(...)` and import it: `export default <expr>` (ESM, TS) or
 * `module.exports = <expr>` (CommonJS). Anything it doesn't fully understand is left to the user.
 */
export function wrapNextConfig(src: string): Edit {
  if (src.includes(NEXT_PACKAGE)) return { ok: true, code: src };
  if (/\bwithAgentHover\b/.test(src)) return { ok: false, reason: 'the config already uses the name withAgentHover' };
  const esm = findCode(src, /^export\s+default\s/);
  const cjs = findCode(src, /^module\.exports\s*=/);
  const exports = esm.length ? esm : cjs;
  if (exports.length !== 1) return { ok: false, reason: exports.length ? 'more than one export' : 'no `export default` or `module.exports =` found' };
  const at = exports[0];
  const start = at + /^(?:export\s+default|module\.exports\s*=)\s*/.exec(src.slice(at))![0].length;
  if (/^(async\s+)?function\b|^class\b/.test(src.slice(start))) return { ok: false, reason: 'the config is a function declaration' };
  const end = expressionEnd(src, start);
  if (end <= start) return { ok: false, reason: 'could not read the exported config' };
  const code = src.slice(0, start) + 'withAgentHover(' + src.slice(start, end) + ')' + src.slice(end);
  if (esm.length) return { ok: true, code: insertImport(code, `import { withAgentHover } from '${NEXT_PACKAGE}';`) };
  // CommonJS: after the last top-level require, else at the top.
  const requires = [...code.matchAll(/^(?:const|let|var)\b[^\n]*\brequire\(\s*['"][^'"]+['"]\s*\)[^\n]*$/gm)];
  const line = `const { withAgentHover } = require('${NEXT_PACKAGE}');`;
  if (requires.length) {
    const last = requires[requires.length - 1];
    const endAt = last.index! + last[0].length;
    return { ok: true, code: code.slice(0, endAt) + '\n' + line + code.slice(endAt) };
  }
  return { ok: true, code: insertImport(code, line) };
}

export const NEXT_CONFIG_MANUAL = [
  `import { withAgentHover } from '${NEXT_PACKAGE}';`,
  '',
  'export default withAgentHover(nextConfig);',
].join('\n');

const REGISTER_BODY = [
  "// Agent Hover: starts with `next dev` (nothing in production builds or the Edge runtime).",
  "if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {",
  `  await (await import('${NEXT_PACKAGE}/register')).register();`,
  '}',
];

/** A new instrumentation.ts (or .js) that starts Agent Hover. */
export function newInstrumentation(): string {
  return ['export async function register() {', ...REGISTER_BODY.map((l) => '  ' + l), '}', ''].join('\n');
}

export const INSTRUMENTATION_MANUAL = newInstrumentation().trimEnd();

/** Start Agent Hover at the top of an existing `register()`, making it async if it isn't. */
export function addToInstrumentation(src: string): Edit {
  if (src.includes(NEXT_PACKAGE)) return { ok: true, code: src };
  const found = findCode(src, /^export\s+(async\s+)?function\s+register\s*\(/);
  if (found.length !== 1) return { ok: false, reason: 'no `export function register()` found' };
  const at = found[0];
  const open = src.indexOf('(', at);
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) { close = i; break; }
  }
  const brace = close === -1 ? -1 : src.indexOf('{', close);
  if (brace === -1) return { ok: false, reason: 'could not read register()' };
  const lineStart = src.lastIndexOf('\n', at) + 1;
  const indent = /^[ \t]*/.exec(src.slice(lineStart))![0] + '  ';
  const body = '\n' + REGISTER_BODY.map((l) => indent + l).join('\n');
  let code = src.slice(0, brace + 1) + body + src.slice(brace + 1);
  if (!/^export\s+async\b/.test(src.slice(at))) code = code.slice(0, at) + code.slice(at).replace(/^export\s+function/, 'export async function');
  return { ok: true, code };
}

/** Add `<AgentHover />` to a root layout (App Router), at the end of `<body>`. */
export function addToLayout(src: string): Edit {
  return addComponent(src, `${NEXT_PACKAGE}/script`, /<\/body>/g, 'before');
}

/** Add `<AgentHover />` to pages/_document after `<NextScript />` (or at the end of `<body>`). */
export function addToDocument(src: string): Edit {
  const afterScript = addComponent(src, `${NEXT_PACKAGE}/document`, /<NextScript\s*\/>/g, 'after');
  return afterScript.ok ? afterScript : addComponent(src, `${NEXT_PACKAGE}/document`, /<\/body>/g, 'before');
}

function addComponent(src: string, from: string, anchor: RegExp, where: 'before' | 'after'): Edit {
  if (src.includes(NEXT_PACKAGE)) return { ok: true, code: src };
  if (/^\s*(['"])use client\1/.test(src)) return { ok: false, reason: "it is a client component ('use client')" };
  if (/\bAgentHover\b/.test(src)) return { ok: false, reason: 'it already uses the name AgentHover' };
  const matches = [...src.matchAll(anchor)];
  if (matches.length !== 1) return { ok: false, reason: matches.length ? `more than one ${matches[0][0]}` : `no ${anchor.source.replace(/\\s\*|\\/g, '')} found` };
  const m = matches[0];
  const lineStart = src.lastIndexOf('\n', m.index!) + 1;
  const before = src.slice(lineStart, m.index!);
  const ownLine = /^[ \t]*$/.test(before);
  let code: string;
  if (where === 'before') {
    code = ownLine
      ? src.slice(0, lineStart) + before + '  <AgentHover />\n' + src.slice(lineStart)
      : src.slice(0, m.index!) + '<AgentHover />' + src.slice(m.index!);
  } else {
    const endAt = m.index! + m[0].length;
    code = ownLine
      ? src.slice(0, endAt) + '\n' + before + '<AgentHover />' + src.slice(endAt)
      : src.slice(0, endAt) + '<AgentHover />' + src.slice(endAt);
  }
  return { ok: true, code: insertImport(code, `import { AgentHover } from '${from}';`) };
}

/** A pages/_document like Next's own default, with Agent Hover after NextScript. */
export function newDocument(): string {
  // Built from a variable: the release check (scripts/pack-check.mjs) would read the plain text as an import of next.
  const nextDocument = 'next/document';
  return [
    `import { Html, Head, Main, NextScript } from '${nextDocument}';`,
    `import { AgentHover } from '${NEXT_PACKAGE}/document';`,
    '',
    'export default function Document() {',
    '  return (',
    '    <Html>',
    '      <Head />',
    '      <body>',
    '        <Main />',
    '        <NextScript />',
    '        <AgentHover />',
    '      </body>',
    '    </Html>',
    '  );',
    '}',
    '',
  ].join('\n');
}

export const LAYOUT_MANUAL = [
  `import { AgentHover } from '${NEXT_PACKAGE}/script';`,
  '',
  '<body>',
  '  {children}',
  '  <AgentHover />',
  '</body>',
].join('\n');

export const DOCUMENT_MANUAL = [
  `import { AgentHover } from '${NEXT_PACKAGE}/document';`,
  '',
  '<body>',
  '  <Main />',
  '  <NextScript />',
  '  <AgentHover />',
  '</body>',
].join('\n');
