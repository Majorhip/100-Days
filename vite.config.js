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
  }
});
