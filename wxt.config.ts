import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  extensionApi: 'chrome',
  manifest: {
    icons: {
      96: 'icon/magnet-96.png',
      128: 'icon/magnet-128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: "supamerz@gmail.com",
        strict_min_version: "58.0"
      }
    },
    version: '1.0.1',
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