import { defineConfig, devices } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';

// Two fixtures run the same app (Sorrel): the Vite demo and the Next.js demo (its src/ copied from demo/).
// AH_DEMO_DIR runs the Vite projects against a copy of the demo (scripts/e2e-isolated.mjs); otherwise demo/ itself.
// AH_NEXT_DIR adds the Next.js project, against a prepared copy (scripts/e2e-isolated.mjs --fixture=next).
// AH_FIXTURE=next leaves the Vite projects out.
const demoDir = process.env.AH_DEMO_DIR;
const nextDir = process.env.AH_NEXT_DIR;
const withVite = process.env.AH_FIXTURE !== 'next';
const port = Number(process.env.AH_E2E_PORT || 5173);
const nextPort = Number(process.env.AH_NEXT_PORT || 3175);
const viteBin = path.join(path.dirname(createRequire(path.resolve('demo/package.json')).resolve('vite/package.json')), 'bin/vite.js');
const nextBin = path.join(path.dirname(createRequire(path.resolve('demo-next/package.json')).resolve('next/package.json')), 'dist/bin/next');

/** The user flows that also run in Firefox and WebKit (Safari's engine). */
const USER_FLOWS = /v02-(main-flow|dock-sidebar|comments-batch|verify|mcp-agent|source|voice)\.spec\.ts|v03-(place|talk|scope-errors)\.spec\.ts/;
/** What the Next.js demo runs: the user flows plus source lookup, tasks and the agent loop (screenshots and media stay on Vite). */
const NEXT_FLOWS = /v02-(main-flow|dock-sidebar|comments-batch|verify|mcp-agent|source|task-flow|a11y)\.spec\.ts|v03-(place|talk|scope-errors)\.spec\.ts|demo-scenes\.spec\.ts/;

const env = { AGENT_HOVER_NO_UPDATE_CHECK: '1', NEXT_TELEMETRY_DISABLED: '1' };

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    ...(withVite
      ? [{
          command: `node ${JSON.stringify(viteBin)} --port ${port} --strictPort`,
          cwd: demoDir || path.resolve('demo'),
          port,
          reuseExistingServer: !process.env.CI && !demoDir,
          timeout: 90000,
          env,
        }]
      : []),
    ...(nextDir
      ? [{
          // AH_NEXT_WEBPACK=1 runs it with webpack instead of Turbopack.
          command: `node ${JSON.stringify(nextBin)} dev --port ${nextPort}${process.env.AH_NEXT_WEBPACK ? ' --webpack' : ''}`,
          cwd: nextDir,
          // A request, not just the open port: webpack runs instrumentation.ts (which starts the bridge) on the first
          // request, and the first page compile is slow.
          url: `http://localhost:${nextPort}/`,
          reuseExistingServer: false,
          timeout: 120000,
          env,
        }]
      : []),
  ],
  projects: [
    ...(withVite
      ? [
          {
            name: 'chromium',
            metadata: { demoDir: demoDir || path.resolve('demo') },
            use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}` },
          },
          // AH_BROWSERS=all also runs the user flows in Firefox and WebKit.
          ...(process.env.AH_BROWSERS === 'all'
            ? (['firefox', 'webkit'] as const).map((name) => ({
                name,
                metadata: { demoDir: demoDir || path.resolve('demo') },
                use: { ...devices[name === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'], baseURL: `http://localhost:${port}` },
                testMatch: USER_FLOWS,
              }))
            : []),
        ]
      : []),
    ...(nextDir
      ? [
          {
            name: 'next',
            metadata: { demoDir: nextDir, framework: 'next' },
            use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${nextPort}` },
            testMatch: NEXT_FLOWS,
          },
        ]
      : []),
  ],
});
