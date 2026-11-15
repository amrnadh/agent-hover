#!/usr/bin/env node
/**
 * Builds the GitHub Pages site into _site/: the pages in site/, plus the images, video and overlay stylesheet
 * they use, copied from where they already live so nothing is kept twice.
 *
 *   node scripts/build-site.mjs        (or npm run site:build)
 *
 * The hero demo renders the real overlay UI, so its stylesheet comes straight from packages/overlay.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');

/** [source in the repo, destination in _site] */
const files = [
  ['packages/overlay/src/styles/ui.css', 'assets/overlay-ui.css'],
  ['docs/brand/logo/favicon.svg', 'assets/brand/favicon.svg'],
  ['docs/brand/logo/apple-touch-icon.png', 'assets/brand/apple-touch-icon.png'],
  ['docs/brand/logo/social.png', 'assets/brand/social.png'],
  ['docs/media/launch/agent-hover-launch.mp4', 'assets/media/agent-hover-launch.mp4'],
  ['docs/media/launch/agent-hover-launch-thumbnail.png', 'assets/media/agent-hover-launch-thumbnail.png'],
];
const screenshots = 'docs/screenshots/v0.2';

const missing = [...files.map(([src]) => src), 'site', screenshots].filter((p) => !existsSync(join(root, p)));
if (missing.length) {
  console.error(`build-site: missing ${missing.join(', ')}`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'site'), out, { recursive: true });
for (const [src, dest] of files) {
  mkdirSync(dirname(join(out, dest)), { recursive: true });
  cpSync(join(root, src), join(out, dest));
}
mkdirSync(join(out, 'assets/screenshots'), { recursive: true });
for (const f of readdirSync(join(root, screenshots)).filter((f) => f.endsWith('.png'))) {
  cpSync(join(root, screenshots, f), join(out, 'assets/screenshots', f));
}

console.log(`build-site: wrote ${out}`);
