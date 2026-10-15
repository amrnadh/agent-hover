import { describe, it, expect } from 'vitest';
import path from 'path';
import { GenMapping, addMapping, toEncodedMap } from '@jridgewell/gen-mapping';
import { createLocationMapper } from '../source-location.js';

/** A served module whose line 30, column 9 came from line 27, column 9 of the original file. */
function graph(root: string) {
  const map = new GenMapping({ file: 'Features.tsx' });
  addMapping(map, { generated: { line: 30, column: 8 }, original: { line: 27, column: 8 }, source: 'Features.tsx' });
  const modules: Record<string, any> = {
    '/src/components/Features.tsx': { file: path.join(root, 'src', 'components', 'Features.tsx'), transformResult: { map: toEncodedMap(map) } },
    '/src/plain.ts': { file: path.join(root, 'src', 'plain.ts'), transformResult: { map: null } },
    '/node_modules/.vite/deps/react.js': { file: path.join(root, 'node_modules', '.vite', 'deps', 'react.js'), transformResult: null },
  };
  return { getModuleByUrl: async (url: string) => modules[url] };
}

describe('source location mapping', () => {
  const root = path.resolve('/projects/app');

  it('maps a served position back to the original file and line (Vite 6+ environments)', async () => {
    const map = createLocationMapper({ environments: { client: { moduleGraph: graph(root) } } }, root);
    expect(await map('http://localhost:5173/src/components/Features.tsx?t=17290000', 30, 9)).toEqual({ file: 'src/components/Features.tsx', line: 27, column: 9 });
  });

  it('works with the Vite 5 module graph, keeps positions without a map, and ignores dependencies', async () => {
    const map = createLocationMapper({ moduleGraph: graph(root) }, root);
    expect(await map('http://localhost:5173/src/plain.ts', 4, 2)).toEqual({ file: 'src/plain.ts', line: 4, column: 2 });
    expect(await map('http://localhost:5173/node_modules/.vite/deps/react.js', 1, 1)).toBeNull();
    expect(await map('http://localhost:5173/src/missing.tsx', 1, 1)).toBeNull();
    expect(await map('not a url', 1, 1)).toBeNull();
  });
});
