import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import {
  ContextBuilder,
  RelationshipResolver,
  formatContextMarkdown,
  formatPinSetMarkdown,
  formatTaskContext,
} from '@component-pointer/core';
import type {
  PinEntry,
  PinSet,
  ComponentContext,
  ContextLevel,
} from '@component-pointer/core';

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
        console.error('[component-pointer] Resolve error:', message);
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
        console.error('[component-pointer] Context error:', message);
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
        console.error('[component-pointer] Pin error:', message);
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
        console.error('[component-pointer] Task error:', message);
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
          console.error('[component-pointer] WS error:', error);
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
        `[component-pointer] Bridge server running on http://localhost:${this.port}`
      );
      console.log(
        `[component-pointer] Project root: ${this.projectRoot}`
      );
    });
  }

  public stop() {
    console.log('[component-pointer] Stopping bridge server...');
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
