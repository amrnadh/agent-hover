#!/usr/bin/env node
// Run the e2e suite against a throwaway git copy of the demo on its own port, so it never edits demo/
// files (the Undo test changes a component and restores it) or collides with a dev server you have running.
// Usage: npm run test:e2e:isolated [-- <playwright args>]   (add --keep to keep the copy for debugging,
// --screenshots to write the README images, --fixture=next for the Next.js demo, --fixture=all for both)
import { cpSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const keep = args.includes('--keep');
// --screenshots refreshes the README images in docs/screenshots/ (npm run screenshots).
const screenshots = args.includes('--screenshots');
const fixtureArg = args.find((a) => a.startsWith('--fixture='));
const fixture = fixtureArg ? fixtureArg.slice('--fixture='.length) : 'vite';
if (!['vite', 'next', 'all'].includes(fixture)) {
  console.error(`[e2e] unknown --fixture=${fixture} (use vite, next or all)`);
  process.exit(1);
}
const playwrightArgs = args.filter((a) => a !== '--keep' && a !== '--screenshots' && a !== fixtureArg);

/** Every package `app` can see (workspace root first, the app's own versions win), linked into `dir`. */
function linkNodeModules(app, dir) {
  const packages = new Map();
  for (const base of [path.join(root, 'node_modules'), path.join(app, 'node_modules')]) {
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
}

/** Copy `app` into a fresh folder under `parent`, without the folders in `skip`, and commit it to a new git repo. */
function copyApp(app, parent, skip, prepare = () => {}) {
  // The real path: Windows CI's temp folder is C:\Users\RUNNER~1\…, and Vite refuses to serve files from a short
  // name it doesn't recognise ("outside of Vite serving allow list").
  mkdirSync(parent, { recursive: true });
  const dir = realpathSync.native(mkdtempSync(path.join(parent, 'ah-e2e-')));
  cpSync(app, dir, { recursive: true, filter: (src) => !skip.has(path.basename(src)) || path.dirname(src) !== app });
  prepare(dir);
  linkNodeModules(app, dir);
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=e2e', '-c', 'user.email=e2e@localhost', 'commit', '-qm', 'demo');
  return dir;
}

const copies = [];
const env = { ...process.env, AH_FIXTURE: fixture };

if (fixture !== 'next') {
  const dir = copyApp(path.join(root, 'demo'), os.tmpdir(), new Set(['node_modules', '.agent-hover', 'dist']));
  copies.push(dir);
  console.log(`[e2e] demo copy: ${dir}`);
  Object.assign(env, { AH_DEMO_DIR: dir, AH_E2E_PORT: process.env.AH_E2E_PORT || '5175' });
}

if (fixture !== 'vite') {
  // Inside the repository (git-ignored .e2e/), not the temp folder: Turbopack only reads files under one root, and
  // the copy and the node_modules it links to must share it (AH_TURBOPACK_ROOT, read by demo-next/next.config.ts).
  const { syncDemo } = await import('./demo-next.mjs');
  const skip = new Set(['node_modules', '.agent-hover', '.next', 'src', 'public', 'next-env.d.ts', '.gitignore']);
  const dir = copyApp(path.join(root, 'demo-next'), path.join(root, '.e2e'), skip, (copy) => {
    syncDemo(copy);
    // demo-next/.gitignore leaves out src/ (a copy there); here src/ is the app, and Compare and Undo need it in git.
    writeFileSync(path.join(copy, '.gitignore'), '/.next/\nnext-env.d.ts\n');
  });
  copies.push(dir);
  console.log(`[e2e] Next.js demo copy: ${dir}`);
  Object.assign(env, { AH_NEXT_DIR: dir, AH_NEXT_PORT: process.env.AH_NEXT_PORT || '3175', AH_TURBOPACK_ROOT: root });
}

// Bridges list themselves under AGENT_HOVER_HOME, not in your own ~/.agent-hover.
env.AGENT_HOVER_HOME = path.join(copies[0], '.user-home');
if (screenshots) env.AH_SCREENSHOTS = '1';

const result = spawnSync('npx', ['playwright', 'test', ...playwrightArgs], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});
for (const dir of copies) {
  if (keep) console.log(`[e2e] kept ${dir}`);
  else rmSync(dir, { recursive: true, force: true });
}
process.exit(result.status ?? 1);
