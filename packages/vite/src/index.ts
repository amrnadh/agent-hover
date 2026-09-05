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
      const ws = new WebSocket('ws://localhost:${port}');
      ws.onopen = () => console.log('[component-pointer] connected to bridge');
      
      let isPointerMode = false;
      let overlay = null;
      let highlight = null;
      let panel = null;
      let currentElement = null;
      
      function createUI() {
        const container = document.createElement('div');
        container.id = 'component-pointer-container';
        const shadow = container.attachShadow({mode: 'open'});
        
        shadow.innerHTML = \`
          <style>
            #highlight {
              position: fixed;
              pointer-events: none;
              z-index: 999999;
              border: 2px dashed #007bff;
              background: rgba(0, 123, 255, 0.1);
              display: none;
            }
            #label {
              position: absolute;
              top: 0; left: 0;
              background: #007bff;
              color: white;
              font-family: monospace;
              font-size: 12px;
              padding: 2px 6px;
            }
            #panel {
              position: fixed;
              right: 20px;
              top: 20px;
              width: 400px;
              height: 80vh;
              background: white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              border-radius: 8px;
              z-index: 1000000;
              display: none;
              flex-direction: column;
              font-family: sans-serif;
              border: 1px solid #ddd;
              overflow: hidden;
            }
            #panel-header {
              padding: 12px;
              background: #f8f9fa;
              border-bottom: 1px solid #ddd;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            #panel-content {
              flex: 1;
              overflow: auto;
              padding: 12px;
            }
            #pin-bar {
              padding: 12px;
              background: #f8f9fa;
              border-top: 1px solid #ddd;
              max-height: 150px;
              overflow-y: auto;
            }
            .btn {
              background: #007bff;
              color: white;
              border: none;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
            }
            .btn:hover { background: #0056b3; }
            .btn-secondary { background: #6c757d; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
          </style>
          <div id="highlight"><div id="label"></div></div>
          <div id="panel">
            <div id="panel-header">
              <h3 style="margin:0; font-size: 16px;">Context Lens</h3>
              <button class="btn btn-secondary" id="close-panel">Close</button>
            </div>
            <div id="panel-content">Select a component...</div>
            <div id="pin-bar">
              <h4 style="margin-top:0;">Pinned (<span id="pin-count">0</span>)</h4>
              <ul id="pin-list" style="margin:0; padding-left:20px; font-size:14px;"></ul>
              <button class="btn" id="generate-task" style="margin-top: 8px; width: 100%;">Generate Task Context</button>
            </div>
          </div>
        \`;
        document.body.appendChild(container);
        highlight = shadow.getElementById('highlight');
        panel = shadow.getElementById('panel');
        
        shadow.getElementById('close-panel').onclick = () => {
          panel.style.display = 'none';
        };
        shadow.getElementById('generate-task').onclick = async () => {
          const res = await fetch('http://localhost:${port}/api/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction: 'Analyze pinned components' })
          });
          const data = await res.json();
          console.log('Task Context:', data);
          alert('Task context generated! Check console.');
        };
        
        return shadow;
      }
      
      const shadow = createUI();
      
      function getFiberNode(el) {
        for (let key in el) {
          if (key.startsWith('__reactFiber$')) {
            return el[key];
          }
        }
        return null;
      }
      
      function getComponentSource(el) {
        const fiber = getFiberNode(el);
        if (!fiber) return null;
        let curr = fiber;
        while (curr) {
          if (curr._debugSource) {
            return curr._debugSource;
          }
          curr = curr.return;
        }
        return null;
      }
      
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Alt') isPointerMode = true;
        if (e.key === 'Escape') panel.style.display = 'none';
      });
      window.addEventListener('keyup', (e) => {
        if (e.key === 'Alt') {
          isPointerMode = false;
          if (highlight) highlight.style.display = 'none';
        }
      });
      
      window.addEventListener('mousemove', (e) => {
        if (!isPointerMode) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el === currentElement) return;
        currentElement = el;
        
        const source = getComponentSource(el);
        if (source && highlight) {
          const rect = el.getBoundingClientRect();
          highlight.style.display = 'block';
          highlight.style.top = rect.top + 'px';
          highlight.style.left = rect.left + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';
          
          const label = shadow.getElementById('label');
          label.textContent = source.fileName.split('/').pop() + ':' + source.lineNumber;
        } else if (highlight) {
          highlight.style.display = 'none';
        }
      });
      
      window.addEventListener('click', async (e) => {
        if (!isPointerMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        const source = getComponentSource(currentElement);
        if (source) {
          if (e.shiftKey) {
            await fetch('http://localhost:${port}/api/pin', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ action: 'add', file: source.fileName, line: source.lineNumber })
            });
            refreshPins();
          } else {
            panel.style.display = 'flex';
            const content = shadow.getElementById('panel-content');
            content.innerHTML = '<p>Loading context...</p>';
            
            try {
              const res = await fetch('http://localhost:${port}/api/context', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ file: source.fileName, line: source.lineNumber, level: 'standard' })
              });
              const ctx = await res.json();
              content.innerHTML = \`
                <div style="margin-bottom: 12px;">
                  <h4 style="margin:0;">\${ctx.name || 'Component'}</h4>
                  <div style="font-size:12px; color:#666;">\${ctx.filePath}</div>
                </div>
                <button class="btn" id="open-editor" style="margin-bottom: 12px;">Open in ${editor}</button>
                <div style="font-weight:bold; margin-bottom: 4px;">Source:</div>
                <pre style="margin:0; font-size: 12px; max-height: 200px;">\${ctx.source || 'No source available'}</pre>
                \${ctx.props ? \`<div style="font-weight:bold; margin-top: 12px; margin-bottom: 4px;">Props:</div>
                <pre style="margin:0; font-size: 12px; max-height: 150px;">\${JSON.stringify(ctx.props, null, 2)}</pre>\` : ''}
              \`;
              
              shadow.getElementById('open-editor').onclick = () => {
                console.log('Open in ${editor}:', source.fileName, source.lineNumber);
              };
            } catch (err) {
              content.innerHTML = '<p style="color:red;">Failed to load context.</p>';
            }
          }
        }
      }, true);
      
      async function refreshPins() {
        try {
          const res = await fetch('http://localhost:${port}/api/pins');
          const data = await res.json();
          shadow.getElementById('pin-count').textContent = data.pins.length;
          const list = shadow.getElementById('pin-list');
          list.innerHTML = '';
          data.pins.forEach(pin => {
             const li = document.createElement('li');
             li.textContent = pin.file.split('/').pop() + ':' + pin.line;
             list.appendChild(li);
          });
        } catch (err) {
          console.error(err);
        }
      }
      
      ws.onmessage = (msg) => {
        const payload = JSON.parse(msg.data);
        if (payload.type === 'pins-update') {
          refreshPins();
        }
      };
      
      refreshPins();
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
