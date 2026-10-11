import { esc } from '../lib/ui.js';
import type { OverlayApp } from '../app/context.js';

export interface ToastOptions {
  /** Label for an optional action button, e.g. "View". */
  action?: string;
  onAction?: () => void;
  ms?: number;
}

/** Single-line toast above the dock, with an optional action button. */
export function setupToast(app: OverlayApp) {
  const { shadow, api } = app;
  Object.assign(api, { toast });

  const el = shadow.getElementById('ah-toast') as HTMLElement;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function toast(message: string, opts: ToastOptions = {}) {
    const hasAction = !!(opts.action && opts.onAction);
    el.innerHTML = `<span>${esc(message)}</span>` + (hasAction ? `<button class="ah-tbtn outline" data-act>${esc(opts.action)}</button>` : '');
    if (hasAction) {
      (el.querySelector('[data-act]') as HTMLElement).onclick = () => {
        el.hidden = true;
        opts.onAction!();
      };
    }
    el.hidden = false;
    // Sit above the dock wherever it is.
    const dock = shadow.getElementById('ah-dock');
    const d = dock && !dock.hidden ? dock.getBoundingClientRect() : null;
    const above = d && d.top > window.innerHeight / 2 && !dock!.classList.contains('vertical');
    el.style.bottom = above ? `${Math.round(window.innerHeight - d!.top + 10)}px` : '';
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { el.hidden = true; }, opts.ms ?? (hasAction ? 5000 : 3000));
  }
}
