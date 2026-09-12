import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import { exec } from 'child_process';
import {
  ContextBuilder,
  RelationshipResolver,
  formatContextMarkdown,
  formatPinSetMarkdown,
  formatTaskContext,
  formatScreenshotDiff,
} from '@agent-hover/core';
import type {
  PinEntry,
  PinSet,
  ComponentContext,
  ContextLevel,
  FreezeEntry,
  ComputedStyleInfo,
  ScreenshotSnapshot,
  ScreenshotDiff
} from '@agent-hover/core';

export class BridgeServer {
  private app: express.Express;
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private projectRoot: string;
  private port: number;

  private contextBuilder: ContextBuilder;
  private relationshipResolver: RelationshipResolver;
  private pins: PinEntry[] = [];
  private frozenEntries: FreezeEntry[] = [];
  private computedStyles: Map<string, ComputedStyleInfo> = new Map();
  private screenshotStore: Map<string, { before?: ScreenshotSnapshot; after?: ScreenshotSnapshot; diff?: ScreenshotDiff }> = new Map();
  private pendingCaptures: Map<string, { resolve: (value: any) => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  private readonly MAX_SCREENSHOT_ENTRIES = 20;
  private clients: Set<WebSocket> = new Set();

  constructor(projectRoot: string, port: number) {
    this.projectRoot = projectRoot;
    this.port = port;
    this.app = express();

    this.contextBuilder = new ContextBuilder(projectRoot);
    this.relationshipResolver = new RelationshipResolver(projectRoot);

    this.setupRoutes();
  }

  private getPinSet(): PinSet {
    const relationships = this.relationshipResolver.resolveRelationships(
      this.pins
    );
    return {
      pins: this.pins,
      relationships,
      totalTokens: {
        minimal: this.pins.reduce(
          (sum, p) => sum + p.context.tokens.minimal,
          0
        ),
        standard: this.pins.reduce(
          (sum, p) => sum + p.context.tokens.standard,
          0
        ),
        full: this.pins.reduce((sum, p) => sum + p.context.tokens.full, 0),
        current: this.pins.reduce(
          (sum, p) => sum + p.context.tokens.current,
          0
        ),
      },
    };
  }

  private evictOldestScreenshot() {
    if (this.screenshotStore.size > this.MAX_SCREENSHOT_ENTRIES) {
      const oldestKey = this.screenshotStore.keys().next().value;
      if (oldestKey) this.screenshotStore.delete(oldestKey);
    }
  }

  private setupRoutes() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));

    // Health check
    this.app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', version: '0.1.0' });
    });

    // Resolve component name to file + line
    this.app.post('/api/resolve', async (req, res) => {
      try {
        const { componentName, ancestors } = req.body;
        if (!componentName) {
          res.status(400).json({ error: 'Missing componentName' });
          return;
        }

        // Search for files matching the component name
        const fg = await import('fast-glob');
        const files = await fg.default(
          `**/${componentName}.{tsx,jsx,ts,js}`,
          {
            cwd: this.projectRoot,
            ignore: ['node_modules/**', 'dist/**'],
          }
        );

        if (files.length > 0) {
          let bestFile = files[0];

          // If multiple matches exist and ancestors are provided, prefer non-shared files
          if (files.length > 1 && ancestors && ancestors.length > 0) {
            const sharedPatterns = ['/shared/', '/common/', '/ui/', '/lib/', '/primitives/'];
            const nonShared = files.filter(f => !sharedPatterns.some(p => f.includes(p)));
            if (nonShared.length > 0) {
              bestFile = nonShared[0];
            }
          } else if (files.length > 1) {
            // Even without ancestors, prefer non-shared files
            const sharedPatterns = ['/shared/', '/common/', '/ui/', '/lib/', '/primitives/'];
            const nonShared = files.filter(f => !sharedPatterns.some(p => f.includes(p)));
            if (nonShared.length > 0) {
              bestFile = nonShared[0];
            }
          }

          // If ancestors are provided and the component is in a shared folder,
          // try to resolve to an ancestor's file instead (the actual usage site)
          if (ancestors && ancestors.length > 0) {
            const sharedPatterns = ['/shared/', '/common/', '/ui/', '/lib/', '/primitives/'];
            const isShared = sharedPatterns.some(p => bestFile.includes(p));
            if (isShared) {
              // Try to find an ancestor component file that would be more useful
              for (const ancestorName of ancestors) {
                const ancestorFiles = await fg.default(
                  `**/${ancestorName}.{tsx,jsx,ts,js}`,
                  { cwd: this.projectRoot, ignore: ['node_modules/**', 'dist/**'] }
                );
                if (ancestorFiles.length > 0) {
                  // Check if this ancestor file actually imports/uses the component
                  const fs = await import('fs/promises');
                  const path = await import('path');
                  for (const af of ancestorFiles) {
                    try {
                      const content = await fs.readFile(path.join(this.projectRoot, af), 'utf-8');
                      if (content.includes(componentName)) {
                        // This ancestor uses our component — resolve to this file instead
                        const lines = content.split('\n');
                        let line = 1;
                        for (let i = 0; i < lines.length; i++) {
                          if (lines[i].includes(`function ${ancestorName}`) || lines[i].includes(`const ${ancestorName}`)) {
                            line = i + 1;
                            break;
                          }
                        }
                        res.json({ file: af, line, resolved: true, resolvedAs: ancestorName, note: 'Resolved to parent component that uses ' + componentName });
                        return;
                      }
                    } catch(e) {}
                  }
                }
              }
            }
          }

          // Find the component declaration line in the best file
          const fs = await import('fs/promises');
          const path = await import('path');
          const content = await fs.readFile(
            path.join(this.projectRoot, bestFile),
            'utf-8'
          );
          const lines = content.split('\n');
          let line = 1;
          for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            if (
              l.includes(`function ${componentName}`) ||
              l.includes(`const ${componentName}`) ||
              l.includes(`class ${componentName}`)
            ) {
              line = i + 1;
              break;
            }
          }
          res.json({ file: bestFile, line, resolved: true });
          return;
        }

        // Fallback: scan all files for the component name as a function/const declaration
        const allFiles = await fg.default('**/*.{tsx,jsx}', {
          cwd: this.projectRoot,
          ignore: ['node_modules/**', 'dist/**'],
        });
        const fs = await import('fs/promises');
        const path = await import('path');

        for (const file of allFiles) {
          const content = await fs.readFile(
            path.join(this.projectRoot, file),
            'utf-8'
          );
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (
              lines[i].includes(`function ${componentName}`) ||
              lines[i].includes(`const ${componentName}`)
            ) {
              res.json({ file, line: i + 1, resolved: true });
              return;
            }
          }
        }

        res.json({ file: null, line: null, resolved: false });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to resolve';
        console.error('[agent-hover] Resolve error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Get component context
    this.app.post('/api/context', async (req, res) => {
      try {
        const { file, line, level = 'standard' } = req.body;
        if (!file || typeof line !== 'number') {
          res.status(400).json({ error: 'Missing or invalid file/line' });
          return;
        }

        const context = await this.contextBuilder.getContext(
          file,
          line,
          level as ContextLevel
        );
        res.json(context);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to fetch context';
        console.error('[agent-hover] Context error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Manage pins
    this.app.post('/api/pin', async (req, res) => {
      try {
        const { action, file, line } = req.body;

        if (action === 'clear') {
          this.pins = [];
        } else if (action === 'add' && file && line !== undefined) {
          // Check if already pinned
          const exists = this.pins.some(
            (p) => p.context.source.file === file
          );
          if (!exists) {
            const context = await this.contextBuilder.getContext(
              file,
              line,
              'standard'
            );
            this.pins.push({ id: context.id, context });
          }
        } else if (action === 'remove' && file) {
          this.pins = this.pins.filter(
            (p) => p.context.source.file !== file
          );
        } else {
          res
            .status(400)
            .json({ error: 'Invalid action or missing file/line' });
          return;
        }

        this.broadcastState();
        res.json(this.getPinSet());
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to manage pins';
        console.error('[agent-hover] Pin error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Get all pins
    this.app.get('/api/pins', (_req, res) => {
      try {
        const pinSet = this.getPinSet();
        const formatted = formatPinSetMarkdown(pinSet);
        res.json({ ...pinSet, formatted });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to fetch pins';
        res.status(500).json({ error: message });
      }
    });

    // Manage frozen components
    this.app.post('/api/freeze', (req, res) => {
      try {
        const { action, file, component, line } = req.body;
        
        if (action === 'clear') {
          this.frozenEntries = [];
        } else if (action === 'add' && file && component) {
          const exists = this.frozenEntries.some(f => f.file === file && f.component === component);
          if (!exists) {
            this.frozenEntries.push({
              id: `${file}:${component}`,
              file,
              component,
              line: line || 1,
              frozenAt: new Date().toISOString()
            });
          }
        } else if (action === 'remove' && file && component) {
          this.frozenEntries = this.frozenEntries.filter(
            f => !(f.file === file && f.component === component)
          );
        } else if (action !== 'list') {
          res.status(400).json({ error: 'Invalid action or missing file/component' });
          return;
        }

        this.broadcastState();
        res.json({ frozenEntries: this.frozenEntries });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to manage frozen components';
        console.error('[agent-hover] Freeze error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Store computed styles
    this.app.post('/api/computed-styles', (req, res) => {
      try {
        const { id, styles } = req.body;
        if (!id || !styles) {
          res.status(400).json({ error: 'Missing id or styles' });
          return;
        }
        this.computedStyles.set(id, styles);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to store styles';
        res.status(500).json({ error: message });
      }
    });

    // Generate task context
    this.app.post('/api/task', async (req, res) => {
      try {
        const { instruction, level = 'standard' } = req.body;
        if (!instruction) {
          res.status(400).json({ error: 'Missing instruction' });
          return;
        }

        // Rebuild context at requested level for all pins
        const updatedPins: PinEntry[] = [];
        for (const pin of this.pins) {
          const context = await this.contextBuilder.getContext(
            pin.context.source.file,
            pin.context.source.startLine,
            level as ContextLevel
          );
          // Attach computed styles if we have them
          const styleId = `${context.source.file}:${context.component.name}`;
          if (this.computedStyles.has(styleId)) {
            context.computedStyles = this.computedStyles.get(styleId);
          }
          updatedPins.push({ id: context.id, context });
        }

        const pinSet = {
          ...this.getPinSet(),
          pins: updatedPins,
        };

        const taskContext = formatTaskContext(pinSet, instruction, this.frozenEntries);
        res.json(taskContext);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to generate task context';
        console.error('[agent-hover] Task error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Clear screenshots
    this.app.post('/api/screenshot/clear', (req, res) => {
      try {
        const { id } = req.body;
        if (id) {
          this.screenshotStore.delete(id);
        } else {
          this.screenshotStore.clear();
        }
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to clear screenshots';
        res.status(500).json({ error: message });
      }
    });

    // Trigger screenshot capture via WebSocket (for MCP)
    this.app.post('/api/screenshot/trigger', (req, res) => {
      try {
        const { file, component, label } = req.body;
        if (!file || !component || !label) {
          res.status(400).json({ error: 'Missing file, component, or label' });
          return;
        }

        const componentId = `${file}:${component}`;
        const requestId = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        if (this.clients.size === 0) {
          res.status(503).json({ error: 'No browser overlay connected. Please open your app in the browser with the Agent Hover overlay active.' });
          return;
        }

        // Create a promise that will be resolved when the overlay responds
        const capturePromise = new Promise<any>((resolve) => {
          const timer = setTimeout(() => {
            this.pendingCaptures.delete(requestId);
            resolve({ error: 'Capture timed out after 10s. The component may not be visible in the browser viewport, or the overlay may not be active.' });
          }, 10000);

          this.pendingCaptures.set(requestId, { resolve, timer });
        });

        // Send capture request to all connected overlay clients
        const wsMessage = JSON.stringify({
          type: 'capture-screenshot',
          data: { requestId, file, component, label, componentId },
        });
        this.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(wsMessage);
          }
        });

        // Wait for the overlay to capture and respond
        capturePromise.then((result) => {
          if (result.error) {
            res.status(408).json(result);
          } else {
            res.json(result);
          }
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to trigger capture';
        console.error('[agent-hover] Screenshot trigger error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Store screenshot snapshot
    this.app.post('/api/screenshot', (req, res) => {
      try {
        const { id, label, dataUrl, boundingBox, viewport, requestId } = req.body;
        if (!id || !label || !dataUrl) {
          res.status(400).json({ error: 'Missing id, label, or dataUrl' });
          return;
        }

        const snapshot: ScreenshotSnapshot = {
          id,
          label,
          dataUrl,
          timestamp: new Date().toISOString(),
          boundingBox: boundingBox || { top: 0, left: 0, width: 0, height: 0 },
          viewport: viewport || { width: 1920, height: 1080 },
        };

        let entry = this.screenshotStore.get(id);
        if (!entry) {
          entry = {};
          this.screenshotStore.set(id, entry);
          this.evictOldestScreenshot();
        }
        entry[label as keyof typeof entry] = snapshot as any;

        // If both before and after exist, store the diff (sent from client)
        if (req.body.diff) {
          entry.diff = req.body.diff;
        }

        // Resolve pending MCP capture if requestId matches
        if (requestId && this.pendingCaptures.has(requestId)) {
          const pending = this.pendingCaptures.get(requestId)!;
          clearTimeout(pending.timer);
          pending.resolve({ snapshot, diff: entry.diff || null });
          this.pendingCaptures.delete(requestId);
        }

        res.json({ success: true, hasBeforeAndAfter: !!(entry.before && entry.after), diff: entry.diff || null });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to store screenshot';
        console.error('[agent-hover] Screenshot error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Get screenshot diff for a component
    this.app.get('/api/screenshot/:id', (req, res) => {
      try {
        const id = decodeURIComponent(req.params.id);
        const entry = this.screenshotStore.get(id);
        if (!entry) {
          res.status(404).json({ error: 'No screenshots found for this component', id });
          return;
        }
        const includeData = req.query.include_data === 'true';
        res.json({
          id,
          before: entry.before ? {
            timestamp: entry.before.timestamp,
            boundingBox: entry.before.boundingBox,
            viewport: entry.before.viewport,
            ...(includeData ? { dataUrl: entry.before.dataUrl } : {}),
          } : null,
          after: entry.after ? {
            timestamp: entry.after.timestamp,
            boundingBox: entry.after.boundingBox,
            viewport: entry.after.viewport,
            ...(includeData ? { dataUrl: entry.after.dataUrl } : {}),
          } : null,
          hasDiff: !!entry.diff,
          diff: entry.diff ? {
            componentId: entry.diff.componentId,
            componentName: entry.diff.componentName,
            changedPixelPercent: entry.diff.changedPixelPercent,
            createdAt: entry.diff.createdAt,
          } : null,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to get screenshot';
        res.status(500).json({ error: message });
      }
    });

    // Open in editor
    this.app.post('/api/open-editor', (req, res) => {
      try {
        console.log("OPEN-EDITOR REQ:", req.body); const { file, line, editor } = req.body;
        if (!file) {
          res.status(400).json({ error: 'Missing file' });
          return;
        }

        let actualEditor = editor;
        if (editor === 'auto') {
          const tp = process.env.TERM_PROGRAM || '';
          const envKeys = Object.keys(process.env).join(',');
          if (envKeys.toLowerCase().includes('cursor')) {
            actualEditor = 'cursor';
          } else if (tp === 'windsurf' || envKeys.toLowerCase().includes('windsurf')) {
            actualEditor = 'windsurf';
          } else if (tp === 'antigravity' || envKeys.toLowerCase().includes('antigravity') || process.env.AGY_IDE) {
            actualEditor = 'antigravity';
          } else if (tp === 'vscode' || envKeys.toLowerCase().includes('vscode')) {
            actualEditor = 'vscode';
          } else {
            // Default fallback if we can't detect
            actualEditor = 'antigravity';
          }
          console.log('[agent-hover] Auto-detected editor:', actualEditor);
        }

        let cmd = '';
        if (actualEditor === 'cursor') {
          cmd = `cursor "${this.projectRoot}" --goto "${file}:${line || 1}" 2>/dev/null || open "cursor://file${file}:${line || 1}"`;
        } else if (actualEditor === 'windsurf') {
          cmd = `windsurf "${this.projectRoot}" --goto "${file}:${line || 1}" 2>/dev/null || open "windsurf://file${file}:${line || 1}"`;
        } else if (actualEditor === 'antigravity') {
          // Try agy CLI first, fallback to macOS open command if missing
          cmd = `agy "${this.projectRoot}" "${file}" 2>/dev/null || open "antigravity-ide://file${file}:${line || 1}"`;
        } else if (actualEditor === 'webstorm') {
          cmd = `webstorm "${this.projectRoot}" --line ${line || 1} "${file}"`;
        } else {
          // Default to vscode
          cmd = `code "${this.projectRoot}" --goto "${file}:${line || 1}" 2>/dev/null || open "vscode://file${file}:${line || 1}"`;
        }

        exec(cmd, (error) => {
          if (error) {
            console.error('[agent-hover] Failed to open editor:', error);
            res.status(500).json({ error: error.message });
          } else {
            res.json({ success: true });
          }
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to open editor';
        res.status(500).json({ error: message });
      }
    });
  }

  public start() {
    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'request-context') {
            const context = await this.contextBuilder.getContext(
              data.file,
              data.line,
              (data.level as ContextLevel) || 'standard'
            );
            ws.send(
              JSON.stringify({ type: 'context-update', data: context })
            );
          }
        } catch (error) {
          console.error('[agent-hover] WS error:', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      // Send current state to new connections
      ws.send(
        JSON.stringify({
          type: 'state-update',
          data: { pins: this.pins, frozenEntries: this.frozenEntries },
        })
      );
    });

    this.httpServer.listen(this.port, () => {
      console.log(
        `[agent-hover] Bridge server running on http://localhost:${this.port}`
      );
      console.log(
        `[agent-hover] Project root: ${this.projectRoot}`
      );
    });
  }

  public stop() {
    console.log('[agent-hover] Stopping bridge server...');
    this.clients.forEach((client) => client.close());
    this.wss?.close();
    this.httpServer?.close();
  }

  private broadcastState() {
    const data = JSON.stringify({
      type: 'state-update',
      data: { pins: this.pins, frozenEntries: this.frozenEntries, screenshotCount: this.screenshotStore.size },
    });
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
