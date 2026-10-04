import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import { launchEditorSafely } from './editor-launcher.js';
import path from 'path';
import fs from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import {
  ContextBuilder,
  RelationshipResolver,
  formatContextMarkdown,
  formatPinSetMarkdown,
  formatTaskContext,
  SourceEditor,
} from '@agent-hover/core';
import type {
  PinEntry,
  PinSet,
  ComponentContext,
  ContextLevel,
  FreezeEntry,
  ComputedStyleInfo,
  ScreenshotSnapshot,
  ScreenshotDiff,
  ElementComment
} from '@agent-hover/core';

export class BridgeServer {
  private app: express.Express;
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private projectRoot: string;
  private port: number;
  private lastMcpHello = 0;
  private latestAgentTask: any = null;
  private initialPort: number;

  private contextBuilder: ContextBuilder;
  private relationshipResolver: RelationshipResolver;
  private sourceEditor: SourceEditor;
  private pins: PinEntry[] = [];
  private frozenEntries: FreezeEntry[] = [];
  private comments: ElementComment[] = [];
  private computedStyles: Map<string, ComputedStyleInfo> = new Map();
  private screenshotStore: Map<string, { before?: ScreenshotSnapshot; after?: ScreenshotSnapshot; diff?: ScreenshotDiff }> = new Map();
  private pendingCaptures: Map<string, { resolve: (value: any) => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  private readonly MAX_SCREENSHOT_ENTRIES = 20;
  private readonly CURRENT_VERSION = '0.1.1';
  private updateInfo: { current: string; latest: string } | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor(projectRoot: string, port: number) {
    this.projectRoot = projectRoot;
    this.port = port;
    this.initialPort = port;
    this.app = express();

    this.contextBuilder = new ContextBuilder(projectRoot);
    this.relationshipResolver = new RelationshipResolver(projectRoot);
    this.sourceEditor = new SourceEditor(projectRoot);

    this.loadComments();
    this.setupRoutes();
  }

  private get commentsFilePath(): string {
    return path.join(this.projectRoot, '.agent-hover', 'comments.json');
  }

  private loadComments() {
    try {
      if (existsSync(this.commentsFilePath)) {
        const content = readFileSync(this.commentsFilePath, 'utf-8');
        this.comments = JSON.parse(content);
      } else {
        this.comments = [];
      }
    } catch {
      this.comments = [];
    }
  }

  private async saveComments() {
    try {
      await fs.mkdir(path.dirname(this.commentsFilePath), { recursive: true });
      await fs.writeFile(this.commentsFilePath, JSON.stringify(this.comments, null, 2), 'utf-8');
    } catch (e) {
      console.error('[agent-hover] Failed to save comments to disk:', e);
    }
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

    // Security: only allow requests from localhost
    this.app.use((req, res, next) => {
      const host = req.headers.host || '';
      const origin = req.headers.origin || '';
      const isLocalHost = host.startsWith('localhost:') || host.startsWith('127.0.0.1:');
      const isLocalOrigin = !origin || origin.includes('localhost') || origin.includes('127.0.0.1');
      if (!isLocalHost && !isLocalOrigin) {
        res.status(403).json({ error: 'Forbidden: non-local request' });
        return;
      }
      next();
    });

    // Health check
    this.app.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        version: this.CURRENT_VERSION,
        updateAvailable: this.updateInfo,
      });
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
        const markdown = formatContextMarkdown(context, level as ContextLevel);
        res.json({ ...context, markdown });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to fetch context';
        console.error('[agent-hover] Context error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Manage pins (support both /api/pin and /api/pins)
    const pinHandler = async (req: express.Request, res: express.Response) => {
      try {
        const { action, file, line, task, id, context } = req.body;

        if (action === 'clear') {
          this.pins = [];
        } else if (context && (action === 'add' || !action)) {
          const pinId = id || context.id || `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const existingIdx = this.pins.findIndex((p) => p.id === pinId);
          const entry: PinEntry = {
            id: pinId,
            context,
            task: task || req.body.task || '',
            order: req.body.order || this.pins.length + 1,
            addedAt: req.body.addedAt || new Date().toISOString(),
          };
          if (existingIdx >= 0) {
            this.pins[existingIdx] = entry;
          } else {
            this.pins.push(entry);
          }
        } else if (action === 'add' && file && line !== undefined) {
          const pinId = id || `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const existing = id ? this.pins.find((p) => p.id === id) : null;
          if (existing) {
            if (task !== undefined) existing.task = task;
          } else {
            const context = await this.contextBuilder.getContext(
              file,
              line,
              'standard'
            );
            this.pins.push({
              id: pinId,
              context,
              task: task || '',
              order: this.pins.length + 1,
              addedAt: new Date().toISOString()
            });
          }
        } else if (action === 'update-task' && (id || file)) {
          const p = this.pins.find((x) => id ? x.id === id : x.context.source.file === file);
          if (p) {
            p.task = task || '';
          }
        } else if (action === 'remove' && (file || id)) {
          this.pins = this.pins.filter(
            (p) => id ? p.id !== id : p.context.source.file !== file
          );
          this.pins.forEach((p, idx) => { p.order = idx + 1; });
        } else {
          res
            .status(400)
            .json({ error: 'Invalid action or missing parameters' });
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
    };

    this.app.post('/api/pin', pinHandler);
    this.app.post('/api/pins', pinHandler);
    this.app.delete('/api/pins', (req, res) => {
      const { id, file } = req.body;
      if (id || file) {
        this.pins = this.pins.filter(
          (p) => id ? p.id !== id : p.context.source.file !== file
        );
        this.pins.forEach((p, idx) => { p.order = idx + 1; });
        this.broadcastState();
        res.json(this.getPinSet());
      } else {
        res.status(400).json({ error: 'Missing id or file' });
      }
    });

    // Get all pins
    this.app.get('/api/pins', (req, res) => {
      try {
        const pinSet = this.getPinSet();
        const level = (req.query.level as ContextLevel) || 'standard';
        const formatted = formatPinSetMarkdown(pinSet);
        res.json({ ...pinSet, level, formatted });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to fetch pins';
        res.status(500).json({ error: message });
      }
    });

    // Comments endpoints
    this.app.get('/api/comments', (_req, res) => {
      this.loadComments();
      res.json({ comments: this.comments });
    });

    this.app.post('/api/comments', async (req, res) => {
      try {
        this.loadComments();
        const action = req.body.action || (req.body.comment || req.body.text || req.body.file ? 'add' : undefined);
        let commentObj: any = req.body;
        if (typeof req.body.comment === 'object' && req.body.comment !== null) {
          commentObj = req.body.comment;
        }
        const commentText = typeof req.body.comment === 'string'
          ? req.body.comment
          : (commentObj.text || commentObj.comment || '');
        const { id, text } = req.body;
        if (action === 'add') {
          const newComment: ElementComment = {
            id: commentObj.id || `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            file: commentObj.file || '',
            line: commentObj.line || 1,
            component: commentObj.component || '',
            selector: commentObj.selector,
            text: commentText,
            createdAt: commentObj.createdAt || new Date().toISOString(),
            resolved: false,
          };
          this.comments.push(newComment);
          await this.saveComments();
          this.broadcastState();
          res.json({ success: true, comment: newComment, comments: this.comments });
        } else if (action === 'update' && id && text !== undefined) {
          const c = this.comments.find(x => x.id === id);
          if (c) {
            c.text = text;
            await this.saveComments();
            this.broadcastState();
            res.json({ success: true, comment: c, comments: this.comments });
          } else {
            res.status(404).json({ error: 'Comment not found' });
          }
        } else if (action === 'toggle-resolve' && id) {
          const c = this.comments.find(x => x.id === id);
          if (c) {
            c.resolved = !c.resolved;
            await this.saveComments();
            this.broadcastState();
            res.json({ success: true, comment: c, comments: this.comments });
          } else {
            res.status(404).json({ error: 'Comment not found' });
          }
        } else if (action === 'delete' && id) {
          this.comments = this.comments.filter(x => x.id !== id);
          await this.saveComments();
          this.broadcastState();
          res.json({ success: true, comments: this.comments });
        } else if (action === 'clear') {
          this.comments = [];
          await this.saveComments();
          this.broadcastState();
          res.json({ success: true, comments: this.comments });
        } else {
          res.status(400).json({ error: 'Invalid comments action' });
        }
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Comments error' });
      }
    });

    // Manage frozen components
    this.app.get('/api/freeze', (_req, res) => {
      res.json({ frozenEntries: this.frozenEntries });
    });

    this.app.delete('/api/freeze', (req, res) => {
      const { file, component } = req.body;
      if (file && component) {
        this.frozenEntries = this.frozenEntries.filter(
          f => !(f.file === file && f.component === component)
        );
        this.broadcastState();
        res.json({ frozenEntries: this.frozenEntries });
      } else {
        res.status(400).json({ error: 'Missing file or component' });
      }
    });

    this.app.post('/api/freeze', (req, res) => {
      try {
        const action = req.body.action || (req.body.file && req.body.component ? 'add' : 'list');
        const { file, component, line } = req.body;
        
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
        const { instruction = '', level = 'standard' } = req.body;

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
          updatedPins.push({
            id: context.id,
            context,
            task: pin.task,
            order: pin.order,
            addedAt: pin.addedAt
          });
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

    // Save clean screenshot to project disk (.agent-hover/screenshots/)
    this.app.post('/api/screenshot/save', async (req, res) => {
      try {
        const { dataUrl, filename } = req.body;
        if (!dataUrl) {
          res.status(400).json({ error: 'Missing dataUrl' });
          return;
        }

        if (dataUrl.length > 50 * 1024 * 1024) {
          res.status(413).json({ error: 'Screenshot data exceeds 50MB limit' });
          return;
        }

        const fs = await import('fs/promises');
        const path = await import('path');
        const screenshotsDir = path.join(this.projectRoot, '.agent-hover', 'screenshots');
        await fs.mkdir(screenshotsDir, { recursive: true });

        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const cleanName = (filename || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
        const fileNameWithExt = `${cleanName}_${Date.now()}.png`;
        const filePath = path.join(screenshotsDir, fileNameWithExt);
        await fs.writeFile(filePath, buffer);

        const relPath = path.relative(this.projectRoot, filePath);
        console.log(`[agent-hover] 📸 Screenshot saved to ${relPath}`);
        res.json({ success: true, path: relPath, filename: fileNameWithExt, fullPath: filePath });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save screenshot';
        console.error('[agent-hover] Screenshot save error:', message);
        res.status(500).json({ error: message });
      }
    });

    // Download/serve screenshot file
    this.app.get('/api/screenshot/download/:filename', async (req, res) => {
      try {
        const path = await import('path');
        const safeName = path.basename(req.params.filename);
        const filePath = path.join(this.projectRoot, '.agent-hover', 'screenshots', safeName);
        res.download(filePath, safeName);
      } catch (e) {
        res.status(404).send('Not found');
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

    // MCP heartbeat
    this.app.post('/api/mcp/hello', (req, res) => {
      this.lastMcpHello = Date.now();
      res.json({ ok: true });
    });

    this.app.get('/api/mcp-status', (_req, res) => {
      const connected = (Date.now() - this.lastMcpHello) < 30000;
      res.json({ connected, lastSeen: this.lastMcpHello > 0 ? new Date(this.lastMcpHello).toISOString() : null });
    });

    this.app.get('/api/components', (req, res) => {
      const filter = (req.query.filter as string) || '';
      const limit = parseInt(req.query.limit as string) || 50;
      const includeLibrary = req.query.includeLibrary === 'true';
      
      if (this.clients.size === 0) {
        res.status(503).json({ error: 'No browser overlay connected. Open your app in the browser with Agent Hover active.' });
        return;
      }
      
      const requestId = `components-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const componentPromise = new Promise<any>((resolve) => {
        const timer = setTimeout(() => {
          this.pendingCaptures.delete(requestId);
          resolve({ error: 'Component listing timed out after 3s. The browser overlay may not be active.' });
        }, 3000);
        this.pendingCaptures.set(requestId, { resolve, timer });
      });
      
      const wsMessage = JSON.stringify({
        type: 'list-components',
        data: { requestId, filter, limit, includeLibrary },
      });
      this.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(wsMessage);
        }
      });
      
      componentPromise.then((result) => {
        if (result.error) {
          res.status(408).json(result);
        } else {
          res.json(result);
        }
      });
    });

    // Send task/context to AI Agent
    this.app.post('/api/agent/send', (req, res) => {
      const task = req.body || {};
      this.latestAgentTask = {
        ...task,
        receivedAt: new Date().toISOString()
      };
      const message = JSON.stringify({
        type: 'agent-task-dispatched',
        data: this.latestAgentTask
      });
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      console.log(`[agent-hover] 🤖 Task sent to agent: "${task.component || task.title || 'Component context'}"`);
      res.json({ ok: true, task: this.latestAgentTask });
    });

    this.app.get('/api/agent/latest', (_req, res) => {
      res.json({ task: this.latestAgentTask });
    });

    // Open in editor
    this.app.post('/api/open-editor', async (req, res) => {
      try {
        const { file, line, text, component, editor } = req.body;
        const fg = await import('fast-glob');
        const path = await import('path');

        let targetFile: string | null = null;
        if (file) {
          targetFile = path.isAbsolute(file) ? file : path.resolve(this.projectRoot, file);
        }

        // If file doesn't exist or wasn't provided, try searching by component or text
        if (!targetFile || !existsSync(targetFile)) {
          const files = await fg.default('**/*.{tsx,jsx,ts,js}', {
            cwd: this.projectRoot,
            ignore: ['node_modules/**', 'dist/**', '.git/**'],
          });

          if (component) {
            const compFile = files.find(f => {
              const base = path.basename(f, path.extname(f)).toLowerCase();
              return base === component.toLowerCase() || f.toLowerCase().includes(component.toLowerCase());
            });
            if (compFile) {
              targetFile = path.resolve(this.projectRoot, compFile);
            }
          }

          if ((!targetFile || !existsSync(targetFile)) && text && text.trim()) {
            const trimmed = text.trim();
            for (const f of files) {
              try {
                const absF = path.resolve(this.projectRoot, f);
                const content = readFileSync(absF, 'utf-8');
                if (content.includes(trimmed)) {
                  targetFile = absF;
                  break;
                }
              } catch {}
            }
          }
        }

        if (!targetFile || !existsSync(targetFile)) {
          res.status(404).json({ error: 'Could not resolve source file for component/text' });
          return;
        }

        let targetLine = typeof line === 'number' && line > 0 ? line : 1;

        // If text is provided, find the exact line in targetFile where text occurs
        if (text && text.trim()) {
          try {
            const content = readFileSync(targetFile, 'utf-8');
            const lines = content.split('\n');
            const trimmed = text.trim();
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(trimmed)) {
                targetLine = i + 1;
                break;
              }
            }
          } catch {}
        }

        let actualEditor = editor;
        if (!actualEditor || actualEditor === 'auto') {
          const tp = process.env.TERM_PROGRAM || '';
          const envStr = JSON.stringify(process.env).toLowerCase();
          if (envStr.includes('cursor')) {
            actualEditor = 'cursor';
          } else if (tp === 'windsurf' || envStr.includes('windsurf')) {
            actualEditor = 'windsurf';
          } else if (tp === 'antigravity' || envStr.includes('antigravity') || process.env.AGY_IDE) {
            actualEditor = 'antigravity';
          } else if (tp === 'vscode' || envStr.includes('code')) {
            actualEditor = 'vscode';
          } else {
            actualEditor = 'cursor';
          }
          console.log('[agent-hover] Auto-detected editor:', actualEditor);
        }

        try {
          await launchEditorSafely({
            editor: actualEditor,
            targetFile,
            targetLine,
            projectRoot: this.projectRoot,
          });
          res.json({ success: true, file: targetFile, line: targetLine });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to open editor';
          console.error('[agent-hover] Failed to open editor:', error);
          res.status(500).json({ error: message });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to open editor';
        res.status(500).json({ error: message });
      }
    });

    // Edit source text directly on disk via AST replacement
    this.app.post('/api/edit-source', async (req, res) => {
      try {
        const { file, component, originalText, newText, line } = req.body;
        if (originalText === undefined || newText === undefined) {
          res.status(400).json({ error: 'Missing required parameters (originalText, newText)' });
          return;
        }

        let targetFile = file;

        // If file wasn't provided or was unresolved by client, scan project for originalText
        if (!targetFile && originalText) {
          const fg = await import('fast-glob');
          const fs = await import('fs/promises');
          const path = await import('path');
          const files = await fg.default('**/*.{tsx,jsx}', {
            cwd: this.projectRoot,
            ignore: ['node_modules/**', 'dist/**', '.git/**'],
          });

          if (component) {
            const compFile = files.find(f => f.toLowerCase().includes(component.toLowerCase()));
            if (compFile) targetFile = compFile;
          }

          if (!targetFile) {
            for (const candidateFile of files) {
              try {
                const content = await fs.readFile(path.join(this.projectRoot, candidateFile), 'utf-8');
                if (content.includes(originalText.trim())) {
                  targetFile = candidateFile;
                  break;
                }
              } catch {}
            }
          }
        }

        if (!targetFile) {
          res.status(400).json({ error: 'Target file not found for text edit' });
          return;
        }

        let result = await this.sourceEditor.editSourceText({
          projectRoot: this.projectRoot,
          file: targetFile,
          component,
          originalText,
          newText,
          line: typeof line === 'number' ? line : undefined,
        });

        // If not found in the specified file (e.g. call-site file was passed instead of definition file),
        // search for the component or text across all project source files
        if (!result.success) {
          const fg = await import('fast-glob');
          const fs = await import('fs/promises');
          const path = await import('path');

          const files = await fg.default('**/*.{tsx,jsx}', {
            cwd: this.projectRoot,
            ignore: ['node_modules/**', 'dist/**', targetFile],
          });

          // Priority 1: Files matching component name
          if (component) {
            const compFile = files.find(f => f.toLowerCase().includes(component.toLowerCase()));
            if (compFile) {
              const retry = await this.sourceEditor.editSourceText({
                projectRoot: this.projectRoot,
                file: compFile,
                component,
                originalText,
                newText,
              });
              if (retry.success) {
                result = retry;
              }
            }
          }

          // Priority 2: Files containing originalText
          if (!result.success) {
            for (const candidateFile of files) {
              try {
                const content = await fs.readFile(path.join(this.projectRoot, candidateFile), 'utf-8');
                if (content.includes(originalText.trim())) {
                  const retry = await this.sourceEditor.editSourceText({
                    projectRoot: this.projectRoot,
                    file: candidateFile,
                    component,
                    originalText,
                    newText,
                  });
                  if (retry.success) {
                    result = retry;
                    break;
                  }
                }
              } catch (e) {}
            }
          }
        }

        if (result.success) {
          this.broadcast({
            type: 'source-updated',
            data: { file: result.file, oldText: result.oldText, newText: result.newText, line: result.line }
          });
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Save modified component source snippet directly to disk
    this.app.post('/api/save-source', async (req, res) => {
      try {
        const { file, component, newSource, startLine, endLine } = req.body;
        if (!file || newSource === undefined) {
          res.status(400).json({ error: 'Missing required parameters (file, newSource)' });
          return;
        }

        const result = await this.sourceEditor.saveComponentSource({
          projectRoot: this.projectRoot,
          file,
          component,
          newSource,
          startLine: typeof startLine === 'number' ? startLine : undefined,
          endLine: typeof endLine === 'number' ? endLine : undefined,
        });

        if (result.success) {
          this.broadcast({
            type: 'source-updated',
            data: { file: result.file, component }
          });
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Revert the last source modification
    this.app.post('/api/source-undo', async (_req, res) => {
      try {
        const result = await this.sourceEditor.undo();
        if (result.success) {
          this.broadcast({
            type: 'source-reverted',
            data: { file: result.file, description: result.description }
          });
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });
  }

  public getPort(): number {
    return this.port;
  }

  public start(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer(this.app);
      this.httpServer = server;

      const errorHandler = (err: any) => {
        server.removeListener('listening', listenHandler);
        server.on('error', () => {});
        if (err.code === 'EADDRINUSE' && this.port < this.initialPort + 10) {
          console.warn(
            `[agent-hover] Port ${this.port} is already in use. Retrying on port ${this.port + 1}...`
          );
          this.port++;
          this.start().then(resolve, reject);
        } else {
          console.error('[agent-hover] Failed to start bridge server:', err);
          reject(err);
        }
      };

      const listenHandler = () => {
        server.removeListener('error', errorHandler);
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        const wss = new WebSocketServer({ server });
        this.wss = wss;

        wss.on('connection', (ws) => {
          this.clients.add(ws);

          ws.on('close', () => {
            this.clients.delete(ws);
          });

          ws.on('message', (data) => {
            try {
              const parsed = JSON.parse(data.toString());
              if (parsed.type === 'component-list-response' && parsed.requestId) {
                const pending = this.pendingCaptures.get(parsed.requestId);
                if (pending) {
                  clearTimeout(pending.timer);
                  pending.resolve(parsed.data);
                  this.pendingCaptures.delete(parsed.requestId);
                }
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          });

          // Send current state to new connections
          ws.send(
            JSON.stringify({
              type: 'state-update',
              data: {
                pins: this.pins,
                frozenEntries: this.frozenEntries,
                comments: this.comments,
                screenshotCount: this.screenshotStore.size,
                updateAvailable: this.updateInfo,
              },
            })
          );
        });

        console.log(
          `[agent-hover] Bridge server running on http://localhost:${this.port}`
        );
        console.log(
          `[agent-hover] Project root: ${this.projectRoot}`
        );

        // Check for package updates in background without blocking startup
        this.checkForUpdates();

        resolve(this.port);
      };

      server.once('error', errorHandler);
      server.once('listening', listenHandler);
      server.listen(this.port, '127.0.0.1');
    });
  }

  private isNewerVersion(remote: string, local: string): boolean {
    const r = remote.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const l = local.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

  private checkForUpdates() {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return;
    }
    import('https').then((https) => {
      const req = https.get(
        'https://registry.npmjs.org/@agent-hover/vite/latest',
        {
          timeout: 2500,
          headers: { 'User-Agent': 'agent-hover/' + this.CURRENT_VERSION },
        },
        (res) => {
          if (res.statusCode !== 200) return;
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const pkg = JSON.parse(data);
              const latest = pkg.version;
              if (latest && this.isNewerVersion(latest, this.CURRENT_VERSION)) {
                this.updateInfo = { current: this.CURRENT_VERSION, latest };
                console.log(
                  `\n  \x1b[36m[agent-hover]\x1b[0m 💡 \x1b[1mUpdate available:\x1b[0m ${this.CURRENT_VERSION} → \x1b[32m${latest}\x1b[0m`
                );
                console.log(
                  `  \x1b[36m[agent-hover]\x1b[0m Run: \x1b[33mnpm i -D @agent-hover/vite@latest\x1b[0m to update\n`
                );
                this.broadcast({
                  type: 'update-available',
                  data: this.updateInfo,
                });
              }
            } catch {}
          });
        }
      );
      req.on('error', () => {});
      req.on('timeout', () => { req.destroy(); });
    }).catch(() => {});
  }

  public async stop(): Promise<void> {
    console.log('[agent-hover] Stopping bridge server...');
    this.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {}
    });
    this.clients.clear();

    if (this.wss) {
      await new Promise<void>((res) => this.wss!.close(() => res()));
      this.wss = null;
    }

    if (this.httpServer) {
      try {
        if (typeof (this.httpServer as any).closeAllConnections === 'function') {
          (this.httpServer as any).closeAllConnections();
        }
      } catch {}
      if (this.httpServer.listening) {
        await new Promise<void>((res) => this.httpServer!.close(() => res()));
      }
      this.httpServer = null;
    }
  }

  private broadcast(msg: { type: string; data?: any }) {
    const data = JSON.stringify(msg);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private broadcastState() {
    const data = JSON.stringify({
      type: 'state-update',
      data: {
        pins: this.pins,
        frozenEntries: this.frozenEntries,
        comments: this.comments,
        screenshotCount: this.screenshotStore.size,
        updateAvailable: this.updateInfo,
      },
    });
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
