import { StorageManager } from '@/lib/shared/StorageManager';
import { RealDebridAPI } from '@/lib/shared/RealDebridAPI';
import { REGEX } from '@/lib/shared/constants';

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });
  
  // Create context menu when extension starts
  browser.runtime.onInstalled.addListener(() => {
    createContextMenu();
  });

  // Also create context menu on startup
  createContextMenu();
  
  // Handle context menu clicks
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    let magnetLink = '';

    if (info.menuItemId === 'add-magnet-link' && info.linkUrl) {
      magnetLink = info.linkUrl;
    } else if (info.menuItemId === 'add-magnet-text' && info.selectionText) {
      magnetLink = info.selectionText.trim();
    } else if (info.menuItemId === 'add-magnet-clipboard') {
      // Try to read from clipboard
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && REGEX.MAGNET_LINK.test(clipboardText.trim())) {
          magnetLink = clipboardText.trim();
        } else {
          showNotification('warning', 'No valid magnet link found in clipboard');
          return;
        }
      } catch (error) {
        showNotification('error', 'Cannot access clipboard. Please copy a magnet link first.');
        return;
      }
    }

    // Only proceed if we have a potential magnet link
    if (magnetLink) {
      if (REGEX.MAGNET_LINK.test(magnetLink)) {
        await handleMagnetLink(magnetLink, tab);
      } else {
        // For non-magnet links, show helpful message
        if (info.menuItemId === 'add-magnet-link') {
          showNotification('warning', 'This is not a magnet link. Copy the magnet link and use "Add magnet from clipboard".');
        } else {
          showNotification('error', 'Selected text is not a valid magnet link');
        }
      }
    }
  });
});

function createContextMenu() {
  try {
    // Remove existing menu items to avoid duplicates
    browser.contextMenus.removeAll(() => {
      try {
        // Create context menu for links (all links, we'll filter in the handler)
        browser.contextMenus.create({
          id: 'add-magnet-link',
          title: 'Add magnet link to Real-Debrid',
          contexts: ['link']
        });

        // Create context menu for selected text (in case magnet link is selected as text)
        browser.contextMenus.create({
          id: 'add-magnet-text',
          title: 'Add magnet link to Real-Debrid',
          contexts: ['selection']
        });

        // Create a page context menu that will check clipboard for magnet links
        browser.contextMenus.create({
          id: 'add-magnet-clipboard',
          title: 'Add magnet from clipboard',
          contexts: ['page']
        });


        console.log('Context menus created successfully');
      } catch (error) {
        console.error('Error creating context menus:', error);
      }
    });
  } catch (error) {
    console.error('Error removing context menus:', error);
  }
}


async function handleMagnetLink(magnetLink: string, _tab?: chrome.tabs.Tab) {
  try {
    const storage = StorageManager.getInstance();
    const apiKey = await storage.getApiKey();

    if (!apiKey) {
      showNotification('warning', 'Please configure your Real-Debrid API key first');
      // Open the extension popup
      browser.action.openPopup();
      return;
    }

    // Get available hosts
    const api = new RealDebridAPI(apiKey);
    const hosts = await api.getAvailableHosts();
    
    if (hosts.length === 0) {
      showNotification('error', 'No available hosts found');
      return;
    }

    // Use the first available host
    const selectedHost = hosts[0].host;
    
    // Add magnet link
    await api.addMagnet(magnetLink, selectedHost);
    
    showNotification('success', 'Magnet link added to Real-Debrid successfully!');
  } catch (error) {
    console.error('Error adding magnet link:', error);
    showNotification('error', 'Failed to add magnet link to Real-Debrid');
  }
}

function showNotification(type: 'success' | 'error' | 'warning', message: string) {
  const iconUrl = type === 'success' ? 'icon/magnet-96.png' : 'icon/magnet-96.png';
  
  browser.notifications.create({
    type: 'basic',
    iconUrl: iconUrl,
    title: 'Real-Debrid Manager',
    message: message,
  });
}
