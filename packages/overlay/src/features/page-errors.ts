import { readPref, writePref } from '../lib/ui.js';
import { PageErrorLog, describeArgs, formatPageErrors } from '../lib/page-errors.js';
import type { OverlayApp } from '../app/context.js';

const PREF = 'agent_hover_page_errors';

/**
 * Collects console errors, uncaught exceptions and failed requests while the page runs, and hands the recent ones
 * to prompts ("On this page"). Requests to Agent Hover's own bridge are left out. Settings › Agent turns it off.
 */
export function setupPageErrors(app: OverlayApp) {
  const { BRIDGE, api } = app;
  const log = new PageErrorLog();
  Object.assign(api, {
    pageErrorsEnabled: () => readPref(PREF, 'on') !== 'off',
    setPageErrorsEnabled: (on: boolean) => writePref(PREF, on ? 'on' : 'off'),
    pageErrorLines: (): string[] => (readPref(PREF, 'on') !== 'off' ? formatPageErrors(log.list()) : []),
    pageErrorLog: log,
  });

  const port = BRIDGE.split(':').pop();
  const ours = (url: string) => url.startsWith(BRIDGE) || url.startsWith(`http://127.0.0.1:${port}/`);

  const original = console.error;
  console.error = function (...args: unknown[]) {
    try { log.add('console', describeArgs(args)); } catch { /* never break the page's logging */ }
    return original.apply(this, args as any);
  };
  window.addEventListener('error', (e) => {
    if (e.error || e.message) log.add('exception', e.error ? `${e.error.name || 'Error'}: ${e.error.message}` : e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r: any = e.reason;
    log.add('exception', r instanceof Error ? `Unhandled promise rejection: ${r.name}: ${r.message}` : `Unhandled promise rejection: ${String(r)}`);
  });

  const pageFetch = window.fetch;
  window.fetch = async function (this: unknown, input: any, init?: any) {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const method = (init?.method || input?.method || 'GET').toUpperCase();
    try {
      const res = await pageFetch.call(this, input, init);
      if (!res.ok && !ours(url)) log.add('request', `${method} ${url} → ${res.status}${res.statusText ? ' ' + res.statusText : ''}`);
      return res;
    } catch (err: any) {
      if (!ours(url) && err?.name !== 'AbortError') log.add('request', `${method} ${url} → ${err?.message || 'network error'}`);
      throw err;
    }
  } as typeof window.fetch;

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (this: any, method: string, url: string | URL, ...rest: any[]) {
    this.__ah = { method: String(method).toUpperCase(), url: String(url) };
    return (open as any).call(this, method, url, ...rest);
  } as any;
  XMLHttpRequest.prototype.send = function (this: any, body?: any) {
    this.addEventListener('loadend', () => {
      const m = this.__ah;
      if (!m || ours(m.url)) return;
      if (this.status === 0) log.add('request', `${m.method} ${m.url} → network error`);
      else if (this.status >= 400) log.add('request', `${m.method} ${m.url} → ${this.status}`);
    });
    return send.call(this, body);
  };
}
