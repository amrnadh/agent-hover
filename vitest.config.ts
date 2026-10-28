import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/src/__tests__/**/*.test.ts'],
    testTimeout: 15000,
    // Bridges started by tests list themselves here, not in your own ~/.agent-hover.
    env: { AGENT_HOVER_HOME: path.join(os.tmpdir(), `ah-vitest-home-${process.pid}`) },
  },
});
