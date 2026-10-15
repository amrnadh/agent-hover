#!/usr/bin/env node
// Records the GitHub demo video from the scenes in e2e/record-demo.spec.ts (needs ffmpeg on PATH).
// Each scene runs on its own fresh demo copy (scripts/e2e-isolated.mjs), so no task markers, comments or locks
// carry over, and is cut with the start/end marks the scene saved next to its video. Clips are cached, so one
// scene can be re-recorded without the others.
// Usage: npm run record:demo           every scene, then the full video and the README GIF
//        npm run record:demo -- 2 4    re-record scenes 2 and 4 only; the other clips come from the last run
// Output: docs/media/agent-hover-demo.mp4 (all scenes); docs/media/agent-hover.gif and .mp4 (scene 1 from Send to
// Compare, the gifStart and gifEnd marks: the README top).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spec = readFileSync(path.join(root, 'e2e/record-demo.spec.ts'), 'utf8');
const scenes = [...spec.matchAll(/test\('scene-(\d\d) /g)].map((m) => m[1]);
const wanted = process.argv.slice(2).map((a) => a.padStart(2, '0'));
const unknown = wanted.filter((s) => !scenes.includes(s));
if (unknown.length) {
  console.error(`Unknown scene ${unknown.join(', ')}; scenes are ${scenes.join(', ')}`);
  process.exit(1);
}

const cache = path.join(root, 'node_modules/.cache/agent-hover-record');
const out = path.join(root, 'docs/media');
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const range = (from, to) => ['-ss', from.toFixed(2), '-to', to.toFixed(2)];
const mp4 = ['-an', '-vf', 'fps=30,scale=1280:800', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23'];

function sceneDir(scene) {
  const results = path.join(root, 'test-results');
  const dir = readdirSync(results).find((d) => d.includes(`scene-${scene}`) && existsSync(path.join(results, d, 'video.webm')));
  if (!dir) throw new Error(`No video for scene ${scene} under test-results/`);
  return path.join(results, dir);
}

for (const scene of wanted.length ? wanted : scenes) {
  console.log(`\n[record] scene ${scene}`);
  const run = spawnSync('node', [path.join(root, 'scripts/e2e-isolated.mjs'), 'e2e/record-demo.spec.ts', '-g', `scene-${scene} `], {
    cwd: root, stdio: 'inherit', env: { ...process.env, AH_RECORD: '1' },
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
  const dir = sceneDir(scene);
  const video = path.join(dir, 'video.webm');
  const marks = JSON.parse(readFileSync(path.join(dir, 'marks.json'), 'utf8'));
  ffmpeg(...range(marks.start, marks.end), '-i', video, ...mp4, path.join(cache, `${scene}.mp4`));
  if (marks.gifEnd) {
    // The README top: this scene from Send to the Compare slider, as a GIF and an MP4. It opens on the task, not on
    // pointing, because what happens after you send is what Agent Hover is about.
    const gifStart = marks.gifStart ?? marks.start;
    ffmpeg(...range(gifStart, marks.gifEnd), '-i', video, ...mp4, '-movflags', '+faststart', path.join(out, 'agent-hover.mp4'));
    ffmpeg(...range(gifStart, marks.gifEnd), '-i', video, '-vf',
      'fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      path.join(out, 'agent-hover.gif'));
  }
}

const clips = scenes.map((s) => path.join(cache, `${s}.mp4`));
const missing = scenes.filter((s, i) => !existsSync(clips[i]));
if (missing.length) {
  console.error(`\nNo clip yet for scene ${missing.join(', ')}: npm run record:demo -- ${missing.join(' ')}`);
  process.exit(1);
}
const list = path.join(cache, 'clips.txt');
writeFileSync(list, clips.map((c) => `file '${c}'`).join('\n') + '\n');
ffmpeg('-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(out, 'agent-hover-demo.mp4'));

const seconds = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));
console.log('');
for (const f of ['agent-hover-demo.mp4', 'agent-hover.mp4', 'agent-hover.gif']) {
  const p = path.join(out, f);
  console.log(`${f.padEnd(22)} ${(statSync(p).size / 1024 / 1024).toFixed(1)} MB  ${seconds(p).toFixed(1)} s`);
}
