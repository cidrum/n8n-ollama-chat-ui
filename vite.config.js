import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";
import legacy from '@vitejs/plugin-legacy';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    legacy()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-redux'],
          'ui-components': ['react-markdown', 'react-syntax-highlighter', 'exceljs'],
          'api-libs': ['openai', 'axios']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
});
