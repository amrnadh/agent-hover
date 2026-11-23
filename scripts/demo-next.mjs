#!/usr/bin/env node
// The Next.js demo (demo-next/) is the Vite demo's app in a Next.js shell: its src/ and public/ are copied from
// demo/, so both run the same components and the e2e specs see the same files (src/components/Hero.tsx …).
// Usage: node scripts/demo-next.mjs sync [target]   (target: demo-next/ by default; e2e copies pass their own)
import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');

/** Copy the Vite demo's app into a Next.js shell folder (replacing an older copy). */
export function syncDemo(dest) {
  for (const dir of ['src', 'public']) {
    rmSync(path.join(dest, dir), { recursive: true, force: true });
    cpSync(path.join(root, 'demo', dir), path.join(dest, dir), {
      recursive: true,
      // main.tsx is Vite's entry; app/page.tsx renders App instead.
      filter: (src) => path.basename(src) !== 'main.tsx',
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [cmd, target = path.join(root, 'demo-next')] = process.argv.slice(2);
  if (cmd !== 'sync') {
    console.error('Usage: node scripts/demo-next.mjs sync [target]');
    process.exit(1);
  }
  syncDemo(path.resolve(target));
}
