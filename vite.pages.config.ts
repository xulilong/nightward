import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = fileURLToPath(new URL('.', import.meta.url));
// A separate browser-only entry reuses the game without a Worker/SSR runtime.
export default defineConfig({
  root: `${root}pages`,
  base: './',
  publicDir: `${root}public`,
  plugins: [react()],
  resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: `${root}dist-pages`, emptyOutDir: true },
});
