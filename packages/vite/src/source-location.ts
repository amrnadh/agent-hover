import path from 'path';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';

export interface SourceLocation { file: string; line: number; column: number }

/** Maps a position in a module the dev server served (a browser stack frame) back to the original source. */
export type LocationMapper = (url: string, line: number, column: number) => Promise<SourceLocation | null>;

interface ModuleLike { file?: string | null; transformResult?: { map?: any } | null }
interface GraphLike { getModuleByUrl(url: string): Promise<ModuleLike | undefined> | ModuleLike | undefined }

/** `file` relative to the project root, with forward slashes on every platform. */
export function projectRelative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

/**
 * Uses the dev server's module graph: each transformed module keeps the source map Vite composed from every
 * plugin (JSX, TypeScript, React Refresh), so a line and column in the served code lead to the original ones.
 * Vite 6+ keeps the browser's modules in `environments.client.moduleGraph`; Vite 5 in `moduleGraph`.
 */
export function createLocationMapper(server: any, root: string): LocationMapper {
  const graph = (): GraphLike | undefined => server?.environments?.client?.moduleGraph ?? server?.moduleGraph;
  return async (url, line, column) => {
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(url).pathname); } catch { return null; }
    const mod = await graph()?.getModuleByUrl(pathname);
    if (!mod?.file || mod.file.includes(`${path.sep}node_modules${path.sep}`) || mod.file.includes('/node_modules/')) return null;
    const file = projectRelative(root, mod.file);
    if (file.startsWith('..')) return null;
    const map = mod.transformResult?.map;
    if (!map?.mappings) return { file, line, column };
    // Browser columns are 1-based; source maps use 0-based columns.
    const pos = originalPositionFor(new TraceMap(map), { line, column: Math.max(0, column - 1) });
    if (pos.line == null) return null;
    return { file, line: pos.line, column: (pos.column ?? 0) + 1 };
  };
}
