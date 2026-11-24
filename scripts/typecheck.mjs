#!/usr/bin/env node
// Type-check every package (portable replacement for a shell loop, so it runs on Windows too), plus type tests:
// code written the way users write it against our types (packages/next/type-tests: next.config with NextConfig).
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const projects = [
  ...['core', 'overlay', 'bridge', 'vite', 'next', 'mcp', 'cli'].map((d) => path.join('packages', d, 'tsconfig.json')),
  path.join('packages', 'next', 'tsconfig.types.json'),
];
for (const project of projects) {
  const r = spawnSync('npx', ['tsc', '--noEmit', '-p', project], {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
