import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy export libraries (jszip ~110KB, jspdf ~280KB)
          'vendor-export': ['jszip', 'jspdf'],
          // Canvas interaction libraries (@dnd-kit/core, react-zoom-pan-pinch)
          'vendor-canvas': ['@dnd-kit/core', 'react-zoom-pan-pinch'],
          // Core React libraries
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
});
