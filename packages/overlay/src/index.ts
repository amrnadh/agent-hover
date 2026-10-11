import { readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

let cached: { path: string; mtimeMs: number; code: string } | null = null;

/**
 * The built overlay (IIFE) as a string, for the Vite plugin to inject. Re-read when the file changes on disk,
 * so a rebuilt overlay is picked up without restarting the dev server.
 */
export function getOverlayBundle(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.join(currentDir, 'overlay.iife.js'), path.resolve(currentDir, '../dist/overlay.iife.js')];
  const bundlePath = candidates.find((p) => existsSync(p));
  if (!bundlePath) {
    throw new Error(`[agent-hover] Overlay bundle not found at ${candidates[0]}. Please run 'npm run build' first.`);
  }
  const mtimeMs = statSync(bundlePath).mtimeMs;
  if (!cached || cached.path !== bundlePath || cached.mtimeMs !== mtimeMs) {
    cached = { path: bundlePath, mtimeMs, code: readFileSync(bundlePath, 'utf-8') };
  }
  return cached.code;
}
