#!/usr/bin/env node
// Try the current code in a real project, exactly as people will install it, before publishing.
//
// Starts a private npm registry on this machine (Verdaccio) and publishes the five packages to it under a fresh
// version (e.g. 0.2.1-local.1729500000), so nothing is cached from earlier tries. Everything else is passed through
// to npmjs. Point npm at it, and `npx agent-hover init`, the plugin install and every agent's `npx -y @agent-hover/mcp`
// get this code. Run `start` again after changing code; `stop` when done.
//
// Usage: node scripts/local-registry.mjs start | stop | status
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, '.local-registry');
const PORT = 4873;
const URL_ = `http://127.0.0.1:${PORT}/`;
const VERDACCIO = 'verdaccio@6.10.4';
const PACKAGES = ['core', 'overlay', 'vite', 'mcp', 'cli'];
const win = process.platform === 'win32';
const pidFile = path.join(dir, 'pid');

const cmd = process.argv[2] || 'start';
const run = (c, args, cwd = root) => {
  const r = spawnSync(c, args, { cwd, encoding: 'utf8', shell: win, stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`${c} ${args.join(' ')} failed:\n${r.stdout}${r.stderr}`);
  return r.stdout;
};
const ping = () => fetch(URL_ + '-/ping').then((r) => r.ok).catch(() => false);

function stop() {
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, 'utf8'));
    try {
      if (win) spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
      else process.kill(-pid, 'SIGTERM');
    } catch { /* already gone */ }
  }
  rmSync(dir, { recursive: true, force: true });
}

async function start() {
  if (await ping() && !existsSync(pidFile)) throw new Error(`Something else is already using port ${PORT}.`);
  stop();
  mkdirSync(path.join(dir, 'staging'), { recursive: true });

  // Our packages live only here (no uplink, so npmjs versions never mix in); everything else comes from npmjs.
  const ours = { access: '$all', publish: '$all', unpublish: '$all' };
  writeFileSync(path.join(dir, 'config.yaml'), [
    `storage: ${JSON.stringify(path.join(dir, 'storage'))}`,
    'uplinks:',
    '  npmjs:',
    '    url: https://registry.npmjs.org/',
    'packages:',
    `  '@agent-hover/*': ${JSON.stringify(ours)}`,
    `  'agent-hover': ${JSON.stringify(ours)}`,
    `  '**': { access: $all, proxy: npmjs }`,
    'log: { type: stdout, format: pretty, level: warn }',
    `listen: 127.0.0.1:${PORT}`,
    '',
  ].join('\n'));

  console.log('[local-registry] building the packages');
  run('npm', ['run', 'build']);

  console.log(`[local-registry] starting ${VERDACCIO} on ${URL_}`);
  const child = spawn('npx', ['-y', VERDACCIO, '--config', path.join(dir, 'config.yaml')], { cwd: dir, shell: win, detached: !win, stdio: 'ignore' });
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  for (let i = 0; i < 360 && !(await ping()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await ping())) throw new Error('The registry did not start within 3 minutes (the first run downloads Verdaccio).');

  // A fresh version for every start, and internal dependencies pinned to it (a ^range skips prereleases).
  const base = JSON.parse(readFileSync(path.join(root, 'packages/vite/package.json'), 'utf8')).version.replace(/-.*$/, '');
  const [maj, min, pat] = base.split('.').map(Number);
  const version = `${maj}.${min}.${pat + 1}-local.${Math.floor(Date.now() / 1000)}`;
  const npmrc = path.join(dir, 'publish.npmrc');
  writeFileSync(npmrc, `registry=${URL_}\n//127.0.0.1:${PORT}/:_authToken=local\n`);
  for (const p of PACKAGES) {
    const out = path.join(dir, 'staging', p);
    mkdirSync(out, { recursive: true });
    run('npm', ['pack', '--silent', '--ignore-scripts', '--pack-destination', out], path.join(root, 'packages', p));
    const tgz = readdirSync(out).find((f) => f.endsWith('.tgz'));
    run('tar', ['-xzf', tgz], out);
    const pkgDir = path.join(out, 'package');
    const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    pkg.version = version;
    for (const deps of [pkg.dependencies, pkg.peerDependencies]) {
      for (const name of Object.keys(deps || {})) if (name.startsWith('@agent-hover/')) deps[name] = version;
    }
    writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    run('npm', ['publish', '--ignore-scripts', '--tag', 'latest', '--userconfig', npmrc, '--registry', URL_], pkgDir);
    console.log(`  ✓ ${pkg.name}@${version}`);
  }

  console.log(`
[local-registry] ready: ${version} on ${URL_}

Use it (in any terminal; agents read the same npm settings):
  npm config set registry ${URL_}

Then in a real Vite + React project:
  npx agent-hover@${version} init

When you're done:
  node scripts/local-registry.mjs stop
  npm config delete registry
`);
}

try {
  if (cmd === 'stop') { stop(); console.log('[local-registry] stopped'); }
  else if (cmd === 'status') console.log((await ping()) ? `[local-registry] running on ${URL_}` : '[local-registry] not running');
  else await start();
} catch (err) {
  console.error(`[local-registry] ${err.message}`);
  process.exitCode = 1;
}
