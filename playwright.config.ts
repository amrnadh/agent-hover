import { defineConfig, devices } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';

// AH_DEMO_DIR runs the suite against a copy of the demo (scripts/e2e-isolated.mjs); otherwise demo/ itself.
const demoDir = process.env.AH_DEMO_DIR;
const port = Number(process.env.AH_E2E_PORT || 5173);
const viteBin = path.join(path.dirname(createRequire(path.resolve('demo/package.json')).resolve('vite/package.json')), 'bin/vite.js');

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
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `node ${JSON.stringify(viteBin)} --port ${port} --strictPort`,
    cwd: demoDir || path.resolve('demo'),
    port,
    reuseExistingServer: !process.env.CI && !demoDir,
    timeout: 90000,
    env: { AGENT_HOVER_NO_UPDATE_CHECK: '1' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
