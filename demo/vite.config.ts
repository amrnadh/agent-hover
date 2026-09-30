import AgentHover from '@agent-hover/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), AgentHover(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // Development server configuration
      hmr: true,
      watch: {
        ignored: ['**/.agent-hover/**'],
      },
    },
  };
});
