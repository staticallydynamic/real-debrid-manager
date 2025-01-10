import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  extensionApi: 'chrome',
  manifest: {
    browser_specific_settings: {
      gecko: {
        id: "supamerz@gmail.com",
        strict_min_version: "58.0"
      }
    },
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