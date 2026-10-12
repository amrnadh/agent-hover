import { defineConfig } from 'vite';
import path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  define: {
    __AH_VERSION__: JSON.stringify(pkg.version),
  },
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
