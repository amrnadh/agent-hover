import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

let cachedBundle: string | null = null;

export function getOverlayBundle(): string {
  if (cachedBundle) return cachedBundle;
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const bundlePath = path.join(currentDir, 'overlay.iife.js');
  if (existsSync(bundlePath)) {
    cachedBundle = readFileSync(bundlePath, 'utf-8');
    return cachedBundle;
  }
  // Fallback for development if loaded from source tree
  const devPath = path.resolve(currentDir, '../dist/overlay.iife.js');
  if (existsSync(devPath)) {
    cachedBundle = readFileSync(devPath, 'utf-8');
    return cachedBundle;
  }
  throw new Error(`[agent-hover] Overlay bundle not found at ${bundlePath}. Please run 'npm run build' first.`);
}
