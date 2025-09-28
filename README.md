# 🧲 Real-Debrid Manager

A modern, powerful browser extension for seamlessly managing your Real-Debrid downloads and torrents. Built with Svelte 5 and featuring a clean, intuitive interface with advanced functionality for power users.

![Real-Debrid Manager Screenshot](screenshot.png)

<video src="demo.mp4" controls muted loop playsinline style="max-width: 100%; border-radius: 12px; margin-top: 1rem;">
  Sorry, your browser doesn't support embedded videos. You can download the demo instead.
</video>

> ✨ **Enhanced with toast notifications, context menu integration, and smart error handling**

## ✨ Features

### 🎛️ **Dashboard & Account Management**
- **Live Account Snapshot**: Premium status, points balance, and remaining premium days
- **API Key Validation**: Keys are verified against Real-Debrid before being stored locally
- **Smart Caching**: Account data is cached per-session and refreshed on demand

### 🧲 **Advanced Torrent Management**
- **Universal Magnet Support**: Send magnets from the popup, context menu, or clipboard
- **Granular File Selection**: Pick the exact files to download with size totals and bulk toggles
- **Bulk Actions**: Multi-select torrents for batched deletion with confirmation safeguards
- **Link Utilities**: Copy or launch unrestricted links individually or in bulk
- **Status Tracking**: Visual queue for downloading, processing, errors, and completed items

### 🚀 **Enhanced User Experience**
- **Persistent Toasts**: Success and error notifications stay visible—even over modals
- **Guided Onboarding**: Empty-state messaging explains how to add an API key
- **Context Menu Integration**: Right-click magnet links, selections, or use the clipboard helper
- **Auto-refresh**: Torrent lists refresh as soon as magnets are added
- **Modern UI**: Dark, responsive layout with animated highlights and keyboard-friendly controls

### 🛠️ **Developer Features**
- **TypeScript + Svelte 5 runes** for safe, expressive components
- **WXT Tooling** with hot reload for Chrome and Firefox targets
- **ESLint, Prettier, and svelte-check** wired into scripts for consistent quality

## 🛠️ How to Use Context Menu Integration

The extension provides **three ways** to add magnet links from any website:

### Method 1: Direct Link Right-click
```
Right-click on any magnet link → "Add magnet link to Real-Debrid"
```

### Method 2: Copy & Paste from Clipboard  
```
1. Copy magnet link (Ctrl+C)
2. Right-click anywhere on page → "Add magnet from clipboard"
```

### Method 3: Select Text & Right-click
```
1. Highlight the magnet link text
2. Right-click → "Add magnet link to Real-Debrid"  
```

> 💡 **Pro Tip**: If one method doesn't work due to website restrictions, try another method!

## 💻 Technology Stack

