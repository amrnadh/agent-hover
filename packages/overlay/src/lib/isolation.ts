/**
 * Keeps the overlay usable while the host app shows a modal <dialog>: showModal() makes everything outside
 * the dialog inert, so the overlay host is moved into the open modal dialog and back when it closes.
 */
export class IsolationManager {
  private host: HTMLElement;
  private defaultParent: HTMLElement;
  private activeDialog: HTMLDialogElement | null = null;
  private observer: MutationObserver | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.defaultParent = host.parentElement || document.body;
    this.initDialogWatcher();
  }

  private initDialogWatcher() {
    const checkDialogs = () => {
      // Find active modal dialog (HTML5 showModal marks elements matching :modal)
      const openDialogs = Array.from(document.querySelectorAll('dialog[open]'));
      let openModalDialog: HTMLDialogElement | null = null;

      for (const d of openDialogs) {
        if (d instanceof HTMLDialogElement) {
          try {
            if (d.matches(':modal')) {
              openModalDialog = d;
              break;
            }
          } catch (_) {
            openModalDialog = d;
            break;
          }
        }
      }

      if (openModalDialog && openModalDialog !== this.activeDialog) {
        this.activeDialog = openModalDialog;
        if (this.host.parentElement !== openModalDialog) {
          openModalDialog.appendChild(this.host);
        }
      } else if (!openModalDialog && this.activeDialog) {
        this.activeDialog = null;
        const targetParent = this.defaultParent || document.body;
        if (targetParent && this.host.parentElement !== targetParent) {
          targetParent.appendChild(this.host);
        }
      }
    };

    this.observer = new MutationObserver(() => {
      checkDialogs();
    });

    if (typeof document !== 'undefined' && document.documentElement) {
      this.observer.observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['open'],
        childList: true,
      });

      window.addEventListener('close', () => checkDialogs(), { capture: true });
    }
  }

  public destroy() {
    this.observer?.disconnect();
    if (this.defaultParent && !this.defaultParent.contains(this.host)) {
      this.defaultParent.appendChild(this.host);
    }
  }
}
