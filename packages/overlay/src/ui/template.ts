import { ICONS } from '../icons.js';
import tokensCss from '../styles/tokens.css?inline';
import overlayCss from '../styles/overlay.css?inline';

export function getOverlayHtml(): string {
  return `
        <style>
${tokensCss}
${overlayCss}
        </style>

        <div id="ah-capture-layer" class="ah-capture-layer" aria-hidden="true"></div>

        <div id="cp-dock-wrapper">
          <div id="cp-dock">
            <div id="cp-dock-tiles">
              <div class="cp-dock-tile" id="cp-dock-toggle" title="Toggle Inspector Mode (Alt)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>
              </div>

              <div class="cp-dock-tile" id="cp-dock-pins" title="Pinned Components Stack" style="position:relative;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span class="cp-badge-pill" id="cp-dock-pin-badge" style="display:none;">0</span>
                <span class="cp-mcp-dot" id="cp-mcp-dot" title="MCP: Not connected"></span>
              </div>
            </div>

            <!-- Bottom Drag Handle -->
            <div class="cp-dock-handle" id="cp-dock-handle" title="Drag dock"></div>
          </div>

          <!-- Reference Callout / Speech Bubble -->
          <div id="cp-dock-callout">
            <div class="cp-callout-tail"></div>
            <span class="cp-callout-message" id="cp-callout-text">Ready to point</span>
            <span class="cp-callout-time" id="cp-callout-meta">Alt</span>
          </div>
        </div>

        <!-- Lens Flyout (Floating window / Attached sidebar) -->
        <div id="cp-flyout">
          <div id="cp-flyout-header">
            <div id="cp-flyout-title-wrap">
              <button class="cp-flyout-tool-btn" id="cp-settings-back" title="Back to Inspector" style="display:none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <span class="cp-badge cp-badge-accent" id="cp-flyout-badge">LENS</span>
              <h3 id="cp-flyout-title">Component Inspector</h3>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <button class="cp-flyout-tool-btn" id="cp-flyout-theme" title="Toggle Light/Dark Mode">
                <svg id="cp-theme-icon-dark" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <svg id="cp-theme-icon-light" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              </button>
              <button class="cp-flyout-tool-btn" id="cp-flyout-settings" title="Settings" style="position:relative;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                <span id="cp-settings-update-dot" style="display:none; position:absolute; top:2px; right:2px; width:7px; height:7px; border-radius:50%; background:#38bdf8; box-shadow:0 0 6px #38bdf8;"></span>
              </button>
              <button class="cp-flyout-tool-btn" id="cp-flyout-mode-toggle" title="Detach Sidebar (Float Window)">
                <svg id="cp-mode-sidebar-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><polyline points="10 9 7 12 10 15"/></svg>
                <svg id="cp-mode-float-icon" style="display:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </button>
              <button class="cp-flyout-tool-btn" id="cp-flyout-snap-btn" title="Take Screenshot" aria-haspopup="menu" aria-expanded="false"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></button>
              <button class="cp-flyout-tool-btn" id="cp-flyout-close" title="Close (Esc)"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>

          <!-- Inspector View (Default) -->
          <div id="cp-view-inspector" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
            <div id="cp-flyout-breadcrumb" style="display:none; padding:10px 20px; background:var(--bg-surface-sunken); border-bottom:1px solid var(--border-glass); font-family:var(--font-mono); font-size:11.5px; overflow-x:auto; white-space:nowrap;">
            </div>

            <!-- Live Token Meter & Context Level Bar -->
            <div id="cp-token-meter" style="padding: 7px 18px; background: var(--bg-surface-sunken); border-bottom: 1px solid var(--border-glass); display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 11px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--text-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> <span id="cp-token-count">0</span> tokens
                </span>
                <span id="cp-token-savings" class="cp-badge cp-badge-emerald" style="min-height: 18px; font-size: 10px; padding: 1px 6px;">
                  prompt-ready
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: var(--text-muted); font-size: 10px;">Context:</span>
                <select id="cp-context-level" style="background: var(--bg-surface-input); color: var(--text-primary); border: 1px solid var(--border-glass); border-radius: 4px; font-size: 10.5px; font-family: var(--font-mono); padding: 2px 6px; cursor: pointer;">
                  <option value="minimal">Compact (Prompt-Ready)</option>
                  <option value="standard" selected>Standard (+Source)</option>
                  <option value="full">Deep (+Styles)</option>
                </select>
              </div>
            </div>

            <div id="cp-flyout-content">
              <p style="color:var(--text-secondary); margin:0;">Point and click any element on the page, or press <kbd style="font-family:var(--font-mono); background:var(--bg-surface-raised); padding:2px 5px; border-radius:4px;">Alt</kbd> to inspect.</p>
            </div>

            <div class="cp-flyout-actions">
              <button class="cp-btn-bento primary" id="cp-copy-ai" style="justify-content: center; font-weight: 600; font-size: 11.5px; padding: 9px 10px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Copy AI Context</button>
              <button class="cp-btn-bento primary" id="cp-send-agent-btn" style="justify-content: center; font-weight: 600; font-size: 11.5px; padding: 9px 10px;">${ICONS.send} Send to Agent</button>
              <button class="cp-btn-bento" id="cp-editor-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Open in IDE</button>
              <button class="cp-btn-bento" id="cp-pin-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg> Pin Component</button>
              <button class="cp-btn-bento" id="cp-toggle-spacing" style="grid-column: span 2;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="9" y1="21" x2="9" y2="9"/><line x1="3" y1="9" x2="21" y2="9"/></svg> Spacing Overlay</button>
            </div>

            <!-- Persistent Notes Section in Sidebar -->
            <div id="cp-notes-section" style="padding:10px 20px; border-top:1px solid var(--border-glass); background:var(--bg-surface-sunken);">
              <div style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <span style="display:inline-flex; align-items:center; gap:5px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Notes (<span id="cp-notes-count">0</span>)
                </span>
                <button id="cp-notes-copy-all" class="cp-btn-bento" style="font-size:9.5px; padding:2px 6px;" title="Copy all notes as AI prompt">Copy All Notes</button>
              </div>
              <div id="cp-notes-list" style="display:flex; flex-direction:column; gap:6px; max-height:130px; overflow-y:auto;">
                <div style="font-size:11px; color:var(--text-muted); font-style:italic;">No notes yet. Click the note icon on any element to add persistent notes.</div>
              </div>
            </div>

            <div id="cp-pin-bar">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Pinned Stack (<span id="cp-pin-count">0</span>)</span>
              </div>
              <div id="cp-pin-list"></div>
              
              <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                <input type="text" id="cp-task-input" placeholder="Overall goal (optional, e.g. 'Align cards to dark theme')" style="width:100%; box-sizing:border-box; background:var(--bg-surface-input); border:1px solid var(--border-glass); border-radius:8px; padding:7px 10px; color:var(--text-primary); font-family:var(--font-sans); font-size:11.5px; outline:none; transition: border-color 0.2s;" />
                <button class="cp-btn-bento primary" id="cp-gen-task" style="width:100%; font-size:11.5px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> Copy All Tasks in Order</button>
                <button class="cp-btn-bento" id="cp-pin-send-agent" style="width:100%; font-size:11.5px; justify-content:center;">${ICONS.send} Send Pinned Tasks to Agent</button>
              </div>
            </div>
            </div>

            <!-- Settings View (Dedicated Page inside Sidebar) -->
            <div id="cp-view-settings" style="display:none; flex-direction:column; flex:1; overflow-y:auto; padding:20px; gap:16px;">
              <div id="cp-update-banner" style="display:none; padding:10px 12px; background:rgba(56, 189, 248, 0.08); border:1px solid rgba(56, 189, 248, 0.35); border-radius:8px; font-size:11px;">
                <div style="font-weight:600; color:#38bdf8; display:flex; align-items:center; gap:6px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>Update Available: v<span id="cp-update-latest-ver"></span></span>
                </div>
                <div style="margin-top:5px; color:var(--text-secondary); font-size:10.5px;">
                  Run <code style="font-family:var(--font-mono); color:#38bdf8; background:rgba(0,0,0,0.3); padding:1px 5px; border-radius:3px;">npm i -D @agent-hover/vite@latest</code>
                </div>
              </div>

              <div class="cp-settings-section">
                <div class="cp-settings-section-title">Theme</div>
                <div style="display:flex; gap:8px;">
                  <button class="cp-btn-bento" id="cp-theme-set-dark" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark</button>
                  <button class="cp-btn-bento" id="cp-theme-set-light" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light</button>
                </div>
              </div>

              <div class="cp-settings-section">
                <div class="cp-settings-section-title">Dock Layout</div>
                <div style="display:flex; gap:8px;">
                  <button class="cp-btn-bento primary" id="cp-dock-orient-vert" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="18" x="8" y="3" rx="2"/></svg> Vertical</button>
                  <button class="cp-btn-bento" id="cp-dock-orient-horiz" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="8" x="3" y="8" rx="2"/></svg> Horizontal</button>
                </div>
              </div>

              <div class="cp-settings-section">
                <div class="cp-settings-section-title">Preferred Editor</div>
                <div class="cp-settings-card">
                  <button class="cp-btn-bento" id="cp-pref-editor-cursor" style="justify-content:flex-start; width:100%;">Cursor (cursor://)</button>
                  <button class="cp-btn-bento" id="cp-pref-editor-vscode" style="justify-content:flex-start; width:100%;">VS Code (vscode://)</button>
                  <button class="cp-btn-bento" id="cp-pref-editor-windsurf" style="justify-content:flex-start; width:100%;">Windsurf (windsurf://)</button>
                </div>
              </div>

              <div class="cp-settings-section">
                <div class="cp-settings-section-title">Shortcuts</div>
                <div class="cp-settings-card">
                  <div class="cp-shortcut-row">
                    <span>Toggle Inspector</span>
                    <kbd style="background:var(--bg-surface-raised); padding:2px 6px; border-radius:4px; color:var(--text-primary); font-size:10px;">Alt</kbd>
                  </div>
                  <div class="cp-shortcut-row">
                    <span>Close Sidebar</span>
                    <kbd style="background:var(--bg-surface-raised); padding:2px 6px; border-radius:4px; color:var(--text-primary); font-size:10px;">Esc</kbd>
                  </div>
                  <div class="cp-shortcut-row">
                    <span>Text Edit (Bold / Italic)</span>
                    <kbd style="background:var(--bg-surface-raised); padding:2px 6px; border-radius:4px; color:var(--text-primary); font-size:10px;">Cmd+B / Cmd+I</kbd>
                  </div>
                </div>
              </div>

              <div class="cp-settings-section">
                <div class="cp-settings-section-title">AI Agents</div>
                <div class="cp-settings-card">
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:11px; color:var(--text-secondary);">MCP Connection</span>
                    <span id="cp-mcp-status-label" style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted);">Not connected</span>
                  </div>
                  <button class="cp-btn-bento" id="cp-mcp-setup-btn" style="width:100%; justify-content:center;">${ICONS.sparkles} Open Setup Guide</button>
                </div>
              </div>

              <!-- MCP Setup Modal (injected into settings) -->
              <div id="cp-mcp-modal" style="display:none; position:fixed; inset:0; z-index:999999; background:rgba(0,0,0,0.5); display:none; align-items:center; justify-content:center;">
                <div style="width:420px; max-width:90vw; max-height:80vh; background:var(--bg-dock-panel); backdrop-filter:blur(20px); border:1px solid var(--border-glass); border-radius:14px; box-shadow:0 24px 64px rgba(0,0,0,0.4); padding:20px; overflow-y:auto;">
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                    <span style="font-weight:600; font-size:14px; color:var(--text-primary);">Connect AI Agent</span>
                    <button id="cp-mcp-modal-close" class="cp-icon-btn" aria-label="Close">${ICONS.x}</button>
                  </div>
                  <div style="display:flex; gap:4px; margin-bottom:14px; flex-wrap:wrap;" id="cp-mcp-tabs">
                    <button class="cp-btn-bento primary cp-mcp-tab" data-tab="claude" style="font-size:10.5px; padding:4px 10px;">Claude Code</button>
                    <button class="cp-btn-bento cp-mcp-tab" data-tab="cursor" style="font-size:10.5px; padding:4px 10px;">Cursor</button>
                    <button class="cp-btn-bento cp-mcp-tab" data-tab="windsurf" style="font-size:10.5px; padding:4px 10px;">Windsurf</button>
                    <button class="cp-btn-bento cp-mcp-tab" data-tab="codex" style="font-size:10.5px; padding:4px 10px;">Codex</button>
                    <button class="cp-btn-bento cp-mcp-tab" data-tab="antigravity" style="font-size:10.5px; padding:4px 10px;">Antigravity</button>
                  </div>
                  <div id="cp-mcp-tab-content">
                    <!-- Tab panels injected by JS -->
                  </div>
                </div>
              </div>

              <div class="cp-settings-section" style="margin-top:auto; padding-top:12px; border-top:1px solid var(--border-subtle); font-family:var(--font-mono); font-size:10.5px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                <span>Agent Hover v0.1.1</span>
                <span id="cp-bridge-status-badge" class="cp-badge cp-badge-emerald" style="min-height:18px; font-size:9.5px; padding:1px 6px;">Bridge Active</span>
              </div>
            </div>
          </div>

        <div id="cp-highlight">
          <div id="cp-label"></div>
        </div>

        <!-- Persistent Selection Frame (Locks on clicked component) -->
        <div id="cp-selection-frame" style="display:none;">
          <div id="cp-selection-chip">
            <span id="cp-sel-name">&lt;Component /&gt;</span>
            <span id="cp-sel-file"></span>
            <div id="cp-sel-actions">
              <button id="cp-sel-copy-btn" title="Copy AI Prompt (Click to copy)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
                <span id="cp-sel-copy-label">Copy Prompt</span>
              </button>
              <button id="cp-sel-send-btn" title="Send Context to Agent" style="background:#2c2c2e; border:1px solid #48484a; color:#ffffff; font-weight:600; padding:2px 7px;">
                ${ICONS.send}
                <span id="cp-sel-send-label">Send</span>
              </button>
              <button id="cp-sel-note-btn" title="Add Note / Comment">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button id="cp-sel-pin-btn" title="Pin Component Task">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
              </button>
              <button id="cp-sel-snap-btn" title="Capture Clean Screenshot (Web UI only)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              </button>
              <button id="cp-sel-ide-btn" title="Open in IDE">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </button>
              <button id="cp-sel-close-btn" title="Deselect">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div id="cp-margin-band"></div>
        <div id="cp-padding-band"></div>
        <div id="cp-axis-guides"></div>
        <div id="cp-distance-layer"></div>
        <div id="cp-comments-layer" style="position:fixed; inset:0; pointer-events:none; z-index:999996;"></div>

        <!-- Inline Note Popover (Apple Minimalist Redesign) -->
        <div id="cp-note-popover" role="dialog" aria-label="Note">
          <div class="cp-note-header">
            <div class="cp-note-title">
              <span class="cp-note-icon">${ICONS.messageSquare}</span>
              <span id="cp-note-popover-label">New note</span>
              <span id="cp-note-status-badge" class="cp-note-status-badge" style="display:none;"></span>
            </div>
            <div class="cp-note-header-actions">
              <button id="cp-note-resolve" class="cp-icon-btn cp-resolve-btn" aria-label="Resolve" title="Mark as resolved">${ICONS.check}</button>
              <button id="cp-note-popover-close" class="cp-icon-btn cp-close-btn" aria-label="Close" title="Close (Esc)">${ICONS.x}</button>
            </div>
          </div>
          <div class="cp-note-target-capsule" id="cp-note-target-capsule" style="display:none;">
            <span class="cp-note-target-tag" id="cp-note-popover-target"></span>
            <span class="cp-note-target-sep" id="cp-note-target-sep">·</span>
            <span class="cp-file-badge" id="cp-note-popover-file"></span>
          </div>
          <textarea id="cp-note-input" class="cp-note-textarea" placeholder="Add a note for this element..."></textarea>
          <div class="cp-note-error" id="cp-note-error"></div>
          <div class="cp-note-footer">
            <div class="cp-note-footer-left">
              <button class="cp-btn-subtle-danger" id="cp-note-delete" aria-label="Delete note" title="Delete note">${ICONS.trash}<span>Delete</span></button>
            </div>
            <div class="cp-note-footer-right">
              <span class="cp-note-hint"><kbd class="cp-kbd">⌘</kbd><kbd class="cp-kbd">↵</kbd></span>
              <button class="cp-btn-apple-primary" id="cp-note-save">Save</button>
            </div>
          </div>
          <button id="cp-note-cancel" style="display:none;" aria-hidden="true"></button>
          <button id="cp-note-send-agent" style="display:none;" aria-hidden="true"></button>
        </div>

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

        <!-- Pinned Task Dialog (Two-choice flow: Copy Now vs Add More) -->
        <div id="cp-pin-dialog" style="display:none; position:fixed; z-index:999999; width:340px; background:var(--bg-dock-panel); backdrop-filter:var(--blur); border:1px solid var(--border-glass); border-radius:14px; box-shadow:var(--shadow-dock); color:var(--text-primary); padding:14px; pointer-events:auto;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="cp-pin-badge" id="cp-pin-dialog-badge">Pin #1</span>
              <span style="font-weight:600; font-size:12px; color:var(--text-primary);" id="cp-pin-dialog-name">&lt;Component /&gt;</span>
            </div>
            <button id="cp-pin-dialog-close" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted); margin-bottom:8px;" id="cp-pin-dialog-file"></div>
          <textarea id="cp-pin-dialog-task" placeholder="Describe the change or task for this component..." style="width:100%; box-sizing:border-box; min-height:65px; background:var(--bg-surface-input); border:1px solid var(--border-glass); border-radius:6px; padding:8px; color:var(--text-primary); font-family:var(--font-sans); font-size:12px; resize:vertical; outline:none; margin-bottom:10px;"></textarea>
          <div style="display:flex; gap:8px;">
            <button class="cp-btn-bento" id="cp-pin-dialog-add-more" style="flex:1; justify-content:center; font-size:11px;" title="Save task and inspect another component">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add More Pins
            </button>
            <button class="cp-btn-bento primary" id="cp-pin-dialog-copy-now" style="flex:1; justify-content:center; font-size:11px;" title="Copy task prompt for AI immediately">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Copy Task Prompt
            </button>
          </div>
        </div>

        <div id="cp-text-editor">
          <div id="cp-text-editor-header">
            <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; font-size:12px; color:var(--text-primary);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Edit Text
            </span>
            <span id="cp-text-target-badge" style="font-size:10px; font-family:var(--font-mono); color:var(--text-primary); background:#2c2c2c; padding:2px 6px; border-radius:4px; margin-left:6px; border:1px solid #444444; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
            <div id="cp-text-editor-toolbar">
              <button class="cp-text-tb-btn" data-cmd="bold" title="Bold (Cmd+B)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H6v-8Zm0 0V4h8a4 4 0 0 1 0 8H6Z"/></svg></button>
              <button class="cp-text-tb-btn" data-cmd="italic" title="Italic (Cmd+I)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg></button>
              <button class="cp-text-tb-btn" data-cmd="underline" title="Underline (Cmd+U)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg></button>
            </div>
            <button id="cp-text-editor-close" title="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div id="cp-text-editor-content" contenteditable="true" spellcheck="false"></div>
          <div id="cp-text-editor-footer">
            <button class="cp-text-action-btn apply" id="cp-text-apply" style="display:inline-flex; align-items:center; gap:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save to Code</button>
            <button class="cp-text-action-btn revert" id="cp-text-revert" style="display:inline-flex; align-items:center; gap:6px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Revert</button>
            <span id="cp-text-char-count"></span>
          </div>
        </div>
`;
}
