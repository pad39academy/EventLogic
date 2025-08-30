import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Set the root to the 'client' directory
  root: 'client',
  plugins: [react()],
  resolve: {
    alias: {
      // The alias paths are relative to the project root, so they remain the same.
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  build: {
    // The output directory is relative to the root, so we need to go up one level.
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  }
})