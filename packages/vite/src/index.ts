import type { Plugin } from 'vite';
import { BridgeServer } from './bridge-server.js';

export interface ComponentPointerOptions {
  /** Port for the bridge server. Default: 9850 */
  port?: number;
  /** Whether to automatically open in editor on Alt+Shift+Click. Default: true */
  openInEditor?: boolean;
  /** Editor to open files in. Default: 'vscode' */
  editor?: 'vscode' | 'cursor' | 'webstorm' | 'zed' | 'windsurf' | 'antigravity';
}

function generateOverlayBootstrap(port: number, editor: string): string {
  return `
    (() => {
      const BRIDGE = 'http://localhost:${port}';
      let ws;
      try {
        ws = new WebSocket('ws://localhost:${port}');
        ws.onopen = () => console.log('[agent-hover] ✓ Connected to bridge');
        ws.onerror = () => console.warn('[agent-hover] WebSocket connection failed');
      } catch(e) {
        console.warn('[agent-hover] Could not connect WebSocket');
      }

      let isPointerMode = false;
      let currentElement = null;
      let currentComponentInfo = null;

      // --- Icons ---
      const ICONS = {
        target: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4 12H2"/><path d="M22 12h-2"/></svg>',
        copy: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        pin: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>',
        code: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        x: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>'
      };

      // --- Shadow DOM UI ---
      const container = document.createElement('div');
      container.id = 'agent-hover-root';
      const shadow = container.attachShadow({ mode: 'open' });

      shadow.innerHTML = \`
        <style>
          * { box-sizing: border-box; }
          :host { all: initial; }

          /* Glassmorphism Variables */
          :host {
            --bg-glass: rgba(15, 23, 42, 0.75);
            --bg-glass-solid: rgba(15, 23, 42, 0.95);
            --border-glass: rgba(255, 255, 255, 0.1);
            --blur: blur(12px);
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --text: #f8fafc;
            --text-muted: #94a3b8;
          }

          /* Floating Toggle Button */
          #cp-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 48px;
            height: 48px;
            border-radius: 24px;
            background: var(--bg-glass);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            border: 1px solid var(--border-glass);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          #cp-fab:hover {
            transform: scale(1.05);
            background: var(--bg-glass-solid);
          }
          #cp-fab.active {
            background: var(--primary);
            border-color: var(--primary);
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
          }
          #cp-fab svg {
            transition: transform 0.3s ease;
          }
          #cp-fab.active svg {
            transform: rotate(90deg);
          }

          #cp-highlight {
            position: fixed;
            pointer-events: none;
            z-index: 999998;
            border: 2px solid var(--primary);
            background: rgba(99, 102, 241, 0.1);
            border-radius: 6px;
            display: none;
            transition: all 0.1s ease;
          }
          #cp-label {
            position: absolute;
            top: -28px;
            left: -2px;
            background: var(--primary);
            color: white;
            font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 6px;
            white-space: nowrap;
            line-height: 1.4;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-weight: 500;
          }

          #cp-panel {
            position: fixed;
            right: 24px;
            bottom: 84px;
            width: 420px;
            max-height: calc(100vh - 120px);
            background: var(--bg-glass);
            backdrop-filter: var(--blur);
            -webkit-backdrop-filter: var(--blur);
            color: var(--text);
            box-shadow: 0 12px 40px rgba(0,0,0,0.4);
            border-radius: 16px;
            z-index: 1000000;
            display: none;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            border: 1px solid var(--border-glass);
            overflow: hidden;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }

          #cp-panel-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-glass);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(15, 23, 42, 0.4);
          }
          #cp-panel-header h3 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: -0.01em;
          }
          #cp-panel-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            font-size: 13px;
            line-height: 1.6;
          }
          
          /* Custom scrollbar */
          #cp-panel-content::-webkit-scrollbar { width: 6px; }
          #cp-panel-content::-webkit-scrollbar-track { background: transparent; }
          #cp-panel-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

          .cp-section { margin-bottom: 20px; }
          .cp-section:last-child { margin-bottom: 0; }
          .cp-section-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: var(--text-muted);
            margin-bottom: 8px;
          }
          .cp-code {
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border-glass);
            border-radius: 8px;
            padding: 12px;
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre;
            max-height: 250px;
            overflow-y: auto;
            line-height: 1.5;
          }
          
          .cp-props-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .cp-props-table th {
            text-align: left; padding: 6px 8px; color: var(--text-muted);
            border-bottom: 1px solid var(--border-glass); font-weight: 500;
          }
          .cp-props-table td {
            padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
            font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px;
          }

          .cp-badge {
            display: inline-block; padding: 3px 10px; border-radius: 999px;
            font-size: 11px; font-weight: 600; letter-spacing: 0.2px;
          }
          .cp-badge-purple { background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); }
          .cp-badge-green { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
          .cp-badge-gray { background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); }

          .cp-btn {
            background: var(--primary); color: white; border: none;
            padding: 8px 16px; border-radius: 8px; cursor: pointer;
            font-size: 13px; font-weight: 500; display: inline-flex;
            align-items: center; justify-content: center; gap: 6px;
            transition: all 0.2s ease;
          }
          .cp-btn:hover { background: var(--primary-hover); }
          .cp-btn-ghost { background: transparent; border: 1px solid var(--border-glass); color: var(--text); }
          .cp-btn-ghost:hover { background: rgba(255,255,255,0.1); }
          .cp-btn-icon { padding: 6px; border-radius: 6px; }

          .cp-actions {
            display: flex; gap: 8px; padding: 16px 20px;
            background: rgba(15, 23, 42, 0.6); border-top: 1px solid var(--border-glass);
          }

          #cp-pin-bar {
            padding: 16px 20px; background: rgba(0, 0, 0, 0.2);
            border-top: 1px solid var(--border-glass); font-size: 12px;
          }
          #cp-pin-bar h4 { margin: 0 0 10px 0; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
          .cp-pin-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 6px 8px; margin: 0 -8px; border-radius: 6px; color: #e2e8f0;
          }
          .cp-pin-item:hover { background: rgba(255,255,255,0.05); }
          .cp-pin-remove { background: none; border: none; color: #f87171; cursor: pointer; padding: 4px; opacity: 0.7; }
          .cp-pin-remove:hover { opacity: 1; }
        </style>

        <div id="cp-fab" title="Toggle Agent Hover (Alt)">
          \${ICONS.target}
        </div>
        
        <div id="cp-highlight"><div id="cp-label"></div></div>
        
        <div id="cp-panel">
          <div id="cp-panel-header">
            <h3 id="cp-panel-title">Context Lens</h3>
            <button class="cp-btn-ghost cp-btn-icon" id="cp-close" style="border:none;">\${ICONS.x}</button>
          </div>
          <div id="cp-panel-content">Select a component...</div>
          <div class="cp-actions">
            <button class="cp-btn" id="cp-copy">\${ICONS.copy} Copy Context</button>
            <button class="cp-btn cp-btn-ghost" id="cp-pin-btn">\${ICONS.pin} Pin</button>
            <button class="cp-btn cp-btn-ghost" id="cp-editor-btn">\${ICONS.code} Open</button>
          </div>
          <div id="cp-pin-bar">
            <h4>Pinned (<span id="cp-pin-count">0</span>)</h4>
            <div id="cp-pin-list"></div>
            <button class="cp-btn" id="cp-gen-task" style="width:100%; margin-top:12px;">Generate Task Context</button>
          </div>
        </div>
      \`;
      document.body.appendChild(container);

      const fab = shadow.getElementById('cp-fab');
      const highlight = shadow.getElementById('cp-highlight');
      const label = shadow.getElementById('cp-label');
      const panel = shadow.getElementById('cp-panel');
      const panelTitle = shadow.getElementById('cp-panel-title');
      const panelContent = shadow.getElementById('cp-panel-content');

      // Toggle functionality
      function togglePointerMode() {
        isPointerMode = !isPointerMode;
        if (isPointerMode) {
          fab.classList.add('active');
          console.log('[agent-hover] Pointer mode ON');
        } else {
          fab.classList.remove('active');
          highlight.style.display = 'none';
          currentComponentInfo = null;
        }
      }

      fab.onclick = togglePointerMode;

      shadow.getElementById('cp-close').onclick = () => { panel.style.display = 'none'; };

      let lastCopiedContext = null;

      shadow.getElementById('cp-copy').onclick = async () => {
        if (lastCopiedContext) {
          const text = formatContextForClipboard(lastCopiedContext);
          await navigator.clipboard.writeText(text);
          const btn = shadow.getElementById('cp-copy');
          btn.innerHTML = '✓ Copied!';
          setTimeout(() => btn.innerHTML = ICONS.copy + ' Copy Context', 1500);
        }
      };

      shadow.getElementById('cp-editor-btn').onclick = async () => {
        if (lastCopiedContext && lastCopiedContext.source) {
          try {
            await fetch(BRIDGE + '/api/open-editor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file: lastCopiedContext.source.absolutePath,
                line: lastCopiedContext.source.startLine,
                editor: '${editor}'
              })
            });
          } catch(e) {
            console.error('[agent-hover] Failed to open editor:', e);
          }
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
          if (typeof curr.type === 'function') {
            const name = curr.type.displayName || curr.type.name;
            if (name && name !== 'Fragment' && !name.startsWith('_')) {
              const source = curr._debugSource || null;
              return { name, source, fiber: curr };
            }
          }
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
        if (e.key === 'Alt' && !isPointerMode) {
          e.preventDefault();
          togglePointerMode();
        }
        if (e.key === 'Escape') {
          panel.style.display = 'none';
        }
      });

      // Optionally keeping keyup to disable pointer mode might conflict with the toggle button
      // To make it purely toggle, we remove the keyup logic, or only trigger if it was enabled via keydown
      // The user requested a toggle button instead of just the ALT key, so a pure toggle works best.

      // --- Hover highlight ---
      window.addEventListener('mousemove', (e) => {
        if (!isPointerMode) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el === currentElement) return;

        if (el.closest && el.closest('#agent-hover-root')) return;
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
        
        // Don't intercept clicks on our own UI
        if (e.target && e.target.closest && e.target.closest('#agent-hover-root')) return;
        
        e.preventDefault();
        e.stopPropagation();

        if (!currentComponentInfo) return;
        const info = currentComponentInfo;

        if (e.shiftKey) {
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

        panel.style.display = 'flex';
        panelTitle.textContent = info.name;
        panelContent.innerHTML = '<p style="color:var(--text-muted);">Loading context...</p>';

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

          html += '<div class="cp-section">';
          html += '<span class="cp-badge cp-badge-purple">' + ctx.component.type + '</span> ';
          html += '<span class="cp-badge cp-badge-green">' + ctx.component.exportType + ' export</span> ';
          html += '<span class="cp-badge cp-badge-gray">' + ctx.tokens.current + ' tokens</span>';
          html += '<div style="margin-top:8px; font-size:12px; color:var(--text-muted);">' + ctx.source.file + ':' + ctx.source.startLine + '-' + ctx.source.endLine + '</div>';
          html += '</div>';

          if (ctx.interface && ctx.interface.props && ctx.interface.props.length > 0) {
            html += '<div class="cp-section">';
            html += '<div class="cp-section-title">Props</div>';
            html += '<table class="cp-props-table"><tr><th>Name</th><th>Type</th><th>Req</th></tr>';
            ctx.interface.props.forEach(function(p) {
              html += '<tr><td>' + p.name + '</td><td style="color:#cbd5e1;">' + p.type + '</td><td>' + (p.required ? '✓' : '—') + '</td></tr>';
            });
            html += '</table></div>';
          }

          if (ctx.interface && ctx.interface.hooks && ctx.interface.hooks.length > 0) {
            html += '<div class="cp-section">';
            html += '<div class="cp-section-title">Hooks</div>';
            html += '<div style="font-family:monospace; font-size:12px; color:#cbd5e1;">' + ctx.interface.hooks.join(', ') + '</div>';
            html += '</div>';
          }

          if (ctx.imports && ctx.imports.length > 0) {
            html += '<div class="cp-section">';
            html += '<div class="cp-section-title">Imports</div>';
            ctx.imports.forEach(function(imp) {
              const badge = imp.isLocal ? '<span class="cp-badge cp-badge-green" style="font-size:9px; padding:2px 6px;">L</span>' : '<span class="cp-badge cp-badge-gray" style="font-size:9px; padding:2px 6px;">E</span>';
              html += '<div style="padding:3px 0; display:flex; align-items:center; gap:6px;">' + badge + ' <span style="font-family:monospace;">' + imp.name + '</span></div>';
            });
            html += '</div>';
          }

          if (ctx.source && ctx.source.code) {
            html += '<div class="cp-section">';
            html += '<div class="cp-section-title">Source</div>';
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
        if (info.source) {
          return { file: info.source.fileName, line: info.source.lineNumber };
        }
        try {
          const res = await fetch(BRIDGE + '/api/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ componentName: info.name })
          });
          const data = await res.json();
          if (data.resolved) return { file: data.file, line: data.line };
        } catch(e) {}
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
              const file = pin.context ? pin.context.source.file.split('/').pop() : '';
              div.innerHTML = '<span>' + name + ' <span style="color:var(--text-muted); font-size:11px; margin-left:6px;">' + file + '</span></span>' +
                '<button class="cp-pin-remove" data-id="' + pin.id + '">' + ICONS.x + '</button>';
              list.appendChild(div);
            });
            // Add click listeners to remove pins
            const removeBtns = list.querySelectorAll('.cp-pin-remove');
            removeBtns.forEach(btn => {
               btn.onclick = async () => {
                 const id = btn.getAttribute('data-id');
                 const p = data.pins.find(x => x.id === id);
                 if (p) {
                   await fetch(BRIDGE + '/api/pin', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ action: 'remove', file: p.context.source.file })
                   });
                   refreshPins();
                 }
               };
            });
          }
        } catch(e) { }
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
      console.log('[agent-hover] ✓ UI initialized');
    })();
  `;
}

export default function componentPointer(options?: ComponentPointerOptions): Plugin {
  const port = options?.port ?? 9850;
  const editor = options?.editor ?? 'vscode';
  let projectRoot: string;
  let bridgeServer: BridgeServer | null = null;
  
  return {
    name: 'agent-hover',
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
