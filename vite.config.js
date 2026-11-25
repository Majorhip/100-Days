import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds everything into one dist/index.html that Caspar can double-click.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    // Keep the CSS exactly as written: the migration must not change how anything looks.
    cssMinify: false,
    // The game file is ~1 MB by design (three.js is embedded until Phase 3).
    chunkSizeWarningLimit: 2000
  },
  // Vitest (npm test). Browser-based tests drive dist/index.html in headless Chrome, so give
  // them time; they run one file at a time so the PC's graphics card isn't shared.
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    testTimeout: 300000,
    hookTimeout: 300000,
    fileParallelism: false
  }
});
