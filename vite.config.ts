import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    sourcemap: false,
    // Load only the current route's critical modules first. The previously
    // emitted 35+ eager modulepreload tags flooded mobile connections and
    // could leave the React bootstrap unfinished before startup recovery.
    // Native ESM still loads every required dependency automatically.
    modulePreload: false,
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    cssCodeSplit: true,
    // Let Vite control dependency chunking. Forcing TanStack Query into a
    // vendor chunk can create eager import cycles that prevent React boot.
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', changeOrigin: true, ws: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
