import type { Plugin } from 'vite';
import { BridgeServer } from './bridge-server.js';

export interface ComponentPointerOptions {
  /** Port for the bridge server. Default: 9850 */
  port?: number;
  /** Whether to automatically open in editor on Alt+Shift+Click. Default: true */
  openInEditor?: boolean;
  /** Editor to open files in. Default: 'vscode' */
  editor?: 'vscode' | 'cursor' | 'webstorm' | 'zed';
}

function generateOverlayBootstrap(port: number, editor: string): string {
  return `
    (() => {
      const BRIDGE = 'http://localhost:${port}';
      let ws;
      try {
        ws = new WebSocket('ws://localhost:${port}');
        ws.onopen = () => console.log('[component-pointer] ✓ Connected to bridge');
        ws.onerror = () => console.warn('[component-pointer] WebSocket connection failed');
      } catch(e) {
        console.warn('[component-pointer] Could not connect WebSocket');
      }

      let isPointerMode = false;
      let currentElement = null;
      let currentComponentInfo = null;

      // --- Shadow DOM UI ---
      const container = document.createElement('div');
      container.id = 'component-pointer-root';
      const shadow = container.attachShadow({ mode: 'open' });

      shadow.innerHTML = \`
        <style>
          * { box-sizing: border-box; }
          :host { all: initial; }

          #cp-highlight {
            position: fixed;
            pointer-events: none;
            z-index: 999998;
            border: 2px solid #6366f1;
            background: rgba(99, 102, 241, 0.08);
            border-radius: 4px;
            display: none;
            transition: all 0.1s ease;
          }
          #cp-label {
            position: absolute;
            top: -26px;
            left: -2px;
            background: #6366f1;
            color: white;
            font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 4px 4px 0 0;
            white-space: nowrap;
            line-height: 1.4;
          }

          #cp-status {
            position: fixed;
            bottom: 16px;
            left: 16px;
            z-index: 999999;
            background: #1e1b4b;
            color: #c7d2fe;
            font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
            font-size: 12px;
            padding: 6px 12px;
            border-radius: 8px;
            display: none;
            border: 1px solid #4338ca;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }

          #cp-panel {
            position: fixed;
            right: 16px;
            top: 16px;
            width: 440px;
            max-height: calc(100vh - 32px);
            background: #0f172a;
            color: #e2e8f0;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            border-radius: 12px;
            z-index: 1000000;
            display: none;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            border: 1px solid #1e293b;
            overflow: hidden;
          }
          #cp-panel-header {
            padding: 14px 16px;
            background: #1e293b;
            border-bottom: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          #cp-panel-header h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #f8fafc;
          }
          #cp-panel-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            font-size: 13px;
            line-height: 1.5;
          }
          .cp-section { margin-bottom: 16px; }
          .cp-section-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #94a3b8;
            margin-bottom: 6px;
          }
          .cp-code {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 12px;
            font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre;
            max-height: 250px;
            overflow-y: auto;
            color: #e2e8f0;
            line-height: 1.5;
          }
          .cp-props-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          .cp-props-table th {
            text-align: left;
            padding: 4px 8px;
            color: #94a3b8;
            border-bottom: 1px solid #334155;
            font-weight: 500;
          }
          .cp-props-table td {
            padding: 4px 8px;
            border-bottom: 1px solid #1e293b;
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: 11px;
          }
          .cp-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 500;
          }
          .cp-badge-purple { background: #6366f1; color: white; }
          .cp-badge-green { background: #059669; color: white; }
          .cp-badge-gray { background: #334155; color: #94a3b8; }

          .cp-btn {
            background: #6366f1;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
          }
          .cp-btn:hover { background: #4f46e5; }
          .cp-btn-ghost {
            background: transparent;
            color: #94a3b8;
            border: 1px solid #334155;
          }
          .cp-btn-ghost:hover { background: #1e293b; color: #e2e8f0; }

          .cp-actions {
            display: flex;
            gap: 8px;
            padding: 12px 16px;
            background: #1e293b;
            border-top: 1px solid #334155;
          }

          #cp-pin-bar {
            padding: 10px 16px;
            background: #0f172a;
            border-top: 1px solid #334155;
            font-size: 12px;
          }
          #cp-pin-bar h4 {
            margin: 0 0 6px 0;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #94a3b8;
          }
          .cp-pin-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            color: #cbd5e1;
          }
          .cp-pin-remove {
            background: none;
            border: none;
            color: #ef4444;
            cursor: pointer;
            font-size: 14px;
            padding: 0 4px;
          }
        </style>

        <div id="cp-highlight"><div id="cp-label"></div></div>
        <div id="cp-status">⌥ Option — Pointer Mode Active</div>
        <div id="cp-panel">
          <div id="cp-panel-header">
            <h3 id="cp-panel-title">Context Lens</h3>
            <button class="cp-btn-ghost cp-btn" id="cp-close">✕</button>
          </div>
          <div id="cp-panel-content">Select a component...</div>
          <div class="cp-actions">
            <button class="cp-btn" id="cp-copy">📋 Copy Context</button>
            <button class="cp-btn cp-btn-ghost" id="cp-pin-btn">📌 Pin</button>
            <button class="cp-btn cp-btn-ghost" id="cp-editor-btn">Open in Editor</button>
          </div>
          <div id="cp-pin-bar">
            <h4>Pinned (<span id="cp-pin-count">0</span>)</h4>
            <div id="cp-pin-list"></div>
            <button class="cp-btn" id="cp-gen-task" style="width:100%; margin-top:8px;">Generate Task Context</button>
          </div>
        </div>
      \`;
      document.body.appendChild(container);

      const highlight = shadow.getElementById('cp-highlight');
      const label = shadow.getElementById('cp-label');
      const status = shadow.getElementById('cp-status');
      const panel = shadow.getElementById('cp-panel');
      const panelTitle = shadow.getElementById('cp-panel-title');
      const panelContent = shadow.getElementById('cp-panel-content');

      shadow.getElementById('cp-close').onclick = () => { panel.style.display = 'none'; };

      let lastCopiedContext = null;

      shadow.getElementById('cp-copy').onclick = async () => {
        if (lastCopiedContext) {
          const text = formatContextForClipboard(lastCopiedContext);
          await navigator.clipboard.writeText(text);
          shadow.getElementById('cp-copy').textContent = '✓ Copied!';
          setTimeout(() => shadow.getElementById('cp-copy').textContent = '📋 Copy Context', 1500);
        }
      };

      shadow.getElementById('cp-editor-btn').onclick = () => {
        if (lastCopiedContext && lastCopiedContext.source) {
          const scheme = '${editor}' === 'cursor' ? 'cursor' : 'vscode';
          const url = scheme + '://file/' + lastCopiedContext.source.absolutePath + ':' + lastCopiedContext.source.startLine;
          window.open(url, '_blank');
        }
      };

      shadow.getElementById('cp-pin-btn').onclick = async () => {
        if (lastCopiedContext) {
          await fetch(BRIDGE + '/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add',
              file: lastCopiedContext.source.file,
              line: lastCopiedContext.source.startLine
            })
          });
          refreshPins();
        }
      };

      shadow.getElementById('cp-gen-task').onclick = async () => {
        const instruction = prompt('Describe the task for your AI agent:');
        if (!instruction) return;
        try {
          const res = await fetch(BRIDGE + '/api/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction, level: 'standard' })
          });
          const data = await res.json();
          await navigator.clipboard.writeText(data.context || JSON.stringify(data, null, 2));
          alert('Task context copied to clipboard! (' + (data.tokenCost || '?') + ' tokens)');
        } catch(e) {
          alert('Failed to generate task context');
        }
      };

      // --- React 19 compatible fiber detection ---
      function getFiberNode(el) {
        if (!el) return null;
        for (const key in el) {
          if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
            return el[key];
          }
        }
        return null;
      }

      function getComponentInfo(el) {
        const fiber = getFiberNode(el);
        if (!fiber) return null;

        let curr = fiber;
        while (curr) {
          // React 19: check fiber.type for function components
          if (typeof curr.type === 'function') {
            const name = curr.type.displayName || curr.type.name;
            if (name && name !== 'Fragment' && !name.startsWith('_')) {
              // Also check for _debugSource (React < 19) as bonus
              const source = curr._debugSource || null;
              return { name, source, fiber: curr };
            }
          }
          // Also check forwardRef/memo wrappers
          if (curr.type && typeof curr.type === 'object') {
            const inner = curr.type.render || curr.type.type;
            if (typeof inner === 'function') {
              const name = inner.displayName || inner.name;
              if (name && !name.startsWith('_')) {
                return { name, source: curr._debugSource || null, fiber: curr };
              }
            }
          }
          curr = curr.return;
        }
        return null;
      }

      // --- Keyboard shortcuts ---
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Alt') {
          e.preventDefault();
          isPointerMode = true;
          status.style.display = 'block';
          console.log('[component-pointer] Pointer mode ON (hover over components)');
        }
        if (e.key === 'Escape') {
          panel.style.display = 'none';
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.key === 'Alt') {
          isPointerMode = false;
          status.style.display = 'none';
          highlight.style.display = 'none';
          currentComponentInfo = null;
        }
      });

      // --- Hover highlight ---
      window.addEventListener('mousemove', (e) => {
        if (!isPointerMode) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el === currentElement) return;

        // Don't highlight our own overlay
        if (el.closest && el.closest('#component-pointer-root')) return;
        currentElement = el;

        const info = getComponentInfo(el);
        if (info) {
          currentComponentInfo = info;
          const rect = el.getBoundingClientRect();
          highlight.style.display = 'block';
          highlight.style.top = rect.top + 'px';
          highlight.style.left = rect.left + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';

          if (info.source) {
            label.textContent = info.name + ' — ' + info.source.fileName.split('/').pop() + ':' + info.source.lineNumber;
          } else {
            label.textContent = info.name;
          }
        } else {
          highlight.style.display = 'none';
          currentComponentInfo = null;
        }
      });

      // --- Click to inspect ---
      window.addEventListener('click', async (e) => {
        if (!isPointerMode) return;
        e.preventDefault();
        e.stopPropagation();

        if (!currentComponentInfo) return;
        const info = currentComponentInfo;

        if (e.shiftKey) {
          // Shift+Click = Pin
          const resolved = await resolveComponent(info);
          if (resolved) {
            await fetch(BRIDGE + '/api/pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'add', file: resolved.file, line: resolved.line })
            });
            refreshPins();
          }
          return;
        }

        // Regular click = Open Context Lens
        panel.style.display = 'flex';
        panelTitle.textContent = info.name;
        panelContent.innerHTML = '<p style="color:#94a3b8;">Loading context...</p>';

        try {
          const resolved = await resolveComponent(info);
          if (!resolved) {
            panelContent.innerHTML = '<p style="color:#f87171;">Could not find source file for ' + info.name + '</p>';
            return;
          }

          const res = await fetch(BRIDGE + '/api/context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: resolved.file, line: resolved.line, level: 'standard' })
          });
          const ctx = await res.json();
          lastCopiedContext = ctx;

          let html = '';

          // Component identity
          html += '<div class="cp-section">';
          html += '<span class="cp-badge cp-badge-purple">' + ctx.component.type + '</span> ';
          html += '<span class="cp-badge cp-badge-green">' + ctx.component.exportType + ' export</span> ';
          html += '<span class="cp-badge cp-badge-gray">' + ctx.tokens.current + ' tokens</span>';
          html += '<div style="margin-top:6px; font-size:12px; color:#64748b;">' + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + '</div>';
          html += '</div>';

          // Props
          if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
            html += '<div class="cp-section">';
            html += '<div class="cp-section-title">Props</div>';
            html += '<table class="cp-props-table"><tr><th>Name</th><th>Type</th><th>Required</th></tr>';
            ctx.interface.props.forEach(function(p) {
              html += '<tr><td>' + p.name + '</td><td>' + p.type + '</td><td>' + (p.required ? '✓' : '—') + '</td></tr>';
            });
            html += '</table></div>';
          }

          // Hooks
          if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
            html += '<div class="cp-section">';
            html += '<div class="cp-section-title">Hooks</div>';
            html += '<div style="font-family:monospace; font-size:12px;">' + ctx.interface.hooks.join(', ') + '</div>';
            html += '</div>';
          }

          // Imports
          if (ctx.imports && ctx.imports.length > 0) {
            html += '<div class="cp-section">';
            html += '<div class="cp-section-title">Imports</div>';
            ctx.imports.forEach(function(imp) {
              const badge = imp.isLocal ? '<span class="cp-badge cp-badge-green" style="font-size:10px;">local</span>' : '<span class="cp-badge cp-badge-gray" style="font-size:10px;">ext</span>';
              html += '<div style="padding:2px 0;">' + badge + ' <span style="font-family:monospace;">' + imp.name + '</span> <span style="color:#64748b;">from ' + imp.source + '</span></div>';
            });
            html += '</div>';
          }

          // Source code
          if (ctx.source && ctx.source.code) {
            html += '<div class="cp-section">';
            html += '<div class="cp-section-title">Source Code</div>';
            html += '<div class="cp-code">' + escapeHtml(ctx.source.code) + '</div>';
            html += '</div>';
          }

          panelContent.innerHTML = html;
        } catch(err) {
          panelContent.innerHTML = '<p style="color:#f87171;">Failed to load context: ' + err.message + '</p>';
        }
      }, true);

      // --- Helpers ---

      async function resolveComponent(info) {
        // If we have _debugSource (React < 19), use it directly
        if (info.source) {
          return { file: info.source.fileName, line: info.source.lineNumber };
        }
        // Otherwise ask the bridge to resolve by component name
        try {
          const res = await fetch(BRIDGE + '/api/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ componentName: info.name })
          });
          const data = await res.json();
          if (data.resolved) return { file: data.file, line: data.line };
        } catch(e) {
          console.error('[component-pointer] Resolve failed:', e);
        }
        return null;
      }

      function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

      async function refreshPins() {
        try {
          const res = await fetch(BRIDGE + '/api/pins');
          const data = await res.json();
          shadow.getElementById('cp-pin-count').textContent = data.pins ? data.pins.length : 0;
          const list = shadow.getElementById('cp-pin-list');
          list.innerHTML = '';
          if (data.pins) {
            data.pins.forEach(function(pin) {
              const div = document.createElement('div');
              div.className = 'cp-pin-item';
              const name = pin.context ? pin.context.component.name : pin.id;
              const file = pin.context ? pin.context.source.file : '';
              div.innerHTML = '<span>' + name + ' <span style="color:#64748b;">' + file + '</span></span>' +
                '<button class="cp-pin-remove" data-id="' + pin.id + '">✕</button>';
              list.appendChild(div);
            });
          }
        } catch(e) {
          console.error('[component-pointer] Pin refresh failed:', e);
        }
      }

      if (ws) {
        ws.onmessage = (msg) => {
          try {
            const payload = JSON.parse(msg.data);
            if (payload.type === 'pins-update') refreshPins();
          } catch(e) {}
        };
      }

      refreshPins();
      console.log('[component-pointer] ✓ Overlay initialized. Hold ⌥ Option to enter pointer mode.');
    })();
  `;
}

export default function componentPointer(options?: ComponentPointerOptions): Plugin {
  const port = options?.port ?? 9850;
  const editor = options?.editor ?? 'vscode';
  let projectRoot: string;
  let bridgeServer: BridgeServer | null = null;
  
  return {
    name: 'component-pointer',
    apply: 'serve', // only in dev mode
    
    configResolved(config) {
      projectRoot = config.root;
    },
    
    configureServer(server) {
      // Start bridge server when Vite dev server starts
      bridgeServer = new BridgeServer(projectRoot, port);
      bridgeServer.start();
      
      // Clean up on server close
      server.httpServer?.on('close', () => {
        if (bridgeServer) {
          bridgeServer.stop();
        }
      });
    },
    
    transformIndexHtml() {
      // Inject the overlay script and element-source into the page
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: generateOverlayBootstrap(port, editor),
          injectTo: 'body',
        },
      ];
    },
  };
}
