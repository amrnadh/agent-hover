#!/usr/bin/env node
// Re-records the README GIF: runs e2e/record-demo.spec.ts on a throwaway demo copy, then converts the
// video with ffmpeg (needs ffmpeg on PATH). Output: docs/media/agent-hover.gif and .mp4.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const results = path.join(root, 'test-results');
const run = spawnSync('node', [path.join(root, 'scripts/e2e-isolated.mjs'), 'e2e/record-demo.spec.ts'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, AH_RECORD: '1' },
});
if (run.status !== 0) process.exit(run.status ?? 1);

const videos = [];
const walk = (dir) => { for (const f of readdirSync(dir)) { const p = path.join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.webm') && p.includes('record-demo')) videos.push(p); } };
walk(results);
const video = videos.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!video) { console.error('No video found under test-results/'); process.exit(1); }

const out = path.join(root, 'docs/media');
mkdirSync(out, { recursive: true });
const trim = ['-ss', process.env.AH_RECORD_TRIM || '1.2'];
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...trim, '-i', video, '-vf', 'fps=30,scale=1280:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', path.join(out, 'agent-hover.mp4')], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...trim, '-i', video, '-vf',
  'fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
  path.join(out, 'agent-hover.gif')], { stdio: 'inherit' });
for (const f of ['agent-hover.gif', 'agent-hover.mp4']) console.log(`${f}  ${(statSync(path.join(out, f)).size / 1024 / 1024).toFixed(1)} MB`);
