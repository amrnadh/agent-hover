/**
 * Review: a finished task that changed files waits on its element until you Keep it, Undo it or Follow up.
 * Pure helpers shared by the markers, task card, Tasks tab and dock.
 */
export interface ReviewTask {
  status: string;
  updatedAt?: string;
  review?: { state: 'kept' | 'undone' | 'followed-up'; at: string; followUp?: string };
  result?: { filesChanged?: string[] };
}

export interface LockEntry { component: string; file?: string }

/** How long an unreviewed change keeps its marker on the page. It stays in the Tasks tab after that. */
export const REVIEW_TTL_MS = 24 * 60 * 60 * 1000;

export function needsReview(t: ReviewTask): boolean {
  return t.status === 'done' && !t.review && (t.result?.filesChanged?.length ?? 0) > 0;
}

export function reviewText(t: ReviewTask): string {
  switch (t.review?.state) {
    case 'kept': return 'Kept';
    case 'undone': return 'Undone';
    case 'followed-up': return 'Followed up';
    default: return needsReview(t) ? 'Waiting for your review' : '';
  }
}

const norm = (f: string) => f.replace(/\\/g, '/').replace(/^\.\//, '');

/** Whether two paths name the same file, one possibly absolute or rooted elsewhere ("src/a.tsx" and "/x/app/src/a.tsx"). */
export function sameFile(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.endsWith('/' + y) || y.endsWith('/' + x));
}

/** Locked components whose file the task changed (Lock asks agents to stay away; this checks they did). */
export function lockedChanges(files: string[] = [], locks: LockEntry[] = []): string[] {
  const hit = locks.filter((l) => l.file && files.some((f) => sameFile(f, l.file!)));
  return [...new Set(hit.map((l) => l.component))];
}