- **Frontend**: Svelte 5 with TypeScript
- **Build Tool**: WXT Framework (modern WebExtension tooling)
- **Styling**: Bulma CSS + Custom SCSS
- **Icons**: Font Awesome 6
- **Storage**: Browser Storage API with caching
- **Notifications**: Custom toast system + browser notifications

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Latest LTS recommended)
- npm, yarn, or pnpm
- Chrome/Chromium or Firefox browser
- [Real-Debrid account](https://real-debrid.com) with API key

### 🎯 Browser Support
| Browser | Version | Status |
|---------|---------|--------|
| **Chrome/Chromium** | 88+ | ✅ Full Support |
| **Firefox** | 89+ | ✅ Full Support |
| **Edge** | 88+ | ✅ Full Support |

### 📦 Installation

```bash
# Clone the repository
git clone https://github.com/staticallydynamic/real-debrid-manager.git
cd real-debrid-manager

# Install dependencies
npm install

# Start a dev build (Chrome target by default)
npm run dev

# Or target Firefox during development
npm run dev:firefox

# Build the extension for release when you're ready
npm run build
```

The dev server prints a URL where you can install the temporary extension during development.

Production builds land in `.output/chrome-mv3/` (and `.output/firefox-mv2/` if you run `npm run build:firefox`).

### 🔧 Setup

1. **Get your API Key**: Visit [real-debrid.com/apitoken](https://real-debrid.com/apitoken)
2. **Load the extension**:
   - Chrome: Go to `chrome://extensions/` → Enable Developer mode → Load unpacked → Select `.output/chrome-mv3/`
   - Firefox: Go to `about:debugging` → This Firefox → Load Temporary Add-on → Select `manifest.json`
3. **Configure**: Click extension icon → Settings → Enter API key → Save

## 👨‍💻 Development

```bash
# Start development server with hot reload
npm run dev

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Build for production
npm run build
```

### 🛠️ Development Tools
- **Hot Reload**: Automatic extension reloading during development
- **TypeScript**: Full type checking with `svelte-check`
- **ESLint + Prettier**: Code formatting and linting
- **WXT Framework**: Modern WebExtension development with Vite

## 🚀 Release & Versioning

Versioning is single‑sourced from `package.json`. The extension manifest reads this value at build time, and the popup footer displays it dynamically.

Recommended flow:

1) Code
- Develop and test: `npm run dev` (Chrome) or `npm run dev:firefox` (Firefox)

2) Bump
- Choose a semantic version bump and run one of:
  - Patch: `npm run bump:patch`
  - Minor: `npm run bump:minor`
  - Major: `npm run bump:major`

3) Build
- Build both targets: `npm run build:all`

4) Package
- Create upload zips:
  - Chrome: `npm run zip`
  - Firefox: `npm run zip:firefox`

5) Verify
- Load the build locally and confirm the footer shows the new `vX.Y.Z`.

6) Publish
- Upload the generated zips to the Chrome Web Store and Firefox Add‑ons.

Notes:
- The manifest version comes from `package.json`; no manual edits required.
- Both stores require strictly increasing versions.
- `npm version` creates a git commit and tag by default; adjust flags if you prefer otherwise.

## 🏗️ Architecture

```
src/
├── entrypoints/           # Extension entry points
│   ├── background.ts      # Service worker (context menus, notifications)
│   └── popup/            # Extension popup
├── lib/
│   ├── components/       # Svelte 5 components
│   │   ├── AddMagnet.svelte
│   │   ├── TorrentManager.svelte
│   │   ├── Toast.svelte
│   │   └── ToastContainer.svelte
│   └── shared/          # Shared utilities
│       ├── RealDebridAPI.ts    # API client
│       ├── StorageManager.ts   # Storage abstraction
│       ├── toastManager.ts     # Toast notifications
│       ├── types.ts           # TypeScript definitions
│       └── constants.ts       # App constants
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines
- **TypeScript**: Use proper typing for all code
- **Svelte 5**: Follow modern Svelte patterns with runes
- **Error Handling**: Implement comprehensive error boundaries
- **Testing**: Add tests for new functionality
- **Documentation**: Update README for new features

## 📚 Resources

- **[Real-Debrid API Documentation](https://api.real-debrid.com/)** - Official API reference
- **[WXT Framework](https://wxt.dev/)** - Modern WebExtension development
- **[Svelte 5 Documentation](https://svelte.dev/)** - Frontend framework

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Real-Debrid](https://real-debrid.com)** - Premium link generation service
- **[Svelte Team](https://svelte.dev)** - Amazing reactive framework  
- **[WXT](https://wxt.dev)** - Modern extension development toolkit
- **[Bulma](https://bulma.io)** - Modern CSS framework

## 💬 Support

- 🐛 **Found a bug?** [Open an issue](https://github.com/staticallydynamic/real-debrid-manager/issues)
- 💡 **Feature request?** [Create a discussion](https://github.com/staticallydynamic/real-debrid-manager/discussions)
- 📧 **Questions?** Check existing issues first, then open a new one

---

<div align="center">
  <strong>Made with ❤️ for the Real-Debrid community by supamerz</strong><br>
  ⭐ Star this repo if you find it useful!
</div>
