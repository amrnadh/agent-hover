import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import componentPointer from '@component-pointer/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    componentPointer(),
  ],
});
