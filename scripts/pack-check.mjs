#!/usr/bin/env node
// Release gate: what each package would publish. Fails on missing entry points, stray sources or tests,
// version drift between packages, or internal dependencies that point at another version.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PACKAGES = ['core', 'overlay', 'vite', 'mcp', 'cli'];
const root = path.resolve(import.meta.dirname, '..');
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const problems = [];

for (const dir of PACKAGES) {
  const cwd = path.join(root, 'packages', dir);
  const pkg = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  const [info] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const files = info.files.map((f) => f.path);
  const fail = (msg) => problems.push(`${pkg.name}: ${msg}`);

  if (pkg.version !== version) fail(`version ${pkg.version}, expected ${version}`);
  for (const [name, range] of Object.entries(pkg.dependencies || {})) {
    if (name.startsWith('@agent-hover/') && range !== `^${version}`) fail(`depends on ${name}@${range}, expected ^${version}`);
  }
  for (const required of ['package.json', 'README.md', 'LICENSE']) if (!files.includes(required)) fail(`missing ${required}`);
  const entries = [pkg.main, ...Object.values(pkg.bin || {})].filter(Boolean).map((f) => f.replace(/^\.\//, ''));
  for (const entry of entries) if (!files.includes(entry)) fail(`entry ${entry} is not in the package (did the build run?)`);
  const stray = files.filter((f) => /(^|\/)(src|__tests__)\/|\.test\.|\.map$/.test(f));
  if (stray.length) fail(`ships ${stray.slice(0, 3).join(', ')}${stray.length > 3 ? ' …' : ''}`);
  if (!pkg.engines?.node) fail('no engines.node');
  console.log(`${pkg.name.padEnd(22)} ${pkg.version}  ${String(files.length).padStart(3)} files  ${(info.size / 1024).toFixed(0).padStart(4)} kB`);
}

if (problems.length) {
  console.error('\n' + problems.map((p) => '✗ ' + p).join('\n'));
  process.exit(1);
}
console.log('\nAll packages ready to publish.');
