import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const run = promisify(execFile);

export interface Checkpoint {
  taskId: string;
  createdAt: string;
  /** Absolute path of the git work tree. */
  gitRoot: string;
  head: string;
  /** Commit holding the tracked working-tree state at claim time (`git stash create`), or HEAD when clean. */
  base: string;
  /** Untracked files at claim time → blob sha (written to the object store, so they can be restored). */
  untracked: Record<string, string>;
  undoneAt?: string;
}

export type ChangeStatus = 'modified' | 'added' | 'deleted';

export interface FileChange {
  /** Relative to the git root (used for Undo). */
  path: string;
  /** Relative to the project root when inside it (for display and opening in the editor). */
  display: string;
  status: ChangeStatus;
  additions?: number;
  deletions?: number;
  /** False when the agent's summary did not list this file (you, or another tool, may have edited it). */
  reported: boolean;
}

export interface ChangesResult {
  available: boolean;
  reason?: string;
  files: FileChange[];
  undoneAt?: string;
}

const MAX_CHECKPOINTS = 50;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Per-task git checkpoints for Undo (spec §7.12, D-15).
 * Taken when the agent claims a task; Undo restores only the files changed since, one file at a time.
 * Never runs `reset --hard`, `clean` or `checkout .`, and never touches the index or HEAD.
 */
export class CheckpointStore {
  private dir: string;
  private gitRootPromise: Promise<string | null> | null = null;

  constructor(private projectRoot: string) {
    this.dir = path.join(projectRoot, '.agent-hover', 'checkpoints');
  }

