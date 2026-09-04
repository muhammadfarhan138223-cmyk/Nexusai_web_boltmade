import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep the heavy PDF parsing library in its own chunk so the main
          // app bundle stays small and PDFs load lazily.
          pdfjs: ['pdfjs-dist'],
          react: ['react', 'react-dom'],
          markdown: ['react-markdown', 'remark-gfm'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
