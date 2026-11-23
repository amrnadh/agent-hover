import path from 'path';

export interface SourceLocation { file: string; line: number; column: number }

/**
 * Maps a position in code the dev server served (a browser stack frame) back to the original source. Each framework
 * integration has its own: the Vite plugin reads Vite's module graph, the Next.js one reads the dev build's source maps.
 */
export type LocationMapper = (url: string, line: number, column: number) => Promise<SourceLocation | null>;

/** `file` relative to the project root, with forward slashes on every platform. */
export function projectRelative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}