  private async git(args: string[], cwd: string, input?: string): Promise<string> {
    if (input !== undefined) {
      return new Promise((resolve, reject) => {
        const child = execFile('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => (err ? reject(err) : resolve(String(stdout))));
        child.stdin?.end(input);
      });
    }
    const { stdout } = await run('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 });
    return String(stdout);
  }

  /** Work-tree root, or null when the project is not inside a git repository. */
  gitRoot(): Promise<string | null> {
    if (!this.gitRootPromise) {
      this.gitRootPromise = this.git(['rev-parse', '--show-toplevel'], this.projectRoot)
        .then((s) => s.trim() || null)
        .catch(() => null);
    }
    return this.gitRootPromise;
  }

  private file(taskId: string) {
    return path.join(this.dir, taskId.replace(/[^\w.-]/g, '_') + '.json');
  }

  async get(taskId: string): Promise<Checkpoint | null> {
    try {
      return JSON.parse(await fs.readFile(this.file(taskId), 'utf8'));
    } catch {
      return null;
    }
  }

  private async save(cp: Checkpoint) {
    await fs.mkdir(this.dir, { recursive: true });
    const target = this.file(cp.taskId);
    await fs.writeFile(target + '.tmp', JSON.stringify(cp, null, 2));
    await fs.rename(target + '.tmp', target);
  }

  private async untrackedFiles(root: string): Promise<string[]> {
    const out = await this.git(['ls-files', '--others', '--exclude-standard', '-z'], root);
    return out.split('\0').filter((p) => p && !p.split('/').includes('.agent-hover'));
  }

  /** Record the state of the work tree for `taskId`. Returns null without git. */
  async create(taskId: string): Promise<Checkpoint | null> {
    const root = await this.gitRoot();
    if (!root) return null;
    const head = (await this.git(['rev-parse', 'HEAD'], root).catch(() => '')).trim();
    if (!head) return null; // repository without commits
    // stash create refreshes the index, so it fails while another git process (an editor polling
    // `git status`) holds index.lock. Retry briefly before giving up.
    let stash = '';
    for (let attempt = 0; ; attempt++) {
      try {
        stash = (await this.git(['stash', 'create'], root)).trim();
        break;
      } catch (err) {
        if (attempt >= 4) throw err;
        await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
      }
    }
    const untracked: Record<string, string> = {};
    const files = (await this.untrackedFiles(root)).slice(0, 2000);
    if (files.length) {
      const shas = (await this.git(['hash-object', '-w', '--stdin-paths'], root, files.join('\n') + '\n')).trim().split('\n');
      files.forEach((f, i) => { if (shas[i]) untracked[f] = shas[i]; });
    }
    const cp: Checkpoint = { taskId, createdAt: new Date().toISOString(), gitRoot: root, head, base: stash || head, untracked };
    await this.save(cp);
    this.prune().catch(() => {});
    return cp;
  }

  /** Files changed since the checkpoint (tracked diff + new or changed untracked files). */
  async changes(taskId: string, reported: string[] = []): Promise<ChangesResult> {
    const root = await this.gitRoot();
    if (!root) return { available: false, reason: 'Undo needs a git repository.', files: [] };
    const cp = await this.get(taskId);
    if (!cp) return { available: false, reason: 'No checkpoint: the agent did not claim this task through Agent Hover.', files: [] };

    const norm = (p: string) => p.replace(/^\.\//, '');
    const display = (p: string) => {
      const rel = path.relative(this.projectRoot, path.join(root, p));
      return rel.startsWith('..') ? p : rel;
    };
    const reportedSet = new Set(reported.map((r) => norm(path.isAbsolute(r) ? path.relative(root, r) : path.relative(root, path.resolve(this.projectRoot, r)))));
    const files: FileChange[] = [];

    const numstat = await this.git(['diff', '--numstat', '-z', cp.base, '--'], root).catch(() => '');
    const status = await this.git(['diff', '--name-status', '-z', cp.base, '--'], root).catch(() => '');
    const counts = new Map<string, [number, number]>();
    const ns = numstat.split('\0');
    for (let i = 0; i < ns.length; i++) {
      const m = ns[i].match(/^(\d+|-)\t(\d+|-)\t(.*)$/);
      if (m) counts.set(m[3], [Number(m[1]) || 0, Number(m[2]) || 0]);
    }
    const st = status.split('\0').filter(Boolean);
    for (let i = 0; i + 1 < st.length; i += 2) {
      const code = st[i][0];
      const p = st[i + 1];
      if (p.split('/').includes('.agent-hover')) continue;
      const c = counts.get(p);
      files.push({ path: p, display: display(p), status: code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified', additions: c?.[0], deletions: c?.[1], reported: reportedSet.has(p) });
    }

    const now = await this.untrackedFiles(root);
    const before = cp.untracked || {};
    for (const p of now) {
      if (!(p in before)) {
        files.push({ path: p, display: display(p), status: 'added', reported: reportedSet.has(p) });
      } else {
        const sha = (await this.git(['hash-object', '--', p], root).catch(() => '')).trim();
        if (sha && sha !== before[p]) files.push({ path: p, display: display(p), status: 'modified', reported: reportedSet.has(p) });
      }
    }
    for (const p of Object.keys(before)) {
      if (!now.includes(p)) {
        const exists = await fs.access(path.join(root, p)).then(() => true, () => false);
        if (!exists) files.push({ path: p, display: display(p), status: 'deleted', reported: reportedSet.has(p) });
      }
    }
    return { available: true, files, undoneAt: cp.undoneAt };
  }

  /** Restore files to their checkpoint state. Limits to `only` when given (paths relative to the git root). */
  async undo(taskId: string, only?: string[]): Promise<{ restored: string[]; removed: string[]; errors: string[] }> {
    const root = await this.gitRoot();
    const cp = root ? await this.get(taskId) : null;
    if (!root || !cp) throw new Error('No checkpoint for this task');
    const { files } = await this.changes(taskId);
    const wanted = only ? files.filter((f) => only.includes(f.path)) : files;
    const restored: string[] = [], removed: string[] = [], errors: string[] = [];

    for (const f of wanted) {
      const abs = path.resolve(root, f.path);
      if (!abs.startsWith(root + path.sep)) { errors.push(`${f.path}: outside the repository`); continue; }
      try {
        const untrackedSha = cp.untracked?.[f.path];
        if (untrackedSha) {
          await this.writeBlob(root, untrackedSha, abs);
          restored.push(f.path);
          continue;
        }
        const inBase = await this.git(['cat-file', '-e', `${cp.base}:${f.path}`], root).then(() => true, () => false);
        if (inBase) {
          const { stdout } = await run('git', ['show', `${cp.base}:${f.path}`], { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 } as any);
          await fs.mkdir(path.dirname(abs), { recursive: true });
          await fs.writeFile(abs, stdout as unknown as Buffer);
          restored.push(f.path);
        } else {
          await fs.rm(abs, { force: true });
          removed.push(f.path);
        }
      } catch (err: any) {
        errors.push(`${f.path}: ${err.message || err}`);
      }
    }
    cp.undoneAt = new Date().toISOString();
    await this.save(cp);
    return { restored, removed, errors };
  }

  private async writeBlob(root: string, sha: string, abs: string) {
    const { stdout } = await run('git', ['cat-file', 'blob', sha], { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 } as any);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, stdout as unknown as Buffer);
  }

  /** Keep the newest 50 checkpoints and nothing older than 7 days. */
  async prune() {
    let names: string[] = [];
    try { names = (await fs.readdir(this.dir)).filter((n) => n.endsWith('.json')); } catch { return; }
    const stats = await Promise.all(names.map(async (n) => ({ n, t: (await fs.stat(path.join(this.dir, n))).mtimeMs })));
    stats.sort((a, b) => b.t - a.t);
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [i, s] of stats.entries()) {
      if (i >= MAX_CHECKPOINTS || s.t < cutoff) await fs.rm(path.join(this.dir, s.n), { force: true });
    }
  }
}
