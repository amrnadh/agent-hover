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
} from '@agent-hover/core';
import type {
  PinEntry,
  PinSet,
  ComponentContext,
  ContextLevel,
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

  private setupRoutes() {
    this.app.use(cors());
    this.app.use(express.json());

    // Health check
    this.app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', version: '0.1.0' });
    });

    // Resolve component name to file + line
    this.app.post('/api/resolve', async (req, res) => {
      try {
        const { componentName } = req.body;
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
          // Found by filename match — find the component declaration line
          const filePath = files[0];
          const fs = await import('fs/promises');
          const path = await import('path');
          const content = await fs.readFile(
            path.join(this.projectRoot, filePath),
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
          res.json({ file: filePath, line, resolved: true });
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

        this.broadcastPins();
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
          updatedPins.push({ id: context.id, context });
        }

        const pinSet = {
          ...this.getPinSet(),
          pins: updatedPins,
        };

        const taskContext = formatTaskContext(pinSet, instruction);
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

      // Send current pin state to new connections
      ws.send(
        JSON.stringify({
          type: 'pins-update',
          data: { pins: this.pins },
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

  private broadcastPins() {
    const data = JSON.stringify({
      type: 'pins-update',
      data: { pins: this.pins },
    });
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
