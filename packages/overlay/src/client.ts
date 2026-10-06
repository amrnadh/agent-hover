// @ts-nocheck
import { ICONS } from './icons.js';
import { getOverlayHtml } from './ui/template.js';
import { IsolationManager, setupPopover, showPopoverSafe, hidePopoverSafe } from './lib/isolation.js';

export interface OverlayConfig {
  port: number;
  editor?: string;
  token?: string;
}

export function bootstrapOverlay(config: OverlayConfig) {
  const { port, editor = 'auto', token = '' } = config;

      const BRIDGE = 'http://localhost:' + port;
      const BRIDGE_TOKEN = token || '';

      // Transparently inject Bearer token into all requests targeting the bridge
      const _origFetch = window.fetch;
      const fetch = (input, init = {}) => {
        const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
        if (BRIDGE_TOKEN && (urlStr.startsWith(BRIDGE) || urlStr.startsWith('' + 'http://localhost:' + port + '') || urlStr.startsWith('' + 'http://127.0.0.1:' + port + ''))) {
          const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
          if (!headers.has('Authorization')) {
            headers.set('Authorization', 'Bearer ' + BRIDGE_TOKEN);
          }
          return _origFetch(input, { ...init, headers });
        }
        return _origFetch(input, init);
      };

      let ws;
      let isBridgeConnected = false;

      function setBridgeConnected(connected) {
        isBridgeConnected = connected;
        const badge = shadow.getElementById('cp-bridge-status-badge');
        if (badge) {
          if (connected) {
            badge.className = 'cp-badge cp-badge-emerald';
            badge.textContent = 'Bridge Active';
          } else {
            badge.className = 'cp-badge cp-badge-rose';
            badge.textContent = 'Server Offline';
          }
        }
      }

      function handleUpdateAvailable(updateInfo) {
        if (!updateInfo || !updateInfo.latest) return;
        const dot = shadow.getElementById('cp-settings-update-dot');
        if (dot) dot.style.display = 'block';
        const banner = shadow.getElementById('cp-update-banner');
        const verEl = shadow.getElementById('cp-update-latest-ver');
        if (banner && verEl) {
          verEl.textContent = updateInfo.latest;
          banner.style.display = 'block';
        }
      }

      try {
        ws = new WebSocket('ws://localhost:' + port + '?token=' + (token || ''));
        ws.onopen = () => {
          console.log('[agent-hover] Connected to bridge');
          setBridgeConnected(true);
        };
        ws.onclose = () => {
          setBridgeConnected(false);
          console.warn('[agent-hover] Bridge disconnected (dev server stopped)');
        };
        ws.onerror = () => {
          setBridgeConnected(false);
          console.warn('[agent-hover] WebSocket connection failed');
        };
      } catch(e) {
        console.warn('[agent-hover] Could not connect WebSocket');
      }

      // Check bridge server health and pending updates on load
      fetch(BRIDGE + '/api/health')
        .then(r => r.json())
        .then(d => {
          setBridgeConnected(true);
          if (d.updateAvailable) handleUpdateAvailable(d.updateAvailable);
        })
        .catch(() => setBridgeConnected(false));

      // Check on page restore from browser bfcache (e.g. Cmd+Shift+T)
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
          fetch(BRIDGE + '/api/health')
            .then(res => res.json())
            .then(data => {
              setBridgeConnected(true);
              if (data.updateAvailable) handleUpdateAvailable(data.updateAvailable);
            })
            .catch(() => {
              setBridgeConnected(false);
              showCallout('Dev server offline — restart npm run dev', 'OFFLINE', 3000);
            });
        }
      });

      let isPointerMode = false;
      let currentElement = null;
      let currentComponentInfo = null;
      let frozenEntries = [];

      // ICONS imported from ./icons.js

      // --- Shadow DOM UI Container ---
      const container = document.createElement('div');
      container.id = 'agent-hover-root';
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '2147483600';
      const shadow = container.attachShadow({ mode: 'open' });
      shadow.innerHTML = getOverlayHtml();
      if (document.body) {
        document.body.appendChild(container);
      } else {
        window.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
      }

      // Initialize host dialog isolation manager (reparents into active modal dialogs if needed)
      const isolationManager = new IsolationManager(container);

      // Setup Popover API for floating UI surfaces
      setupPopover(shadow.getElementById('cp-flyout'));
      setupPopover(shadow.getElementById('cp-selection-chip'));
      setupPopover(shadow.getElementById('cp-note-popover'));
      setupPopover(shadow.getElementById('cp-snap-preview'));
      setupPopover(shadow.getElementById('cp-snap-lightbox'));
      setupPopover(shadow.getElementById('cp-mcp-modal'));
      setupPopover(shadow.getElementById('cp-dock-wrapper'));

      // Elements
      const dockWrapper = shadow.getElementById('cp-dock-wrapper');
      const dockToggle = shadow.getElementById('cp-dock-toggle');
      const dockPins = shadow.getElementById('cp-dock-pins');
      const dockHandle = shadow.getElementById('cp-dock-handle');
      const dockPinBadge = shadow.getElementById('cp-dock-pin-badge');
      const callout = shadow.getElementById('cp-dock-callout');
      const calloutText = shadow.getElementById('cp-callout-text');
      const calloutMeta = shadow.getElementById('cp-callout-meta');

      const highlight = shadow.getElementById('cp-highlight');
      const label = shadow.getElementById('cp-label');
      const marginBand = shadow.getElementById('cp-margin-band');
      const paddingBand = shadow.getElementById('cp-padding-band');
      const axisGuides = shadow.getElementById('cp-axis-guides');
      const flyout = shadow.getElementById('cp-flyout');
      const flyoutTitle = shadow.getElementById('cp-flyout-title');
      const flyoutContent = shadow.getElementById('cp-flyout-content');
      const distanceLayer = shadow.getElementById('cp-distance-layer');
      const textEditor = shadow.getElementById('cp-text-editor');
      const textEditorContent = shadow.getElementById('cp-text-editor-content');
      const textCharCount = shadow.getElementById('cp-text-char-count');
      const textTargetBadge = shadow.getElementById('cp-text-target-badge');
      const flyoutThemeBtn = shadow.getElementById('cp-flyout-theme');
      const flyoutSettingsBtn = shadow.getElementById('cp-flyout-settings');
      const settingsBackBtn = shadow.getElementById('cp-settings-back');
      const viewInspector = shadow.getElementById('cp-view-inspector');
      const viewSettings = shadow.getElementById('cp-view-settings');
      const flyoutBadge = shadow.getElementById('cp-flyout-badge');
      const themeSetDark = shadow.getElementById('cp-theme-set-dark');
      const themeSetLight = shadow.getElementById('cp-theme-set-light');
      const prefEditorCursor = shadow.getElementById('cp-pref-editor-cursor');
      const prefEditorVscode = shadow.getElementById('cp-pref-editor-vscode');
      const prefEditorWindsurf = shadow.getElementById('cp-pref-editor-windsurf');
      const dockOrientVert = shadow.getElementById('cp-dock-orient-vert');
      const dockOrientHoriz = shadow.getElementById('cp-dock-orient-horiz');

      function updateDockOrientation() {
        const rect = dockWrapper.getBoundingClientRect();
        const isRight = (rect.left + rect.width / 2) > (window.innerWidth / 2);
        if (isRight) {
          dockWrapper.classList.add('cp-dock-right');
        } else {
          dockWrapper.classList.remove('cp-dock-right');
        }

        const isBottom = (rect.top + rect.height / 2) > (window.innerHeight / 2);
        if (isBottom) {
          dockWrapper.classList.add('cp-dock-bottom');
        } else {
          dockWrapper.classList.remove('cp-dock-bottom');
        }
      }

      // Settings View Switcher (Dedicated page inside sidebar)
      let inSettingsView = false;
      function toggleSettingsView(force) {
        inSettingsView = (typeof force === 'boolean') ? force : !inSettingsView;
        if (inSettingsView) {
          viewInspector.style.display = 'none';
          viewSettings.style.display = 'flex';
          flyoutBadge.style.display = 'none';
          if (settingsBackBtn) settingsBackBtn.style.display = 'inline-flex';
          flyoutTitle.textContent = 'Settings';
          flyoutSettingsBtn.classList.add('active');
          if (!flyout.classList.contains('open')) {
            flyout.classList.add('open');
            dockWrapper.classList.add('sidebar-open');
          }
        } else {
          viewInspector.style.display = 'flex';
          viewSettings.style.display = 'none';
          flyoutBadge.style.display = 'inline-flex';
          if (settingsBackBtn) settingsBackBtn.style.display = 'none';
          flyoutTitle.textContent = lastInfoName || 'Component Inspector';
          flyoutSettingsBtn.classList.remove('active');
        }
      }

      if (flyoutSettingsBtn) {
        flyoutSettingsBtn.onclick = () => toggleSettingsView();
      }
      if (settingsBackBtn) {
        settingsBackBtn.onclick = () => toggleSettingsView(false);
      }

      // Editor preference
      let currentEditorPref = 'cursor';
      try {
        currentEditorPref = localStorage.getItem('agent-hover-pref-editor') || editor || 'cursor';
      } catch(e) {}

      function updateEditorPrefUI() {
        [prefEditorCursor, prefEditorVscode, prefEditorWindsurf].forEach((b) => {
          if (b) b.classList.remove('primary');
        });
        if (currentEditorPref === 'cursor' && prefEditorCursor) prefEditorCursor.classList.add('primary');
        if (currentEditorPref === 'vscode' && prefEditorVscode) prefEditorVscode.classList.add('primary');
        if (currentEditorPref === 'windsurf' && prefEditorWindsurf) prefEditorWindsurf.classList.add('primary');
      }
      updateEditorPrefUI();

      if (prefEditorCursor) {
        prefEditorCursor.onclick = () => {
          currentEditorPref = 'cursor';
          try { localStorage.setItem('agent-hover-pref-editor', 'cursor'); } catch(e) {}
          updateEditorPrefUI();
          showCallout('Editor: Cursor', 'SET');
        };
      }
      if (prefEditorVscode) {
        prefEditorVscode.onclick = () => {
          currentEditorPref = 'vscode';
          try { localStorage.setItem('agent-hover-pref-editor', 'vscode'); } catch(e) {}
          updateEditorPrefUI();
          showCallout('Editor: VS Code', 'SET');
        };
      }
      if (prefEditorWindsurf) {
        prefEditorWindsurf.onclick = () => {
          currentEditorPref = 'windsurf';
          try { localStorage.setItem('agent-hover-pref-editor', 'windsurf'); } catch(e) {}
          updateEditorPrefUI();
          showCallout('Editor: Windsurf', 'SET');
        };
      }

      // --- MCP Setup Modal ---
      const MCP_CONFIGS = {
        claude: {
          title: 'Claude Code',
          cli: 'claude mcp add agent-hover -- npx -y @agent-hover/mcp',
          fileLabel: 'Or add to .mcp.json (project) or ~/.claude.json (global):',
          snippet: JSON.stringify({
            mcpServers: {
              'agent-hover': {
                command: 'npx',
                args: ['-y', '@agent-hover/mcp']
              }
            }
          }, null, 2),
          lang: 'json'
        },
        cursor: {
          title: 'Cursor',
          fileLabel: 'Add to .cursor/mcp.json (project) or ~/.cursor/mcp.json (global):',
          snippet: JSON.stringify({
            mcpServers: {
              'agent-hover': {
                command: 'npx',
                args: ['-y', '@agent-hover/mcp']
              }
            }
          }, null, 2),
          lang: 'json'
        },
        windsurf: {
          title: 'Windsurf',
          fileLabel: 'Add to ~/.codeium/windsurf/mcp_config.json:',
          snippet: JSON.stringify({
            mcpServers: {
              'agent-hover': {
                command: 'npx',
                args: ['-y', '@agent-hover/mcp']
              }
            }
          }, null, 2),
          lang: 'json'
        },
        codex: {
          title: 'Codex',
          cli: 'codex mcp add agent-hover -- npx -y @agent-hover/mcp',
          fileLabel: 'Or add to ~/.codex/config.toml (global) or .codex/config.toml (project):',
          snippet: ['[mcp_servers.agent-hover]', 'command = "npx"', 'args = ["-y", "@agent-hover/mcp"]'].join(String.fromCharCode(10)),
          lang: 'toml'
        },
        antigravity: {
          title: 'Antigravity',
          cli: 'agy mcp add agent-hover -- npx -y @agent-hover/mcp',
          fileLabel: 'Or add to ~/.gemini/config/mcp_config.json:',
          snippet: JSON.stringify({
            mcpServers: {
              'agent-hover': {
                command: 'npx',
                args: ['-y', '@agent-hover/mcp']
              }
            }
          }, null, 2),
          lang: 'json'
        }
      };

      function renderMcpTab(key) {
        const cfg = MCP_CONFIGS[key];
        if (!cfg) return;
        const content = shadow.getElementById('cp-mcp-tab-content');
        if (!content) return;

        let html = '';
        if (cfg.cli) {
          html += '<div style="margin-bottom:10px; font-size:11px; font-weight:500; color:var(--text-primary);">Run in terminal:</div>';
          html += '<div style="position:relative; background:var(--bg-surface-sunken); border:1px solid var(--border-glass); border-radius:8px; padding:10px 12px; font-family:var(--font-mono); font-size:11px; word-break:break-all; color:var(--text-secondary); margin-bottom:12px;" id="cp-mcp-cli-block">' + escapeHtml(cfg.cli) + '<button class="cp-btn-bento" id="cp-mcp-copy-cli" style="position:absolute; top:6px; right:6px; font-size:9px; padding:2px 6px;">' + ICONS.copy + '</button></div>';
        }
        html += '<div style="margin-bottom:6px; font-size:11px; color:var(--text-muted);">' + escapeHtml(cfg.fileLabel) + '</div>';
        html += '<div style="position:relative; background:var(--bg-surface-sunken); border:1px solid var(--border-glass); border-radius:8px; padding:10px 12px; font-family:var(--font-mono); font-size:10.5px; white-space:pre-wrap; color:var(--text-secondary); line-height:1.5;" id="cp-mcp-snippet-block">' + escapeHtml(cfg.snippet) + '<button class="cp-btn-bento" id="cp-mcp-copy-snippet" style="position:absolute; top:6px; right:6px; font-size:9px; padding:2px 6px;">' + ICONS.copy + '</button></div>';

        content.innerHTML = html;

        // Tab highlighting
        shadow.querySelectorAll('.cp-mcp-tab').forEach(t => {
          t.classList.toggle('primary', t.getAttribute('data-tab') === key);
        });

        // Copy handlers
        const copyCli = shadow.getElementById('cp-mcp-copy-cli');
        if (copyCli) {
          copyCli.onclick = async () => {
            try {
              await navigator.clipboard.writeText(cfg.cli);
              copyCli.innerHTML = ICONS.check;
              setTimeout(() => { copyCli.innerHTML = ICONS.copy; }, 1500);
            } catch (_) {}
          };
        }
        const copySnippet = shadow.getElementById('cp-mcp-copy-snippet');
        if (copySnippet) {
          copySnippet.onclick = async () => {
            try {
              await navigator.clipboard.writeText(cfg.snippet);
              copySnippet.innerHTML = ICONS.check;
              setTimeout(() => { copySnippet.innerHTML = ICONS.copy; }, 1500);
            } catch (_) {}
          };
        }
      }

      // Open/close modal
      const mcpSetupBtn = shadow.getElementById('cp-mcp-setup-btn');
      const mcpModal = shadow.getElementById('cp-mcp-modal');
      if (mcpSetupBtn && mcpModal) {
        mcpSetupBtn.onclick = () => {
          mcpModal.style.display = 'flex';
          renderMcpTab('claude');
        };
      }
      shadow.getElementById('cp-mcp-modal-close')?.addEventListener('click', () => {
        if (mcpModal) mcpModal.style.display = 'none';
      });
      mcpModal?.addEventListener('click', (e) => {
        if (e.target === mcpModal) mcpModal.style.display = 'none';
      });

      // Tab switching
      shadow.querySelectorAll('.cp-mcp-tab').forEach(tab => {
        tab.onclick = () => renderMcpTab(tab.getAttribute('data-tab'));
      });

      // Dock Orientation Controller
      let currentDockOrient = 'vertical';
      try {
        currentDockOrient = localStorage.getItem('agent-hover-dock-orient') || 'vertical';
      } catch(e) {}

      function applyDockOrientation(orient) {
        currentDockOrient = orient;
        try { localStorage.setItem('agent-hover-dock-orient', orient); } catch(e) {}
        if (orient === 'horizontal') {
          dockWrapper.classList.add('cp-dock-horizontal');
          if (dockOrientHoriz) dockOrientHoriz.classList.add('primary');
          if (dockOrientVert) dockOrientVert.classList.remove('primary');
        } else {
          dockWrapper.classList.remove('cp-dock-horizontal');
          if (dockOrientVert) dockOrientVert.classList.add('primary');
          if (dockOrientHoriz) dockOrientHoriz.classList.remove('primary');
        }
      }
      applyDockOrientation(currentDockOrient);

      if (dockOrientVert) {
        dockOrientVert.onclick = () => {
          applyDockOrientation('vertical');
          showCallout('Dock: Vertical', 'DOCK');
        };
      }
      if (dockOrientHoriz) {
        dockOrientHoriz.onclick = () => {
          applyDockOrientation('horizontal');
          showCallout('Dock: Horizontal', 'DOCK');
        };
      }

      // Persist & Drag Dock
      try {
        const savedPos = localStorage.getItem('agent_hover_dock_pos');
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          if (parsed.top && parsed.left) {
            dockWrapper.style.top = parsed.top;
            dockWrapper.style.left = parsed.left;
            dockWrapper.style.transform = 'none';
          }
        }
      } catch(e) {}
      updateDockOrientation();
      window.addEventListener('resize', updateDockOrientation);

      let isDragging = false;
      let dragStartY = 0;
      let dragStartX = 0;
      let initialTop = 0;
      let initialLeft = 0;

      dockHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = dockWrapper.getBoundingClientRect();
        initialTop = rect.top;
        initialLeft = rect.left;
        dockWrapper.style.transform = 'none';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dockH = dockWrapper.offsetHeight || 90;
        const dockW = dockWrapper.offsetWidth || 50;
        const newTop = Math.max(10, Math.min(window.innerHeight - dockH - 10, initialTop + (e.clientY - dragStartY)));
        const newLeft = Math.max(10, Math.min(window.innerWidth - dockW - 10, initialLeft + (e.clientX - dragStartX)));
        dockWrapper.style.top = newTop + 'px';
        dockWrapper.style.left = newLeft + 'px';
        updateDockOrientation();
      });

      window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        updateDockOrientation();
        try {
          localStorage.setItem('agent_hover_dock_pos', JSON.stringify({
            top: dockWrapper.style.top,
            left: dockWrapper.style.left
          }));
        } catch(e) {}
      });

      let calloutTimer = null;
      function showCallout(text, meta, duration = 2000) {
        calloutText.textContent = text;
        calloutMeta.textContent = meta || '';

        // Reset and apply theme-aware meta classification
        callout.className = '';
        calloutMeta.className = 'cp-callout-time';

        if (meta) {
          const m = String(meta).toLowerCase();
          let metaClass = 'meta-info';
          if (m === 'saved' || m === 'copied') metaClass = 'meta-success';
          else if (m === 'snap') metaClass = 'meta-snap';
          else if (m === 'error') metaClass = 'meta-error';
          else if (m === 'warning') metaClass = 'meta-warning';
          else if (m === 'hmr' || m === 'edit' || m === 'source' || m === 'undo') metaClass = 'meta-code';
          else if (m === 'pin' || m === 'note' || m === 'tip' || m === 'alt' || m === 'dock' || m === 'theme' || m === 'mode' || m === 'set' || m === 'ide') metaClass = 'meta-info';

          callout.classList.add(metaClass);
          calloutMeta.classList.add(metaClass);
        }

        callout.classList.add('show');
        if (calloutTimer) clearTimeout(calloutTimer);
        calloutTimer = setTimeout(() => {
          callout.classList.remove('show');
          calloutTimer = null;
        }, duration);
      }

      function updateInspectorCursor(active) {
        // Clean isolation: never inject into document.head or modify document.documentElement (F-07).
        // Cursor will be applied cleanly to the shadow root capture layer in P2-03.
      }

      function togglePointerMode() {
        isPointerMode = !isPointerMode;
        if (isPointerMode) {
          dockToggle.classList.add('active');
          showCallout('Inspector Active', 'Alt', 2200);
          updateInspectorCursor(true);
          console.log('[agent-hover] Pointer mode ON');
        } else {
          dockToggle.classList.remove('active');
          showCallout('Inspector Paused', 'OFF', 1500);
          updateInspectorCursor(false);
          highlight.style.display = 'none';
          if (typeof clearSelection === 'function') clearSelection();
          hideBands();
          clearDistanceGuides();
          closeTextEditor();
          selectedRect = null;
          currentComponentInfo = null;
          currentElement = null;
          currentStack = [];
          currentStackIndex = -1;
          console.log('[agent-hover] Pointer mode OFF');
        }
      }

      dockToggle.onclick = togglePointerMode;

      // Hover labels for dock buttons
      dockToggle.addEventListener('mouseenter', () => {
        if (!calloutTimer) {
          calloutText.textContent = isPointerMode ? 'Inspector Mode' : 'Inspect Element';
          calloutMeta.textContent = 'Alt';
          callout.classList.add('show');
        }
      });
      dockToggle.addEventListener('mouseleave', () => {
        if (!calloutTimer) callout.classList.remove('show');
      });

      dockPins.addEventListener('mouseenter', () => {
        if (!calloutTimer) {
          const pinCount = shadow.getElementById('cp-pin-count')?.textContent || '0';
          calloutText.textContent = 'Pinned Stack';
          calloutMeta.textContent = pinCount + ' pinned';
          callout.classList.add('show');
        }
      });
      dockPins.addEventListener('mouseleave', () => {
        if (!calloutTimer) callout.classList.remove('show');
      });

      dockHandle.addEventListener('mouseenter', () => {
        if (!calloutTimer) {
          calloutText.textContent = 'Drag Dock';
          calloutMeta.textContent = 'Move';
          callout.classList.add('show');
        }
      });
      dockHandle.addEventListener('mouseleave', () => {
        if (!calloutTimer) callout.classList.remove('show');
      });

      dockPins.onclick = () => {
        flyout.classList.toggle('open');
        if (flyout.classList.contains('open') && flyout.classList.contains('is-sidebar')) {
          dockWrapper.classList.add('sidebar-open');
        } else {
          dockWrapper.classList.remove('sidebar-open');
        }
        const pinBar = shadow.getElementById('cp-pin-bar');
        pinBar.scrollIntoView({ behavior: 'smooth' });
      };


      // Theme toggle (dark/light mode)
      const themeToggle = shadow.getElementById('cp-flyout-theme');
      const themeIconDark = shadow.getElementById('cp-theme-icon-dark');
      const themeIconLight = shadow.getElementById('cp-theme-icon-light');
      let isLightMode = false;
      try { isLightMode = localStorage.getItem('agent-hover-theme') === 'light'; } catch(e) {}
      
      function applyTheme() {
        if (isLightMode) {
          shadow.host.classList.add('light-mode');
          if (themeIconDark) themeIconDark.style.display = 'none';
          if (themeIconLight) themeIconLight.style.display = 'block';
          if (themeSetDark) themeSetDark.classList.remove('primary');
          if (themeSetLight) themeSetLight.classList.add('primary');
        } else {
          shadow.host.classList.remove('light-mode');
          if (themeIconDark) themeIconDark.style.display = 'block';
          if (themeIconLight) themeIconLight.style.display = 'none';
          if (themeSetDark) themeSetDark.classList.add('primary');
          if (themeSetLight) themeSetLight.classList.remove('primary');
        }
      }
      applyTheme();

      if (themeToggle) {
        themeToggle.onclick = () => {
          isLightMode = !isLightMode;
          applyTheme();
          try { localStorage.setItem('agent-hover-theme', isLightMode ? 'light' : 'dark'); } catch(e) {}
          showCallout(isLightMode ? 'Light mode' : 'Dark mode', 'THEME');
        };
      }
      if (themeSetDark) {
        themeSetDark.onclick = () => {
          isLightMode = false;
          applyTheme();
          try { localStorage.setItem('agent-hover-theme', 'dark'); } catch(e) {}
          showCallout('Dark mode', 'THEME');
        };
      }
      if (themeSetLight) {
        themeSetLight.onclick = () => {
          isLightMode = true;
          applyTheme();
          try { localStorage.setItem('agent-hover-theme', 'light'); } catch(e) {}
          showCallout('Light mode', 'THEME');
        };
      }

      shadow.getElementById('cp-flyout-close').onclick = () => {
        flyout.classList.remove('open');
        dockWrapper.classList.remove('sidebar-open');
      };

      // Flyout Sidebar Mode Switcher & Draggable Floating Panel
      const flyoutModeToggle = shadow.getElementById('cp-flyout-mode-toggle');
      const modeSidebarIcon = shadow.getElementById('cp-mode-sidebar-icon');
      const modeFloatIcon = shadow.getElementById('cp-mode-float-icon');
      const flyoutHeader = shadow.getElementById('cp-flyout-header');

      // Requirement 4: The sidebar by default should be attached for now.
      let flyoutMode = 'sidebar';
      try {
        flyoutMode = localStorage.getItem('agent-hover-flyout-mode-v2') || 'sidebar';
      } catch(e) {}

      function applyFlyoutMode(mode) {
        flyoutMode = mode;
        try {
          localStorage.setItem('agent-hover-flyout-mode-v2', mode);
        } catch(e) {}

        if (mode === 'sidebar') {
          flyout.classList.add('is-sidebar');
          flyout.style.left = '';
          flyout.style.top = '';
          flyout.style.right = '';
          flyout.style.bottom = '';
          if (flyoutHeader) flyoutHeader.style.cursor = 'default';
          if (modeSidebarIcon) modeSidebarIcon.style.display = 'none';
          if (modeFloatIcon) modeFloatIcon.style.display = 'block';
          if (flyoutModeToggle) flyoutModeToggle.setAttribute('title', 'Detach Sidebar (Float Window)');
          if (flyout.classList.contains('open')) {
            dockWrapper.classList.add('sidebar-open');
          }
        } else {
          flyout.classList.remove('is-sidebar');
          if (flyoutHeader) flyoutHeader.style.cursor = 'grab';
          if (modeSidebarIcon) modeSidebarIcon.style.display = 'block';
          if (modeFloatIcon) modeFloatIcon.style.display = 'none';
          if (flyoutModeToggle) flyoutModeToggle.setAttribute('title', 'Attach Sidebar (Dock to Edge)');
          dockWrapper.classList.remove('sidebar-open');

          // Position screen-friendly within viewport
          try {
            const savedFlyoutPos = localStorage.getItem('agent_hover_flyout_pos');
            if (savedFlyoutPos) {
              const parsed = JSON.parse(savedFlyoutPos);
              const fW = 440;
              const fH = 600;
              const maxLeft = Math.max(12, window.innerWidth - fW - 12);
              const maxTop = Math.max(12, window.innerHeight - fH - 12);
              const clampedLeft = Math.max(12, Math.min(maxLeft, parseInt(parsed.left, 10) || maxLeft));
              const clampedTop = Math.max(12, Math.min(maxTop, parseInt(parsed.top, 10) || 60));
              flyout.style.left = clampedLeft + 'px';
              flyout.style.top = clampedTop + 'px';
              flyout.style.right = 'auto';
            } else {
              const defaultLeft = Math.max(12, window.innerWidth - 440 - 24);
              flyout.style.left = defaultLeft + 'px';
              flyout.style.top = '60px';
              flyout.style.right = 'auto';
            }
          } catch(e) {
            flyout.style.left = Math.max(12, window.innerWidth - 440 - 24) + 'px';
            flyout.style.top = '60px';
            flyout.style.right = 'auto';
          }
        }
      }

      applyFlyoutMode(flyoutMode);

      if (flyoutModeToggle) {
        flyoutModeToggle.onclick = () => {
          applyFlyoutMode(flyoutMode === 'sidebar' ? 'float' : 'sidebar');
          showCallout(flyoutMode === 'sidebar' ? 'Sidebar: Attached' : 'Sidebar: Detached & Draggable', 'MODE');
        };
      }

      // Detached Draggable Flyout Mechanics (Requirements 2 & 5)
      let isFlyoutDragging = false;
      let flyoutDragStartX = 0;
      let flyoutDragStartY = 0;
      let flyoutInitialTop = 0;
      let flyoutInitialLeft = 0;

      if (flyoutHeader) {
        flyoutHeader.addEventListener('mousedown', (e) => {
          if (flyout.classList.contains('is-sidebar')) return;
          if (e.target.closest('button') || e.target.closest('.cp-dock-tile') || e.target.closest('select') || e.target.closest('input')) return;

          isFlyoutDragging = true;
          flyoutDragStartX = e.clientX;
          flyoutDragStartY = e.clientY;
          const rect = flyout.getBoundingClientRect();
          flyoutInitialTop = rect.top;
          flyoutInitialLeft = rect.left;
          flyoutHeader.style.cursor = 'grabbing';
          e.preventDefault();
        });
      }

      window.addEventListener('mousemove', (e) => {
        if (!isFlyoutDragging || flyout.classList.contains('is-sidebar')) return;
        const fW = flyout.offsetWidth || 440;
        const fH = flyout.offsetHeight || 600;
        const newLeft = flyoutInitialLeft + (e.clientX - flyoutDragStartX);
        const newTop = flyoutInitialTop + (e.clientY - flyoutDragStartY);
        const maxLeft = Math.max(12, window.innerWidth - fW - 12);
        const maxTop = Math.max(12, window.innerHeight - fH - 12);
        const clampedLeft = Math.max(12, Math.min(maxLeft, newLeft));
        const clampedTop = Math.max(12, Math.min(maxTop, newTop));
        flyout.style.left = clampedLeft + 'px';
        flyout.style.top = clampedTop + 'px';
        flyout.style.right = 'auto';
        flyout.style.bottom = 'auto';
      });

      window.addEventListener('mouseup', () => {
        if (!isFlyoutDragging) return;
        isFlyoutDragging = false;
        if (flyoutHeader && !flyout.classList.contains('is-sidebar')) {
          flyoutHeader.style.cursor = 'grab';
        }
        try {
          localStorage.setItem('agent_hover_flyout_pos', JSON.stringify({
            left: flyout.style.left,
            top: flyout.style.top
          }));
        } catch(e) {}
      });

      // Window resize bounds keeper
      window.addEventListener('resize', () => {
        if (flyout.classList.contains('is-sidebar')) return;
        const rect = flyout.getBoundingClientRect();
        const fW = rect.width || 440;
        const fH = rect.height || 600;
        const maxLeft = Math.max(12, window.innerWidth - fW - 12);
        const maxTop = Math.max(12, window.innerHeight - fH - 12);
        if (rect.left > maxLeft || rect.top > maxTop) {
          flyout.style.left = Math.max(12, Math.min(maxLeft, rect.left)) + 'px';
          flyout.style.top = Math.max(12, Math.min(maxTop, rect.top)) + 'px';
          flyout.style.right = 'auto';
        }
      });

      // Spacing Overlay Toggle (Opt-in Box Model)
      let showSpacingOverlay = false;
      const toggleSpacingBtn = shadow.getElementById('cp-toggle-spacing');
      if (toggleSpacingBtn) {
        toggleSpacingBtn.onclick = () => {
          showSpacingOverlay = !showSpacingOverlay;
          if (showSpacingOverlay) {
            toggleSpacingBtn.classList.add('primary');
            toggleSpacingBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Spacing ON';
            if (currentElement) positionBands(currentElement);
          } else {
            toggleSpacingBtn.classList.remove('primary');
            toggleSpacingBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Spacing Overlay';
            hideBands();
          }
        };
      }

      let lastCopiedContext = null;
      let lastResolved = null;
      let lastInfoName = null;
      let lastComputedStyles = null;

      // Selection frame elements (Persistent selection & near-component chip)
      const selectionFrame = shadow.getElementById('cp-selection-frame');
      const selectionChip = shadow.getElementById('cp-selection-chip');
      const selName = shadow.getElementById('cp-sel-name');
      const selFile = shadow.getElementById('cp-sel-file');
      const selCopyBtn = shadow.getElementById('cp-sel-copy-btn');
      const selCopyLabel = shadow.getElementById('cp-sel-copy-label');
      const selNoteBtn = shadow.getElementById('cp-sel-note-btn');
      const selPinBtn = shadow.getElementById('cp-sel-pin-btn');
      const selSnapBtn = shadow.getElementById('cp-sel-snap-btn');
      const selIdeBtn = shadow.getElementById('cp-sel-ide-btn');
      const selCloseBtn = shadow.getElementById('cp-sel-close-btn');

      let selectedTarget = null;
      let selectedElement = null;
      let comments = [];
      let editingComment = null;
      let activeNoteMarker = null;
      let pendingNoteTarget = null;
      let pendingPinTarget = null;
      let currentPins = [];

      function clearSelection() {
        selectedTarget = null;
        selectedElement = null;
        selectedRect = null;
        if (selectionFrame) selectionFrame.style.display = 'none';
        highlight.classList.remove('selected');
        clearDistanceGuides();
      }

      function updateSelectionFrame() {
        if (!selectedTarget || !selectionFrame) {
          if (selectionFrame) selectionFrame.style.display = 'none';
          return;
        }
        let rect = null;
        if (selectedTarget.isDomElement && selectedTarget.element) {
          rect = selectedTarget.element.getBoundingClientRect();
        } else if (selectedTarget.fiber) {
          rect = getComponentBoundingRect(selectedTarget.fiber);
        } else if (selectedElement) {
          rect = selectedElement.getBoundingClientRect();
        }
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          selectionFrame.style.display = 'none';
          return;
        }
        selectionFrame.style.display = 'block';
        selectionFrame.style.top = rect.top + 'px';
        selectionFrame.style.left = rect.left + 'px';
        selectionFrame.style.width = rect.width + 'px';
        selectionFrame.style.height = rect.height + 'px';

        if (rect.top < 36) {
          selectionChip.classList.add('inside-top');
        } else {
          selectionChip.classList.remove('inside-top');
        }

        const sidebarActive = flyout && flyout.classList.contains('open') && flyout.classList.contains('is-sidebar');
        const maxRight = sidebarActive ? (window.innerWidth - 440 - 12) : (window.innerWidth - 12);

        if (rect.left < 10) {
          selectionChip.style.left = '4px';
          selectionChip.style.right = 'auto';
        } else if (rect.left + 320 > maxRight) {
          selectionChip.style.left = 'auto';
          selectionChip.style.right = sidebarActive ? '452px' : '4px';
        } else {
          selectionChip.style.left = '-2px';
          selectionChip.style.right = 'auto';
        }
      }

      // --- Persistent Inline Comments Logic ---
      async function loadComments() {
        try {
          const res = await fetch(BRIDGE + '/api/comments');
          const data = await res.json();
          comments = data.comments || [];
          try { localStorage.setItem('agent-hover-comments', JSON.stringify(comments)); } catch(e) {}
          renderCommentMarkers();
          renderSidebarNotes();
        } catch(e) {
          try {
            comments = JSON.parse(localStorage.getItem('agent-hover-comments') || '[]');
            renderCommentMarkers();
            renderSidebarNotes();
          } catch(err) {}
        }
      }

      function renderCommentMarkers() {
        const layer = shadow.getElementById('cp-comments-layer');
        if (!layer) return;
        layer.innerHTML = '';
        const notePopoverOpen = shadow.getElementById('cp-note-popover')?.classList.contains('open');

        // Build marker data with positions
        const markerData = [];
        comments.forEach((c, index) => {
          let el = null;
          if (c.selector) {
            try { el = document.querySelector(c.selector); } catch(e) {}
          }
          if (!el && c.component) {
            el = findComponentElement(c.component);
          }
          if (!el) return;

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;

          // Anchor at bottom-left corner of the element
          const x = Math.max(12, Math.min(window.innerWidth - 12, rect.left));
          const y = Math.max(24, rect.bottom);
          markerData.push({ c, index, el, x, y, rect });
        });

        // Cluster detection: group markers within 14px of each other
        const CLUSTER_DIST = 14;
        const used = new Set();
        const clusters = [];

        for (let i = 0; i < markerData.length; i++) {
          if (used.has(i)) continue;
          const group = [i];
          used.add(i);
          for (let j = i + 1; j < markerData.length; j++) {
            if (used.has(j)) continue;
            const dx = markerData[i].x - markerData[j].x;
            const dy = markerData[i].y - markerData[j].y;
            if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_DIST) {
              group.push(j);
              used.add(j);
            }
          }
          clusters.push(group);
        }

        clusters.forEach((group) => {
          if (group.length > 1) {
            // Render cluster marker
            const avg = group.reduce((a, i) => ({ x: a.x + markerData[i].x, y: a.y + markerData[i].y }), { x: 0, y: 0 });
            avg.x /= group.length;
            avg.y /= group.length;

            const clusterMarker = document.createElement('div');
            clusterMarker.className = 'cp-comment-marker cluster';
            clusterMarker.style.left = avg.x + 'px';
            clusterMarker.style.top = avg.y + 'px';
            clusterMarker.setAttribute('role', 'button');
            clusterMarker.tabIndex = 0;
            clusterMarker.setAttribute('aria-label', group.length + ' notes');
            clusterMarker.innerHTML = '<span class="cp-marker-num">' + group.length + '</span>';

            // Preview for cluster
            if (!notePopoverOpen) {
              const names = group.map(i => markerData[i].c.component || 'Element').join(', ');
              const flipClass = avg.x > window.innerWidth - 240 ? ' flip' : '';
              clusterMarker.innerHTML += '<span class="cp-marker-preview' + flipClass + '">' +
                '<span class="cp-marker-preview-header">' + group.length + ' notes</span>' +
                '<span class="cp-marker-preview-text">' + escapeHtml(names) + '</span></span>';
            }

            // Click expands cluster by spreading members
            clusterMarker.onclick = (e) => {
              e.stopPropagation();
              clusterMarker.remove();
              group.forEach((mi, offset) => {
                const m = markerData[mi];
                const spreadX = m.x + (offset - (group.length - 1) / 2) * 28;
                createSingleMarker(m, layer, notePopoverOpen, spreadX, m.y);
              });
            };
            clusterMarker.onkeydown = (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clusterMarker.click(); }
            };
            layer.appendChild(clusterMarker);
          } else {
            const m = markerData[group[0]];
            createSingleMarker(m, layer, notePopoverOpen, m.x, m.y);
          }
        });
      }

      function createSingleMarker(m, layer, notePopoverOpen, x, y) {
        const { c, index, el } = m;
        const componentName = c.component || el.tagName.toLowerCase();
        const marker = document.createElement('div');
        marker.className = 'cp-comment-marker' + (c.resolved ? ' resolved' : '');
        if (activeNoteMarker === marker) marker.classList.add('active');
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
        marker.setAttribute('role', 'button');
        marker.tabIndex = 0;
        marker.setAttribute('aria-label', 'Note ' + (index + 1) + ' on ' + componentName);

        // Content: number for normal, check icon for resolved
        if (c.resolved) {
          marker.innerHTML = ICONS.check;
        } else {
          marker.innerHTML = '<span class="cp-marker-num">' + (index + 1) + '</span>';
        }

        // Preview card (hidden when popover is open)
        if (!notePopoverOpen) {
          const flipClass = x > window.innerWidth - 240 ? ' flip' : '';
          const previewText = escapeHtml(c.text || '').slice(0, 80);
          marker.innerHTML += '<span class="cp-marker-preview' + flipClass + '">' +
            '<span class="cp-marker-preview-header">#' + (index + 1) + ' ' + escapeHtml(componentName) + '</span>' +
            '<span class="cp-marker-preview-text">' + previewText + '</span></span>';
        }

        marker.onclick = (e) => {
          e.stopPropagation();
          activeNoteMarker = marker;
          openNotePopover({ element: el, name: componentName }, c, marker);
        };
        marker.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); marker.click(); }
          if (e.key === 'Escape') {
            const popover = shadow.getElementById('cp-note-popover');
            if (popover?.classList.contains('open')) closeNotePopover();
          }
        };
        layer.appendChild(marker);
      }

      function renderSidebarNotes() {
        const countEl = shadow.getElementById('cp-notes-count');
        const listEl = shadow.getElementById('cp-notes-list');
        if (!listEl) return;
        if (countEl) countEl.textContent = comments.length;

        if (comments.length === 0) {
          listEl.innerHTML = '<div style="font-size:11px; color:var(--text-muted); font-style:italic;">No notes yet. Click the note icon on any element to add persistent notes.</div>';
          return;
        }

        listEl.innerHTML = '';
        comments.forEach((c, idx) => {
          const item = document.createElement('div');
          item.className = 'cp-note-item' + (c.resolved ? ' resolved' : '');
          
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';

          const titleWrap = document.createElement('div');
          titleWrap.style.display = 'flex';
          titleWrap.style.alignItems = 'center';
          titleWrap.style.gap = '5px';
          titleWrap.innerHTML = '<span class="cp-pin-badge">#' + (idx + 1) + '</span> <span style="font-weight:600; color:var(--text-primary); font-family:var(--font-mono); font-size:11px;">' + (c.component ? '&lt;' + escapeHtml(c.component) + ' /&gt;' : escapeHtml(c.selector || 'Element')) + '</span>';

          const actionsWrap = document.createElement('div');
          actionsWrap.style.display = 'flex';
          actionsWrap.style.alignItems = 'center';
          actionsWrap.style.gap = '4px';

          const resolveBtn = document.createElement('button');
          resolveBtn.style.cssText = 'background:none; border:none; cursor:pointer; padding:2px; color:' + (c.resolved ? 'var(--accent-emerald)' : 'var(--text-muted)');
          resolveBtn.title = c.resolved ? 'Mark unresolved' : 'Mark resolved';
          resolveBtn.innerHTML = ICONS.check;
          resolveBtn.onclick = async (e) => {
            e.stopPropagation();
            await fetch(BRIDGE + '/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'toggle-resolve', id: c.id })
            });
            loadComments();
          };

          const delBtn = document.createElement('button');
          delBtn.style.cssText = 'background:none; border:none; cursor:pointer; padding:2px; color:var(--accent-rose); opacity:0.7;';
          delBtn.title = 'Delete note';
          delBtn.innerHTML = ICONS.trash;
          delBtn.onclick = async (e) => {
            e.stopPropagation();
            await fetch(BRIDGE + '/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: c.id })
            });
            loadComments();
          };

          actionsWrap.appendChild(resolveBtn);
          actionsWrap.appendChild(delBtn);
          header.appendChild(titleWrap);
          header.appendChild(actionsWrap);

          const body = document.createElement('div');
          body.style.color = c.resolved ? 'var(--text-muted)' : 'var(--text-primary)';
          body.style.textDecoration = c.resolved ? 'line-through' : 'none';
          body.style.fontSize = '11.5px';
          body.style.lineHeight = '1.4';
          body.textContent = c.text;

          item.appendChild(header);
          item.appendChild(body);
          
          item.onclick = () => {
            let el = null;
            if (c.selector) {
              try { el = document.querySelector(c.selector); } catch(e) {}
            }
            if (!el && c.component) el = findComponentElement(c.component);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              selectedElement = el;
              selectedTarget = { name: c.component || el.tagName.toLowerCase(), element: el, isDomElement: true };
              updateSelectionFrame();
            }
          };

          listEl.appendChild(item);
        });
      }

      function openNotePopover(target, comment = null, markerEl = null) {
        editingComment = comment;
        activeNoteMarker = markerEl;
        pendingNoteTarget = target;
        const popover = shadow.getElementById('cp-note-popover');
        const labelEl = shadow.getElementById('cp-note-popover-label');
        const targetNameEl = shadow.getElementById('cp-note-popover-target');
        const fileBadge = shadow.getElementById('cp-note-popover-file');
        const sepEl = shadow.getElementById('cp-note-target-sep');
        const targetCapsule = shadow.getElementById('cp-note-target-capsule');
        const statusBadge = shadow.getElementById('cp-note-status-badge');
        const inputEl = shadow.getElementById('cp-note-input');
        const errorEl = shadow.getElementById('cp-note-error');
        const delBtn = shadow.getElementById('cp-note-delete');
        const resolveBtn = shadow.getElementById('cp-note-resolve');
        if (!popover || !inputEl) return;

        // Close any other floating layers (screenshot dropdown)
        closeSnapDropdown();

        const compName = comment?.component || target?.name || selectedTarget?.name || (lastCopiedContext ? lastCopiedContext.component.name : '');
        const fileStr = comment?.file || lastResolved?.file || lastCopiedContext?.source?.file || '';

        // Header label & status pill
        if (comment) {
          const noteIdx = comments.findIndex(c => c.id === comment.id);
          labelEl.textContent = noteIdx >= 0 ? ('Note #' + (noteIdx + 1)) : 'Note';
          if (statusBadge) {
            statusBadge.style.display = comment.resolved ? 'inline-flex' : 'none';
            statusBadge.textContent = 'Resolved';
          }
        } else {
          labelEl.textContent = 'New note';
          if (statusBadge) statusBadge.style.display = 'none';
        }

        // Format component tag & file badge cleanly
        function formatComponentName(name) {
          if (!name) return '';
          name = name.trim();
          if (name.startsWith('<') && name.endsWith('/>')) return name;
          if (name.startsWith('<') && name.endsWith('>')) return name;
          return '<' + name + ' />';
        }

        const formattedTarget = compName ? formatComponentName(compName) : '';
        const shortFile = fileStr ? fileStr.split('/').pop() : '';

        if (targetNameEl) targetNameEl.textContent = formattedTarget;
        if (fileBadge) {
          fileBadge.textContent = shortFile;
          fileBadge.style.display = shortFile ? '' : 'none';
        }
        if (sepEl) {
          sepEl.style.display = (formattedTarget && shortFile) ? 'inline' : 'none';
        }
        if (targetCapsule) {
          targetCapsule.style.display = (formattedTarget || shortFile) ? 'inline-flex' : 'none';
        }

        inputEl.value = comment?.text || '';
        if (errorEl) errorEl.textContent = '';

        // Auto-resize input to content
        const updateInputHeight = () => {
          inputEl.style.height = 'auto';
          const newHeight = Math.max(72, Math.min(inputEl.scrollHeight, 200));
          inputEl.style.height = newHeight + 'px';
        };

        // Platform-specific shortcut hint (⌘↵ on Mac, Ctrl↵ on others)
        const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        const hintEl = popover.querySelector('.cp-note-hint');
        if (hintEl) {
          hintEl.innerHTML = '<kbd class="cp-kbd">' + (isMac ? '⌘' : 'Ctrl') + '</kbd><kbd class="cp-kbd">↵</kbd>';
        }

        // Show/hide delete and resolve for existing notes only
        if (comment) {
          delBtn.style.display = 'inline-flex';
          resolveBtn.style.display = 'inline-flex';
          resolveBtn.title = comment.resolved ? 'Reopen note' : 'Mark as resolved';
          resolveBtn.setAttribute('aria-label', comment.resolved ? 'Reopen note' : 'Resolve note');
          resolveBtn.innerHTML = comment.resolved ? ICONS.undo : ICONS.check;
          if (comment.resolved) {
            resolveBtn.classList.add('resolved');
          } else {
            resolveBtn.classList.remove('resolved');
          }

          delBtn.onclick = async () => {
            await fetch(BRIDGE + '/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: comment.id })
            });
            closeNotePopover();
            await loadComments();
            if (typeof renderFlyoutForStackIndex === 'function' && typeof currentStackIndex === 'number' && shadow.getElementById('cp-flyout')?.classList.contains('open')) {
              renderFlyoutForStackIndex(currentStackIndex);
            }
            showCallout('Note deleted', 'NOTE');
          };

          resolveBtn.onclick = async () => {
            await fetch(BRIDGE + '/api/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'toggle-resolve', id: comment.id })
            });
            closeNotePopover();
            await loadComments();
            if (typeof renderFlyoutForStackIndex === 'function' && typeof currentStackIndex === 'number' && shadow.getElementById('cp-flyout')?.classList.contains('open')) {
              renderFlyoutForStackIndex(currentStackIndex);
            }
            showCallout(comment.resolved ? 'Note reopened' : 'Note resolved', 'SAVED');
          };
        } else {
          delBtn.style.display = 'none';
          resolveBtn.style.display = 'none';
          resolveBtn.classList.remove('resolved');
        }

        // Position: anchor beside the marker or selected element
        const MARGIN = 12;
        const CARD_WIDTH = 320;
        let anchorX, anchorY;

        let anchorRect = null;
        if (markerEl) {
          anchorRect = markerEl.getBoundingClientRect();
        } else if (target?.element && typeof target.element.getBoundingClientRect === 'function') {
          anchorRect = target.element.getBoundingClientRect();
        } else if (selectedRect) {
          anchorRect = selectedRect;
        }

        if (markerEl && anchorRect) {
          anchorX = anchorRect.right + 14;
          anchorY = anchorRect.top - 16;
          // Flip left if off-screen on the right
          if (anchorX + CARD_WIDTH + MARGIN > window.innerWidth) {
            anchorX = anchorRect.left - CARD_WIDTH - 14;
          }
        } else if (anchorRect) {
          // If anchored to an element, place to the right if fits, or below/left
          if (anchorRect.right + 14 + CARD_WIDTH + MARGIN <= window.innerWidth) {
            anchorX = anchorRect.right + 14;
            anchorY = anchorRect.top;
          } else if (anchorRect.left - CARD_WIDTH - 14 >= MARGIN) {
            anchorX = anchorRect.left - CARD_WIDTH - 14;
            anchorY = anchorRect.top;
          } else {
            anchorX = Math.max(MARGIN, Math.min(window.innerWidth - CARD_WIDTH - MARGIN, anchorRect.left));
            anchorY = anchorRect.bottom + 12;
          }
        } else {
          anchorX = window.innerWidth / 2 - (CARD_WIDTH / 2);
          anchorY = window.innerHeight * 0.25;
        }

        // Clamp inside viewport
        anchorX = Math.max(MARGIN, Math.min(window.innerWidth - CARD_WIDTH - MARGIN, anchorX));
        anchorY = Math.max(MARGIN, Math.min(window.innerHeight - 250 - MARGIN, anchorY));

        popover.style.top = Math.round(anchorY) + 'px';
        popover.style.left = Math.round(anchorX) + 'px';

        // Animate open using requestAnimationFrame for display+class toggle
        requestAnimationFrame(() => {
          popover.classList.add('open');
          updateInputHeight();
        });

        // Set active state on marker
        if (markerEl) markerEl.classList.add('active');

        // Re-render markers to hide previews
        renderCommentMarkers();

        setTimeout(() => {
          inputEl.focus();
          updateInputHeight();
        }, 50);

        // Clear error and resize on input
        inputEl.oninput = () => {
          if (errorEl) errorEl.textContent = '';
          updateInputHeight();
        };
      }

      function closeNotePopover() {
        const popover = shadow.getElementById('cp-note-popover');
        if (popover) popover.classList.remove('open');
        if (activeNoteMarker) {
          activeNoteMarker.classList.remove('active');
          try { activeNoteMarker.focus(); } catch (_) {}
        }
        activeNoteMarker = null;
        editingComment = null;
        pendingNoteTarget = null;
        renderCommentMarkers();
      }

      async function saveNote() {
        const inputEl = shadow.getElementById('cp-note-input');
        const errorEl = shadow.getElementById('cp-note-error');
        const text = inputEl ? inputEl.value.trim() : '';
        if (!text) {
          if (errorEl) errorEl.textContent = 'Enter a note first';
          if (inputEl) inputEl.focus();
          return;
        }

        if (editingComment) {
          await fetch(BRIDGE + '/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id: editingComment.id, text })
          });
          showCallout('Note updated', 'SAVED');
        } else {
          const compName = pendingNoteTarget?.name || selectedTarget?.name || (lastCopiedContext ? lastCopiedContext.component.name : '');
          const file = lastResolved?.file || lastCopiedContext?.source?.file || '';
          const line = lastResolved?.line || lastCopiedContext?.source?.startLine || undefined;
          const targetEl = pendingNoteTarget?.element || selectedTarget?.element || selectedElement;
          const selector = targetEl ? buildCSSSelector(targetEl) : '';

          await fetch(BRIDGE + '/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add',
              comment: { file, line, component: compName, selector, text }
            })
          });
          showCallout('Note saved', 'SAVED');
        }

        closeNotePopover();
        await loadComments();
        if (typeof renderFlyoutForStackIndex === 'function' && typeof currentStackIndex === 'number' && shadow.getElementById('cp-flyout')?.classList.contains('open')) {
          renderFlyoutForStackIndex(currentStackIndex);
        }
      }

      // Note popover keyboard: Cmd/Ctrl+Enter saves, Escape closes anywhere in popover
      shadow.getElementById('cp-note-popover')?.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          saveNote();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeNotePopover();
        }
      });

      const noteSaveBtn = shadow.getElementById('cp-note-save');
      if (noteSaveBtn) noteSaveBtn.onclick = saveNote;
      const noteCancelBtn = shadow.getElementById('cp-note-cancel');
      if (noteCancelBtn) noteCancelBtn.onclick = () => closeNotePopover();
      const noteCloseBtn = shadow.getElementById('cp-note-popover-close');
      if (noteCloseBtn) noteCloseBtn.onclick = () => closeNotePopover();

      // Click outside closes popover
      shadow.addEventListener('click', (e) => {
        const popover = shadow.getElementById('cp-note-popover');
        if (popover?.classList.contains('open') && !popover.contains(e.target) && !e.target.closest('.cp-comment-marker')) {
          closeNotePopover();
        }
      });

      const notesCopyAllBtn = shadow.getElementById('cp-notes-copy-all');
      if (notesCopyAllBtn) {
        notesCopyAllBtn.onclick = async () => {
          if (comments.length === 0) {
            showCallout('No notes to copy', 'TIP');
            return;
          }
          const bt = String.fromCharCode(96);
          const nl = String.fromCharCode(10);
          let md = '### Persistent Codebase Notes & Feedback' + nl + nl;
          comments.forEach((c, i) => {
            const num = i + 1;
            const target = c.component ? '<' + c.component + ' />' : (c.selector || 'Element');
            const loc = c.file ? ' (' + bt + c.file + (c.line ? ':' + c.line : '') + bt + ')' : '';
            const status = c.resolved ? ' [RESOLVED]' : '';
            md += num + '. **' + target + '**' + loc + status + ':' + nl;
            md += '   > ' + c.text + nl + nl;
          });
          await navigator.clipboard.writeText(md);
          const origText = notesCopyAllBtn.textContent;
          notesCopyAllBtn.textContent = 'Copied!';
          showCallout('All ' + comments.length + ' notes copied for AI', 'COPIED');
          setTimeout(() => { notesCopyAllBtn.textContent = origText; }, 1600);
        };
      }

      // --- Pinned Multi-Task Dialog Logic ---
      function openPinDialog(target, resolved) {
        pendingPinTarget = { target, resolved };
        const pinBadge = shadow.getElementById('cp-pin-dialog-badge');
        const pinName = shadow.getElementById('cp-pin-dialog-name');
        const pinFile = shadow.getElementById('cp-pin-dialog-file');
        const pinTask = shadow.getElementById('cp-pin-dialog-task');
        const pinDlg = shadow.getElementById('cp-pin-dialog');

        const currentPinsCount = currentPins.length;
        pinBadge.textContent = 'Pin #' + (currentPinsCount + 1);
        pinName.textContent = '<' + (target?.name || 'Component') + ' />';
        pinFile.textContent = resolved?.file ? (resolved.file.split('/').slice(-2).join('/') + (resolved.line ? ':' + resolved.line : '')) : '';
        
        const existingPin = currentPins.find(p => p.context?.source?.file === resolved?.file);
        pinTask.value = existingPin?.task || '';

        if (selectedRect) {
          let top = selectedRect.bottom + 10;
          if (top + 190 > window.innerHeight) top = Math.max(20, selectedRect.top - 200);
          let left = Math.max(20, Math.min(window.innerWidth - 360, selectedRect.left));
          pinDlg.style.top = top + 'px';
          pinDlg.style.left = left + 'px';
          pinDlg.style.transform = 'none';
        } else {
          pinDlg.style.top = '30%';
          pinDlg.style.left = '50%';
          pinDlg.style.transform = 'translate(-50%, -50%)';
        }

        pinDlg.style.display = 'block';
        setTimeout(() => pinTask.focus(), 50);
      }

      const pinDialogAddMore = shadow.getElementById('cp-pin-dialog-add-more');
      if (pinDialogAddMore) {
        pinDialogAddMore.onclick = async () => {
          if (!pendingPinTarget) return;
          const { target, resolved } = pendingPinTarget;
          const taskVal = shadow.getElementById('cp-pin-dialog-task')?.value.trim() || '';
          const pinId = 'pin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          
          await fetch(BRIDGE + '/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', id: pinId, file: resolved.file, line: resolved.line, task: taskVal })
          });
          shadow.getElementById('cp-pin-dialog').style.display = 'none';
          showCallout('Pin added. Click next element to add more', 'PIN');
          await refreshState();
          
          if (!isPointerMode) {
            togglePointerMode();
          }
        };
      }

      const pinDialogCopyNow = shadow.getElementById('cp-pin-dialog-copy-now');
      if (pinDialogCopyNow) {
        pinDialogCopyNow.onclick = async () => {
          if (!pendingPinTarget) return;
          const { target, resolved } = pendingPinTarget;
          const taskVal = shadow.getElementById('cp-pin-dialog-task')?.value.trim() || '';
          const pinId = 'pin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

          await fetch(BRIDGE + '/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', id: pinId, file: resolved.file, line: resolved.line, task: taskVal })
          });
          shadow.getElementById('cp-pin-dialog').style.display = 'none';
          await refreshState();

          const level = shadow.getElementById('cp-context-level')?.value || 'standard';
          try {
            const taskRes = await fetch(BRIDGE + '/api/task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instruction: taskVal, level })
            });
            const taskData = await taskRes.json();
            await navigator.clipboard.writeText(taskData.context);
            showCallout('Task prompt copied (' + (taskData.tokenCost || '?') + ' tok)', 'COPIED');
          } catch(e) {
            showCallout('Pinned ' + (target?.name || 'Component'), 'PIN');
          }
        };
      }

      const pinDialogClose = shadow.getElementById('cp-pin-dialog-close');
      if (pinDialogClose) {
        pinDialogClose.onclick = () => {
          shadow.getElementById('cp-pin-dialog').style.display = 'none';
        };
      }

      if (selCloseBtn) {
        selCloseBtn.onclick = (e) => {
          e.stopPropagation();
          clearSelection();
          flyout.classList.remove('open');
          dockWrapper.classList.remove('sidebar-open');
        };
      }

      if (selCopyBtn) {
        selCopyBtn.onclick = async (e) => {
          e.stopPropagation();
          if (lastCopiedContext) {
            const promptText = formatContextForAiPrompt(lastCopiedContext, currentStack);
            await navigator.clipboard.writeText(promptText);
            if (selCopyLabel) selCopyLabel.textContent = 'Copied!';
            showCallout('AI Prompt Copied (' + (lastCopiedContext.tokens?.current || '?') + ' tok)', 'COPIED');
            setTimeout(() => { if (selCopyLabel) selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
          } else if (selectedTarget) {
            try {
              if (selCopyLabel) selCopyLabel.textContent = 'Copying...';
              const compToResolve = selectedTarget.isDomElement && currentStack.length > 1 ? currentStack[1] : selectedTarget;
              const res = await resolveComponent(compToResolve);
              if (res) {
                const fetchRes = await fetch(BRIDGE + '/api/context', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file: res.file, line: res.line, level: 'standard' })
                });
                const ctx = await fetchRes.json();
                lastCopiedContext = ctx;
                const promptText = formatContextForAiPrompt(ctx, currentStack);
                await navigator.clipboard.writeText(promptText);
                if (selCopyLabel) selCopyLabel.textContent = 'Copied!';
                showCallout('AI Prompt Copied', 'COPIED');
                setTimeout(() => { if (selCopyLabel) selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
                return;
              }
            } catch(err) {
              console.error(err);
            }
            const promptText = formatDomElementPrompt(selectedTarget, lastComputedStyles || extractComputedStyles(selectedTarget.element || selectedElement), currentStack);
            await navigator.clipboard.writeText(promptText);
            if (selCopyLabel) selCopyLabel.textContent = 'Copied!';
            showCallout('Element Prompt Copied', 'COPIED');
            setTimeout(() => { if (selCopyLabel) selCopyLabel.textContent = 'Copy Prompt'; }, 1600);
          }
        };
      }

      const selSendBtn = shadow.getElementById('cp-sel-send-btn');
      const selSendLabel = shadow.getElementById('cp-sel-send-label');
      if (selSendBtn) {
        selSendBtn.onclick = async (e) => {
          e.stopPropagation();
          let promptText = '';
          let compName = '';
          let filePath = '';
          if (lastCopiedContext) {
            promptText = formatContextForAiPrompt(lastCopiedContext, currentStack);
            compName = lastCopiedContext.component?.name || '';
            filePath = lastCopiedContext.source?.file || '';
          } else if (selectedTarget) {
            promptText = formatDomElementPrompt(selectedTarget, lastComputedStyles || extractComputedStyles(selectedTarget.element || selectedElement), currentStack);
            compName = selectedTarget.name || '';
          }
          if (!promptText) {
            showCallout('Select a component first', 'TIP', 2000);
            return;
          }
          if (selSendLabel) selSendLabel.textContent = 'Sent!';
          setTimeout(() => { if (selSendLabel) selSendLabel.textContent = 'Send'; }, 1600);
          await dispatchToAgent(promptText, { type: 'selection', component: compName, file: filePath });
        };
      }

      if (selNoteBtn) {
        selNoteBtn.onclick = (e) => {
          e.stopPropagation();
          const compName = selectedTarget?.name || (lastCopiedContext ? lastCopiedContext.component.name : '');
          const file = lastResolved?.file || lastCopiedContext?.source?.file || '';
          const existing = comments.find(c => (compName && c.component === compName) || (file && c.file === file));
          openNotePopover(selectedTarget, existing || null);
        };
      }

      if (selSnapBtn) {
        selSnapBtn.onclick = async (e) => {
          e.stopPropagation();
          await handleSnapMode('component');
        };
      }

      if (selIdeBtn) {
        selIdeBtn.onclick = (e) => {
          e.stopPropagation();
          openInEditor();
        };
      }

      if (selPinBtn) {
        selPinBtn.onclick = async (e) => {
          e.stopPropagation();
          const targetToPin = selectedTarget?.isDomElement && currentStack.length > 1 ? currentStack[1] : selectedTarget;
          const resolved = lastResolved || (targetToPin ? await resolveComponent(targetToPin) : null);
          if (resolved) {
            openPinDialog(targetToPin, resolved);
          } else {
            showCallout('Could not resolve file', 'ERROR');
          }
        };
      }

      shadow.getElementById('cp-context-level').addEventListener('change', async () => {
        refreshState();
        if (flyout.classList.contains('open') && lastResolved && lastInfoName) {
          await loadComponentContext(lastInfoName, lastResolved, lastComputedStyles);
        }
      });

      // Dedicated Copy for AI Prompt Action
      const copyAiBtn = shadow.getElementById('cp-copy-ai');
      if (copyAiBtn) {
        copyAiBtn.onclick = async () => {
          if (lastCopiedContext) {
            const promptText = formatContextForAiPrompt(lastCopiedContext, currentStack);
            await navigator.clipboard.writeText(promptText);
            const originalHtml = copyAiBtn.innerHTML;
            copyAiBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
            showCallout('AI Prompt Copied (' + (lastCopiedContext.tokens?.current || '?') + ' tok)', 'COPIED');
            setTimeout(() => { copyAiBtn.innerHTML = originalHtml; }, 1600);
          } else if (selectedTarget) {
            const promptText = formatDomElementPrompt(selectedTarget, lastComputedStyles || extractComputedStyles(selectedTarget.element || selectedElement), currentStack);
            await navigator.clipboard.writeText(promptText);
            const originalHtml = copyAiBtn.innerHTML;
            copyAiBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
            showCallout('Element Prompt Copied', 'COPIED');
            setTimeout(() => { copyAiBtn.innerHTML = originalHtml; }, 1600);
          } else {
            showCallout('Select a component first', 'TIP');
          }
        };
      }

      // --- Dispatch to AI Agent (Queue & Clipboard per D-06) ---
      let connectedAgents = [];
      let copyOnSend = 'auto'; // 'auto' | 'always' | 'never'

      async function dispatchToAgent(promptText, extra = {}) {
        if (!promptText) return;

        const hasAgent = Array.isArray(connectedAgents) && connectedAgents.length > 0;
        const agentName = hasAgent ? connectedAgents[0].client : null;

        // Clipboard rule D-06:
        // 'auto': write to clipboard ONLY if no agent connected or bridge unreachable
        // 'always': always write
        // 'never': never write
        const shouldCopy = copyOnSend === 'always' || (copyOnSend === 'auto' && !hasAgent);

        if (shouldCopy) {
          try {
            await navigator.clipboard.writeText(promptText);
          } catch (_) {}
        }

        try {
          const res = await fetch(BRIDGE + '/api/agent/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: extra.type || 'component-context',
              instruction: extra.instruction || extra.goal || (typeof promptText === 'string' ? promptText.split(String.fromCharCode(10))[0] : 'UI Instruction'),
              target: {
                component: extra.component,
                file: extra.file,
                lineStart: extra.line,
              },
              payload: {
                prompt: promptText,
                ...extra,
              },
            }),
          });
          const data = await res.json();
          if (data && data.task) {
            if (hasAgent) {
              showCallout('Sent to ' + agentName, 'SUCCESS', 2500);
            } else {
              showCallout('Queued · no agent connected', 'SENT', 2500);
            }
          } else {
            showCallout('Copied to clipboard', 'COPIED', 2000);
          }
        } catch (err) {
          if (copyOnSend !== 'never') {
            try {
              await navigator.clipboard.writeText(promptText);
            } catch (_) {}
          }
          showCallout('Copied to clipboard', 'COPIED', 2000);
        }
      }

      // Flyout Send to Agent Button
      const sendAgentBtn = shadow.getElementById('cp-send-agent-btn');
      if (sendAgentBtn) {
        sendAgentBtn.onclick = async () => {
          let promptText = '';
          let compName = '';
          let filePath = '';
          if (lastCopiedContext) {
            promptText = formatContextForAiPrompt(lastCopiedContext, currentStack);
            compName = lastCopiedContext.component?.name || '';
            filePath = lastCopiedContext.source?.file || '';
          } else if (selectedTarget) {
            promptText = formatDomElementPrompt(selectedTarget, lastComputedStyles || extractComputedStyles(selectedTarget.element || selectedElement), currentStack);
            compName = selectedTarget.name || '';
          }
          if (!promptText) {
            showCallout('Select a component first', 'TIP', 2000);
            return;
          }
          const origHtml = sendAgentBtn.innerHTML;
          sendAgentBtn.innerHTML = ICONS.check + ' Sent!';
          setTimeout(() => { sendAgentBtn.innerHTML = origHtml; }, 1600);
          await dispatchToAgent(promptText, { type: 'component-context', component: compName, file: filePath });
        };
      }

      // Note Popover Send to Agent Button
      const noteSendAgentBtn = shadow.getElementById('cp-note-send-agent');
      if (noteSendAgentBtn) {
        noteSendAgentBtn.onclick = async () => {
          const input = shadow.getElementById('cp-note-input');
          const text = input ? input.value.trim() : '';
          if (!text) {
            const errEl = shadow.getElementById('cp-note-error');
            if (errEl) errEl.textContent = 'Please enter a note';
            return;
          }
          saveNote();
          const compName = selectedTarget?.name || (lastCopiedContext ? lastCopiedContext.component.name : '');
          const file = lastResolved?.file || lastCopiedContext?.source?.file || '';
          const line = lastResolved?.line || lastCopiedContext?.source?.startLine || '';
          const targetStr = compName ? '<' + compName + ' />' : 'Element';
          const locStr = file ? ' (' + file + (line ? ':' + line : '') + ')' : '';
          const notePrompt = '### Note for ' + targetStr + locStr + String.fromCharCode(10) + String.fromCharCode(10) + text;
          await dispatchToAgent(notePrompt, { type: 'note', component: compName, file, line, text });
        };
      }

      // Pin Stack Send to Agent Button
      const pinSendAgentBtn = shadow.getElementById('cp-pin-send-agent');
      if (pinSendAgentBtn) {
        pinSendAgentBtn.onclick = async () => {
          if (!currentPins || currentPins.length === 0) {
            showCallout('Pin components first', 'TIP');
            return;
          }
          const taskInputEl = shadow.getElementById('cp-task-input');
          const overallGoal = taskInputEl ? taskInputEl.value.trim() : '';
          const level = shadow.getElementById('cp-context-level')?.value || 'standard';
          const origHtml = pinSendAgentBtn.innerHTML;
          pinSendAgentBtn.innerHTML = '<svg class="cp-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Sending...';
          try {
            const res = await fetch(BRIDGE + '/api/task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instruction: overallGoal, level })
            });
            const data = await res.json();
            const prompt = data.context || JSON.stringify(data, null, 2);
            await dispatchToAgent(prompt, { type: 'pinned-stack', count: currentPins.length, goal: overallGoal });
            pinSendAgentBtn.innerHTML = ICONS.check + ' Sent to Agent!';
            showCallout('Pinned tasks sent to agent', 'SENT');
            setTimeout(() => { pinSendAgentBtn.innerHTML = origHtml; }, 1600);
          } catch (e) {
            pinSendAgentBtn.innerHTML = origHtml;
            showCallout('Failed to send pinned tasks to agent', 'ERROR');
          }
        };
      }

      async function openInEditor() {
        // Priority 1: Check selectedTarget.source or leaf Fiber source
        let targetFile = selectedTarget?.source?.fileName || null;
        let targetLine = selectedTarget?.source?.lineNumber || null;
        let targetComp = selectedTarget && !selectedTarget.isDomElement ? selectedTarget.name : null;

        // If selectedTarget was a DOM element, check enclosing component in currentStack
        if (!targetFile && currentStack && currentStack.length > 1) {
          const comp = currentStack.find(c => !c.isDomElement && c.source?.fileName);
          if (comp) {
            targetFile = comp.source.fileName;
            targetLine = comp.source.lineNumber;
            if (!targetComp) targetComp = comp.name;
          }
        }

        // Priority 2: Use lastCopiedContext or lastResolved
        if (!targetFile && lastCopiedContext?.source) {
          targetFile = lastCopiedContext.source.file;
          targetLine = lastCopiedContext.source.startLine;
        } else if (!targetFile && lastResolved) {
          targetFile = lastResolved.file;
          targetLine = lastResolved.line;
        }

        const el = selectedElement || selectedTarget?.element || currentElement;
        const textSnippet = el && el.textContent ? el.textContent.trim().slice(0, 50) : '';

        const btn = shadow.getElementById('cp-editor-btn');
        const originalContent = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = 'Opening...';
        showCallout('Opening in IDE...', currentEditorPref || editor);

        try {
          const res = await fetch(BRIDGE + '/api/open-editor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: targetFile,
              line: targetLine,
              text: textSnippet,
              component: targetComp,
              editor: currentEditorPref || editor
            })
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            showCallout('Failed to open editor: ' + (data.error || 'Unknown'), 'ERROR');
          } else {
            showCallout('Opened in IDE (L' + (data.line || targetLine || 1) + ')', 'IDE');
          }
        } catch(e) {
          console.error('[agent-hover] Failed to open editor:', e);
          showCallout('Bridge server connection failed', 'ERROR');
        } finally {
          if (btn) btn.innerHTML = originalContent || (ICONS.code + ' Open in IDE');
        }
      }

      shadow.getElementById('cp-editor-btn').onclick = openInEditor;

      // --- Screenshot Mode System ---
      let snapBusy = false;
      let snapPreviewBlobUrl = null;
      let lastCapturedDataUrl = null;
      let lastCapturedFilename = null;

      function closeSnapDropdown() {
        const dd = shadow.getElementById('cp-snap-dropdown');
        if (dd) dd.classList.remove('open');
        const btn = shadow.getElementById('cp-flyout-snap-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        hideRegionHint();
        const msg = shadow.getElementById('cp-snap-message');
        if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
      }

      function hideRegionHint() {
        const hint = shadow.getElementById('cp-region-hint');
        if (hint) { hint.className = ''; hint.style.display = 'none'; hint.style.cssText = ''; }
      }

      function showRegionHint(mode) {
        const hint = shadow.getElementById('cp-region-hint');
        const label = shadow.getElementById('cp-region-label');
        if (!hint) return;
        hideRegionHint();

        if (mode === 'component') {
          const el = selectedTarget?.element || selectedElement;
          if (el && el.isConnected) {
            const r = el.getBoundingClientRect();
            hint.className = 'component';
            hint.style.display = 'block';
            hint.style.position = 'fixed';
            hint.style.left = r.left + 'px';
            hint.style.top = r.top + 'px';
            hint.style.width = r.width + 'px';
            hint.style.height = r.height + 'px';
            if (label) label.textContent = 'Element bounds';
          }
        } else if (mode === 'viewport') {
          hint.className = 'viewport';
          hint.style.display = 'block';
          hint.style.position = 'fixed';
          if (label) label.textContent = 'Visible viewport';
        } else if (mode === 'fullpage') {
          const w = document.documentElement.scrollWidth;
          const h = document.documentElement.scrollHeight;
          const sizeLabel = shadow.getElementById('cp-snap-fullpage-size');
          if (sizeLabel) sizeLabel.textContent = 'Full scroll height, ' + w + ' x ' + h + ' px';
        }
      }

      function openSnapDropdown() {
        const dd = shadow.getElementById('cp-snap-dropdown');
        const btn = shadow.getElementById('cp-flyout-snap-btn');
        if (!dd || !btn) return;

        // Close note popover
        closeNotePopover();

        // Position dropdown under the button using fixed viewport coordinates
        const btnRect = btn.getBoundingClientRect();
        let top = btnRect.bottom + 4;
        let left = btnRect.right - 240;

        // Flip above if no room below
        if (btnRect.bottom + 200 > window.innerHeight) {
          top = btnRect.top - 200;
        }
        // Clamp
        left = Math.max(8, left);
        dd.style.top = top + 'px';
        dd.style.left = left + 'px';

        // Update component name caption
        const compCaption = shadow.getElementById('cp-snap-component-name');
        if (compCaption) {
          const name = selectedTarget?.name || (selectedElement ? selectedElement.tagName.toLowerCase() : null);
          compCaption.textContent = name ? '<' + name + ' />' : 'None selected';
        }

        dd.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');

        // Focus the right row
        const options = dd.querySelectorAll('.cp-snap-option');
        const hasSelection = selectedTarget?.element || selectedElement;
        const focusIdx = hasSelection ? 0 : 1;
        if (options[focusIdx]) options[focusIdx].focus();
      }

      const flyoutSnapBtn = shadow.getElementById('cp-flyout-snap-btn');
      if (flyoutSnapBtn) {
        flyoutSnapBtn.onclick = () => {
          const dd = shadow.getElementById('cp-snap-dropdown');
          if (dd?.classList.contains('open')) {
            closeSnapDropdown();
          } else {
            openSnapDropdown();
          }
        };
      }

      // Dropdown keyboard navigation
      shadow.getElementById('cp-snap-dropdown')?.addEventListener('keydown', (e) => {
        const options = Array.from(shadow.querySelectorAll('.cp-snap-option'));
        const idx = options.indexOf(e.target);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const next = e.key === 'ArrowDown' ? (idx + 1) % options.length : (idx - 1 + options.length) % options.length;
          options[next]?.focus();
        }
        if (e.key === 'Home') { e.preventDefault(); options[0]?.focus(); }
        if (e.key === 'End') { e.preventDefault(); options[options.length - 1]?.focus(); }
        if (e.key === 'Escape' || e.key === 'Tab') {
          e.preventDefault();
          closeSnapDropdown();
          flyoutSnapBtn?.focus();
        }
      });

      // Dropdown option hover/focus region hints
      shadow.querySelectorAll('.cp-snap-option').forEach((opt) => {
        const mode = opt.getAttribute('data-mode');
        opt.addEventListener('mouseenter', () => showRegionHint(mode));
        opt.addEventListener('focus', () => showRegionHint(mode));
        opt.addEventListener('mouseleave', () => hideRegionHint());
        opt.addEventListener('blur', () => hideRegionHint());

        opt.addEventListener('click', () => handleSnapMode(mode));
      });

      // Click outside closes dropdown
      shadow.addEventListener('click', (e) => {
        const dd = shadow.getElementById('cp-snap-dropdown');
        if (dd?.classList.contains('open') && !dd.contains(e.target) && e.target !== flyoutSnapBtn && !flyoutSnapBtn?.contains(e.target)) {
          closeSnapDropdown();
        }
      });

      async function handleSnapMode(mode) {
        if (snapBusy) return;

        if (mode === 'component') {
          const el = selectedTarget?.element || selectedElement;
          if (!el || !el.isConnected) {
            showCallout('Select a component on the page first', 'WARNING', 2000);
            const msg = shadow.getElementById('cp-snap-message');
            if (msg) {
              msg.textContent = 'Click an element on the page first, or pick Viewport.';
              msg.style.display = 'block';
            }
            return;
          }
        }

        closeSnapDropdown();
        hideRegionHint();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        snapBusy = true;
        const modeLabel = mode === 'component' ? 'Component' : mode === 'viewport' ? 'Viewport' : 'Full page';
        showCallout(mode === 'fullpage' ? 'Capturing full page...' : 'Capturing...', 'SNAP', 1500);

        try {
          let el, captureOpts;
          if (mode === 'component') {
            el = selectedTarget?.element || selectedElement;
          } else if (mode === 'viewport') {
            el = document.documentElement;
            captureOpts = { width: window.innerWidth, height: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY };
          } else {
            el = document.documentElement;
            captureOpts = { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
          }

          const dataUrl = await captureElement(el, captureOpts);
          if (!dataUrl) {
            showCallout(mode === 'fullpage' ? 'Page is too long to capture in one image' : 'Capture failed. Try Viewport instead.', 'ERROR', 3000);
            snapBusy = false;
            return;
          }

          // Flash after capture completes
          triggerShutterFlash();

          // Get image dimensions for meta line
          const img = new Image();
          img.onload = () => {
            const filename = mode + '-' + Date.now() + '.png';
            lastCapturedDataUrl = dataUrl;
            lastCapturedFilename = filename;
            const resStr = img.naturalWidth + ' × ' + img.naturalHeight;
            showSnapPreview(dataUrl, modeLabel + ' • ' + resStr, filename, mode);
          };
          img.onerror = () => {
            const filename = mode + '-' + Date.now() + '.png';
            lastCapturedDataUrl = dataUrl;
            lastCapturedFilename = filename;
            showSnapPreview(dataUrl, modeLabel, filename, mode);
          };
          img.src = dataUrl;

          // Save to bridge for agent workflow
          let savedForAgent = false;
          try {
            const res = await fetch(BRIDGE + '/api/screenshot/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dataUrl, filename: mode })
            });
            const result = await res.json();
            savedForAgent = result?.success;
          } catch (_) {}

          // Update status line
          setTimeout(() => {
            const statusEl = shadow.getElementById('cp-snap-preview-status');
            if (statusEl) {
              if (savedForAgent) {
                statusEl.className = 'cp-snap-preview-status success';
                statusEl.innerHTML = ICONS.check + ' Saved for agent';
              } else {
                statusEl.className = 'cp-snap-preview-status error';
                statusEl.innerHTML = 'Local preview only';
              }
            }
          }, 100);

        } catch (err) {
          showCallout('Capture failed. Try Viewport instead.', 'ERROR', 3000);
        }
        snapBusy = false;
      }

      let lastCapturedMode = 'viewport';
      let lastCapturedMeta = '';
      let snapAutoDismissTimer = null;

      function showSnapPreview(dataUrl, meta, filename, mode) {
        const card = shadow.getElementById('cp-snap-preview');
        const img = shadow.getElementById('cp-snap-preview-img');
        const metaEl = shadow.getElementById('cp-snap-preview-meta');
        const statusEl = shadow.getElementById('cp-snap-preview-status');
        if (!card) return;

        lastCapturedDataUrl = dataUrl;
        lastCapturedFilename = filename || 'screenshot.png';
        lastCapturedMode = mode || 'viewport';
        lastCapturedMeta = meta || '';

        // Revoke previous blob URL
        if (snapPreviewBlobUrl) { URL.revokeObjectURL(snapPreviewBlobUrl); snapPreviewBlobUrl = null; }

        // Create blob URL for thumbnail
        const blob = dataUrlToBlob(dataUrl);
        if (blob) {
          snapPreviewBlobUrl = URL.createObjectURL(blob);
          if (img) img.src = snapPreviewBlobUrl;
        } else if (img) {
          img.src = dataUrl;
        }

        if (metaEl) metaEl.textContent = meta || '';
        if (statusEl) {
          statusEl.textContent = '';
          statusEl.className = 'cp-snap-preview-status';
        }

        // Reset button labels
        const dlBtn = shadow.getElementById('cp-snap-download');
        const cpBtn = shadow.getElementById('cp-snap-copy');
        if (dlBtn) dlBtn.innerHTML = ICONS.download + ' Download';
        if (cpBtn) cpBtn.innerHTML = ICONS.copy + ' Copy Image';

        // Trigger smooth opening & restart progress bar animation
        card.classList.remove('open');
        card.classList.remove('animating');
        void card.offsetWidth; // Force reflow to restart CSS animation
        card.classList.add('open');
        card.classList.add('animating');

        // Auto-dismiss after 6s (pauses on hover)
        if (snapAutoDismissTimer) clearTimeout(snapAutoDismissTimer);
        snapAutoDismissTimer = setTimeout(() => {
          closeSnapPreview();
        }, 6000);

        // Hover pause / leave resume
        card.onmouseenter = () => {
          if (snapAutoDismissTimer) {
            clearTimeout(snapAutoDismissTimer);
            snapAutoDismissTimer = null;
          }
        };
        card.onmouseleave = () => {
          if (card.classList.contains('open') && !snapAutoDismissTimer) {
            snapAutoDismissTimer = setTimeout(() => {
              closeSnapPreview();
            }, 3000);
          }
        };
      }

      function closeSnapPreview() {
        const card = shadow.getElementById('cp-snap-preview');
        if (card) {
          card.classList.remove('open');
          card.classList.remove('animating');
        }
        if (snapAutoDismissTimer) {
          clearTimeout(snapAutoDismissTimer);
          snapAutoDismissTimer = null;
        }
        if (snapPreviewBlobUrl) { URL.revokeObjectURL(snapPreviewBlobUrl); snapPreviewBlobUrl = null; }
      }

      // Preview card close button
      shadow.getElementById('cp-snap-preview-close')?.addEventListener('click', closeSnapPreview);

      // Clickable Zoom Thumbnail opens Full Lightbox Modal
      const snapThumbBtn = shadow.getElementById('cp-snap-thumb-btn');
      if (snapThumbBtn) {
        snapThumbBtn.onclick = () => {
          if (lastCapturedDataUrl) {
            openLightbox(lastCapturedDataUrl, lastCapturedMode, lastCapturedFilename, lastCapturedMeta);
          }
        };
      }

      // Full Lightbox Modal Logic
      function openLightbox(dataUrl, mode, filename, meta) {
        const lb = shadow.getElementById('cp-snap-lightbox');
        const lbImg = shadow.getElementById('cp-lightbox-img');
        const lbBadge = shadow.getElementById('cp-lightbox-mode-badge');
        const lbFilename = shadow.getElementById('cp-lightbox-filename');
        const lbRes = shadow.getElementById('cp-lightbox-res');
        if (!lb || !lbImg) return;

        lbImg.src = dataUrl;
        if (lbBadge) lbBadge.textContent = (mode || 'COMPONENT').toUpperCase();
        if (lbFilename) lbFilename.textContent = filename || 'screenshot.png';
        if (lbRes) lbRes.textContent = meta || '';

        lb.classList.add('open');
      }

      function closeLightbox() {
        const lb = shadow.getElementById('cp-snap-lightbox');
        if (lb) lb.classList.remove('open');
      }

      shadow.getElementById('cp-lightbox-close')?.addEventListener('click', closeLightbox);
      shadow.getElementById('cp-snap-lightbox')?.addEventListener('click', (e) => {
        if (e.target === shadow.getElementById('cp-snap-lightbox')) {
          closeLightbox();
        }
      });

      // Lightbox download button
      shadow.getElementById('cp-lightbox-download')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!lastCapturedDataUrl) return;
        const blob = dataUrlToBlob(lastCapturedDataUrl);
        if (!blob) return;
        try {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = lastCapturedFilename || 'screenshot.png';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            try { document.body.removeChild(a); } catch(_) {}
            URL.revokeObjectURL(url);
          }, 3000);
          const btn = shadow.getElementById('cp-lightbox-download');
          if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = ICONS.check + ' Downloaded';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
          }
          showCallout('Screenshot downloaded', 'SAVED', 2000);
        } catch (_) {}
      });

      // Lightbox copy image button
      shadow.getElementById('cp-lightbox-copy')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!lastCapturedDataUrl) return;
        const blob = dataUrlToBlob(lastCapturedDataUrl);
        const btn = shadow.getElementById('cp-lightbox-copy');
        if (blob && navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            if (btn) {
              const orig = btn.innerHTML;
              btn.innerHTML = ICONS.check + ' Copied';
              setTimeout(() => { btn.innerHTML = orig; }, 1500);
            }
            showCallout('Screenshot copied to clipboard', 'COPIED', 2000);
          } catch (_) {
            showCallout('Browser blocked clipboard access. Use Download.', 'WARNING', 3000);
          }
        }
      });

      // Escape key closes Lightbox or Toast
      shadow.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const lb = shadow.getElementById('cp-snap-lightbox');
          if (lb?.classList.contains('open')) {
            closeLightbox();
            e.stopPropagation();
            return;
          }
          const preview = shadow.getElementById('cp-snap-preview');
          if (preview?.classList.contains('open')) {
            closeSnapPreview();
          }
        }
      });

      // Download button
      shadow.getElementById('cp-snap-download')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!lastCapturedDataUrl) return;
        const blob = dataUrlToBlob(lastCapturedDataUrl);
        if (!blob) return;
        try {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = lastCapturedFilename || 'screenshot.png';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            try { document.body.removeChild(a); } catch(_) {}
            URL.revokeObjectURL(url);
          }, 3000);
          const btn = shadow.getElementById('cp-snap-download');
          if (btn) {
            btn.innerHTML = ICONS.check + ' Downloaded';
            setTimeout(() => { btn.innerHTML = ICONS.download + ' Download'; }, 1500);
          }
          showCallout('Screenshot downloaded', 'SAVED', 2000);
        } catch (_) {}
      });

      // Open Folder button
      shadow.getElementById('cp-snap-open-folder')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = shadow.getElementById('cp-snap-open-folder');
        try {
          const res = await fetch(BRIDGE + '/api/screenshot/open-folder', { method: 'POST' });
          if (res.ok) {
            if (btn) {
              btn.innerHTML = ICONS.check + ' Opened';
              setTimeout(() => { btn.innerHTML = ICONS.camera + ' Folder'; }, 1500);
            }
            showCallout('Screenshots folder opened', 'OPENED', 2000);
          } else {
            showCallout('Failed to open folder', 'ERROR', 2000);
          }
        } catch (_) {
          showCallout('Failed to connect to bridge', 'ERROR', 2000);
        }
      });

      // Copy button
      shadow.getElementById('cp-snap-copy')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!lastCapturedDataUrl) return;
        const blob = dataUrlToBlob(lastCapturedDataUrl);
        const btn = shadow.getElementById('cp-snap-copy');
        if (blob && navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            if (btn) {
              btn.innerHTML = ICONS.check + ' Copied';
              setTimeout(() => { btn.innerHTML = ICONS.copy + ' Copy Image'; }, 1500);
            }
            showCallout('Screenshot copied to clipboard', 'COPIED', 2000);
          } catch (_) {
            if (btn) {
              btn.innerHTML = 'Copy failed';
              setTimeout(() => { btn.innerHTML = ICONS.copy + ' Copy Image'; }, 2000);
            }
            showCallout('Browser blocked clipboard access. Use Download.', 'WARNING', 3000);
          }
        }
      });

      shadow.getElementById('cp-pin-btn').onclick = async () => {
        const targetToPin = selectedTarget?.isDomElement && currentStack.length > 1 ? currentStack[1] : selectedTarget;
        const resolved = lastResolved || (targetToPin ? await resolveComponent(targetToPin) : null);
        if (resolved) {
          openPinDialog(targetToPin, resolved);
        } else if (lastCopiedContext) {
          openPinDialog({ name: lastCopiedContext.component.name }, { file: lastCopiedContext.source.file, line: lastCopiedContext.source.startLine });
        } else {
          showCallout('Select a component to pin first', 'TIP');
        }
      };

      const taskInput = shadow.getElementById('cp-task-input');
      if (taskInput) {
        taskInput.addEventListener('focus', () => {
          taskInput.style.borderColor = 'var(--border-accent)';
        });
        taskInput.addEventListener('blur', () => {
          taskInput.style.borderColor = '';
        });
      }

      shadow.getElementById('cp-gen-task').onclick = async () => {
        if (!currentPins || currentPins.length === 0) {
          showCallout('Pin at least one component first', 'TIP');
          return;
        }
        const instruction = taskInput ? taskInput.value.trim() : '';
        const level = shadow.getElementById('cp-context-level')?.value || 'standard';
        const btn = shadow.getElementById('cp-gen-task');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<svg class="cp-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Generating...';
        btn.disabled = true;
        try {
          const res = await fetch(BRIDGE + '/api/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction, level })
          });
          const data = await res.json();
          await navigator.clipboard.writeText(data.context || JSON.stringify(data, null, 2));
          showCallout('All tasks copied in order (' + (data.tokenCost || '?') + ' tokens)', 'COPIED');
          btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
          setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 1600);
        } catch(e) {
          showCallout('Failed to generate task context', 'ERROR');
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      };

      // --- React 19 Fiber Detection ---
      function getFiberNode(el) {
        let curr = el;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          for (const key in curr) {
            if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
              return curr[key];
            }
          }
          curr = curr.parentElement;
        }
        return null;
      }

      // --- Element & Component Detection (Universal Selection) ---
      function describeElement(el) {
        if (!el) return '';
        let desc = el.tagName.toLowerCase();
        if (el.id) {
          desc += '#' + el.id;
        } else if (el.className && typeof el.className === 'string') {
          const cls = el.className.trim().split(/\\s+/).slice(0, 2);
          if (cls.length && cls[0]) desc += '.' + cls.join('.');
        }
        return desc;
      }

      function buildHierarchyStack(el) {
        if (!el) return [];
        const stack = [];

        // 1. The exact DOM element under the cursor is ALWAYS level 0 (direct selection)
        const desc = describeElement(el);
        const textSnippet = el.textContent ? el.textContent.trim().slice(0, 35) : '';
        const fiber = getFiberNode(el);
        let leafSource = null;
        if (fiber && fiber._debugSource) {
          leafSource = {
            fileName: fiber._debugSource.fileName,
            lineNumber: fiber._debugSource.lineNumber,
            columnNumber: fiber._debugSource.columnNumber
          };
        }

        stack.push({
          name: desc,
          isDomElement: true,
          element: el,
          tagName: el.tagName.toLowerCase(),
          textPreview: textSnippet,
          source: leafSource,
          fiber: fiber
        });

        // 2. Walk fiber ancestry to find all React components containing this element
        if (fiber) {
          const seen = new Set();
          let curr = fiber;
          while (curr) {
            let name = null;
            let source = null;
            if (typeof curr.type === 'function') {
              name = curr.type.displayName || curr.type.name;
              source = curr._debugSource || null;
            } else if (curr.type && typeof curr.type === 'object') {
              const inner = curr.type.render || curr.type.type;
              if (typeof inner === 'function') {
                name = inner.displayName || inner.name;
                source = curr._debugSource || null;
              }
            }
            if (name && name !== 'Fragment' && !name.startsWith('_') && name !== 'Suspense' && name !== 'StrictMode') {
              const key = name + ':' + (source ? source.fileName + ':' + source.lineNumber : 'null');
              if (!seen.has(key)) {
                seen.add(key);
                stack.push({ name, source, fiber: curr, isDomElement: false, element: el });
              }
            }
            curr = curr.return;
          }
        }
        return stack; // [leaf DOM element, innermost React component, ..., outermost App]
      }

      function getComponentStack(el) {
        return buildHierarchyStack(el).filter(x => !x.isDomElement);
      }

      function getBestComponent(stack) {
        if (!stack || stack.length === 0) return null;
        return stack[0];
      }

      function getComponentInfo(el) {
        const stack = getComponentStack(el);
        return getBestComponent(stack);
      }

      // Collect all DOM nodes owned by a fiber
      function collectFiberDomNodes(fiber) {
        const nodes = [];
        function walkFiber(f) {
          if (!f) return;
          if (f.stateNode && f.stateNode instanceof HTMLElement && f.stateNode !== document.body) {
            nodes.push(f.stateNode);
          } else {
            let child = f.child;
            while (child) {
              walkFiber(child);
              child = child.sibling;
            }
          }
        }
        let child = fiber.child;
        while (child) {
          walkFiber(child);
          child = child.sibling;
        }
        if (fiber.stateNode && fiber.stateNode instanceof HTMLElement && fiber.stateNode !== document.body) {
          nodes.push(fiber.stateNode);
        }
        return nodes;
      }

      // Compute the union bounding rect of all DOM nodes in a fiber subtree
      function getComponentBoundingRect(fiber) {
        const nodes = collectFiberDomNodes(fiber);
        if (nodes.length === 0) return null;
        let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;
        for (const node of nodes) {
          const r = node.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.top < top) top = r.top;
          if (r.left < left) left = r.left;
          if (r.bottom > bottom) bottom = r.bottom;
          if (r.right > right) right = r.right;
        }
        if (top === Infinity) return null;
        return { top, left, width: right - left, height: bottom - top };
      }

      // --- Hierarchy Navigation State ---
      let currentStack = [];
      let currentStackIndex = -1;

      // Position margin/padding bands and dashed axis guides (Studio inspection style)
      function positionBands(el) {
        if (!el) return;
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const px = (v) => parseFloat(v) || 0;
        const mt = px(cs.marginTop), mr = px(cs.marginRight), mb = px(cs.marginBottom), ml = px(cs.marginLeft);
        const pt = px(cs.paddingTop), pr = px(cs.paddingRight), pb = px(cs.paddingBottom), pl = px(cs.paddingLeft);
        const bt = px(cs.borderTopWidth), brw = px(cs.borderRightWidth), bb = px(cs.borderBottomWidth), blw = px(cs.borderLeftWidth);

        // 1. Draw full-canvas dashed Axis Projection Lines (Figma / Studio inspection style)
        if (axisGuides) {
          const lines = [
            '<div class="cp-axis-line cp-axis-h" style="top:' + Math.round(rect.top) + 'px;"></div>',
            '<div class="cp-axis-line cp-axis-h" style="top:' + Math.round(rect.bottom) + 'px;"></div>',
            '<div class="cp-axis-line cp-axis-v" style="left:' + Math.round(rect.left) + 'px;"></div>',
            '<div class="cp-axis-line cp-axis-v" style="left:' + Math.round(rect.right) + 'px;"></div>'
          ];

          // Flex / Grid direct child dashed frames
          if (cs.display.includes('flex') || cs.display.includes('grid')) {
            const children = Array.from(el.children);
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              if (!(child instanceof HTMLElement) || child.id === 'agent-hover-root') continue;
              const cr = child.getBoundingClientRect();
              if (cr.width > 0 && cr.height > 0) {
                lines.push('<div class="cp-layout-child-frame" style="top:' + Math.round(cr.top) + 'px; left:' + Math.round(cr.left) + 'px; width:' + Math.round(cr.width) + 'px; height:' + Math.round(cr.height) + 'px;"></div>');
              }
            }
          }

          axisGuides.innerHTML = lines.join('');
        }

        // 2. Margin Outer Dashed Frame
        if (marginBand) {
          if (mt || mr || mb || ml) {
            marginBand.style.display = 'block';
            marginBand.style.top = (rect.top - mt) + 'px';
            marginBand.style.left = (rect.left - ml) + 'px';
            marginBand.style.width = (rect.width + ml + mr) + 'px';
            marginBand.style.height = (rect.height + mt + mb) + 'px';
            marginBand.style.borderTopWidth = mt + 'px';
            marginBand.style.borderRightWidth = mr + 'px';
            marginBand.style.borderBottomWidth = mb + 'px';
            marginBand.style.borderLeftWidth = ml + 'px';
          } else {
            marginBand.style.display = 'none';
          }
        }

        // 3. Padding Inner Dashed Frame
        if (paddingBand) {
          if (pt || pr || pb || pl) {
            paddingBand.style.display = 'block';
            paddingBand.style.top = (rect.top + bt) + 'px';
            paddingBand.style.left = (rect.left + blw) + 'px';
            paddingBand.style.width = Math.max(0, rect.width - blw - brw) + 'px';
            paddingBand.style.height = Math.max(0, rect.height - bt - bb) + 'px';
            paddingBand.style.borderTopWidth = pt + 'px';
            paddingBand.style.borderRightWidth = pr + 'px';
            paddingBand.style.borderBottomWidth = pb + 'px';
            paddingBand.style.borderLeftWidth = pl + 'px';
          } else {
            paddingBand.style.display = 'none';
          }
        }
      }

      function hideBands() {
        if (marginBand) marginBand.style.display = 'none';
        if (paddingBand) paddingBand.style.display = 'none';
        if (axisGuides) axisGuides.innerHTML = '';
      }

      // --- Measurement Distance Guides ---
      let selectedRect = null; // Stores the rect of the currently selected (clicked) element

      function clearDistanceGuides() {
        if (distanceLayer) distanceLayer.innerHTML = '';
      }

      function renderDistanceGuides(selRect, hovRect) {
        clearDistanceGuides();
        if (!distanceLayer || !selRect || !hovRect) return;

        // Check if rects are the same element (skip)
        if (Math.abs(selRect.top - hovRect.top) < 2 && Math.abs(selRect.left - hovRect.left) < 2 &&
            Math.abs(selRect.width - hovRect.width) < 2 && Math.abs(selRect.height - hovRect.height) < 2) return;

        const selBottom = selRect.top + selRect.height;
        const selRight = selRect.left + selRect.width;
        const hovBottom = hovRect.top + hovRect.height;
        const hovRight = hovRect.left + hovRect.width;

        const overlapX = selRect.left < hovRight && selRight > hovRect.left;
        const overlapY = selRect.top < hovBottom && selBottom > hovRect.top;

        function addLine(cls, top, left, w, h) {
          const el = document.createElement('div');
          el.className = 'cp-dist-line ' + cls;
          el.style.top = top + 'px';
          el.style.left = left + 'px';
          if (w) el.style.width = w + 'px';
          if (h) el.style.height = h + 'px';
          distanceLayer.appendChild(el);
        }

        function addPill(text, top, left) {
          const el = document.createElement('div');
          el.className = 'cp-dist-pill';
          el.textContent = text;
          el.style.top = top + 'px';
          el.style.left = left + 'px';
          distanceLayer.appendChild(el);
        }

        // Vertical gap (elements don't overlap vertically)
        if (!overlapY) {
          const isAbove = selRect.top > hovBottom;
          const gapTop = isAbove ? hovBottom : selBottom;
          const gapBottom = isAbove ? selRect.top : hovRect.top;
          const gap = Math.round(gapBottom - gapTop);
          if (gap > 0) {
            const midX = Math.max(selRect.left + selRect.width / 2, hovRect.left + hovRect.width / 2);
            addLine('vertical', gapTop, midX, null, gap);
            addPill(gap + 'px', gapTop + gap / 2, midX);
          }
        }

        // Horizontal gap (elements don't overlap horizontally)
        if (!overlapX) {
          const isLeft = selRect.left > hovRight;
          const gapLeft = isLeft ? hovRight : selRight;
          const gapRight = isLeft ? selRect.left : hovRect.left;
          const gap = Math.round(gapRight - gapLeft);
          if (gap > 0) {
            const midY = Math.max(selRect.top + selRect.height / 2, hovRect.top + hovRect.height / 2);
            addLine('horizontal', midY, gapLeft, gap, null);
            addPill(gap + 'px', midY, gapLeft + gap / 2);
          }
        }

        // Both overlap (nested/containment) — show edge inset distances
        if (overlapX && overlapY) {
          const topGap = Math.round(Math.abs(hovRect.top - selRect.top));
          const leftGap = Math.round(Math.abs(hovRect.left - selRect.left));
          const bottomGap = Math.round(Math.abs(selBottom - hovBottom));
          const rightGap = Math.round(Math.abs(selRight - hovRight));

          const innerLeft = Math.max(selRect.left, hovRect.left);
          const innerRight = Math.min(selRight, hovRight);
          const innerTop = Math.max(selRect.top, hovRect.top);
          const innerBottom = Math.min(selBottom, hovBottom);
          const midX = (innerLeft + innerRight) / 2;
          const midY = (innerTop + innerBottom) / 2;

          if (topGap > 4) {
            const t = Math.min(selRect.top, hovRect.top);
            addLine('vertical', t, midX, null, topGap);
            addPill(topGap + 'px', t + topGap / 2, midX);
          }
          if (leftGap > 4) {
            const l = Math.min(selRect.left, hovRect.left);
            addLine('horizontal', midY, l, leftGap, null);
            addPill(leftGap + 'px', midY, l + leftGap / 2);
          }
          if (bottomGap > 4 && bottomGap !== topGap) {
            const bTop = Math.min(selBottom, hovBottom);
            addLine('vertical', bTop, midX, null, bottomGap);
            addPill(bottomGap + 'px', bTop + bottomGap / 2, midX);
          }
          if (rightGap > 4 && rightGap !== leftGap) {
            const rLeft = Math.min(selRight, hovRight);
            addLine('horizontal', midY, rLeft, rightGap, null);
            addPill(rightGap + 'px', midY, rLeft + rightGap / 2);
          }
        }
      }

      // --- Inline Text Editor (Writes directly to Source with DOM Fallback) ---
      let textEditTarget = null;
      let textEditOriginalHTML = '';
      let textEditOriginalText = '';
      let textEditTargetFile = null;
      let textEditTargetLine = null;
      let textEditTargetComponent = null;
      let textEdits = new Map(); // element -> { originalHTML, currentHTML }
      let textEditorVisible = false;

      // Managed stylesheet for edited element indicators
      let editedStyleEl = null;
      function getEditedStylesheet() {
        if (!editedStyleEl) {
          editedStyleEl = document.createElement('style');
          editedStyleEl.id = 'agent-hover-edits';
          document.head.appendChild(editedStyleEl);
        }
        return editedStyleEl;
      }

      function updateEditedIndicators() {
        const sheet = getEditedStylesheet();
        let css = '';
        let idx = 0;
        textEdits.forEach(function(val, el) {
          const attrVal = 'ah-edited-' + idx;
          el.setAttribute('data-ah-edited', attrVal);
          css += '[data-ah-edited="' + attrVal + '"] { outline: 1px dashed rgba(0, 240, 255, 0.35) !important; outline-offset: 2px !important; }\\n';
          idx++;
        });
        sheet.textContent = css;
      }

      function isLeafTextElement(el) {
        if (!el || !el.textContent || !el.textContent.trim()) return false;
        // Check that it has mostly text content (no complex children)
        const children = el.children;
        if (children.length === 0) return true;
        // Allow elements with only inline formatting children (b, i, u, em, strong, span, a, br)
        const inlineTags = new Set(['B', 'I', 'U', 'EM', 'STRONG', 'SPAN', 'A', 'BR', 'SMALL', 'SUB', 'SUP', 'MARK', 'CODE']);
        for (let i = 0; i < children.length; i++) {
          if (!inlineTags.has(children[i].tagName)) return false;
        }
        return true;
      }

      function isFormElement(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'OPTION';
      }

      function positionTextEditor(targetEl) {
        if (!textEditor || !targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const edW = 340;
        const edH = 240; // approximate
        const gap = 8;
        let top, left;

        // Prefer below the element
        if (rect.bottom + gap + edH < window.innerHeight) {
          top = rect.bottom + gap;
        } else if (rect.top - gap - edH > 0) {
          // Above the element
          top = rect.top - gap - edH;
        } else {
          // Fallback: center of viewport
          top = Math.max(12, (window.innerHeight - edH) / 2);
        }

        // Horizontally align with element left, clamped to viewport
        left = Math.max(12, Math.min(rect.left, window.innerWidth - edW - 12));

        textEditor.style.top = top + 'px';
        textEditor.style.left = left + 'px';
      }

      function openTextEditor(el) {
        if (!textEditor || !textEditorContent || !el) return;
        textEditTarget = el;
        textEditOriginalHTML = el.innerHTML;
        textEditOriginalText = (el.textContent || '').trim();
        textEditTargetFile = null;
        textEditTargetLine = null;
        textEditTargetComponent = null;

        // 1. Try direct leaf fiber _debugSource (exact JSX element tag)
        const leafFiber = getFiberNode(el);
        if (leafFiber && leafFiber._debugSource) {
          textEditTargetFile = leafFiber._debugSource.fileName;
          textEditTargetLine = leafFiber._debugSource.lineNumber;
        }

        // 2. Find enclosing React component and source location
        const stack = buildHierarchyStack(el);
        const comp = stack.find(c => !c.isDomElement);
        if (comp) {
          textEditTargetComponent = comp.name;
          if (!textEditTargetFile && comp.source && comp.source.fileName) {
            textEditTargetFile = comp.source.fileName;
            textEditTargetLine = comp.source.lineNumber;
          }
        }

        // Target badge
        const targetBadge = shadow.getElementById('cp-text-target-badge');
        if (targetBadge) {
          if (textEditTargetFile) {
            const fileName = textEditTargetFile.split('/').pop();
            targetBadge.textContent = (textEditTargetComponent ? textEditTargetComponent + ' • ' : '') + fileName + (textEditTargetLine ? ':' + textEditTargetLine : '');
            targetBadge.title = textEditTargetFile + (textEditTargetLine ? ':' + textEditTargetLine : '');
          } else if (textEditTargetComponent) {
            targetBadge.textContent = textEditTargetComponent + ' • resolving...';
            resolveComponent({ name: textEditTargetComponent }).then(resolved => {
              if (resolved && resolved.file) {
                textEditTargetFile = resolved.file;
                textEditTargetLine = resolved.line;
                const fn = resolved.file.split('/').pop();
                targetBadge.textContent = textEditTargetComponent + ' • ' + fn + (resolved.line ? ':' + resolved.line : '');
                targetBadge.title = resolved.file + ':' + resolved.line;
              } else {
                targetBadge.textContent = textEditTargetComponent + ' • auto-scan';
              }
            });
          } else {
            targetBadge.textContent = 'Auto-scan on save';
            targetBadge.title = 'Will scan project files on save';
          }
        }

        // If this element was previously edited, show current content
        textEditorContent.innerHTML = el.innerHTML;

        positionTextEditor(el);
        textEditor.style.display = 'block';
        textEditorVisible = true;

        // Focus the editor and select all text
        setTimeout(function() {
          textEditorContent.focus();
          try {
            const range = document.createRange();
            range.selectNodeContents(textEditorContent);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
          } catch (e) {}
        }, 50);

        // Update char count
        updateCharCount();
        showCallout('Editing source text', 'EDIT');
      }

      function closeTextEditor() {
        if (textEditor) textEditor.style.display = 'none';
        textEditorVisible = false;
        textEditTarget = null;
        textEditTargetFile = null;
        textEditTargetLine = null;
        textEditTargetComponent = null;
        textEditOriginalText = '';
      }

      async function applyTextEdit() {
        if (!textEditTarget || !textEditorContent) return;
        const newText = (textEditorContent.textContent || textEditorContent.innerText || '').trim();
        const originalText = textEditOriginalText;
        const newHTML = textEditorContent.innerHTML;

        const applyBtn = shadow.getElementById('cp-text-apply');

        // Always attempt /api/edit-source when text actually changed!
        if (originalText && newText !== originalText) {
          if (applyBtn) {
            applyBtn.textContent = 'Saving...';
            applyBtn.disabled = true;
          }
          try {
            const res = await fetch(BRIDGE + '/api/edit-source', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file: textEditTargetFile || '',
                component: textEditTargetComponent || '',
                originalText: originalText,
                newText: newText,
                line: textEditTargetLine,
              }),
            });
            const data = await res.json();
            if (applyBtn) {
              applyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save to Code';
              applyBtn.disabled = false;
            }
            if (data.success) {
              const fileBase = (data.file || textEditTargetFile || 'source').split('/').pop();
              showCallout('Saved to ' + fileBase + ' (HMR reloaded)', 'SOURCE');
              textEditTarget.textContent = newText;
              closeTextEditor();
              return;
            } else {
              console.warn('[agent-hover] Source edit fallback:', data.error);
              showCallout('Could not match AST — applied to DOM', 'WARNING');
            }
          } catch (e) {
            if (applyBtn) {
              applyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save to Code';
              applyBtn.disabled = false;
            }
            console.error('[agent-hover] Error calling /api/edit-source:', e);
            showCallout('Server error — applied to DOM', 'WARNING');
          }
        }

        // Fallback to DOM update (ephemeral / dynamic expression)
        textEditTarget.innerHTML = newHTML;
        textEdits.set(textEditTarget, { originalHTML: textEditOriginalHTML, currentHTML: newHTML });
        updateEditedIndicators();
        saveTextEditsToSession();
        showCallout('DOM updated', 'EDIT');
        closeTextEditor();
      }

      async function revertTextEdit() {
        if (!textEditTarget) return;
        const revertBtn = shadow.getElementById('cp-text-revert');
        if (revertBtn) revertBtn.disabled = true;

        try {
          const res = await fetch(BRIDGE + '/api/source-undo', { method: 'POST' });
          const data = await res.json();
          if (revertBtn) revertBtn.disabled = false;
          if (data.success) {
            showCallout((data.description || 'Source change reverted'), 'UNDO');
            closeTextEditor();
            return;
          }
        } catch (e) {
          if (revertBtn) revertBtn.disabled = false;
        }

        // Fallback DOM revert
        textEditTarget.innerHTML = textEditOriginalHTML;
        textEdits.delete(textEditTarget);
        textEditTarget.removeAttribute('data-ah-edited');
        updateEditedIndicators();
        saveTextEditsToSession();
        showCallout('Text reverted', 'UNDO');
        closeTextEditor();
      }

      function updateCharCount() {
        if (!textCharCount || !textEditorContent) return;
        const len = textEditorContent.textContent ? textEditorContent.textContent.length : 0;
        textCharCount.textContent = len + ' chars';
      }

      // --- sessionStorage persistence for text edits ---
      function buildCSSSelector(el) {
        if (!el || el === document.body || el === document.documentElement) return '';
        const parts = [];
        let curr = el;
        while (curr && curr !== document.body && parts.length < 6) {
          let sel = curr.tagName.toLowerCase();
          if (curr.id) {
            sel += '#' + curr.id;
            parts.unshift(sel);
            break; // ID is unique enough
          }
          if (curr.parentElement) {
            const siblings = Array.from(curr.parentElement.children).filter(function(c) { return c.tagName === curr.tagName; });
            if (siblings.length > 1) {
              const idx = siblings.indexOf(curr) + 1;
              sel += ':nth-of-type(' + idx + ')';
            }
          }
          parts.unshift(sel);
          curr = curr.parentElement;
        }
        return parts.join(' > ');
      }

      function saveTextEditsToSession() {
        try {
          const data = [];
          textEdits.forEach(function(val, el) {
            const selector = buildCSSSelector(el);
            if (selector) {
              data.push({ selector: selector, originalHTML: val.originalHTML, currentHTML: val.currentHTML });
            }
          });
          sessionStorage.setItem('agent-hover-text-edits', JSON.stringify(data));
        } catch(e) { }
      }

      function restoreTextEditsFromSession() {
        try {
          const raw = sessionStorage.getItem('agent-hover-text-edits');
          if (!raw) return;
          const data = JSON.parse(raw);
          if (!Array.isArray(data)) return;
          data.forEach(function(item) {
            try {
              const el = document.querySelector(item.selector);
              if (el && el.innerHTML !== item.currentHTML) {
                el.innerHTML = item.currentHTML;
                textEdits.set(el, { originalHTML: item.originalHTML, currentHTML: item.currentHTML });
              }
            } catch(e) { }
          });
          if (textEdits.size > 0) {
            updateEditedIndicators();
            console.log('[agent-hover] Restored ' + textEdits.size + ' text edit(s) from session');
          }
        } catch(e) { }
      }

      // Restore edits after a short delay (let React render first)
      setTimeout(restoreTextEditsFromSession, 800);

      // --- Text Editor Event Handlers ---
      // Apply button
      shadow.getElementById('cp-text-apply').onclick = applyTextEdit;

      // Revert button
      shadow.getElementById('cp-text-revert').onclick = revertTextEdit;

      // Close button
      shadow.getElementById('cp-text-editor-close').onclick = closeTextEditor;

      // Toolbar buttons (bold, italic, underline)
      shadow.querySelectorAll('.cp-text-tb-btn').forEach(function(btn) {
        btn.onclick = function(e) {
          e.preventDefault();
          const cmd = btn.getAttribute('data-cmd');
          if (cmd && textEditorContent) {
            // Need to refocus the contenteditable before executing command
            textEditorContent.focus();
            document.execCommand(cmd, false, null);
          }
        };
      });

      // Update char count on input and keyboard shortcuts (Cmd+Enter to commit, Esc to close)
      if (textEditorContent) {
        textEditorContent.addEventListener('input', updateCharCount);
        textEditorContent.addEventListener('keydown', function(e) {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            applyTextEdit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeTextEditor();
          }
        });
      }

      // Double-click handler for text editing
      window.addEventListener('dblclick', function(e) {
        if (!isPointerMode) return;
        if (e.target && e.target.closest && e.target.closest('#agent-hover-root')) return;

        e.preventDefault();
        e.stopPropagation();

        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        if (el.closest && el.closest('#agent-hover-root')) return;
        if (isFormElement(el)) return;
        if (!isLeafTextElement(el)) {
          showCallout('Element has complex children — select a text element', 'TIP');
          return;
        }

        openTextEditor(el);
      }, true);

      // Close text editor on Escape (handled in keydown handler below)
      // Close text editor on click outside
      window.addEventListener('mousedown', function(e) {
        if (!textEditorVisible) return;
        // Check if click is inside the text editor (Shadow DOM)
        const path = e.composedPath ? e.composedPath() : [];
        let insideEditor = false;
        for (let i = 0; i < path.length; i++) {
          if (path[i] === textEditor) { insideEditor = true; break; }
        }
        if (!insideEditor) {
          closeTextEditor();
        }
      }, true);

      // Update highlight box to match a specific item in currentStack
      function highlightComponent(info, useUnionRect) {
        if (!info) return;
        currentComponentInfo = info;
        let rect = null;

        if (info.isDomElement && info.element) {
          rect = info.element.getBoundingClientRect();
          highlight.classList.add('is-raw');
        } else if (useUnionRect && info.fiber) {
          rect = getComponentBoundingRect(info.fiber);
          highlight.classList.remove('is-raw');
        } else if (currentElement) {
          rect = currentElement.getBoundingClientRect();
          highlight.classList.remove('is-raw');
        }

        if (!rect || (rect.width === 0 && rect.height === 0)) {
          highlight.style.display = 'none';
          hideBands();
          return;
        }

        highlight.style.display = 'block';
        highlight.style.top = rect.top + 'px';
        highlight.style.left = rect.left + 'px';
        highlight.style.width = rect.width + 'px';
        highlight.style.height = rect.height + 'px';

        const isFrozen = frozenEntries.some(f => (info.source && f.file === info.source.fileName) || f.component === info.name);
        const frameColor = isFrozen ? '#f43f5e' : (info.isDomElement ? '#38bdf8' : '#0ea5e9');
        highlight.style.border = '1.5px solid ' + frameColor;
        highlight.style.background = 'transparent';
        highlight.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.12)';

        // Position single-line chip cleanly above the frame, or inside if too close to viewport top
        if (rect.top < 26) {
          label.style.top = '2px';
          label.style.left = '2px';
          label.style.borderRadius = '3px';
        } else {
          label.style.top = '-23px';
          label.style.left = '-1px';
          label.style.borderRadius = '4px';
        }

        const lockHtml = isFrozen ? '<span style="color:#fb7185; margin-right:4px;">' + ICONS.lock + '</span>' : '';
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        const dimSpan = '<span style="color:var(--text-muted); font-size:9.5px; margin-left:4px; font-weight:normal;">' + w + ' × ' + h + '</span>';

        if (info.isDomElement) {
          label.innerHTML = lockHtml + '<span style="color:#38bdf8;">' + info.name + '</span>' + dimSpan;
          label.style.borderColor = '#38bdf8';
        } else {
          label.innerHTML = lockHtml + '<span style="color:#0ea5e9;">&lt;' + info.name + ' /&gt;</span>' + dimSpan;
          label.style.borderColor = isFrozen ? '#f43f5e' : '#0ea5e9';
        }

        if (showSpacingOverlay && (info.element || currentElement)) {
          positionBands(info.element || currentElement);
        } else {
          hideBands();
        }
      }

      // --- Keyboard Shortcuts ---
      window.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

        if (e.key === 'Alt') {
          if (isTyping) return;
          e.preventDefault();
          togglePointerMode();
          return;
        }

        if (e.key === 'Escape') {
          if (textEditorVisible) {
            closeTextEditor();
            return;
          }
          if (isTyping && activeEl && activeEl.blur) {
            activeEl.blur();
            return;
          }
          flyout.classList.remove('open');
          dockWrapper.classList.remove('sidebar-open');
          if (typeof clearSelection === 'function') clearSelection();
          return;
        }

        if (isTyping) return;

        // Ancestry navigation: ArrowUp goes to parent, ArrowDown goes to child
        if ((isPointerMode || flyout.classList.contains('open')) && currentStack && currentStack.length > 1) {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentStackIndex < currentStack.length - 1) {
              currentStackIndex++;
              if (flyout.classList.contains('open')) {
                renderFlyoutForStackIndex(currentStackIndex);
              } else {
                highlightComponent(currentStack[currentStackIndex], true);
              }
            }
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentStackIndex > 0) {
              currentStackIndex--;
              if (flyout.classList.contains('open')) {
                renderFlyoutForStackIndex(currentStackIndex);
              } else {
                highlightComponent(currentStack[currentStackIndex], currentStackIndex > 0);
              }
            }
          }
        }
      });

      // --- Hover Highlight (RAF-throttled, Universal Selection) ---
      let hoverRafPending = false;
      window.addEventListener('mousemove', (e) => {
        if (!isPointerMode || hoverRafPending) return;
        hoverRafPending = true;
        requestAnimationFrame(() => {
          hoverRafPending = false;

          // Check if cursor is over Agent Hover UI
          const path = e.composedPath ? e.composedPath() : [];
          const isOverHoverUi = path.some(node => node === container || (node.id === 'agent-hover-root') || (node.classList && node.classList.contains && node.classList.contains('agent-hover-panel')));
          if (isOverHoverUi || (e.target && e.target.closest && e.target.closest('#agent-hover-root'))) {
            highlight.style.display = 'none';
            hideBands();
            return;
          }

          const el = document.elementFromPoint(e.clientX, e.clientY);
          if (!el || (el.closest && el.closest('#agent-hover-root'))) {
            highlight.style.display = 'none';
            hideBands();
            return;
          }
          if (el === currentElement) return;
          currentElement = el;

          // Build full hierarchy stack (Level 0 = DOM element, Level 1..N = React components)
          currentStack = buildHierarchyStack(el);
          currentStackIndex = 0; // Default to exact element under cursor!

          // If a selection is active, show measurement guides between selected and hovered
          if (selectedRect) {
            const hoveredRect = el.getBoundingClientRect();
            renderDistanceGuides(selectedRect, hoveredRect);
          } else {
            clearDistanceGuides();
          }

          // If hovering over the selected element, hide the hover preview so borders don't double
          if (selectedTarget && ((selectedTarget.element && selectedTarget.element === el) || (selectedElement && selectedElement === el))) {
            highlight.style.display = 'none';
            hideBands();
          } else {
            highlightComponent(currentStack[0], false);
          }
        });
      });

      // Reposition highlight on scroll/resize
      function repositionHighlight() {
        if (typeof updateSelectionFrame === 'function') updateSelectionFrame();
        if (!currentComponentInfo || highlight.style.display === 'none') return;
        const target = currentStack[currentStackIndex] || currentComponentInfo;

        if (target.isDomElement && target.element) {
          const rect = target.element.getBoundingClientRect();
          highlight.style.top = rect.top + 'px';
          highlight.style.left = rect.left + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';
          if (showSpacingOverlay) positionBands(target.element);
        } else if (target.fiber) {
          const rect = getComponentBoundingRect(target.fiber);
          if (rect) {
            highlight.style.top = rect.top + 'px';
            highlight.style.left = rect.left + 'px';
            highlight.style.width = rect.width + 'px';
            highlight.style.height = rect.height + 'px';
            if (showSpacingOverlay && currentElement) positionBands(currentElement);
          }
        }
      }
      window.addEventListener('scroll', repositionHighlight, { capture: true, passive: true });
      window.addEventListener('resize', repositionHighlight);

      function extractComputedStyles(el) {
        const s = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          width: s.width, height: s.height, padding: s.padding, margin: s.margin, border: s.border,
          display: s.display, position: s.position, flexDirection: s.flexDirection,
          alignItems: s.alignItems, justifyContent: s.justifyContent, gridTemplateColumns: s.gridTemplateColumns,
          gap: s.gap, zIndex: s.zIndex, overflow: s.overflow, opacity: s.opacity, visibility: s.visibility,
          fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color, backgroundColor: s.backgroundColor,
          boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        };
      }

      function getInheritedBackgroundColor(el) {
        let curr = el;
        while (curr && curr !== document.documentElement) {
          const bg = window.getComputedStyle(curr).backgroundColor;
          if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
            return bg;
          }
          curr = curr.parentElement;
        }
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') {
          return bodyBg;
        }
        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        if (htmlBg && htmlBg !== 'transparent' && htmlBg !== 'rgba(0, 0, 0, 0)') {
          return htmlBg;
        }
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? '#09090b' : '#ffffff';
      }

      function triggerShutterFlash() {
        try {
          const flash = document.createElement('div');
          flash.id = 'ah-shutter-flash';
          flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.32);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);pointer-events:none;z-index:9999999;opacity:1;transition:opacity 0.35s cubic-bezier(0.16,1,0.3,1);';
          document.body.appendChild(flash);
          requestAnimationFrame(() => {
            flash.style.opacity = '0';
            setTimeout(() => {
              try { if (flash.parentNode) flash.parentNode.removeChild(flash); } catch (_) {}
            }, 400);
          });
        } catch (_) {}
      }

      async function captureElement(element, opts) {
        if (!element) return null;
        // Completely hide Agent Hover UI (dock, sidebar, overlays, markers) so only website UI is captured
        const rootContainer = shadow.host || container;
        const prevVisibility = rootContainer.style.visibility;
        rootContainer.style.visibility = 'hidden';

        // Capture filter: exclude agent-hover UI, preview card, dropdown, markers, popover, flash
        const captureFilter = (node) => {
          if (!node) return true;
          if (node.id === 'agent-hover-root' || node === container) return false;
          if (node.id === 'ah-shutter-flash') return false;
          if (node.classList && node.classList.contains && (
            node.classList.contains('agent-hover-ignore') ||
            node.classList.contains('cp-comment-marker') ||
            node.classList.contains('cp-marker-preview')
          )) return false;
          return true;
        };

        try {
          const isViewport = opts && opts.scrollX !== undefined;
          const isFullPage = opts && opts.height > window.innerHeight;
          const isComponent = !isViewport && !isFullPage;

          if (isComponent && element.getBoundingClientRect) {
            const rect = element.getBoundingClientRect();
            const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
            if (!inViewport && element.scrollIntoView) {
              element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
              await new Promise(r => setTimeout(r, 100));
            }
          }

          let scale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 2);
          const solidBg = getInheritedBackgroundColor(element);

          // Build capture options
          const captureOpts = {
            scale,
            backgroundColor: solidBg,
            filter: captureFilter,
            onCloneNode: (clonedRoot) => {
              if (!clonedRoot) return;
              const fixNode = (node) => {
                if (!node || node.nodeType !== 1) return;
                const text = node.textContent ? node.textContent.trim() : '';
                if (text.length > 0 && text.length <= 60 && !text.includes(String.fromCharCode(10))) {
                  const hasBlockChild = Array.from(node.children || []).some((c) => {
                    const tag = c.tagName ? c.tagName.toLowerCase() : '';
                    return tag === 'div' || tag === 'p' || tag === 'section' || tag === 'article' || tag === 'header';
                  });
                  if (!hasBlockChild) {
                    node.style.whiteSpace = 'nowrap';
                  }
                }
                if (node.children) {
                  for (let i = 0; i < node.children.length; i++) {
                    fixNode(node.children[i]);
                  }
                }
              };
              fixNode(clonedRoot);
            },
            onCloneEachNode: (clonedNode) => {
              if (clonedNode && clonedNode.nodeType === 1) {
                const text = clonedNode.textContent ? clonedNode.textContent.trim() : '';
                if (text.length > 0 && text.length <= 60 && !text.includes(String.fromCharCode(10))) {
                  const hasBlockChild = Array.from(clonedNode.children || []).some((c) => {
                    const tag = c.tagName ? c.tagName.toLowerCase() : '';
                    return tag === 'div' || tag === 'p' || tag === 'section' || tag === 'article';
                  });
                  if (!hasBlockChild) {
                    clonedNode.style.whiteSpace = 'nowrap';
                  }
                }
              }
            }
          };

          // Viewport mode: capture at viewport dimensions with scroll offset
          if (isViewport) {
            captureOpts.width = opts.width || window.innerWidth;
            captureOpts.height = opts.height || window.innerHeight;
            // Offset by scroll position through the clone's style
            captureOpts.style = {
              transform: 'translate(-' + (opts.scrollX || 0) + 'px, -' + (opts.scrollY || 0) + 'px)',
              transformOrigin: 'top left',
            };
          }

          // Full page mode: pass dimensions without mutating live DOM
          if (isFullPage) {
            captureOpts.width = opts.width || document.documentElement.scrollWidth;
            captureOpts.height = opts.height || document.documentElement.scrollHeight;
          }

          // Primary: Use modernScreenshot
          if (window.modernScreenshot && window.modernScreenshot.domToPng) {
            try {
              const dataUrl = await window.modernScreenshot.domToPng(element, captureOpts);
              if (dataUrl) return dataUrl;
            } catch (err) {
              // Retry full page at lower scale on canvas failure
              if (isFullPage && scale > 1) {
                console.warn('[agent-hover] Full page capture failed at scale ' + scale + ', retrying at scale 1');
                captureOpts.scale = 1;
                try {
                  const dataUrl = await window.modernScreenshot.domToPng(element, captureOpts);
                  if (dataUrl) return dataUrl;
                } catch (_) {}
              }
            }
          }

          // Fallback: domtoimage
          if (window.domtoimage && window.domtoimage.toPng) {
            const rect = isComponent && element.getBoundingClientRect ? element.getBoundingClientRect() : null;
            const captureWidth = Math.max(Math.round(
              opts?.width || (isComponent ? (element.offsetWidth || element.clientWidth || (rect ? rect.width : 300)) : window.innerWidth)
            ), 10);
            const captureHeight = Math.max(Math.round(
              opts?.height || (isComponent ? (element.offsetHeight || element.clientHeight || (rect ? rect.height : 200)) : window.innerHeight)
            ), 10);
            const dataUrl = await window.domtoimage.toPng(element, {
              width: captureWidth,
              height: captureHeight,
              pixelRatio: scale,
              bgcolor: solidBg,
              imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=',
              filter: captureFilter,
            });
            return dataUrl;
          }

          console.error('[agent-hover] No screenshot capture library available');
          return null;
        } catch (err) {
          console.error('[agent-hover] Screenshot capture failed:', err);
          return null;
        } finally {
          rootContainer.style.visibility = prevVisibility || 'visible';
        }
      }

      function dataUrlToBlob(dataUrl) {
        try {
          const parts = dataUrl.split(';base64,');
          const contentType = (parts[0] && parts[0].split(':')[1]) || 'image/png';
          const byteCharacters = atob(parts[1]);
          const byteArrays = [];
          for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
            const slice = byteCharacters.slice(offset, offset + 1024);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
          }
          return new Blob(byteArrays, { type: contentType });
        } catch (e) {
          console.error('[agent-hover] Blob conversion error:', e);
          return null;
        }
      }

      async function downloadCleanScreenshot(targetEl, name) {
        triggerShutterFlash();
        showCallout('Capturing screenshot...', 'SNAP', 800);
        const el = (targetEl && targetEl.isConnected) ? targetEl : document.body;
        const cleanName = (name || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = Date.now();
        const filename = cleanName + '_' + timestamp + '.png';

        const dataUrl = await captureElement(el);
        if (!dataUrl) {
          showCallout('Failed to capture screenshot', 'ERROR', 2500);
          return;
        }

        const blob = dataUrlToBlob(dataUrl);

        // 1. Direct browser download via Blob Object URL
        let browserDownloaded = false;
        if (blob) {
          try {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              try { document.body.removeChild(a); } catch (_) {}
              URL.revokeObjectURL(blobUrl);
            }, 5000);
            browserDownloaded = true;
          } catch (e) {
            console.warn('[agent-hover] Browser blob download failed:', e);
          }
        }

        // 2. Direct copy to system clipboard for immediate pasting (Cmd+V / Ctrl+V)
        let clipboardCopied = false;
        if (blob && navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            clipboardCopied = true;
          } catch (_) {}
        }

        // 3. Save directly to project disk via Bridge server (.agent-hover/screenshots/)
        let diskSaved = false;
        try {
          const res = await fetch(BRIDGE + '/api/screenshot/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, filename: cleanName })
          });
          const result = await res.json();
          if (result && result.success) {
            diskSaved = true;
          }
        } catch (_) {}

        if (diskSaved || browserDownloaded) {
          const testImg = new Image();
          testImg.onload = () => {
            showSnapPreview(dataUrl, (name || 'Component') + ' • ' + testImg.naturalWidth + ' × ' + testImg.naturalHeight, filename, 'component');
          };
          testImg.onerror = () => {
            showSnapPreview(dataUrl, (name || 'Component'), filename, 'component');
          };
          testImg.src = dataUrl;

          if (clipboardCopied && diskSaved) {
            showCallout('Screenshot saved and copied to clipboard', 'SAVED', 3500);
          } else if (clipboardCopied) {
            showCallout('Downloaded and copied to clipboard', 'SAVED', 3000);
          } else if (diskSaved) {
            showCallout('Saved to .agent-hover/screenshots/', 'SAVED', 3000);
          } else {
            showCallout('Screenshot downloaded', 'SAVED', 3000);
          }
        } else {
          showCallout('Failed to save screenshot', 'ERROR', 2500);
        }
      }

      function findComponentElement(componentName) {
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          if (el.id === 'agent-hover-root') continue;
          const info = getComponentInfo(el);
          if (info && info.name === componentName) return el;
        }
        return null;
      }

      // --- Click to Inspect ---
      window.addEventListener('click', async (e) => {
        if (!isPointerMode) return;
        const path = e.composedPath ? e.composedPath() : [];
        const isOverHoverUi = path.some(node => node === container || (node.id === 'agent-hover-root') || (node.classList && node.classList.contains && node.classList.contains('agent-hover-panel')));
        if (isOverHoverUi || (e.target && e.target.closest && e.target.closest('#agent-hover-root'))) return;
        
        e.preventDefault();
        e.stopPropagation();

        const clickedEl = document.elementFromPoint(e.clientX, e.clientY) || e.target;
        if (clickedEl && clickedEl !== document.body && clickedEl !== container && (!clickedEl.closest || !clickedEl.closest('#agent-hover-root'))) {
          currentStack = buildHierarchyStack(clickedEl);
          currentStackIndex = 0;
          currentElement = clickedEl;
        }
        if (!currentStack || currentStack.length === 0) return;

        // Select exact leaf element clicked (index 0) so smaller elements and components are directly selectable
        const targetIndex = 0;
        const target = currentStack[targetIndex] || currentStack[0];

        // Raw elements can't be frozen/pinned
        if (!target.isDomElement) {
          if (e.ctrlKey || e.metaKey) {
            const resolved = await resolveComponent(target);
            if (resolved) {
              const isCurrentlyFrozen = frozenEntries.some(f => f.file === resolved.file && f.component === target.name);
              await fetch(BRIDGE + '/api/freeze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: isCurrentlyFrozen ? 'remove' : 'add', file: resolved.file, component: target.name, line: resolved.line })
              });
              showCallout(isCurrentlyFrozen ? 'Unfrozen ' + target.name : 'Frozen ' + target.name, 'LOCK');
              refreshState();
            }
            return;
          }

          if (e.shiftKey) {
            const resolved = await resolveComponent(target);
            if (resolved) {
              await fetch(BRIDGE + '/api/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', file: resolved.file, line: resolved.line })
              });
              showCallout('Pinned ' + target.name, 'PIN');
              refreshState();
            }
            return;
          }
        }

        await renderFlyoutForStackIndex(targetIndex);
      }, true);

      async function renderFlyoutForStackIndex(index) {
        if (!currentStack || currentStack.length === 0) return;
        currentStackIndex = index;
        const item = currentStack[index];
        currentComponentInfo = item;

        // Lock persistent selection frame on the selected element/component
        selectedTarget = item;
        selectedElement = item.element || currentElement;
        updateSelectionFrame();

        // Update selection chip text
        if (selName) {
          selName.textContent = item.isDomElement ? item.name : '<' + item.name + ' />';
        }
        if (selFile) {
          if (item.source) {
            const shortFile = item.source.fileName.split('/').slice(-2).join('/');
            selFile.textContent = shortFile + ':' + item.source.lineNumber;
          } else if (currentStack.length > 1 && currentStack[1].source) {
            const shortFile = currentStack[1].source.fileName.split('/').slice(-2).join('/');
            selFile.textContent = shortFile + ':' + currentStack[1].source.lineNumber;
          } else {
            selFile.textContent = '';
          }
        }

        // Hide hover highlight because selection frame is now displayed
        highlight.style.display = 'none';

        // Store the selected element's rect for measurement guides
        if (item.isDomElement && item.element) {
          selectedRect = item.element.getBoundingClientRect();
        } else if (item.fiber) {
          selectedRect = getComponentBoundingRect(item.fiber);
        } else if (currentElement) {
          selectedRect = currentElement.getBoundingClientRect();
        }
        clearDistanceGuides();

        flyout.classList.add('open');
        if (flyout.classList.contains('is-sidebar')) {
          dockWrapper.classList.add('sidebar-open');
        }

        // Render interactive breadcrumbs with proper HTML escaping
        const breadcrumbEl = shadow.getElementById('cp-flyout-breadcrumb');
        if (currentStack && currentStack.length > 0) {
          const crumbs = [];
          for (let i = currentStack.length - 1; i >= 0; i--) {
            const c = currentStack[i];
            const isActive = i === currentStackIndex;
            const style = isActive
              ? 'color:#ffffff; font-weight:600; cursor:pointer; padding:2px 8px; border-radius:4px; background:#2c2c2c; border:1px solid #444444; white-space:nowrap;'
              : 'color:var(--text-muted); cursor:pointer; padding:2px 6px; border-radius:4px; white-space:nowrap;';
            const label = c.isDomElement ? c.name : '<' + c.name + ' />';
            crumbs.push('<span style="' + style + '" data-bc-idx="' + i + '" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>');
          }
          breadcrumbEl.innerHTML = crumbs.join('<span style="color:var(--text-muted); margin:0 2px; font-size:10px;">›</span>');
          breadcrumbEl.style.display = 'flex';
          breadcrumbEl.style.alignItems = 'center';
          breadcrumbEl.style.overflowX = 'auto';

          breadcrumbEl.onclick = (evt) => {
            const targetEl = evt.target.closest('[data-bc-idx]');
            if (!targetEl) return;
            const idx = parseInt(targetEl.getAttribute('data-bc-idx'), 10);
            if (isNaN(idx) || idx < 0 || idx >= currentStack.length) return;
            renderFlyoutForStackIndex(idx);
          };
        } else {
          breadcrumbEl.style.display = 'none';
        }

        const computedStyles = currentElement ? extractComputedStyles(currentElement) : {};
        if (inSettingsView) toggleSettingsView(false);

        if (item.isDomElement) {
          flyoutTitle.textContent = item.name;
          const el = item.element;
          let html = '';

          // Contextual In-Inspector Note Card
          const selector = (typeof buildCSSSelector === 'function' && el) ? buildCSSSelector(el) : (el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''));
          const attachedNote = (typeof comments !== 'undefined' && comments && comments.length > 0)
            ? comments.find(c => {
                if (c.selector) {
                  try {
                    if (el.matches && el.matches(c.selector)) return true;
                    if (el.closest && el.closest(c.selector)) return true;
                  } catch (_) {}
                  if (c.selector === selector) return true;
                }
                if (c.component && item.name && (c.component === item.name || item.name.includes(c.component))) return true;
                return false;
              })
            : null;

          if (attachedNote) {
            html += '<div class="cp-section" id="cp-inspector-attached-note" style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); border-left:3px solid var(--accent); border-radius:8px; padding:10px 12px; margin-bottom:14px; cursor:pointer;" title="Click to view or edit attached note">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
            html += '<span style="display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:var(--accent);">' + ICONS.comment + ' Attached Note</span>';
            html += '<span class="cp-badge cp-badge-' + (attachedNote.status === 'resolved' ? 'emerald' : 'accent') + '" style="font-size:9.5px; text-transform:uppercase;">' + escapeHtml(attachedNote.status || 'open') + '</span>';
            html += '</div>';
            html += '<div style="font-size:12px; color:var(--text-primary); line-height:1.45; word-break:break-word; max-height:80px; overflow-y:auto;">' + escapeHtml(attachedNote.text) + '</div>';
            html += '<div style="margin-top:6px; font-size:10.5px; color:var(--text-secondary); font-weight:500;">Click to edit note ›</div>';
            html += '</div>';
          }

          html += '<div class="cp-section" style="margin-bottom:14px;">';
          html += '<span class="cp-badge cp-badge-accent">' + el.tagName.toLowerCase() + '</span> ';
          if (el.id) html += '<span class="cp-badge cp-badge-emerald">#' + el.id + '</span> ';
          if (el.className && typeof el.className === 'string') {
            const cls = el.className.trim().split(/\\s+/).slice(0, 6);
            if (cls.length && cls[0]) {
              cls.forEach(function(c) {
                html += '<span class="cp-badge cp-badge-muted">.' + c + '</span> ';
              });
            }
          }
          html += '</div>';

          // If inside a React component, link to the parent component
          if (currentStack.length > 1) {
            const parentComp = currentStack[1];
            html += '<div class="cp-section" id="cp-parent-comp-card" style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); border-radius:8px; padding:10px 14px; margin-bottom:14px; cursor:pointer;" title="Click to view component">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
            html += '<span style="font-size:10.5px; color:var(--text-muted); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.5px;">Rendered In Component</span>';
            html += '<span style="font-size:10.5px; color:var(--text-secondary); font-weight:600;">Inspect Component ›</span>';
            html += '</div>';
            html += '<div style="font-size:13.5px; font-weight:700; color:var(--text-primary); margin-top:3px;">&lt;' + parentComp.name + ' /&gt;</div>';
            if (parentComp.source) {
              html += '<div style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted); margin-top:3px;">' + parentComp.source.fileName + ':' + parentComp.source.lineNumber + '</div>';
              lastResolved = { file: parentComp.source.fileName, line: parentComp.source.lineNumber };
            }
            html += '</div>';
          }

          // Text content preview (leaf or concise direct text only, avoid whole-page dump)
          let text = '';
          if (el.children.length === 0) {
            text = el.textContent ? el.textContent.trim() : '';
          } else {
            let directText = '';
            for (let i = 0; i < el.childNodes.length; i++) {
              if (el.childNodes[i].nodeType === 3) {
                directText += el.childNodes[i].textContent.trim() + ' ';
              }
            }
            text = directText.trim();
          }
          if (text) {
            if (text.length > 150) text = text.slice(0, 150) + '...';
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Text Content</summary>';
            html += '<div style="margin-top:6px; font-size:12px; color:var(--text-secondary); word-break:break-word; max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:8px 10px; border-radius:6px; font-family:var(--font-mono);">' + escapeHtml(text) + '</div>';
            html += '</details>';
          } else if (el.children.length > 0) {
            html += '<div style="margin-bottom:12px; font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">' + el.children.length + ' child element' + (el.children.length > 1 ? 's' : '') + '</div>';
          }

          // Attributes
          const attrs = Array.from(el.attributes || []).filter(a => a.name !== 'class' && a.name !== 'id' && a.name !== 'style');
          if (attrs.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Attributes (' + attrs.length + ')</summary>';
            html += '<table class="cp-props-table"><tr><th>Name</th><th>Value</th></tr>';
            attrs.forEach(function(a) {
              const val = a.value.length > 60 ? a.value.substring(0, 60) + '...' : a.value;
              html += '<tr><td style="color:var(--text-primary); font-weight:500;">' + a.name + '</td><td style="color:var(--text-secondary);">' + escapeHtml(val) + '</td></tr>';
            });
            html += '</table></details>';
          }

          // Compact visual layout metrics
          if (computedStyles && Object.keys(computedStyles).length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Layout & Dimensions</summary>';
            html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; font-family:var(--font-mono); background:var(--bg-surface-sunken); padding:10px; border-radius:8px; border:1px solid var(--border-subtle);">';
            html += '<div><span style="color:var(--text-muted);">size:</span> <strong style="color:var(--text-primary);">' + Math.round(parseFloat(computedStyles.width)) + ' × ' + Math.round(parseFloat(computedStyles.height)) + '</strong></div>';
            html += '<div><span style="color:var(--text-muted);">display:</span> ' + computedStyles.display + '</div>';
            html += '<div><span style="color:var(--text-muted);">padding:</span> ' + computedStyles.padding + '</div>';
            html += '<div><span style="color:var(--text-muted);">margin:</span> ' + computedStyles.margin + '</div>';
            if (computedStyles.display && computedStyles.display.includes('flex')) {
              html += '<div><span style="color:var(--text-muted);">flex-dir:</span> ' + computedStyles.flexDirection + '</div>';
              html += '<div><span style="color:var(--text-muted);">gap:</span> ' + computedStyles.gap + '</div>';
            }
            if (computedStyles.color) {
              html += '<div style="display:flex; align-items:center; gap:4px;"><span style="color:var(--text-muted);">color:</span> <span style="width:9px; height:9px; border-radius:2px; background:' + computedStyles.color + '; border:1px solid rgba(255,255,255,0.2);"></span>' + computedStyles.color + '</div>';
            }
            if (computedStyles.backgroundColor && computedStyles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              html += '<div style="display:flex; align-items:center; gap:4px;"><span style="color:var(--text-muted);">bg:</span> <span style="width:9px; height:9px; border-radius:2px; background:' + computedStyles.backgroundColor + '; border:1px solid rgba(255,255,255,0.2);"></span>' + computedStyles.backgroundColor + '</div>';
            }
            html += '</div></details>';
          }

          flyoutContent.innerHTML = html;

          const noteCard = shadow.getElementById('cp-inspector-attached-note');
          if (noteCard && attachedNote) {
            noteCard.onclick = () => {
              openNotePopover({ element: el, name: item.name }, attachedNote);
            };
          }

          const parentCard = shadow.getElementById('cp-parent-comp-card');
          if (parentCard) {
            parentCard.onclick = () => renderFlyoutForStackIndex(1);
          }

          // Fetch parent component context in background so tokens and copy context are ready!
          if (currentStack.length > 1) {
            resolveComponent(currentStack[1]).then(async (resolved) => {
              if (resolved) {
                lastResolved = resolved;
                try {
                  const level = shadow.getElementById('cp-context-level')?.value || 'standard';
                  const res = await fetch(BRIDGE + '/api/context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file: resolved.file, line: resolved.line, level })
                  });
                  const ctx = await res.json();
                  lastCopiedContext = ctx;
                  const tokenCountEl = shadow.getElementById('cp-token-count');
                  const tokenSavingsEl = shadow.getElementById('cp-token-savings');
                  if (tokenCountEl && ctx.tokens) {
                    tokenCountEl.textContent = ctx.tokens.current || 0;
                  }
                  if (tokenSavingsEl && ctx.tokens) {
                    const fullTokens = ctx.tokens.full || 0;
                    const curTokens = ctx.tokens.current || 0;
                    if (fullTokens > curTokens && fullTokens > 0) {
                      const saved = Math.round((1 - curTokens / fullTokens) * 100);
                      tokenSavingsEl.textContent = saved + '% smaller than full';
                    } else {
                      tokenSavingsEl.textContent = 'prompt-ready';
                    }
                  }
                } catch(e) {}
              }
            });
          }
        } else {
          // React Component
          flyoutTitle.textContent = item.name;
          flyoutContent.innerHTML = '<p style="color:var(--text-secondary);">Loading context...</p>';
          try {
            const resolved = await resolveComponent(item);
            if (!resolved) {
              flyoutContent.innerHTML = '<p style="color:#fb7185;">Could not find source file for ' + item.name + '</p>';
              return;
            }
            fetch(BRIDGE + '/api/computed-styles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: resolved.file + ':' + item.name, styles: computedStyles })
            }).catch(e => console.error(e));

            await loadComponentContext(item.name, resolved, computedStyles);
          } catch(err) {
            flyoutContent.innerHTML = '<p style="color:#fb7185;">Failed to load context: ' + err.message + '</p>';
          }
        }
      }

      async function loadComponentContext(infoName, resolved, computedStyles) {
        flyoutContent.innerHTML = '<p style="color:var(--text-secondary);">Loading context...</p>';
        try {
          const level = shadow.getElementById('cp-context-level')?.value || 'standard';
          const res = await fetch(BRIDGE + '/api/context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: resolved.file, line: resolved.line, level })
          });
          const ctx = await res.json();
          lastCopiedContext = ctx;
          lastResolved = resolved;
          lastInfoName = infoName;
          lastComputedStyles = computedStyles;

          // Update Live Token Meter
          const tokenCountEl = shadow.getElementById('cp-token-count');
          const tokenSavingsEl = shadow.getElementById('cp-token-savings');
          if (tokenCountEl && ctx.tokens) {
            tokenCountEl.textContent = ctx.tokens.current || 0;
          }
          if (tokenSavingsEl && ctx.tokens) {
            const fullTokens = ctx.tokens.full || 0;
            const curTokens = ctx.tokens.current || 0;
            if (fullTokens > curTokens && fullTokens > 0) {
              const saved = Math.round((1 - curTokens / fullTokens) * 100);
              tokenSavingsEl.textContent = saved + '% smaller than full';
            } else {
              tokenSavingsEl.textContent = 'prompt-ready';
            }
          }

          let html = '';

          // Contextual In-Inspector Note Card
          const attachedNote = (typeof comments !== 'undefined' && comments && comments.length > 0)
            ? comments.find(c => (c.component && ctx.component && c.component === ctx.component.name) || (c.file && ctx.source && c.file === ctx.source.file))
            : null;

          if (attachedNote) {
            html += '<div class="cp-section" id="cp-inspector-attached-note" style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); border-left:3px solid var(--accent); border-radius:8px; padding:10px 12px; margin-bottom:14px; cursor:pointer;" title="Click to view or edit attached note">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
            html += '<span style="display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:var(--accent);">' + ICONS.comment + ' Attached Note</span>';
            html += '<span class="cp-badge cp-badge-' + (attachedNote.status === 'resolved' ? 'emerald' : 'accent') + '" style="font-size:9.5px; text-transform:uppercase;">' + escapeHtml(attachedNote.status || 'open') + '</span>';
            html += '</div>';
            html += '<div style="font-size:12px; color:var(--text-primary); line-height:1.45; word-break:break-word; max-height:80px; overflow-y:auto;">' + escapeHtml(attachedNote.text) + '</div>';
            html += '<div style="margin-top:6px; font-size:10.5px; color:var(--text-secondary); font-weight:500;">Click to edit note ›</div>';
            html += '</div>';
          }

          html += '<div class="cp-section" style="margin-bottom:14px;">';
          html += '<span class="cp-badge cp-badge-accent">' + ctx.component.type + '</span> ';
          html += '<span class="cp-badge cp-badge-emerald">' + ctx.component.exportType + ' export</span> ';
          html += '<span class="cp-badge cp-badge-muted">' + ctx.tokens.current + ' tokens</span>';
          html += '<div style="margin-top:8px; font-size:12px; font-family:var(--font-mono); color:var(--text-muted);">' + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + '</div>';
          html += '</div>';

          if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Props (' + ctx.interface.props.length + ')</summary>';
            html += '<table class="cp-props-table"><tr><th>Name</th><th>Type</th><th>Req</th></tr>';
            ctx.interface.props.forEach(function(p) {
              html += '<tr><td style="color:var(--text-primary); font-weight:500;">' + p.name + '</td><td style="color:var(--text-secondary);">' + p.type + '</td><td style="color:var(--accent-emerald);">' + (p.required ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '—') + '</td></tr>';
            });
            html += '</table></details>';
          }

          if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Hooks</summary>';
            html += '<div style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary); margin-top:6px;">' + ctx.interface.hooks.join(', ') + '</div>';
            html += '</details>';
          }

          if (ctx.imports && ctx.imports.length > 0) {
            html += '<details class="cp-section">';
            html += '<summary class="cp-section-title">Imports (' + ctx.imports.length + ')</summary>';
            html += '<div style="margin-top:8px;">';
            ctx.imports.forEach(function(imp) {
              const badge = imp.isLocal ? '<span class="cp-badge cp-badge-emerald" style="font-size:9px; padding:2px 5px;">LOCAL</span>' : '<span class="cp-badge cp-badge-muted" style="font-size:9px; padding:2px 5px;">PKG</span>';
              html += '<div style="padding:4px 0; display:flex; align-items:center; gap:8px;">' + badge + ' <span style="font-family:var(--font-mono); font-size:11.5px;">' + imp.name + '</span></div>';
            });
            html += '</div></details>';
          }

          if (computedStyles && Object.keys(computedStyles).length > 0) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title">Computed Box Model</summary>';
            html += '<div class="cp-box-model">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">margin: ' + computedStyles.margin + '</div>';
            html += '<div style="border:1px dashed #475569; padding:8px; margin:4px; display:inline-block; border-radius:6px;">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">border: ' + computedStyles.border + '</div>';
            html += '<div style="border:1px solid var(--border-glass); padding:8px; margin:4px; display:inline-block; background:rgba(255,255,255,0.03); border-radius:4px;">';
            html += '<div style="margin-bottom:4px; color:var(--text-muted);">padding: ' + computedStyles.padding + '</div>';
            html += '<div style="background:var(--bg-surface-raised); border:1px solid var(--border-glass); padding:8px 12px; display:inline-block; color:var(--text-primary); border-radius:4px; font-weight:600;">';
            html += Math.round(parseFloat(computedStyles.width)) + ' × ' + Math.round(parseFloat(computedStyles.height));
            html += '</div></div></div></div>';
            
            html += '<div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; font-family:var(--font-mono);">';
            html += '<div><span style="color:var(--text-muted);">display:</span> ' + computedStyles.display + '</div>';
            html += '<div><span style="color:var(--text-muted);">position:</span> ' + computedStyles.position + '</div>';
            if (computedStyles.display && computedStyles.display.includes('flex')) {
              html += '<div><span style="color:var(--text-muted);">flex-dir:</span> ' + computedStyles.flexDirection + '</div>';
              html += '<div><span style="color:var(--text-muted);">gap:</span> ' + computedStyles.gap + '</div>';
            }
            html += '<div><span style="color:var(--text-muted);">color:</span> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + computedStyles.color + '; margin-right:4px;"></span>' + computedStyles.color + '</div>';
            html += '</div>';
            html += '</details>';
          }

          if (ctx.source && ctx.source.code) {
            html += '<details class="cp-section" open>';
            html += '<summary class="cp-section-title" style="display:flex; justify-content:space-between; align-items:center;">';
            html += '<span>Component Source</span>';
            html += '<button class="cp-btn-bento" id="cp-toggle-source-editor" style="font-size:10.5px; padding:2px 8px; border-radius:4px; margin-left:auto; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source</button>';
            html += '</summary>';
            html += '<div id="cp-source-preview-box">';
            html += '<div class="cp-code" id="cp-source-code-display">' + escapeHtml(ctx.source.code) + '</div>';
            html += '</div>';
            html += '<div id="cp-source-editor-box" style="display:none; margin-top:8px;">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:11px; font-family:var(--font-mono); color:var(--text-muted);">';
            html += '<span>' + ctx.source.file.split('/').pop() + ' (L' + ctx.source.startLine + '-L' + ctx.source.endLine + ')</span>';
            html += '<span style="color:var(--text-secondary); font-weight:500;">Direct Disk Edit</span>';
            html += '</div>';
            html += '<textarea id="cp-source-code-editor" spellcheck="false"></textarea>';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:8px;">';
            html += '<div style="display:flex; gap:6px;">';
            html += '<button class="cp-btn-bento primary" id="cp-source-save-btn" style="padding:5px 12px; font-size:11px; display:inline-flex; align-items:center; gap:5px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd></button>';
            html += '<button class="cp-btn-bento" id="cp-source-undo-btn" style="padding:5px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Undo</button>';
            html += '</div>';
            html += '<button class="cp-btn-bento" id="cp-source-cancel-btn" style="padding:5px 8px; font-size:11px;">Close</button>';
            html += '</div>';
            html += '<div id="cp-source-save-status" style="font-size:11px; font-family:var(--font-mono); margin-top:6px; min-height:16px;"></div>';
            html += '</div>';
            html += '</details>';
          }

          flyoutContent.innerHTML = html;

          const noteCard = shadow.getElementById('cp-inspector-attached-note');
          if (noteCard && attachedNote) {
            noteCard.onclick = () => {
              openNotePopover({ element: selectedTarget?.element, name: ctx.component?.name || infoName }, attachedNote);
            };
          }

          // Wire up in-flyout Component Source Editor
          const toggleEditorBtn = shadow.getElementById('cp-toggle-source-editor');
          const previewBox = shadow.getElementById('cp-source-preview-box');
          const editorBox = shadow.getElementById('cp-source-editor-box');
          const codeTextarea = shadow.getElementById('cp-source-code-editor');
          const saveSourceBtn = shadow.getElementById('cp-source-save-btn');
          const undoSourceBtn = shadow.getElementById('cp-source-undo-btn');
          const cancelSourceBtn = shadow.getElementById('cp-source-cancel-btn');
          const saveStatus = shadow.getElementById('cp-source-save-status');

          if (toggleEditorBtn && previewBox && editorBox && codeTextarea) {
            toggleEditorBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const isEditing = editorBox.style.display !== 'none';
              if (isEditing) {
                editorBox.style.display = 'none';
                previewBox.style.display = 'block';
                toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source';
              } else {
                codeTextarea.value = ctx.source.code;
                editorBox.style.display = 'block';
                previewBox.style.display = 'none';
                toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview';
                if (saveStatus) saveStatus.textContent = '';
                setTimeout(() => codeTextarea.focus(), 50);
              }
            };

            if (cancelSourceBtn) {
              cancelSourceBtn.onclick = (e) => {
                e.preventDefault();
                editorBox.style.display = 'none';
                previewBox.style.display = 'block';
                toggleEditorBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Source';
              };
            }

            const handleSaveSource = async () => {
              if (!saveSourceBtn || saveSourceBtn.disabled) return;
              const newSource = codeTextarea.value;
              saveSourceBtn.disabled = true;
              saveSourceBtn.innerHTML = 'Saving...';
              if (saveStatus) {
                saveStatus.style.color = 'var(--text-primary)';
                saveStatus.textContent = 'Writing to disk & compiling...';
              }

              try {
                const res = await fetch(BRIDGE + '/api/save-source', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    file: ctx.source.file,
                    component: infoName,
                    newSource: newSource,
                    startLine: ctx.source.startLine,
                    endLine: ctx.source.endLine,
                  }),
                });
                const data = await res.json();
                saveSourceBtn.disabled = false;
                saveSourceBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd>';

                if (data.success) {
                  ctx.source.code = newSource;
                  const displayEl = shadow.getElementById('cp-source-code-display');
                  if (displayEl) displayEl.textContent = newSource;
                  if (saveStatus) {
                    saveStatus.style.color = '#34d399';
                    saveStatus.textContent = 'Saved to disk & HMR reloaded!';
                  }
                  showCallout(infoName + ' saved to disk — HMR reloaded', 'SOURCE');
                } else {
                  if (saveStatus) {
                    saveStatus.style.color = '#fb7185';
                    saveStatus.textContent = 'Syntax error: ' + (data.error || 'Failed to save');
                  }
                  showCallout('Save failed: ' + (data.error || 'Syntax error'), 'WARNING');
                }
              } catch (err) {
                saveSourceBtn.disabled = false;
                saveSourceBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Component <kbd style="opacity:0.6; font-size:9px; background:rgba(255,255,255,0.15); padding:1px 3px; border-radius:2px;">Cmd+S</kbd>';
                if (saveStatus) {
                  saveStatus.style.color = '#fb7185';
                  saveStatus.textContent = 'Error: ' + err.message;
                }
              }
            };

            if (saveSourceBtn) {
              saveSourceBtn.onclick = (e) => {
                e.preventDefault();
                handleSaveSource();
              };
            }

            // Keyboard shortcut Cmd+S / Ctrl+S inside textarea
            codeTextarea.addEventListener('keydown', (e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                e.stopPropagation();
                handleSaveSource();
              }
              // Tab key indents by 2 spaces
              if (e.key === 'Tab') {
                e.preventDefault();
                const start = codeTextarea.selectionStart;
                const end = codeTextarea.selectionEnd;
                codeTextarea.value = codeTextarea.value.substring(0, start) + '  ' + codeTextarea.value.substring(end);
                codeTextarea.selectionStart = codeTextarea.selectionEnd = start + 2;
              }
            });

            if (undoSourceBtn) {
              undoSourceBtn.onclick = async (e) => {
                e.preventDefault();
                undoSourceBtn.disabled = true;
                if (saveStatus) {
                  saveStatus.style.color = 'var(--text-primary)';
                  saveStatus.textContent = 'Reverting...';
                }
                try {
                  const res = await fetch(BRIDGE + '/api/source-undo', { method: 'POST' });
                  const data = await res.json();
                  undoSourceBtn.disabled = false;
                  if (data.success) {
                    if (saveStatus) {
                      saveStatus.style.color = '#34d399';
                      saveStatus.textContent = data.description || 'Reverted';
                    }
                    showCallout(data.description || 'Reverted change', 'UNDO');
                    // Reload component context to refresh source snippet
                    loadComponentContext(infoName, resolved, computedStyles);
                  } else {
                    if (saveStatus) {
                      saveStatus.style.color = '#fb7185';
                      saveStatus.textContent = data.error || 'Nothing to undo';
                    }
                  }
                } catch (err) {
                  undoSourceBtn.disabled = false;
                  if (saveStatus) {
                    saveStatus.style.color = '#fb7185';
                    saveStatus.textContent = 'Undo error: ' + err.message;
                  }
                }
              };
            }
          }
        } catch(err) {
          flyoutContent.innerHTML = '<p style="color:#fb7185;">Failed to load context: ' + err.message + '</p>';
        }
      }

      async function resolveComponent(info) {
        if (info.source && info.source.fileName) {
          const fn = info.source.fileName.split('/').pop().replace(/\.[jt]sx?$/, '');
          if (fn.toLowerCase() === info.name.toLowerCase()) {
            return { file: info.source.fileName, line: info.source.lineNumber };
          }
        }
        try {
          // Send ancestor names so bridge can prefer the right file
          const ancestorNames = currentStack.map(c => c.name).filter(n => n !== info.name);
          const res = await fetch(BRIDGE + '/api/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ componentName: info.name, ancestors: ancestorNames })
          });
          const data = await res.json();
          if (data.resolved) return { file: data.file, line: data.line };
        } catch(e) {}
        return null;
      }

      function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      function formatContextForAiPrompt(ctx, stack, customTask) {
        const bt = String.fromCharCode(96);
        const nl = String.fromCharCode(10);
        const compName = ctx.component && ctx.component.name ? '<' + ctx.component.name + ' />' : 'Target Component';
        let text = '### Component Task: ' + compName + nl;
        if (ctx.source && ctx.source.file) {
          text += '- **Location**: ' + bt + ctx.source.file + (ctx.source.startLine ? ':' + ctx.source.startLine + '-' + ctx.source.endLine : '') + bt + nl;
        }
        if (stack && stack.length > 0) {
          const pathStr = stack.map(function(s) { return s.name; }).reverse().join(' › ');
          text += '- **Hierarchy**: ' + pathStr + nl;
        }
        if (customTask && customTask.trim()) {
          text += nl + '#### Objective' + nl + '> ' + customTask.trim() + nl;
        }
        if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
          const propSummary = ctx.interface.props.map(function(p) { return p.name + ': ' + p.type + (p.required ? ' (req)' : ''); }).join(', ');
          text += '- **Props**: ' + propSummary + nl;
        }
        if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
          text += '- **Hooks**: ' + ctx.interface.hooks.join(', ') + nl;
        }
        if (typeof comments !== 'undefined' && comments && comments.length > 0) {
          const relComments = comments.filter(c => (ctx.component && c.component === ctx.component.name) || (ctx.source && c.file === ctx.source.file));
          if (relComments.length > 0) {
            text += nl + '#### Active Notes & Feedback' + nl;
            relComments.forEach(c => {
              text += '- ' + (c.resolved ? '[RESOLVED] ' : '') + c.text + nl;
            });
          }
        }
        if (ctx.source && ctx.source.code) {
          text += nl + '#### Source Code' + nl + bt+bt+bt + 'tsx' + nl + ctx.source.code + nl + bt+bt+bt + nl;
        }
        text += nl + '> Token Budget: ~' + (ctx.tokens && ctx.tokens.current ? ctx.tokens.current : '150') + ' tokens' + nl;
        return text;
      }

      function formatDomElementPrompt(target, computedStyles, stack, customTask) {
        const bt = String.fromCharCode(96);
        const nl = String.fromCharCode(10);
        const el = target?.element || selectedElement;
        const tag = el ? el.tagName.toLowerCase() : 'element';
        const classes = el && el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
        const selector = (typeof buildCSSSelector === 'function' && el) ? buildCSSSelector(el) : tag + classes;

        let text = '### UI Element Task: <' + tag + classes + ' />' + nl;
        text += '- **Selector**: ' + bt + selector + bt + nl;
        if (stack && stack.length > 0) {
          const pathStr = stack.map(function(s) { return s.name; }).reverse().join(' › ');
          text += '- **Hierarchy**: ' + pathStr + nl;
        }
        if (customTask && customTask.trim()) {
          text += nl + '#### Objective' + nl + '> ' + customTask.trim() + nl;
        }
        if (computedStyles) {
          text += nl + '#### Computed Styles & Box Model' + nl;
          if (computedStyles.boundingBox) {
            text += '- **Dimensions**: ' + Math.round(computedStyles.boundingBox.width) + 'px × ' + Math.round(computedStyles.boundingBox.height) + 'px (at x: ' + Math.round(computedStyles.boundingBox.left) + ', y: ' + Math.round(computedStyles.boundingBox.top) + ')' + nl;
          }
          text += '- **Layout**: display: ' + (computedStyles.display || 'block') + ' | position: ' + (computedStyles.position || 'static') + nl;
          text += '- **Colors**: color: ' + (computedStyles.color || 'inherit') + ' | bg: ' + (computedStyles.backgroundColor || 'transparent') + nl;
          text += '- **Typography**: ' + (computedStyles.fontSize || '14px') + ' line-height: ' + (computedStyles.lineHeight || 'normal') + nl;
        }
        if (typeof comments !== 'undefined' && comments && comments.length > 0) {
          const relComments = comments.filter(c => c.selector === selector || (c.component && target && c.component === target.name));
          if (relComments.length > 0) {
            text += nl + '#### Active Notes & Feedback' + nl;
            relComments.forEach(c => {
              text += '- ' + (c.resolved ? '[RESOLVED] ' : '') + c.text + nl;
            });
          }
        }
        return text;
      }

      function formatContextForClipboard(ctx) {
        const bt = String.fromCharCode(96);
        const nl = String.fromCharCode(10);
        let text = '## ' + ctx.component.name + nl;
        text += '**Source**: ' + bt + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + bt + nl + nl;
        if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
          text += '### Props' + nl;
          ctx.interface.props.forEach(function(p) { text += '- ' + p.name + ': ' + p.type + (p.required ? ' (required)' : '') + nl; });
          text += nl;
        }
        if (ctx.source.code) {
          text += '### Source Code' + nl + bt+bt+bt + 'tsx' + nl + ctx.source.code + nl + bt+bt+bt + nl;
        }
        if (ctx.imports) {
          text += '### Imports' + nl;
          ctx.imports.forEach(function(imp) { text += '- ' + imp.name + ' from ' + imp.source + nl; });
        }
        text += nl + '**Tokens**: ' + ctx.tokens.current + nl;
        return text;
      }

      async function refreshState() {
        try {
          const resPins = await fetch(BRIDGE + '/api/pins');
          const dataPins = await resPins.json();
          currentPins = dataPins.pins || [];
          const count = currentPins.length;
          shadow.getElementById('cp-pin-count').textContent = count;

          if (count > 0) {
            dockPinBadge.style.display = 'inline-flex';
            dockPinBadge.textContent = count;
          } else {
            dockPinBadge.style.display = 'none';
          }

          const list = shadow.getElementById('cp-pin-list');
          list.innerHTML = '';
          if (dataPins.pins && dataPins.pins.length > 0) {
            dataPins.pins.forEach(function(pin, index) {
              const card = document.createElement('div');
              card.className = 'cp-pin-card';
              const name = pin.context ? pin.context.component.name : pin.id;
              const file = pin.context ? pin.context.source.file.split('/').pop() : '';
              
              const isPinFrozen = frozenEntries.some(f => (pin.context && f.file === pin.context.source.file) || f.id === pin.id);
              const lockIcon = isPinFrozen ? '<span style="color:#fb7185; margin-right:4px;">' + ICONS.lock + '</span>' : '';
              
              card.innerHTML =
                '<div class="cp-pin-header">' +
                  '<div class="cp-pin-title">' +
                    '<span class="cp-pin-badge">#' + (index + 1) + '</span>' +
                    '<span>' + lockIcon + '&lt;' + name + ' /&gt;</span>' +
                    '<span class="cp-pin-file">' + file + '</span>' +
                  '</div>' +
                  '<button class="cp-pin-remove" data-id="' + pin.id + '" title="Remove pin">' + ICONS.x + '</button>' +
                '</div>' +
                '<textarea class="cp-pin-textarea" rows="2" placeholder="Task for this component..." data-id="' + pin.id + '">' + (pin.task || '') + '</textarea>';
              list.appendChild(card);
            });

            // Listen for changes/blur on task textareas to update-task
            const textareas = list.querySelectorAll('.cp-pin-textarea');
            textareas.forEach(ta => {
              const saveTask = async () => {
                const id = ta.getAttribute('data-id');
                const p = dataPins.pins.find(x => x.id === id);
                if (p && p.task !== ta.value) {
                  p.task = ta.value;
                  await fetch(BRIDGE + '/api/pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update-task', id, task: ta.value })
                  });
                }
              };
              ta.addEventListener('change', saveTask);
              ta.addEventListener('blur', saveTask);
            });

            const removeBtns = list.querySelectorAll('.cp-pin-remove');
            removeBtns.forEach(btn => {
              btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const p = dataPins.pins.find(x => x.id === id);
                if (p) {
                  await fetch(BRIDGE + '/api/pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'remove', file: p.context.source.file, id })
                  });
                  refreshState();
                }
              };
            });
          } else {
            list.innerHTML = '<div style="font-size:11px; color:var(--text-muted); font-style:italic; padding:6px 0;">No pinned components. Click "Pin Component Task" on any component to stage changes.</div>';
          }

          const savingsDiv = shadow.getElementById('cp-token-savings');
          if (dataPins.pins && dataPins.pins.length > 0 && dataPins.totalTokens) {
            const levelSelect = shadow.getElementById('cp-context-level');
            const level = levelSelect.value;
            const cost = dataPins.totalTokens[level] || dataPins.totalTokens.current;
            
            savingsDiv.style.display = 'block';
            savingsDiv.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Stack: ' + cost.toLocaleString() + ' tokens (' + dataPins.pins.length + ' pinned)';
          } else {
            savingsDiv.style.display = 'none';
          }
        } catch(e) { }
      }

      function refreshPins() {
        refreshState();
      }

      if (ws) {
        ws.onmessage = (msg) => {
          try {
            const payload = JSON.parse(msg.data);
            if (payload.type === 'state-update') {
              frozenEntries = payload.data.frozenEntries || [];
              if (payload.data.updateAvailable) {
                handleUpdateAvailable(payload.data.updateAvailable);
              }
              if (payload.data.comments) {
                comments = payload.data.comments;
                renderCommentMarkers();
                renderSidebarNotes();
              }
              refreshState();
            } else if (payload.type === 'update-available') {
              handleUpdateAvailable(payload.data);
            } else if (payload.type === 'pins-update') {
              refreshState();
            } else if (payload.type === 'presence.updated') {
              connectedAgents = payload.data?.agents || [];
            } else if (payload.type === 'task.updated') {
              const task = payload.data;
              if (task) {
                if (task.status === 'delivered') {
                  showCallout('Seen by ' + (task.claimedBy || 'agent'), 'INFO', 2000);
                } else if (task.status === 'in_progress') {
                  showCallout('Working…', 'WORKING', 2500);
                } else if (task.status === 'done') {
                  const files = task.result?.filesChanged?.length ? task.result.filesChanged.length + ' files' : 'complete';
                  showCallout('Done · ' + files, 'SUCCESS', 3000);
                } else if (task.status === 'failed') {
                  showCallout('Failed: ' + (task.result?.error || 'error'), 'ERROR', 3000);
                }
              }
            } else if (payload.type === 'source-updated') {
              showCallout('Source updated: ' + (payload.data.file ? payload.data.file.split('/').pop() : 'file'), 'HMR');
            } else if (payload.type === 'source-reverted') {
              showCallout('Source reverted: ' + (payload.data.description || 'change'), 'UNDO');
            } else if (payload.type === 'capture-screenshot') {
              const { requestId, file, component, label, componentId } = payload.data;
              const el = findComponentElement(component);
              if (!el) {
                fetch(BRIDGE + '/api/screenshot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: componentId, label: label, dataUrl: 'data:image/png;base64,', requestId: requestId })
                }).catch(e => console.error(e));
                return;
              }
              
              captureElement(el).then(async (dataUrl) => {
                if (!dataUrl) {
                  fetch(BRIDGE + '/api/screenshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: componentId, label: label, dataUrl: 'data:image/png;base64,', requestId: requestId })
                  }).catch(e => console.error(e));
                  return;
                }
                
                const rect = el.getBoundingClientRect();
                const postBody = {
                  id: componentId,
                  label: label,
                  dataUrl: dataUrl,
                  boundingBox: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                  viewport: { width: window.innerWidth, height: window.innerHeight },
                  requestId: requestId
                };
                
                fetch(BRIDGE + '/api/screenshot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(postBody)
                }).catch(e => console.error(e));
              });
            } else if (payload.type === 'list-components') {
              // Walk React fiber tree to collect visible components
              const { requestId, filter, limit, includeLibrary } = payload.data || {};
              const maxCount = limit || 50;
              const filterLower = (filter || '').toLowerCase();
              const allComponents = [];

              function walkFiber(fiber, depth) {
                if (!fiber || allComponents.length >= maxCount * 2) return;
                if (fiber.tag === 0 || fiber.tag === 1 || fiber.tag === 11 || fiber.tag === 15) {
                  const name = fiber.type?.displayName || fiber.type?.name || '';
                  if (name && name !== 'Fragment') {
                    // Skip library components unless explicitly included
                    const source = fiber._debugSource;
                    const fileName = source?.fileName || '';
                    if (!includeLibrary && fileName.includes('node_modules')) {
                      // skip
                    } else if (!filterLower || name.toLowerCase().includes(filterLower)) {
                      // Get bounding rect from DOM
                      let domNode = null;
                      try {
                        let n = fiber;
                        while (n) {
                          if (n.stateNode && n.stateNode instanceof HTMLElement) { domNode = n.stateNode; break; }
                          n = n.child;
                        }
                      } catch (_) {}
                      const rect = domNode?.getBoundingClientRect?.() || null;
                      allComponents.push({
                        name,
                        file: fileName || undefined,
                        line: source?.lineNumber || undefined,
                        visible: rect ? (rect.width > 0 && rect.height > 0) : undefined,
                        bounds: rect ? { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) } : undefined,
                      });
                    }
                  }
                }
                if (fiber.child) walkFiber(fiber.child, depth + 1);
                if (fiber.sibling) walkFiber(fiber.sibling, depth);
              }

              // Find React root fiber
              const rootEl = document.getElementById('root') || document.getElementById('app') || document.getElementById('__next') || document.querySelector('[data-reactroot]');
              let rootFiber = null;
              if (rootEl) {
                const containerKey = Object.keys(rootEl).find(k => k.startsWith('__reactContainer'));
                if (containerKey) {
                  const container = rootEl[containerKey];
                  rootFiber = container?.stateNode?.current?.child || container?.current?.child || container?.child;
                }
                if (!rootFiber && rootEl.firstElementChild) {
                  rootFiber = getFiberNode(rootEl.firstElementChild);
                  while (rootFiber?.return) rootFiber = rootFiber.return;
                }
                if (!rootFiber) {
                  const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
                  if (fiberKey) {
                    rootFiber = rootEl[fiberKey];
                    while (rootFiber?.return) rootFiber = rootFiber.return;
                  }
                }
              }
              if (rootFiber) {
                walkFiber(rootFiber, 0);
              }

              const truncated = allComponents.length > maxCount;
              const result = {
                components: allComponents.slice(0, maxCount),
                total: allComponents.length,
                truncated,
              };

              if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'component-list-response', requestId, data: result }));
              }
            }
          } catch(e) {}
        };
      }

      // MCP status polling: check every 10s
      let mcpStatusInterval = null;
      function pollMcpStatus() {
        fetch(BRIDGE + '/api/mcp-status')
          .then(r => r.json())
          .then(d => {
            const dot = shadow.getElementById('cp-mcp-dot');
            const label = shadow.getElementById('cp-mcp-status-label');
            if (dot) {
              if (d.connected) {
                dot.classList.add('connected');
                dot.title = 'MCP: Connected';
              } else {
                dot.classList.remove('connected');
                dot.title = 'MCP: Not connected';
              }
            }
            if (label) {
              label.textContent = d.connected ? 'Connected' : 'Not connected';
              label.style.color = d.connected ? 'var(--accent-emerald, #10b981)' : 'var(--text-muted)';
            }
          })
          .catch(() => {
            const dot = shadow.getElementById('cp-mcp-dot');
            const label = shadow.getElementById('cp-mcp-status-label');
            if (dot) { dot.classList.remove('connected'); dot.title = 'MCP: Not connected'; }
            if (label) { label.textContent = 'Not connected'; label.style.color = 'var(--text-muted)'; }
          });
      }
      pollMcpStatus();
      mcpStatusInterval = setInterval(pollMcpStatus, 10000);

      fetch(BRIDGE + '/api/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' })
      })
      .then(r => r.json())
      .then(d => {
        if (d.frozenEntries) frozenEntries = d.frozenEntries;
        refreshState();
      })
      .catch(e => refreshState());
      window.addEventListener('scroll', () => {
        if (typeof updateSelectionFrame === 'function') updateSelectionFrame();
        if (typeof renderCommentMarkers === 'function') renderCommentMarkers();
      }, { passive: true });
      window.addEventListener('resize', () => {
        if (typeof updateSelectionFrame === 'function') updateSelectionFrame();
        if (typeof renderCommentMarkers === 'function') renderCommentMarkers();
      }, { passive: true });

      loadComments();

      console.log('[agent-hover] Ready');
}

if (typeof window !== 'undefined') {
  (window as any).__AGENT_HOVER_BOOTSTRAP__ = (port: number, editor?: string, token?: string) => {
    bootstrapOverlay({ port, editor, token });
  };
}
