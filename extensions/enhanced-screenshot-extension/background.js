/**
 * Enhanced Screenshot Extension - Background Script
 * Automation integration for AD543 system
 */

class ScreenshotAutomationAPI {
  constructor() {
    this.activeCaptures = new Map();
    this.setupMessageHandlers();
  }

  setupMessageHandlers() {
    // Handle messages from automation system
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Indicates async response
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.source === 'content') {
        this.handleContentMessage(message, sender, sendResponse);
        return true;
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'captureWithMobileUI':
          const result = await this.captureWithMobileUI(message.options);
          sendResponse({ success: true, data: result });
          break;

        case 'configureMobileUI':
          await this.configureMobileUI(message.options);
          sendResponse({ success: true });
          break;

        case 'getScreenshotAsBuffer':
          const buffer = await this.getScreenshotAsBuffer(message.options);
          sendResponse({ success: true, data: buffer });
          break;

        case 'checkExtensionReady':
          sendResponse({ success: true, ready: true });
          break;

        case 'ad543Ready':
          this.handleAD543Ready(message.options);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleContentMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'AD543_LOADED':
          console.log('AD543 loaded on tab:', sender.tab.id);
          this.notifyAD543Ready(sender.tab.id);
          break;

        case 'AD543_PANEL_OPENED':
          console.log('AD543 panel opened on tab:', sender.tab.id);
          break;

        case 'AD543_INJECTION_COMPLETE':
          console.log('AD543 injection complete on tab:', sender.tab.id);
          this.handleAD543InjectionComplete(sender.tab.id, message.data);
          break;

        default:
          console.log('Unknown content message:', message);
      }
    } catch (error) {
      console.error('Content message handling error:', error);
    }
  }

  async captureWithMobileUI(options = {}) {
    const {
      deviceType = 'ios',
      time = null,
      url = null,
      tabId = null,
      saveToFile = false,
      returnAsBuffer = true
    } = options;

    try {
      // Get target tab
      const tab = tabId ? 
        await chrome.tabs.get(tabId) : 
        (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

      // Configure mobile UI in popup
      await this.configureMobileUIInPopup(tab.id, {
        deviceType,
        time: time || this.getCurrentTime(),
        url: url || new URL(tab.url).host
      });

      // Capture screenshot with mobile overlay
      const screenshotData = await this.captureTabWithOverlay(tab.id, deviceType);

      if (returnAsBuffer) {
        // Convert to buffer for automation system
        const base64Data = screenshotData.split(',')[1];
        return base64Data;
      } else {
        // Return data URL for display
        return screenshotData;
      }
    } catch (error) {
      console.error('Capture with mobile UI failed:', error);
      throw error;
    }
  }

  async configureMobileUI(options) {
    const { deviceType, time, url, tabId } = options;
    
    // Store configuration for when popup is opened
    await chrome.storage.local.set({
      automationConfig: {
        deviceType,
        time,
        url,
        tabId,
        timestamp: Date.now()
      }
    });

    console.log('Mobile UI configured:', options);
  }

  async configureMobileUIInPopup(tabId, config) {
    // Send configuration to popup if it's open
    try {
      await chrome.runtime.sendMessage({
        action: 'updateMobileUIConfig',
        config,
        tabId
      });
    } catch (error) {
      // Popup may not be open, store for later
      await chrome.storage.local.set({
        pendingConfig: { ...config, tabId }
      });
    }
  }

  async captureTabWithOverlay(tabId, deviceType) {
    return new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        // For now, return the base screenshot
        // In production, this would composite with mobile UI
        resolve(dataUrl);
      });
    });
  }

  async getScreenshotAsBuffer(options = {}) {
    const { tabId, deviceType = 'ios' } = options;
    
    const dataUrl = await this.captureWithMobileUI({
      ...options,
      returnAsBuffer: false
    });

    // Convert data URL to buffer
    const base64Data = dataUrl.split(',')[1];
    return base64Data;
  }

  getCurrentTime() {
    const now = new Date();
    const hours = String((now.getUTCHours() + 8) % 24).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  notifyAD543Ready(tabId) {
    // Notify automation system that AD543 is ready
    chrome.runtime.sendMessage({
      action: 'ad543Ready',
      tabId,
      timestamp: Date.now()
    }).catch(() => {
      // Automation system may not be connected
      console.log('AD543 ready notification sent for tab:', tabId);
    });
  }

  handleAD543InjectionComplete(tabId, data) {
    // Handle completion of AD543 injection
    chrome.runtime.sendMessage({
      action: 'ad543InjectionComplete',
      tabId,
      data,
      timestamp: Date.now()
    }).catch(() => {
      // Automation system may not be connected
      console.log('AD543 injection complete for tab:', tabId);
    });
  }

  handleAD543Ready(options) {
    console.log('AD543 system ready:', options);
    // Could trigger automatic screenshot capture here
  }
}

// Initialize the automation API
const screenshotAPI = new ScreenshotAutomationAPI();

// Export for external access
globalThis.screenshotAutomationAPI = screenshotAPI;

console.log('Enhanced Screenshot Extension - Background Script Loaded');