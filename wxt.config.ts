import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  extensionApi: 'chrome',
  manifest: {
    version: '1.0.0',
    permissions: ['storage'],
    host_permissions: [
      "https://api.real-debrid.com/*"
    ],
    content_security_policy: {
      "extension_pages": "script-src 'self'; object-src 'self'"
    }
  },
  modules: ['@wxt-dev/module-svelte'],
});