import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import componentPointer from '@agent-hover/vite';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/.agent-hover/**'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    componentPointer(),
  ],
});
