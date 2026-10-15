#!/usr/bin/env node
// Type-check every package (portable replacement for a shell loop, so it runs on Windows too).
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
for (const d of ['core', 'overlay', 'vite', 'mcp', 'cli']) {
  const r = spawnSync('npx', ['tsc', '--noEmit', '-p', path.join('packages', d, 'tsconfig.json')], {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
