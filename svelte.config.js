import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('svelte/compiler').CompileOptions} */
const config = {
  // Consult https://svelte.dev/docs/introduction#typescript-support
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  compilerOptions: {
    // enable run-time checks when not in production
    dev: process.env.NODE_ENV === 'development',
    // Enable runes mode for Svelte 5
    runes: true
  }
};

export default config;