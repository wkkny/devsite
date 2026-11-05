import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default {
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Keep React and motion in their own long-lived chunks so the app chunk stays small.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    // Vite serves no /api routes, so read the live visitor count from production.
    // Local pages only read; the function ignores counts outside production anyway.
    proxy: {
      '/api/visitors': { target: 'https://www.wkkny.tech', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
}
