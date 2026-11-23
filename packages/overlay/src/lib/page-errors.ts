/**
 * Page errors (a light version of spec P3-03): console errors, uncaught exceptions and failed requests since the
 * page loaded, so a "fix this" request carries what went wrong. Kept small: the newest entries, repeats folded.
 */

export type PageErrorKind = 'console' | 'exception' | 'request';

export interface PageError {
  kind: PageErrorKind;
  message: string;
  count: number;
  at: number;
}

const MAX_ENTRIES = 20;
const MAX_LENGTH = 300;

/** One line, no long stack traces, and nothing that looks like a token or password in a URL. */
export function cleanMessage(text: string): string {
  const firstLines = String(text).split('\n').slice(0, 2).join(' · ');
  return firstLines
    .replace(/([?&](?:token|key|apikey|api_key|access_token|auth|password|secret|sig|signature)=)[^&\s]+/gi, '$1…')
    .replace(/\bBearer\s+[\w.-]+/g, 'Bearer …')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}

export class PageErrorLog {
  private entries: PageError[] = [];

  add(kind: PageErrorKind, message: string, now = Date.now()) {
    const msg = cleanMessage(message);
    if (!msg) return;
    const same = this.entries.find((e) => e.kind === kind && e.message === msg);
    if (same) {
      same.count++;
      same.at = now;
      return;
    }
    this.entries.push({ kind, message: msg, count: 1, at: now });
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
  }

  list(): PageError[] {
    return [...this.entries].sort((a, b) => a.at - b.at);
  }

  clear() {
    this.entries = [];
  }
}

const LABEL: Record<PageErrorKind, string> = { console: 'Console error', exception: 'Uncaught', request: 'Failed request' };

/** Prompt lines for the most recent errors (newest last). */
export function formatPageErrors(errors: PageError[], max = 8): string[] {
  return errors.slice(-max).map((e) => `- ${LABEL[e.kind]}: ${e.message}${e.count > 1 ? ` (×${e.count})` : ''}`);
}

/** Text for anything a page passes to console.error. */
export function describeArgs(args: unknown[]): string {
  return args
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()))
    .join(' ');
}
