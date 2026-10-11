import { icon, GRIP } from '../lib/icon.js';
import uiCss from '../styles/ui.css?inline';

/**
 * Overlay markup (0.2 UI, see docs/design/prototype.html). Everything lives in one shadow root.
 * Surfaces: selector (hover/selection/batch/measure layers), action pill + menu, composer, task card,
 * comment card, dock (+ menu, connection popover, tooltip), toast, sidebar, screenshot lightbox.
 */
export function getOverlayHtml(): string {
  return `
        <style>
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

        <div id="ah-lightbox" hidden></div>
  `;
}
