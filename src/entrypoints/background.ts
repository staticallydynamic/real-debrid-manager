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
    } else if (info.menuItemId === 'add-magnet-general') {
      // For general page context, prompt user to enter magnet link
      showNotification('warning', 'Right-click on magnet links or copy magnet link text and select it');
      return;
    }

    if (magnetLink && REGEX.MAGNET_LINK.test(magnetLink)) {
      await handleMagnetLink(magnetLink, tab);
    } else {
      // Show error notification
      showNotification('error', 'Invalid magnet link selected');
    }
  });
});

function createContextMenu() {
  try {
    // Remove existing menu items to avoid duplicates
    browser.contextMenus.removeAll(() => {
      try {
        // Create context menu for links
        browser.contextMenus.create({
          id: 'add-magnet-link',
          title: 'Add magnet link to Real-Debrid',
          contexts: ['link'],
          targetUrlPatterns: ['magnet:*']
        });

        // Create context menu for selected text (in case magnet link is selected as text)
        browser.contextMenus.create({
          id: 'add-magnet-text',
          title: 'Add magnet link to Real-Debrid',
          contexts: ['selection']
        });

        // Create a general context menu for all pages as fallback
        browser.contextMenus.create({
          id: 'add-magnet-general',
          title: 'Add magnet link to Real-Debrid',
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
