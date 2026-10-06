import { BridgeServer } from '../../bridge-server.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface TestBridgeInstance {
  server: BridgeServer;
  port: number;
  baseUrl: string;
  wsUrl: string;
  projectRoot: string;
  cleanup: () => Promise<void>;
}

export interface CreateBridgeOptions {
  port?: number;
  customProjectRoot?: string;
  suppressLogs?: boolean;
}

/**
 * Creates and starts a BridgeServer instance on an ephemeral dynamic port (port 0).
 * Isolates all filesystem storage to a unique temporary directory.
 */
export async function createTestBridge(options: CreateBridgeOptions = {}): Promise<TestBridgeInstance> {
  const projectRoot = options.customProjectRoot ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'ah-bridge-test-')));

  // Use port 0 by default for dynamic OS allocation
  const requestedPort = options.port ?? 0;
  const server = new BridgeServer(projectRoot, requestedPort);

  const port = await server.start();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}`;

  return {
    server,
    port,
    baseUrl,
    wsUrl,
    projectRoot,
    cleanup: async () => {
      try {
        await server.stop();
      } catch (err) {
        console.error('Error stopping test bridge:', err);
      }
      try {
        await fs.rm(projectRoot, { recursive: true, force: true });
      } catch {}
    },
  };
}
