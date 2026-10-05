import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/client.ts'),
      name: 'AgentHoverOverlay',
      formats: ['iife'],
      fileName: () => 'overlay.iife.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
  },
});
