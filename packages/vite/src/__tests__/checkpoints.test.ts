import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CheckpointStore } from '../checkpoints.js';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (root: string, p: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
  fs.writeFileSync(path.join(root, p), text);
};
const read = (root: string, p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('CheckpointStore (Undo, P3-01)', () => {
  let repo: string;
  let project: string;

  beforeEach(() => {
    repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ah-cp-')));
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 't@example.com');
    git(repo, 'config', 'user.name', 'Test');
    // A monorepo-style layout: the Vite project lives in app/.
    project = path.join(repo, 'app');
    write(repo, 'app/src/Hero.tsx', 'export const Hero = () => <h1>v1</h1>;\n');
    write(repo, 'app/src/Card.tsx', 'export const Card = () => null;\n');
    write(repo, '.gitignore', 'node_modules\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-qm', 'init');
    // Your own uncommitted work before the agent starts:
    write(repo, 'app/src/Hero.tsx', 'export const Hero = () => <h1>v2 (mine, uncommitted)</h1>;\n');
    write(repo, 'app/src/notes.md', 'my untracked notes\n');
  });

  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it('restores exactly what was there at claim time, including uncommitted and untracked work', async () => {
    const store = new CheckpointStore(project);
    const headBefore = git(repo, 'rev-parse', 'HEAD');
    const statusBefore = git(repo, 'status', '--porcelain');
    const cp = await store.create('task_1');
    expect(cp).toBeTruthy();
    // Taking a checkpoint must not change HEAD, the index or the working tree.
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(headBefore);
    const withoutData = (st: string) => st.split('\n').filter((l) => !l.includes('.agent-hover')).join('\n');
    expect(withoutData(git(repo, 'status', '--porcelain'))).toBe(statusBefore);

    // The agent edits, creates, deletes:
    write(repo, 'app/src/Hero.tsx', 'export const Hero = () => <h1>v3 agent</h1>;\n');
    write(repo, 'app/src/NewThing.tsx', 'export const NewThing = 1;\n');
    write(repo, 'app/src/notes.md', 'agent rewrote notes\n');
    fs.rmSync(path.join(repo, 'app/src/Card.tsx'));

    const changes = await store.changes('task_1', ['src/Hero.tsx']);
    expect(changes.available).toBe(true);
    const byPath = Object.fromEntries(changes.files.map((f) => [f.path, f]));
    expect(byPath['app/src/Hero.tsx']).toMatchObject({ status: 'modified', display: 'src/Hero.tsx', reported: true });
    expect(byPath['app/src/NewThing.tsx']).toMatchObject({ status: 'added', reported: false });
    expect(byPath['app/src/notes.md']).toMatchObject({ status: 'modified' });
    expect(byPath['app/src/Card.tsx']).toMatchObject({ status: 'deleted' });

    const result = await store.undo('task_1');
    expect(result.errors).toEqual([]);
    expect(read(repo, 'app/src/Hero.tsx')).toBe('export const Hero = () => <h1>v2 (mine, uncommitted)</h1>;\n');
    expect(read(repo, 'app/src/notes.md')).toBe('my untracked notes\n');
    expect(read(repo, 'app/src/Card.tsx')).toBe('export const Card = () => null;\n');
    expect(fs.existsSync(path.join(repo, 'app/src/NewThing.tsx'))).toBe(false);
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(headBefore);
    expect((await store.changes('task_1')).files).toEqual([]);
    expect((await store.get('task_1'))?.undoneAt).toBeTruthy();
  });

  it('can undo selected files only', async () => {
    const store = new CheckpointStore(project);
    await store.create('task_2');
    write(repo, 'app/src/Hero.tsx', 'agent hero\n');
    write(repo, 'app/src/Card.tsx', 'agent card\n');
    await store.undo('task_2', ['app/src/Card.tsx']);
    expect(read(repo, 'app/src/Card.tsx')).toBe('export const Card = () => null;\n');
    expect(read(repo, 'app/src/Hero.tsx')).toBe('agent hero\n');
  });

  it('works on a clean tree and ignores .agent-hover data', async () => {
    git(repo, 'add', '-A');
    git(repo, 'commit', '-qm', 'clean');
    const store = new CheckpointStore(project);
    const cp = await store.create('task_3');
    expect(cp!.base).toBe(cp!.head);
    write(repo, 'app/.agent-hover/tasks.json', '{}');
    write(repo, 'app/src/Hero.tsx', 'changed\n');
    const changes = await store.changes('task_3');
    expect(changes.files.map((f) => f.path)).toEqual(['app/src/Hero.tsx']);
  });

  it('reports Undo as unavailable outside git or without a checkpoint', async () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-nogit-'));
    try {
      const store = new CheckpointStore(plain);
      expect(await store.create('t')).toBeNull();
      expect(await store.changes('t')).toMatchObject({ available: false, reason: expect.stringContaining('git') });
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
    expect(await new CheckpointStore(project).changes('missing')).toMatchObject({ available: false });
  });
});
