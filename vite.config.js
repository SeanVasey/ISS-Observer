import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['three', 'globe.gl'],
          leaflet: ['leaflet', '@joergdietrich/leaflet.terminator'],
          satellite: ['satellite.js', 'suncalc']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 4173
  },
  optimizeDeps: {
    include: ['three', 'globe.gl', 'leaflet', 'satellite.js', 'suncalc']
  }
});
