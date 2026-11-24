import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { GenMapping, addMapping, toEncodedMap } from '@jridgewell/gen-mapping';
import { createNextLocationMapper, sourcePath, unwrap } from '../location.js';

/** A map whose generated line/column (1-based line, 0-based column) came from `source` line/column. */
function map(source: string, generated: [number, number], original: [number, number]) {
  const g = new GenMapping();
  addMapping(g, { generated: { line: generated[0], column: generated[1] }, original: { line: original[0], column: original[1] }, source });
  return toEncodedMap(g);
}

describe('Next.js source locations', () => {
  let root: string;
  const write = (rel: string, text: string) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
  };

  beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ah-next-map-')));
    const card = pathToFileURL(path.join(root, 'components', 'Card.tsx')).href;
    // Turbopack client chunk (Next 16 keeps it in .next/dev): a sectioned map, the app module in its second section.
    write('.next/dev/static/chunks/_app123._.js', '// chunk\n');
    write('.next/dev/static/chunks/_app123._.js.map', JSON.stringify({
      version: 3,
      sources: [],
      sections: [
        { offset: { line: 0, column: 0 }, map: map('file:///elsewhere/node_modules/react/index.js', [1, 0], [1, 0]) },
        { offset: { line: 4, column: 0 }, map: map(card, [17, 214], [7, 6]) },
      ],
    }));
    // Turbopack Server Component chunk (Next 15 layout: .next/server).
    write('.next/server/chunks/ssr/[root-of-the-server]__abc._.js', '// server chunk\n');
    write('.next/server/chunks/ssr/[root-of-the-server]__abc._.js.map', JSON.stringify(map('turbopack:///[project]/app/page.tsx', [24, 263], [6, 6])));
    // webpack: each module evaluated with an inline source map.
    const inline = Buffer.from(JSON.stringify(map(path.join(root, 'components', 'Card.tsx'), [17, 87], [7, 6]))).toString('base64');
    const other = Buffer.from(JSON.stringify(map(path.join(root, 'app', 'other.tsx'), [1, 0], [1, 0]))).toString('base64');
    write('.next/dev/static/chunks/app/page.js', [
      `"(app-pages-browser)/./app/other.tsx": ((m) => { eval(__webpack_require__.ts("x\\n//# sourceURL=webpack-internal:///(app-pages-browser)/./app/other.tsx\\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${other}\\n")); }),`,
      `"(app-pages-browser)/./components/Card.tsx": ((m) => { eval(__webpack_require__.ts("x\\n//# sourceURL=webpack-internal:///(app-pages-browser)/./components/Card.tsx\\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${inline}\\n")); }),`,
    ].join('\n'));
    write('outside.js.map', JSON.stringify(map('file:///etc/passwd', [1, 0], [1, 0])));
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it('maps a Turbopack client chunk through its sectioned map', async () => {
    const mapper = createNextLocationMapper(root);
    expect(await mapper('http://localhost:3000/_next/static/chunks/_app123._.js', 21, 215)).toEqual({ file: 'components/Card.tsx', line: 7, column: 7 });
  });

  it('maps a Server Component frame, with or without React\'s wrapper and counter', async () => {
    const mapper = createNextLocationMapper(root);
    const chunk = pathToFileURL(path.join(root, '.next/server/chunks/ssr/[root-of-the-server]__abc._.js')).href;
    expect(await mapper(chunk + '?3', 24, 264)).toEqual({ file: 'app/page.tsx', line: 6, column: 7 });
    expect(await mapper('about://React/Server/' + chunk + '?12', 24, 264)).toEqual({ file: 'app/page.tsx', line: 6, column: 7 });
  });

  it('maps a webpack module through the inline map that follows it in its chunk', async () => {
    const mapper = createNextLocationMapper(root);
    expect(await mapper('webpack-internal:///(app-pages-browser)/./components/Card.tsx', 17, 88)).toEqual({ file: 'components/Card.tsx', line: 7, column: 7 });
    expect(await mapper('webpack-internal:///(app-pages-browser)/./components/Missing.tsx', 1, 1)).toBeNull();
  });

  it('reads nothing outside the build folder and returns only project files', async () => {
    const mapper = createNextLocationMapper(root);
    expect(await mapper('http://localhost:3000/_next/../../outside.js', 1, 1)).toBeNull();
    expect(await mapper(pathToFileURL(path.join(root, 'outside.js')).href, 1, 1)).toBeNull();
    expect(await mapper('file:///etc/hosts', 1, 1)).toBeNull();
    expect(await mapper('http://localhost:3000/src/app.tsx', 1, 1)).toBeNull();
    // The first section is React from node_modules.
    expect(await mapper('http://localhost:3000/_next/static/chunks/_app123._.js', 1, 1)).toBeNull();
    expect(await mapper('not a url', 1, 1)).toBeNull();
  });

  it('honours a custom distDir', async () => {
    fs.cpSync(path.join(root, '.next'), path.join(root, 'build-out'), { recursive: true });
    const mapper = createNextLocationMapper(root, 'build-out');
    expect(await mapper('http://localhost:3000/_next/static/chunks/_app123._.js', 21, 215)).toEqual({ file: 'components/Card.tsx', line: 7, column: 7 });
  });

  it('reads the source names Turbopack and webpack write', () => {
    const r = path.resolve('/p/app');
    expect(sourcePath(r, 'turbopack:///[project]/app/page.tsx')).toBe(path.join(r, 'app', 'page.tsx'));
    expect(sourcePath(r, 'webpack://_N_E/./components/Card.tsx?abc')).toBe(path.join(r, 'components', 'Card.tsx'));
    expect(sourcePath(r, pathToFileURL(path.join(r, 'x.tsx')).href)).toBe(path.join(r, 'x.tsx'));
    expect(sourcePath(r, 'turbopack:///[turbopack]/runtime.ts')).toBeNull();
    expect(unwrap('rsc://React/Server/webpack-internal:///(rsc)/./app/page.tsx?3')).toBe('webpack-internal:///(rsc)/./app/page.tsx');
  });
});
