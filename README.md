# Real-Debrid Manager

A powerful browser extension for managing your Real-Debrid downloads and torrents. This extension provides a clean, intuitive interface for interacting with the Real-Debrid API, making it easier to manage your downloads and torrents directly from your browser.

![Real-Debrid Manager Screenshot](placeholder-for-screenshot.png)

## Features

- **User Dashboard**: View your Real-Debrid account information including:
  - Premium status and days remaining
  - Points balance
  - Account type
  
- **Torrent Management**:
  - Add new magnet links
  - View active torrents
  - Select files from torrents for downloading
  - Get unrestricted download links
  - Delete unwanted torrents
  
- **Smart Caching**: Implements efficient caching system for API responses to reduce API calls and improve performance
- **Secure API Key Management**: Safely store and manage your Real-Debrid API key
- **Modern UI**: Clean, responsive interface built with Svelte and Bulma CSS framework

## Technology Stack

- **Frontend Framework**: Svelte
- **Styling**: Bulma CSS & Custom CSS
- **Icons**: Font Awesome
- **Storage**: Chrome Storage API
- **API Integration**: Real-Debrid REST API v1.0

## Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn
- Chrome/Chromium-based browser
- Real-Debrid account and API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/staticallydynamic/real-debrid-manager.git
cd real-debrid-manager
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory from your build

### Configuration

1. Get your Real-Debrid API key from [real-debrid.com/apitoken](https://real-debrid.com/apitoken)
2. Click the extension icon in your browser
3. Click the Settings button
4. Enter your API key and save

## Development

To start development server:

```bash
npm run dev
```

The project uses the following structure:

```
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── AddMagnet.svelte
│   │   │   ├── ApiKeyInput.svelte
│   │   │   └── TorrentManager.svelte
│   │   └── shared/
│   │       ├── CacheManager.ts
│   │       └── types.ts
│   ├── App.svelte
│   ├── app.css
│   ├── index.html
│   └── main.ts
```

## Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Style Guidelines

- Use TypeScript for type safety
- Follow Svelte best practices
- Use Bulma classes for layout and basic styling
- Add custom styles within Svelte components using `<style>` tags
- Implement proper error handling and loading states

## API Documentation

This project uses the Real-Debrid API v1.0. Full API documentation can be found in the [official Real-Debrid API documentation](https://api.real-debrid.com/).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Real-Debrid for providing the API
- Svelte team for the excellent framework
- Bulma team for the CSS framework
- Font Awesome for the icons

## Support

If you encounter any issues or have questions, please:

1. Check the [issues page](https://github.com/staticallydynamic/real-debrid-manager/issues)
2. Open a new issue if your problem hasn't been reported
3. Provide detailed information about your problem including steps to reproduce

---

Made with ❤️ by supamerz