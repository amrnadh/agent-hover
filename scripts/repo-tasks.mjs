#!/usr/bin/env node
// Small repository chores that used to be shell one-liners, so they also run on Windows.
// Usage: node scripts/repo-tasks.mjs sync-license | clean
import { cpSync, rmSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packages = ['core', 'overlay', 'vite', 'mcp', 'cli'];
const task = process.argv[2];

if (task === 'sync-license') {
  for (const d of packages) cpSync(path.join(root, 'LICENSE'), path.join(root, 'packages', d, 'LICENSE'));
} else if (task === 'clean') {
  for (const d of readdirSync(path.join(root, 'packages'))) rmSync(path.join(root, 'packages', d, 'dist'), { recursive: true, force: true });
  rmSync(path.join(root, 'demo', 'dist'), { recursive: true, force: true });
  rmSync(path.join(root, 'node_modules', '.cache'), { recursive: true, force: true });
} else {
  console.error('Usage: node scripts/repo-tasks.mjs sync-license | clean');
  process.exit(1);
}
