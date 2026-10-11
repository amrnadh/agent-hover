import { ICONS } from '../icons.js';
import { icon, GRIP } from '../lib/icon.js';
import tokensCss from '../styles/tokens.css?inline';
import overlayCss from '../styles/overlay.css?inline';
import uiCss from '../styles/ui.css?inline';

/**
 * Overlay markup (0.2 UI, see docs/design/prototype.html). Everything lives in one shadow root.
 * Surfaces: selector (hover/selection/batch/measure layers), action pill + menu, composer, task card,
 * comment card, dock (+ menu, connection popover, tooltip), toast, sidebar. Screenshot preview and
 * lightbox markup is unchanged from 0.1.
 */
export function getOverlayHtml(): string {
  return `
        <style>
${tokensCss}
${overlayCss}
${uiCss}
        </style>

        <div id="ah-capture-layer" class="ah-capture-layer" aria-hidden="true"></div>

        <div id="ah-hover" class="ah-ov" hidden></div>
        <div id="ah-hover-label" hidden></div>
        <div id="ah-sel-frame" class="ah-ov" hidden><i></i><i></i><i></i><i></i></div>
        <div id="ah-layer-batch"></div>
        <div id="ah-layer-measure"></div>
        <div id="ah-layer-markers"></div>
        <div id="ah-layer-pins"></div>

        <div id="ah-pill" class="ah-surface" hidden role="toolbar" aria-label="Selected element">
          <button class="who" id="ah-pill-who" title="Open in editor"><b id="ah-pill-name"></b><span id="ah-pill-file"></span></button>
          <span class="ah-sep"></span>
          <button class="ah-tbtn" id="ah-pill-ask" title="Ask your agent (Enter)">${icon('send', 14)}Ask</button>
          <button class="ah-ibtn" id="ah-pill-comment" title="Comment (C)" aria-label="Comment">${icon('comment')}</button>
          <button class="ah-ibtn" id="ah-pill-batch" title="Add to batch (B)" aria-label="Add to batch" aria-pressed="false">${icon('layers-plus')}</button>
          <button class="ah-ibtn" id="ah-pill-copy" title="Copy context (⌘C)" aria-label="Copy context">${icon('copy')}</button>
          <button class="ah-ibtn" id="ah-pill-more" title="More" aria-label="More actions" aria-haspopup="menu">${icon('more')}</button>
          <span class="ah-sep"></span>
          <button class="ah-ibtn" id="ah-pill-close" title="Deselect (Esc)" aria-label="Deselect">${icon('x')}</button>
        </div>

        <div id="ah-pill-menu" class="ah-menu ah-surface" hidden role="menu">
          <button data-act="editor" role="menuitem">${icon('code')}Open in editor<kbd>O</kbd></button>
          <button data-act="shot" role="menuitem">${icon('camera')}Screenshot element</button>
          <button data-act="freeze" role="menuitem">${icon('lock')}<span id="ah-freeze-label">Don't let agents change this</span></button>
          <hr>
          <button data-act="parent" role="menuitem">${icon('up')}Select parent<kbd>↑</kbd></button>
          <button data-act="child" role="menuitem">${icon('down')}Select child<kbd>↓</kbd></button>
          <hr>
          <button data-act="details" role="menuitem">${icon('panel')}Show details<kbd>D</kbd></button>
        </div>

        <div id="ah-composer" class="ah-surface" hidden role="dialog" aria-label="Ask your agent">
          <div class="target">${icon('target', 14)}<b id="ah-comp-name"></b><span id="ah-comp-file" class="ah-mono"></span></div>
          <textarea id="ah-comp-input" aria-label="What should change" placeholder="What should change? e.g. Make the amount larger and add a sparkline"></textarea>
          <div class="foot">
            <button class="ah-tbtn outline dest" id="ah-comp-dest" aria-haspopup="menu"><span class="ah-dot" id="ah-comp-dest-dot"></span><span id="ah-comp-dest-label"></span>${icon('chev-down', 14)}</button>
            <button class="ah-tbtn" id="ah-comp-cancel">Cancel</button>
            <button class="ah-tbtn primary" id="ah-comp-send"><span id="ah-comp-send-label">Send</span><kbd id="ah-comp-kbd">⌘↵</kbd></button>
          </div>
          <div class="hint" id="ah-comp-hint" hidden></div>
        </div>
        <div id="ah-dest-menu" class="ah-menu ah-surface" hidden role="menu"></div>

        <div id="ah-task-card" class="ah-card ah-surface" hidden role="dialog" aria-label="Task"></div>
        <div id="ah-comment-card" class="ah-card ah-surface" hidden role="dialog" aria-label="Comment"></div>

        <div id="ah-dock" class="ah-surface" role="toolbar" aria-label="Agent Hover">
          <button class="ah-ibtn mark" id="ah-d-mark" data-tip="Agent Hover" aria-label="Connection status">${icon('mark')}<span class="ah-dot" id="ah-d-mark-dot"></span></button>
          <span class="ah-sep"></span>
          <button class="ah-ibtn" id="ah-d-inspect" data-tip="Inspect" data-key="Alt" aria-pressed="false" aria-label="Inspect">${icon('pointer')}</button>
          <button class="ah-ibtn" id="ah-d-comment" data-tip="Comment" data-key="C" aria-pressed="false" aria-label="Comment mode">${icon('comment')}</button>
          <button class="ah-ibtn" id="ah-d-tasks" data-tip="Tasks" data-key="T" aria-pressed="false" aria-label="Tasks">${icon('tasks')}<span class="ah-dot pulse warn working" id="ah-d-tasks-dot" hidden></span></button>
          <button class="ah-ibtn" id="ah-d-batch" data-tip="Batch" data-key="B" aria-pressed="false" aria-label="Batch">${icon('layers')}<span class="count" id="ah-d-batch-count" hidden>0</span></button>
          <span class="ah-sep"></span>
          <button class="ah-ibtn" id="ah-d-more" data-tip="More" aria-label="More" aria-haspopup="menu">${icon('more')}</button>
          <span class="grip" id="ah-d-grip" title="Drag to move" aria-hidden="true">${GRIP}</span>
        </div>
        <button id="ah-dock-min" class="ah-surface" hidden aria-label="Show Agent Hover dock" title="Show dock (⌘⇧X)">${icon('mark', 18)}<span class="ah-dot" id="ah-dock-min-dot"></span></button>
        <div id="ah-dock-tip" class="ah-tip" hidden></div>
        <div id="ah-dock-menu" class="ah-menu ah-surface" hidden role="menu">
          <button data-act="sidebar" role="menuitem">${icon('panel')}Open sidebar</button>
          <button data-act="shot" role="menuitem">${icon('camera')}Screenshot visible area</button>
          <button data-act="shotfull" role="menuitem">${icon('camera')}Screenshot full page</button>
          <hr>
          <button data-act="settings" role="menuitem">${icon('gear')}Settings</button>
          <button data-act="keys" role="menuitem">${icon('keyboard')}Keyboard shortcuts<kbd>?</kbd></button>
          <button data-act="minimize" role="menuitem">${icon('minimize')}Minimize dock<kbd>⌘⇧X</kbd></button>
        </div>
        <div id="ah-conn" class="ah-menu ah-surface" hidden></div>
        <div id="ah-hint" class="ah-surface" hidden><span>Press <kbd>Alt</kbd> or the pointer, then click anything</span><button class="ah-ibtn" id="ah-hint-close" aria-label="Dismiss">${icon('x', 14)}</button></div>
        <div id="ah-toast" class="ah-surface" hidden role="status" aria-live="polite"></div>

        <aside id="ah-side" hidden aria-label="Agent Hover sidebar">
          <div class="rail" id="ah-side-rail" title="Drag to resize · double-click to reset"></div>
          <div class="top">
            <div class="tabs" role="tablist" id="ah-tabs">
              <button role="tab" data-tab="inspect" aria-selected="true">Inspect</button>
              <button role="tab" data-tab="tasks" aria-selected="false">Tasks <span class="n" id="ah-n-tasks"></span></button>
              <button role="tab" data-tab="comments" aria-selected="false">Comments <span class="n" id="ah-n-comments"></span></button>
              <button role="tab" data-tab="batch" aria-selected="false">Batch <span class="n" id="ah-n-batch"></span></button>
            </div>
            <button class="ah-ibtn" id="ah-s-gear" aria-label="Settings" title="Settings" aria-pressed="false">${icon('gear')}</button>
            <button class="ah-ibtn" id="ah-s-float" aria-label="Float sidebar" title="Float sidebar" aria-pressed="false">${icon('float')}</button>
            <button class="ah-ibtn" id="ah-s-close" aria-label="Close sidebar" title="Close (Esc)">${icon('x')}</button>
          </div>
          <div class="body" id="ah-s-body"></div>
          <div class="foot" id="ah-s-foot" hidden></div>
        </aside>

        <!-- Screenshot Mode Dropdown -->
        <div id="cp-snap-dropdown" role="menu" aria-label="Screenshot mode">
          <button class="cp-snap-option" role="menuitem" data-mode="component">
            <span class="cp-snap-option-label">${ICONS.boxSelect} Selected component</span>
            <span class="cp-snap-option-caption" id="cp-snap-component-name">None selected</span>
          </button>
          <button class="cp-snap-option" role="menuitem" data-mode="viewport">
            <span class="cp-snap-option-label">${ICONS.monitor} Viewport</span>
            <span class="cp-snap-option-caption">What you see now</span>
          </button>
          <button class="cp-snap-option" role="menuitem" data-mode="fullpage">
            <span class="cp-snap-option-label">${ICONS.arrowsVertical} Full page</span>
            <span class="cp-snap-option-caption" id="cp-snap-fullpage-size">Whole scrollable page</span>
          </button>
          <div class="cp-snap-message" id="cp-snap-message"></div>
        </div>

        <!-- Enhanced Screenshot Toast Widget -->
        <div id="cp-snap-preview" role="status" aria-live="polite">
          <div class="cp-snap-header">
            <div class="cp-snap-title">
              ${ICONS.camera}
              <span>Screenshot Captured</span>
            </div>
            <button id="cp-snap-preview-close" class="cp-snap-close" aria-label="Close" title="Close Toast">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Clickable Zoom Thumbnail -->
          <div class="cp-snap-thumb-box" id="cp-snap-thumb-btn" title="Click to inspect full resolution">
            <img id="cp-snap-preview-img" class="cp-snap-preview-img" alt="Screenshot preview" />
            <div class="cp-snap-zoom-overlay">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              <span>Click to Inspect</span>
            </div>
          </div>

          <div class="cp-snap-meta-row">
            <span id="cp-snap-preview-meta"></span>
            <span id="cp-snap-preview-status" class="cp-snap-preview-status"></span>
          </div>

          <div class="cp-snap-actions">
            <button class="cp-btn-bento" id="cp-snap-download">${ICONS.download} Download</button>
            <button class="cp-btn-bento" id="cp-snap-open-folder" title="Open screenshots folder in system file manager">${ICONS.camera} Folder</button>
            <button class="cp-btn-bento primary" id="cp-snap-copy">${ICONS.copy} Copy Image</button>
          </div>

          <!-- Auto-dismiss Progress Bar -->
          <div class="cp-snap-progress-track">
            <div id="cp-snap-progress" class="cp-snap-progress-bar"></div>
          </div>
        </div>

        <!-- Full Lightbox Modal -->
        <div id="cp-snap-lightbox" role="dialog" aria-modal="true" aria-label="Screenshot Lightbox Preview">
          <div class="cp-lightbox-dialog" id="cp-lightbox-dialog">
            <div class="cp-lightbox-header">
              <div style="font-weight:600; font-size:13px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                <span class="cp-badge cp-badge-accent" id="cp-lightbox-mode-badge">VIEWPORT</span>
                <span id="cp-lightbox-filename" style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">screenshot.png</span>
                <span style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted);" id="cp-lightbox-res"></span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <button class="cp-btn-bento" id="cp-lightbox-download">${ICONS.download} Download</button>
                <button class="cp-btn-bento primary" id="cp-lightbox-copy">${ICONS.copy} Copy Image</button>
                <button class="cp-snap-close" id="cp-lightbox-close" title="Close Lightbox (Esc)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <div class="cp-lightbox-body">
              <img id="cp-lightbox-img" src="" alt="Full Resolution Screenshot" />
            </div>
          </div>
        </div>

        <!-- Region Hint Overlay (screenshot mode hover) -->
        <div id="cp-region-hint"><span class="cp-region-label" id="cp-region-label"></span></div>
  `;
}
