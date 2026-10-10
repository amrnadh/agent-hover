import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import { launchEditorSafely } from './editor-launcher.js';
import { validateSafePath } from './path-validator.js';
import { TaskStore } from './task-store.js';
import path from 'path';
import fs from 'fs/promises';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import {
  ContextBuilder,
  RelationshipResolver,
  formatContextMarkdown,
  formatPinSetMarkdown,
  formatTaskContext,
  formatTaskMarkdown,
  SourceEditor,
  generateSessionToken,
  writeSessionFile,
  removeSessionFile,
  getSessionFilePath,
  BRAND,
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
  ElementComment,
  AgentTask,
  TaskStatus,
  BridgeSession,
} from '@agent-hover/core';

export function isSafeHost(hostHeader: string): boolean {
  if (!hostHeader) return false;
  const [hostname] = hostHeader.split(':');
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function isSafeOrigin(originHeader?: string): boolean {
  if (!originHeader) return true;
  try {
    const parsed = new URL(originHeader);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

export class BridgeServer {
  private app: express.Express;
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private projectRoot: string;
  private port: number;
  private initialPort: number;
  private token: string;
  private startedAt: string = '';
  private taskStore: TaskStore;
  private agentPresence: Map<string, { client: string; version?: string; lastSeen: number }> = new Map();
  private cleanupExitHandler?: () => void;
  private lastMcpHello = 0;
  private latestAgentTask: any = null;

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

  constructor(projectRoot: string, port: number = 9850, options?: { token?: string }) {
    this.projectRoot = projectRoot;
    this.port = port;
    this.initialPort = port;
    this.token = options?.token || generateSessionToken();
    this.taskStore = new TaskStore(projectRoot);
    this.app = express();

    this.contextBuilder = new ContextBuilder(projectRoot);
    this.relationshipResolver = new RelationshipResolver(projectRoot);
    this.sourceEditor = new SourceEditor(projectRoot);

    this.setupTaskStoreListeners();
    this.loadComments();
    this.setupRoutes();
  }

  public getToken(): string {
    return this.token;
  }

  public getSession(): BridgeSession {
    return {
      version: 1,
      port: this.port,
      token: this.token,
      pid: process.pid,
      projectRoot: this.projectRoot,
      startedAt: this.startedAt,
    };
  }

  public getTaskStore(): TaskStore {
    return this.taskStore;
  }

  private setupTaskStoreListeners() {
    this.taskStore.on('task:created', (task: AgentTask) => {
      this.broadcast({ type: 'task.created', data: task });
      this.broadcast({ type: 'agent-task-dispatched', data: task });
    });
    this.taskStore.on('task:updated', (task: AgentTask) => {
      this.broadcast({ type: 'task.updated', data: task });
    });
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
    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || isSafeOrigin(origin)) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
        allowedHeaders: ['Content-Type', 'Authorization', 'X-AH-Token'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
      })
    );
    this.app.use(express.json({ limit: '10mb' }));

    // Security: strict localhost validation on Host, Origin, and Token (P1-02)
    this.app.use((req, res, next) => {
      const host = req.headers.host || '';
      const origin = req.headers.origin;

      if (!isSafeHost(host)) {
        res.status(403).json({ error: 'Forbidden: invalid host header' });
        return;
      }

      if (req.method === 'OPTIONS') {
        next();
        return;
      }

      if (origin && !isSafeOrigin(origin)) {
        res.status(403).json({ error: 'Forbidden: untrusted origin' });
        return;
      }

      if (req.path === '/api/health' && req.method === 'GET') {
        next();
        return;
      }

      const authHeader = req.headers.authorization || req.headers['x-ah-token'];
      let token: string | undefined;
      if (typeof authHeader === 'string') {
        token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
      }

      if (!token || token !== this.token) {
        res.status(401).json({ error: 'Unauthorized: invalid or missing session token' });
        return;
      }

      next();
    });

    // Health check (public)
    this.app.get('/api/health', (_req, res) => {
      res.json({
        ok: true,
        status: 'ok',
        version: this.CURRENT_VERSION,
        port: this.port,
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

        let safeFile: string;
        try {
          safeFile = validateSafePath(file, this.projectRoot);
        } catch (err: any) {
          res.status(403).json({ error: err.message });
          return;
        }

        const context = await this.contextBuilder.getContext(
          safeFile,
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
          let safeFile: string;
          try {
            safeFile = validateSafePath(file, this.projectRoot);
          } catch (err: any) {
            res.status(403).json({ error: err.message });
            return;
          }
          const pinId = id || `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const existing = id ? this.pins.find((p) => p.id === id) : null;
          if (existing) {
            if (task !== undefined) existing.task = task;
          } else {
            const context = await this.contextBuilder.getContext(
              safeFile,
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

    // Open screenshots folder in system file manager (no shell, confined to project)
    this.app.post('/api/screenshot/open-folder', async (_req, res) => {
      try {
        const path = await import('path');
        const fs = await import('fs/promises');
        const screenshotsDir = path.join(this.projectRoot, '.agent-hover', 'screenshots');
        await fs.mkdir(screenshotsDir, { recursive: true });
        const { launchFolderSafely } = await import('./editor-launcher.js');
        await launchFolderSafely(screenshotsDir, this.projectRoot);
        res.json({ success: true, path: '.agent-hover/screenshots' });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to open screenshots folder';
        res.status(500).json({ error: message });
      }
    });

    // Download/serve screenshot file
    this.app.get('/api/screenshot/download/:filename', async (req, res) => {
      try {
        const path = await import('path');
        const filename = path.basename(req.params.filename);
        const screenshotsDir = path.join(this.projectRoot, '.agent-hover', 'screenshots');
        const safePath = validateSafePath(path.join(screenshotsDir, filename), this.projectRoot);
        res.download(safePath, filename);
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

    // Presence endpoints (P1-06)
    this.app.post('/api/agent/presence', (req, res) => {
      const { client = 'agent', version } = req.body || {};
      this.agentPresence.set(client, { client, version, lastSeen: Date.now() });
      this.lastMcpHello = Date.now();
      this.broadcastPresence();
      res.json({ ok: true, registered: true });
    });

    this.app.get('/api/agent/presence', (_req, res) => {
      this.prunePresence();
      const agents = Array.from(this.agentPresence.values()).map((a) => ({
        client: a.client,
        version: a.version,
        lastSeen: new Date(a.lastSeen).toISOString(),
      }));
      res.json({ agents, connected: agents.length > 0 });
    });

    // Legacy MCP heartbeat
    this.app.post('/api/mcp/hello', (_req, res) => {
      this.lastMcpHello = Date.now();
      this.agentPresence.set('mcp-client', { client: 'mcp-client', lastSeen: Date.now() });
      this.broadcastPresence();
      res.json({ ok: true });
    });

    this.app.get('/api/mcp-status', (_req, res) => {
      this.prunePresence();
      const connected = (Date.now() - this.lastMcpHello) < 30000 || this.agentPresence.size > 0;
      res.json({ connected, lastSeen: this.lastMcpHello > 0 ? new Date(this.lastMcpHello).toISOString() : null });
    });

    // --- Task Queue Endpoints (P1-04) ---

    // Create task (POST /api/agent/tasks)
    this.app.post('/api/agent/tasks', async (req, res) => {
      try {
        const task = await this.taskStore.createTask(req.body);
        this.latestAgentTask = task;
        res.status(201).json({ task });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    // List tasks (GET /api/agent/tasks). Agents pass ?deliver=1 so returned queued tasks are marked
    // delivered ("Seen by …" in the overlay); overlay reads omit it and never change task state.
    this.app.get('/api/agent/tasks', async (req, res) => {
      const statusParam = req.query.status as string;
      const limitParam = parseInt(req.query.limit as string, 10) || 50;
      const statusFilter = statusParam
        ? (statusParam.split(',').map((s) => s.trim()) as TaskStatus[])
        : undefined;
      let tasks = this.taskStore.listTasks({ status: statusFilter, limit: limitParam });
      if (req.query.deliver === '1') {
        tasks = await Promise.all(
          tasks.map((t) => (t.status === 'queued' ? this.taskStore.markDelivered(t.id) : t)),
        );
      }
      res.json({ tasks });
    });

    // Listen mode: long-poll for the oldest queued task (GET /api/agent/tasks/next?wait=<seconds>).
    // Returns immediately when a task is queued, otherwise holds the request until one arrives or
    // `wait` (max 30 s) elapses. The returned task is marked delivered.
    // Registered before /api/agent/tasks/:id so "next" is not treated as an id.
    this.app.get('/api/agent/tasks/next', async (req, res) => {
      const waitSeconds = Math.min(Math.max(parseInt(req.query.wait as string, 10) || 0, 0), 30);

      const takeOldestQueued = async () => {
        const queued = this.taskStore.listTasks({ status: ['queued'] });
        const oldest = queued[queued.length - 1];
        return oldest ? this.taskStore.markDelivered(oldest.id) : null;
      };

      const ready = await takeOldestQueued();
      if (ready || waitSeconds === 0) {
        res.json({ task: ready, timedOut: !ready });
        return;
      }

      let settled = false;
      const finish = async (task: AgentTask | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.taskStore.off('task:created', onCreated);
        res.off('close', onClose);
        if (!res.writableEnded) res.json({ task, timedOut: !task });
      };
      const onCreated = () => {
        takeOldestQueued().then((task) => { if (task) finish(task); }).catch(() => {});
      };
      const onClose = () => {
        // Client went away (e.g. the agent's tool call was cancelled): stop listening, deliver nothing.
        settled = true;
        clearTimeout(timer);
        this.taskStore.off('task:created', onCreated);
      };
      const timer = setTimeout(() => finish(null), waitSeconds * 1000);
      this.taskStore.on('task:created', onCreated);
      res.on('close', onClose);
      // Re-check once after subscribing, in case a task was queued while we were setting up.
      onCreated();
    });

    // Get task + rendered prompt (GET /api/agent/tasks/:id)
    this.app.get('/api/agent/tasks/:id', (req, res) => {
      const task = this.taskStore.getTask(req.params.id);
      if (!task) {
        res.status(404).json({ error: `Task '${req.params.id}' not found` });
        return;
      }
      const format = (req.query.format as 'compact' | 'standard' | 'deep') || 'standard';
      const prompt = formatTaskMarkdown(task, format);
      res.json({ task, prompt });
    });

    // Claim task (POST /api/agent/tasks/:id/claim)
    this.app.post('/api/agent/tasks/:id/claim', async (req, res) => {
      try {
        const client = req.body?.client || 'agent';
        const task = await this.taskStore.claimTask(req.params.id, { client });
        res.json({ task });
      } catch (err: any) {
        res.status(409).json({ error: err.message });
      }
    });

    // Complete task (POST /api/agent/tasks/:id/complete)
    this.app.post('/api/agent/tasks/:id/complete', async (req, res) => {
      try {
        const { status = 'done', summary, filesChanged, error } = req.body || {};
        const task = await this.taskStore.completeTask(req.params.id, {
          status,
          summary,
          filesChanged,
          error,
        });
        res.json({ task });
      } catch (err: any) {
        res.status(409).json({ error: err.message });
      }
    });

    // Cancel task (POST /api/agent/tasks/:id/cancel)
    this.app.post('/api/agent/tasks/:id/cancel', async (req, res) => {
      try {
        const task = await this.taskStore.cancelTask(req.params.id);
        res.json({ task });
      } catch (err: any) {
        res.status(409).json({ error: err.message });
      }
    });

    // Send task/context to AI Agent (Legacy shim)
    this.app.post('/api/agent/send', async (req, res) => {
      const taskBody = req.body || {};
      const task = await this.taskStore.createTask({
        type: taskBody.type || 'component-context',
        instruction: taskBody.goal || taskBody.instruction || taskBody.title || taskBody.component,
        target: {
          component: taskBody.component,
          file: taskBody.file,
          lineStart: taskBody.line,
        },
        payload: {
          prompt: taskBody.prompt,
          goal: taskBody.goal,
          pins: taskBody.pins,
        },
      });
      this.latestAgentTask = task;
      console.log(`[agent-hover] 🤖 Task sent to agent: "${taskBody.component || taskBody.title || 'Component context'}"`);
      res.json({ ok: true, task: this.latestAgentTask });
    });

    // Legacy latest task shim
    this.app.get('/api/agent/latest', (_req, res) => {
      const task = this.latestAgentTask || this.taskStore.listTasks({ limit: 1 })[0] || null;
      res.json({ task });
    });

    // Open in editor
    this.app.post('/api/open-editor', async (req, res) => {
      try {
        const { file, line, text, component, editor } = req.body;
        const fg = await import('fast-glob');
        const path = await import('path');

        let targetFile: string | null = null;
        if (file) {
          try {
            targetFile = validateSafePath(file, this.projectRoot);
          } catch (err: any) {
            res.status(403).json({ error: err.message });
            return;
          }
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

    // Get component source slice (POST /api/source) (P1-05 / §7.6)
    this.app.post('/api/source', async (req, res) => {
      try {
        const { file, lineStart, lineEnd } = req.body || {};
        if (!file) {
          res.status(400).json({ error: 'Missing required parameter: file' });
          return;
        }
        let safePath: string;
        try {
          safePath = validateSafePath(file, this.projectRoot, { maxSizeBytes: 5 * 1024 * 1024 });
        } catch (err: any) {
          res.status(403).json({ error: err.message });
          return;
        }

        const fullPath = path.join(this.projectRoot, safePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        let slice = lines;
        const start = typeof lineStart === 'number' && lineStart > 0 ? Math.max(0, lineStart - 1) : 0;
        const end = typeof lineEnd === 'number' && lineEnd >= (lineStart || 1) ? Math.min(lines.length, lineEnd) : lines.length;
        slice = lines.slice(start, end);

        res.json({
          file: safePath,
          lineStart: start + 1,
          lineEnd: end,
          totalLines: lines.length,
          source: slice.join('\n'),
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
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
        if (targetFile) {
          try {
            targetFile = validateSafePath(targetFile, this.projectRoot, { maxSizeBytes: 5 * 1024 * 1024 });
          } catch (err: any) {
            res.status(403).json({ error: err.message });
            return;
          }
        }

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

        let targetFile: string;
        try {
          targetFile = validateSafePath(file, this.projectRoot, { maxSizeBytes: 5 * 1024 * 1024 });
        } catch (err: any) {
          res.status(403).json({ error: err.message });
          return;
        }

        const result = await this.sourceEditor.saveComponentSource({
          projectRoot: this.projectRoot,
          file: targetFile,
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

      const listenHandler = async () => {
        server.removeListener('error', errorHandler);
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        this.startedAt = new Date().toISOString();

        // Write session file (0600 mode) (P1-01)
        try {
          await writeSessionFile({
            version: 1,
            port: this.port,
            token: this.token,
            pid: process.pid,
            projectRoot: this.projectRoot,
            startedAt: this.startedAt,
          });
        } catch (err) {
          console.error('[agent-hover] Failed to write session file:', err);
        }

        this.cleanupExitHandler = () => {
          try {
            const p = getSessionFilePath(this.projectRoot);
            if (existsSync(p)) {
              unlinkSync(p);
            }
          } catch {}
        };
        process.once('exit', this.cleanupExitHandler);

        const wss = new WebSocketServer({ server });
        this.wss = wss;

        wss.on('connection', (ws, req) => {
          // 1. Check Origin if present
          if (req.headers.origin && !isSafeOrigin(req.headers.origin)) {
            ws.close(4403, 'Forbidden');
            return;
          }

          // 2. Check token (query parameter or headers) (P1-02)
          const reqUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
          const tokenParam = reqUrl.searchParams.get('token');
          const authHeader = req.headers['authorization'] || req.headers['x-ah-token'] || req.headers['sec-websocket-protocol'];
          let wsToken = tokenParam;
          if (!wsToken && typeof authHeader === 'string') {
            wsToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
          }

          if (!wsToken || wsToken !== this.token) {
            ws.close(4401, 'Unauthorized');
            return;
          }

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

          // Send snapshot of tasks and current state to new connections
          ws.send(
            JSON.stringify({
              type: 'tasks.snapshot',
              data: this.taskStore.getSnapshot(),
            })
          );

          ws.send(
            JSON.stringify({
              type: 'state-update',
              data: {
                pins: this.pins,
                frozenEntries: this.frozenEntries,
                comments: this.comments,
                screenshotCount: this.screenshotStore.size,
                updateAvailable: null,
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

        resolve(this.port);
      };

      server.once('error', errorHandler);
      server.once('listening', listenHandler);
      server.listen(this.port, '127.0.0.1');
    });
  }

  public async stop(): Promise<void> {
    console.log('[agent-hover] Stopping bridge server...');

    // Clean up session file
    await removeSessionFile(this.projectRoot);
    if (this.cleanupExitHandler) {
      process.removeListener('exit', this.cleanupExitHandler);
    }

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

  private prunePresence() {
    const cutoff = Date.now() - 25000;
    for (const [key, val] of this.agentPresence.entries()) {
      if (val.lastSeen < cutoff) {
        this.agentPresence.delete(key);
      }
    }
  }

  private broadcastPresence() {
    this.prunePresence();
    const agents = Array.from(this.agentPresence.values()).map((a) => ({
      client: a.client,
      version: a.version,
      lastSeen: new Date(a.lastSeen).toISOString(),
    }));
    this.broadcast({
      type: 'presence.updated',
      data: { agents, connected: agents.length > 0 },
    });
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
