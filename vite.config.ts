import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    {
      name: 'suppress-sveltekit-warnings',
      configureServer(server) {
        const originalWarn = console.warn;
        console.warn = function (...args) {
          const msg = args[0]?.toString() || '';
          // Suppress "Avoid calling fetch" warning in SPA mode
          if (msg.includes('Avoid calling `fetch`')) return;
          originalWarn.apply(console, args);
        };
      }
    }
  ]
});
