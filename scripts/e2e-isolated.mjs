#!/usr/bin/env node
// Run the e2e suite against a throwaway git copy of the demo on its own port, so it never edits demo/
// files (the Undo test changes a component and restores it) or collides with a dev server you have running.
// Usage: npm run test:e2e:isolated [-- <playwright args>]   (add --keep to keep the copy for debugging)
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const demo = path.join(root, 'demo');
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const playwrightArgs = args.filter((a) => a !== '--keep');

const dir = mkdtempSync(path.join(os.tmpdir(), 'ah-e2e-'));
const skip = new Set(['node_modules', '.agent-hover', 'dist']);
cpSync(demo, dir, { recursive: true, filter: (src) => !skip.has(path.basename(src)) || path.dirname(src) !== demo });

// node_modules: link every package the demo can see (workspace root first, the demo's own versions win).
const packages = new Map();
for (const base of [path.join(root, 'node_modules'), path.join(demo, 'node_modules')]) {
  if (!existsSync(base)) continue;
  for (const name of readdirSync(base)) {
    if (name.startsWith('.')) continue;
    if (name.startsWith('@')) for (const sub of readdirSync(path.join(base, name))) packages.set(`${name}/${sub}`, path.join(base, name, sub));
    else packages.set(name, path.join(base, name));
  }
}
for (const [name, target] of packages) {
  const link = path.join(dir, 'node_modules', name);
  mkdirSync(path.dirname(link), { recursive: true });
  symlinkSync(target, link, 'junction');
}

const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
git('init', '-q');
git('add', '-A');
git('-c', 'user.name=e2e', '-c', 'user.email=e2e@localhost', 'commit', '-qm', 'demo');

console.log(`[e2e] demo copy: ${dir}`);
const result = spawnSync('npx', ['playwright', 'test', ...playwrightArgs], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, AH_DEMO_DIR: dir, AH_E2E_PORT: process.env.AH_E2E_PORT || '5175' },
});
if (keep) console.log(`[e2e] kept ${dir}`);
else rmSync(dir, { recursive: true, force: true });
process.exit(result.status ?? 1);
