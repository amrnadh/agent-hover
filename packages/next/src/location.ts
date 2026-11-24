import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AnyMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { projectRelative, type LocationMapper } from '@agent-hover/bridge';

/**
 * Maps a frame from React's creation stack (`_debugStack`) in a Next.js dev app back to the source file and line.
 * Everything is read from the dev build on disk (`<distDir>`); nothing the page sends is fetched.
 *
 * - Turbopack, client: `http://localhost:3000/_next/static/chunks/<chunk>.js` → `<distDir>[/dev]/static/chunks/<chunk>.js.map`
 *   (a sectioned source map: one section per module).
 * - Turbopack, Server Component: `file:///…/<distDir>[/dev]/server/chunks/ssr/<chunk>.js?3` → the `.map` beside it.
 * - webpack: `webpack-internal:///(app-pages-browser)/./components/Card.tsx` → the chunk that holds that module
 *   keeps its source map inline (eval-source-map).
 *
 * Server Component frames come wrapped as `about://React/Server/<url>?N` (older React: `rsc://React/Server/…`).
 */
export function createNextLocationMapper(root: string, distDir: string = '.next'): LocationMapper {
  const dist = path.resolve(root, distDir);
  const insideDist = (file: string) => {
    const rel = path.relative(dist, file);
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  };

  return async (url, line, column) => {
    const target = unwrap(url);
    let map: any = null;
    if (target.startsWith('webpack-internal:')) {
      map = webpackModuleMap(dist, decodeURIComponent(target.replace(/^webpack-internal:\/*/, '')));
    } else {
      const file = generatedFile(dist, target);
      if (!file || !insideDist(file)) return null;
      map = chunkMap(file);
    }
    if (!map) return null;
    let pos;
    try {
      // Browser columns are 1-based; source maps use 0-based columns.
      pos = originalPositionFor(map, { line, column: Math.max(0, column - 1) });
    } catch {
      return null;
    }
    if (pos.line == null || !pos.source) return null;
    const source = sourcePath(root, pos.source);
    if (!source || /[\\/]node_modules[\\/]/.test(source)) return null;
    const file = projectRelative(root, source);
    if (!file || file.startsWith('..') || path.isAbsolute(file) || file.startsWith(projectRelative(root, dist) + '/')) return null;
    return { file, line: pos.line, column: (pos.column ?? 0) + 1 };
  };
}

/** The frame's own URL: without React's Server Component wrapper or its `?N` counter. */
export function unwrap(url: string): string {
  return url.replace(/^(?:about|rsc):\/\/React\/Server\//, '').replace(/\?\d+$/, '');
}

/** The generated file on disk for a client chunk URL (`/_next/...`) or a server chunk (`file://`). */
function generatedFile(dist: string, url: string): string | null {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol === 'file:') {
    try { return fileURLToPath(parsed); } catch { return null; }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const pathname = decodeURIComponent(parsed.pathname);
  const at = pathname.indexOf('/_next/');
  if (at < 0) return null;
  const rest = pathname.slice(at + '/_next/'.length);
  // Next 16 keeps the dev build in <distDir>/dev, Next 15 in <distDir>.
  for (const base of [path.join(dist, 'dev'), dist]) {
    const file = path.resolve(base, rest);
    if (existsSync(file) || existsSync(file + '.map')) return file;
  }
  return null;
}

const maps = new Map<string, { mtimeMs: number; map: any }>();

function cached(key: string, mtimeMs: number, load: () => any): any {
  const hit = maps.get(key);
  if (hit && hit.mtimeMs === mtimeMs) return hit.map;
  const map = load();
  maps.set(key, { mtimeMs, map });
  if (maps.size > 200) maps.delete(maps.keys().next().value!);
  return map;
}

function parseMap(text: string): any {
  try { return new AnyMap(JSON.parse(text)); } catch { return null; }
}

/** The source map of a chunk: `<chunk>.map` beside it, else its `sourceMappingURL` (a file or inline). */
function chunkMap(file: string): any {
  const mapFile = file + '.map';
  if (existsSync(mapFile)) return cached(mapFile, statSync(mapFile).mtimeMs, () => parseMap(readFileSync(mapFile, 'utf8')));
  if (!existsSync(file)) return null;
  return cached(file, statSync(file).mtimeMs, () => {
    const code = readFileSync(file, 'utf8');
    const m = /\/\/[#@] sourceMappingURL=(\S+)\s*$/.exec(code);
    if (!m) return null;
    const inline = /^data:application\/json[^,]*;base64,(.+)$/.exec(m[1]);
    if (inline) return parseMap(Buffer.from(inline[1], 'base64').toString('utf8'));
    const linked = path.resolve(path.dirname(file), decodeURIComponent(m[1]));
    if (path.dirname(linked) !== path.dirname(file) || !existsSync(linked)) return null;
    return parseMap(readFileSync(linked, 'utf8'));
  });
}

const INLINE_MAP = 'sourceMappingURL=data:application/json;charset=utf-8;base64,';

/**
 * webpack (`next dev --webpack`) evaluates each module with its own inline source map. Finds the chunk that holds
 * the module (`"(app-pages-browser)/./components/Card.tsx": …`) and reads the map right after it.
 */
function webpackModuleMap(dist: string, id: string): any {
  const key = JSON.stringify(id) + ':';
  const browser = !/^\((rsc|ssr|action-browser|middleware|instrument|shared)\)/.test(id);
  const dirs = browser
    ? ['dev/static/chunks', 'static/chunks', 'dev/server', 'server']
    : ['dev/server', 'server', 'dev/static/chunks', 'static/chunks'];
  for (const dir of dirs) {
    for (const file of jsFiles(path.join(dist, dir))) {
      const map = cached(`${file}\0${id}`, statSync(file).mtimeMs, () => {
        const code = readFileSync(file, 'utf8');
        const at = code.indexOf(key);
        if (at < 0) return null;
        const start = code.indexOf(INLINE_MAP, at);
        if (start < 0) return null;
        const from = start + INLINE_MAP.length;
        const end = code.slice(from).search(/[^A-Za-z0-9+/=]/);
        return parseMap(Buffer.from(code.slice(from, end < 0 ? undefined : from + end), 'base64').toString('utf8'));
      });
      if (map) return map;
    }
  }
  return null;
}

function jsFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string, depth: number) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 6) walk(p, depth + 1); }
      else if (e.name.endsWith('.js')) out.push(p);
    }
  };
  walk(dir, 0);
  return out;
}

/** A source map `source` as an absolute path: file URLs, Turbopack's `[project]`, webpack's `webpack://` or a path. */
export function sourcePath(root: string, source: string): string | null {
  let s = source.replace(/\?[^/]*$/, '');
  try {
    if (s.startsWith('file://')) return fileURLToPath(s);
  } catch { return null; }
  const turbo = /^turbopack:\/\/\/\[project\]\/(.*)$/.exec(s);
  if (turbo) return path.resolve(root, turbo[1]);
  if (s.startsWith('turbopack://')) return null;
  const webpack = /^webpack:\/\/[^/]*\/(.*)$/.exec(s);
  if (webpack) s = webpack[1];
  if (path.isAbsolute(s)) return s;
  return path.resolve(root, s);
}
