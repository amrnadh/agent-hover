// @ts-nocheck
import type { OverlayApp } from '../app/context.js';

/** Dock callout toast (showCallout). */
export function setupToast(app: OverlayApp) {
  const { dom, api } = app;
  Object.assign(api, { showCallout });

  let calloutTimer = null;
  function showCallout(text, meta, duration = 2000) {
    dom.calloutText.textContent = text;
    dom.calloutMeta.textContent = meta || '';

    // Reset and apply theme-aware meta classification
    dom.callout.className = '';
    dom.calloutMeta.className = 'cp-callout-time';

    if (meta) {
      const m = String(meta).toLowerCase();
      let metaClass = 'meta-info';
      if (m === 'saved' || m === 'copied') metaClass = 'meta-success';
      else if (m === 'snap') metaClass = 'meta-snap';
      else if (m === 'error') metaClass = 'meta-error';
      else if (m === 'warning') metaClass = 'meta-warning';
      else if (m === 'hmr' || m === 'edit' || m === 'source' || m === 'undo') metaClass = 'meta-code';
      else if (m === 'pin' || m === 'note' || m === 'tip' || m === 'alt' || m === 'dock' || m === 'theme' || m === 'mode' || m === 'set' || m === 'ide') metaClass = 'meta-info';

      dom.callout.classList.add(metaClass);
      dom.calloutMeta.classList.add(metaClass);
    }

    dom.callout.classList.add('show');
    if (calloutTimer) clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => {
      dom.callout.classList.remove('show');
      calloutTimer = null;
    }, duration);
  }
}
